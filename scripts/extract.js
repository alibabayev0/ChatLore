// WhatsApp export (input/*.txt) -> Gemini -> faq.json (read by the Next.js app at build time)
// Zero dependencies. Node 18+.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'input');
const FAQ_FILE = path.join(ROOT, 'faq.json');
const STATE_FILE = path.join(ROOT, 'state.json');
const CACHE_DIR = path.join(ROOT, '.cache'); // one file per finished Gemini batch -> reruns resume
const WINDOW = 120;          // messages per Gemini request
const MIN_GAP_MS = 6500;     // ~9 requests/min, under free tier 10 RPM

// ---------- env ----------
function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------- parse ----------
// Android: "31.12.2023, 22:15 - Name: text"   or "12/31/23, 10:15 PM - Name: text"
// iOS:     "[31.12.23, 22:15:03] Name: text"
const HEADER = /^‎?\[?(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:[\s ]?[APap]\.?\s?[Mm]\.?)?)\]?\s*(?:-\s)?(.*)$/;
const JUNK = /(<Media omitted>|<Medya dahil edilmedi>|image omitted|video omitted|sticker omitted|audio omitted|document omitted|GIF omitted|This message was deleted|Bu mesaj silindi|You deleted this message|<This message was edited>|null)$/i;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/g;

const anon = (name) => 'U' + crypto.createHash('sha1').update(name.trim()).digest('hex').slice(0, 6);
const clean = (s) => s.replace(/[‎‏‪-‮]/g, '').replace(PHONE, '[tel]').trim();

function parseChat(text) {
  const msgs = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '');
    const h = line.match(HEADER);
    if (h) {
      const rest = h[3];
      const i = rest.indexOf(': ');
      if (i <= 0) { msgs.push(null); continue; } // system message (joined, left, encryption...) -> skip
      msgs.push({ ts: `${h[1]} ${h[2]}`, who: anon(rest.slice(0, i)), text: rest.slice(i + 2) });
    } else if (msgs.length && msgs[msgs.length - 1]) {
      msgs[msgs.length - 1].text += '\n' + line; // multiline continuation
    }
  }
  const kept = msgs
    .filter(Boolean)
    .map((m) => ({ ...m, text: clean(m.text) }))
    .filter((m) => m.text && !JUNK.test(m.text) && !m.text.includes('BEGIN:VCARD')); // shared contacts carry base64 photos
  const order = dateOrder(kept);
  return kept.map((m) => ({ ...m, date: toISODate(m.ts, order) }));
}

// Exports use the phone's locale: "11/15/25" (M/D/Y) or "15.11.25" (D/M/Y). Detect per file.
function dateOrder(msgs) {
  let dmy = false, mdy = false;
  for (const m of msgs) {
    const [a, b] = m.ts.split(/[./ -]/).map(Number);
    if (a > 12 && a < 32) dmy = true;
    if (b > 12) mdy = true;
  }
  if (dmy !== mdy) return dmy ? 'DMY' : 'MDY';
  return msgs[0]?.ts.includes('/') ? 'MDY' : 'DMY';
}

function toISODate(ts, order) {
  const p = ts.split(' ')[0].split(/[./-]/);
  let [d, mo, y] = order === 'MDY' ? [p[1], p[0], p[2]] : [p[0], p[1], p[2]];
  if (p[0].length === 4) [y, mo, d] = p; // Y-M-D
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ---------- gemini ----------
const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING' },
      answer: { type: 'STRING' },
      topic: { type: 'STRING' },
      alt: { type: 'ARRAY', items: { type: 'STRING' } },
      confidence: { type: 'NUMBER' },
      sources: { type: 'ARRAY', items: { type: 'INTEGER' } },
    },
    required: ['question', 'answer', 'topic', 'confidence', 'sources'],
  },
};

const PROMPT = `Sən WhatsApp qrup söhbətindən FAQ çıxaran köməkçisən. Qrup Milanda yaşayan azərbaycanlılar üçündür.
Aşağıdakı mesajlarda REAL cavab almış sualları tap. Cavabsız sualları, söhbət/zarafat, şəxsi məlumatları at.
Hər element üçün:
- question: ümumiləşdirilmiş, aydın sual (Azərbaycanca)
- answer: bir neçə mesajdan birləşdirilmiş faydalı, qısa cavab (Azərbaycanca). Ad, telefon, şəxsi detal YAZMA.
- topic: qısa mövzu, bunlardan seç əgər uyğundursa: Permesso, Hərbi xidmət, Sənədlər, Təhsil, Təqaüd, Nəqliyyat, Səyahət, Ev, Bank, Səhiyyə, Telefon/İnternet, İş, Alış-veriş, Digər
- alt: sualın 2-4 alternativ yazılışı (sinonim, italyanca termin, latın hərfli variant)
- confidence: 0-1, cavabın nə qədər etibarlı olduğu
- sources: sualın və cavabın götürüldüyü mesajların #nömrələri (sual mesajı + əsas cavab mesajları, maksimum 6)
Heç nə tapmasan boş massiv qaytar.

Mesajlar (#nömrə [tarix] istifadəçi: mətn):
`;

const MAX_SOURCES = 8;

// Public snippet of a source message: no hashed IDs, no @mentions, capped length.
function toSource(m, labels) {
  if (!labels.has(m.who)) labels.set(m.who, labels.size + 1);
  const text = m.text.replace(/@\S+/g, '@…');
  return { date: m.date, time: m.ts.split(' ').slice(1).join(' '), user: labels.get(m.who), text: text.length > 400 ? text.slice(0, 400) + '…' : text };
}

function mergeSources(lists) {
  const seen = new Set();
  const all = lists.flat().filter((s) => {
    const k = s.date + s.time + s.text;
    return !seen.has(k) && seen.add(k);
  });
  return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_SOURCES); // stable: keeps chat order within a day
}

let lastCall = 0;
// Tries the main model, then the fallback (separate free quota) when Google is overloaded.
async function gemini(body) {
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-latest'])];
  for (const model of models) {
    try { return await callModel(model, body); } catch (e) {
      if (model === models.at(-1) || !e.retryable) throw e;
      console.warn(`  ! ${model} əlçatan deyil, ${models.at(-1)} ilə davam edirəm`);
    }
  }
}

async function callModel(model, body) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000), // overloaded models can hang for minutes
      });
    } catch (e) {
      console.warn(`  ! ${model}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}, retry`);
      continue;
    }
    if (res.ok) {
      const j = await res.json();
      const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '[]';
      try { return JSON.parse(txt); } catch { console.warn('  ! bad JSON, skipping window'); return []; }
    }
    if (res.status === 429 || res.status >= 500) {
      const delay = Math.min(60000, 5000 * 2 ** (attempt - 1));
      console.warn(`  ! ${res.status}, retry in ${delay / 1000}s`);
      await sleep(delay);
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  throw Object.assign(new Error(`Gemini (${model}): too many retries`), { retryable: true });
}

async function extract(windowMsgs) {
  const chat = windowMsgs.map((m, i) => `#${i + 1} [${m.date} ${m.ts.split(' ').slice(1).join(' ')}] ${m.who}: ${m.text}`).join('\n');
  const cacheFile = path.join(CACHE_DIR, crypto.createHash('sha1').update(PROMPT + chat).digest('hex').slice(0, 16) + '.json');
  let items;
  if (fs.existsSync(cacheFile)) {
    items = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    process.stdout.write('(cache) ');
  } else {
    items = await gemini({
      contents: [{ role: 'user', parts: [{ text: PROMPT + chat }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
    });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(items));
  }
  // turn message numbers into public snippets ("İstifadəçi 1: ...")
  return items.map(({ sources = [], ...it }) => {
    const labels = new Map();
    const msgs = [...new Set(sources)].sort((a, b) => a - b).map((n) => windowMsgs[n - 1]).filter(Boolean);
    return { ...it, sources: msgs.slice(0, MAX_SOURCES).map((m) => toSource(m, labels)) };
  });
}

const GROUP_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      ids: { type: 'ARRAY', items: { type: 'INTEGER' } },
      question: { type: 'STRING' },
      answer: { type: 'STRING' },
      topic: { type: 'STRING' },
      alt: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['ids', 'question', 'answer', 'topic'],
  },
};

// Gemini only returns groups of duplicates; everything else stays untouched, so nothing can get lost.
async function merge(items) {
  items = dedupeLocal(items);
  if (items.length < 2) return items;
  const list = items.map((it, i) => ({ id: i, question: it.question, answer: it.answer }));
  const text = `Aşağıdakı FAQ siyahısında EYNİ MƏNALI sualları tap (fərqli sözlərlə yazılmış eyni sual).
Hər dublikat qrupu üçün qaytar:
- ids: qrupdakı elementlərin id-ləri (ən azı 2)
- question: ən aydın ümumi sual
- answer: cavabların birləşməsi (ziddiyyət olsa daha yeni/dəqiq məlumatı saxla), qısa
- topic: Permesso, Hərbi xidmət, Sənədlər, Təhsil, Təqaüd, Nəqliyyat, Səyahət, Ev, Bank, Səhiyyə, Telefon/İnternet, İş, Alış-veriş, Digər
- alt: 2-5 alternativ yazılış
Dublikatı olmayan elementləri QAYTARMA. Dublikat yoxdursa boş massiv qaytar.

${JSON.stringify(list)}`;
  try {
    const groups = await gemini({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: GROUP_SCHEMA, temperature: 0.1 },
    });
    const used = new Set();
    const merged = [];
    for (const g of groups) {
      const ids = [...new Set(g.ids)].filter((id) => items[id] && !used.has(id));
      if (ids.length < 2) continue;
      ids.forEach((id) => used.add(id));
      const parts = ids.map((id) => items[id]);
      merged.push({
        question: g.question, answer: g.answer, topic: g.topic,
        alt: [...new Set([...(g.alt || []), ...parts.flatMap((p) => p.alt || [])])].slice(0, 8),
        confidence: Math.max(...parts.map((p) => p.confidence || 0)),
        sources: mergeSources(parts.map((p) => p.sources || [])),
      });
    }
    console.log(`  merge: ${used.size} sual → ${merged.length} birləşdirildi`);
    return [...items.filter((_, i) => !used.has(i)), ...merged];
  } catch (e) {
    console.warn('  ! Gemini merge failed (' + e.message + '), only local dedupe');
    return items;
  }
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const readJSON = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function dedupeLocal(items) {
  const map = new Map();
  for (const it of items) {
    if (!it?.question || !it?.answer) continue;
    const k = norm(it.question);
    const prev = map.get(k);
    if (!prev || (it.confidence || 0) > (prev.confidence || 0)) {
      map.set(k, { ...it, alt: [...new Set([...(prev?.alt || []), ...(it.alt || [])])], sources: mergeSources([prev?.sources || [], it.sources || []]) });
    } else {
      prev.sources = mergeSources([prev.sources || [], it.sources || []]);
    }
  }
  return [...map.values()];
}

// ---------- main ----------
module.exports = { parseChat, toSource };
if (require.main === module) (async () => {
  loadEnv();
  if (process.argv.includes('--reset')) {
    for (const f of [FAQ_FILE, STATE_FILE]) if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (!fs.existsSync(FAQ_FILE)) writeJSON(FAQ_FILE, []); // the Next.js app imports it

  const files = fs.existsSync(INPUT_DIR) ? fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.txt')) : [];
  if (!files.length) {
    return console.log(`input/ içində .txt yoxdur, Gemini addımı keçilir. faq.json: ${readJSON(FAQ_FILE, []).length} sual`);
  }
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY yoxdur (.env faylına yaz)');

  const state = readJSON(STATE_FILE, {});
  let faq = readJSON(FAQ_FILE, []);

  for (const file of files) {
    const msgs = parseChat(fs.readFileSync(path.join(INPUT_DIR, file), 'utf8'));
    // exports are always full history -> skip what we already processed (by count + last-message fingerprint)
    const prev = state[file] || { count: 0 };
    const fp = (m) => m && crypto.createHash('sha1').update(m.ts + m.text).digest('hex').slice(0, 12);
    let start = prev.count && fp(msgs[prev.count - 1]) === prev.last ? prev.count : 0;
    if (prev.count && !start) console.warn(`  ! ${file}: tarixçə dəyişib, hamısı yenidən emal olunur`);
    const fresh = msgs.slice(start);
    console.log(`${file}: ${msgs.length} mesaj, ${fresh.length} yeni`);
    if (!fresh.length) continue;

    const found = [];
    const total = Math.ceil(fresh.length / WINDOW);
    for (let i = 0; i < fresh.length; i += WINDOW) {
      // small overlap so Q/A split across windows isn't lost
      const win = fresh.slice(Math.max(0, i - 10), i + WINDOW);
      process.stdout.write(`  pəncərə ${i / WINDOW + 1}/${total}... `);
      const items = await extract(win);
      console.log(`${items.length} sual`);
      found.push(...items);
    }

    console.log(`  merge: ${faq.length} köhnə + ${found.length} yeni`);
    faq = await merge([...faq, ...found]);
    state[file] = { count: msgs.length, last: fp(msgs[msgs.length - 1]) };
    writeJSON(FAQ_FILE, faq);   // save after each file so a crash doesn't lose work
    writeJSON(STATE_FILE, state);
  }

  console.log(`\nHazırdır: faq.json (${faq.length} sual)`);
})().catch((e) => { console.error('XƏTA:', e.message); process.exit(1); });
