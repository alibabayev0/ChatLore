'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const ALL = 'Hamısı';
const TOPICS = {
  'Sənədlər':         { icon: '📄', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  'Nəqliyyat':        { icon: '🚇', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  'Ev':               { icon: '🏠', tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  'Bank':             { icon: '💳', tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  'Təhsil':           { icon: '🎓', tone: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  'İş':               { icon: '💼', tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  'Səhiyyə':          { icon: '🩺', tone: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  'Telefon/İnternet': { icon: '📱', tone: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
  'Alış-veriş':       { icon: '🛍️', tone: 'bg-pink-500/10 text-pink-700 dark:text-pink-300' },
};
const topicMeta = (t) => TOPICS[t] || { icon: '💬', tone: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300' };
const POPULAR = ['permesso', 'kod fiskal', 'metro', 'bank', 'ev'];

// Azerbaijani/Italian-aware folding: "seher" matches "şəhər", "citta" matches "città"
const FOLD = { 'ə': 'e', 'ı': 'i', 'ö': 'o', 'ü': 'u', 'ş': 's', 'ç': 'c', 'ğ': 'g', 'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u' };
const norm = (s) => (s || '').replace(/İ/g, 'i').toLowerCase().replace(/[əıöüşçğàèéìòù]/g, (c) => FOLD[c] || c);

function score(row, terms) {
  let total = 0;
  for (const t of terms) {
    let s = 0;
    if (row.q.includes(t)) s += 5;
    if (row.alt.includes(t)) s += 3;
    if (row.a.includes(t)) s += 1;
    if (!s && t.length > 4) { // tolerate typos / suffixes: try a shorter stem
      const stem = t.slice(0, -2);
      if (row.q.includes(stem) || row.alt.includes(stem)) s += 2;
      else if (row.a.includes(stem)) s += 0.5;
    }
    if (!s) return 0; // every term must match somewhere
    total += s;
  }
  return total;
}

function Highlight({ text, terms }) {
  if (!terms.length) return text;
  const f = norm(text); // folding keeps length, so indexes map 1:1 to the original
  const marks = [];
  for (const t of terms) for (let i = f.indexOf(t); i !== -1; i = f.indexOf(t, i + 1)) marks.push([i, i + t.length]);
  if (!marks.length) return text;
  marks.sort((a, b) => a[0] - b[0]);
  const out = [];
  let last = 0;
  marks.forEach(([s, e], k) => {
    if (s < last) return;
    out.push(text.slice(last, s), <mark key={k}>{text.slice(s, e)}</mark>);
    last = e;
  });
  out.push(text.slice(last));
  return out;
}

// inline flag: Windows doesn't render flag emoji
function AzFlag({ className }) {
  return (
    <svg className={className} viewBox="0 0 60 30" aria-label="Azərbaycan bayrağı" role="img">
      <rect width="60" height="10" fill="#00B5E2" />
      <rect y="10" width="60" height="10" fill="#EF3340" />
      <rect y="20" width="60" height="10" fill="#509E2F" />
      <circle cx="28.5" cy="15" r="4.5" fill="#fff" />
      <circle cx="29.6" cy="15" r="3.75" fill="#EF3340" />
      <polygon fill="#fff" points="33.60,13.00 33.93,14.21 35.01,13.59 34.39,14.67 35.60,15.00 34.39,15.33 35.01,16.41 33.93,15.79 33.60,17.00 33.27,15.79 32.19,16.41 32.81,15.33 31.60,15.00 32.81,14.67 32.19,13.59 33.27,14.21" />
    </svg>
  );
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const USER_TONES = ['text-emerald-600 dark:text-emerald-400', 'text-sky-600 dark:text-sky-400', 'text-violet-600 dark:text-violet-400', 'text-amber-600 dark:text-amber-400', 'text-rose-600 dark:text-rose-400'];

// "📎 Mənbə · 15 noyabr 2025" button -> the anonymized chat messages the answer came from
function Sources({ sources }) {
  const [show, setShow] = useState(false);
  if (!sources.length) return null;
  const first = sources[0].date, last = sources[sources.length - 1].date;
  const range = first === last ? fmtDate(first) : `${fmtDate(first)} – ${fmtDate(last)}`;
  return (
    <div className="mt-3">
      <button onClick={() => setShow(!show)} aria-expanded={show}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
        <span>📎</span> Mənbə · {range}
        <span className="text-zinc-400">({sources.length} mesaj)</span>
        <svg className={`size-3 transition-transform ${show ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className="acc" data-open={show}>
        <div>
          <div className="mt-2 space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="mb-2 text-[11px] text-zinc-500">WhatsApp qrupundan · adlar gizlədilib</p>
            {sources.map((s, i) => (
              <div key={i} className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm dark:bg-zinc-900">
                <div className="mb-0.5 flex items-baseline gap-2 text-[11px]">
                  <span className={`font-semibold ${USER_TONES[(s.user - 1) % USER_TONES.length]}`}>İstifadəçi {s.user}</span>
                  <span className="text-zinc-400">{fmtDate(s.date)}{s.time ? `, ${s.time}` : ''}</span>
                </div>
                <p className="whitespace-pre-line break-words text-zinc-700 dark:text-zinc-300">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const fmtSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

function GuideCard({ g, onOpen, compact }) {
  return (
    <a href={g.href} target="_blank" rel="noopener" onClick={(e) => onOpen(e, g)}
      className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 dark:border-zinc-800 dark:bg-zinc-900">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600 opacity-0 transition group-hover:opacity-100" />
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl ${topicMeta(g.topic).tone}`}>{g.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="font-semibold leading-snug">{g.title}</span>
          <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-px text-[10px] font-bold tracking-wide text-red-600 dark:text-red-400">PDF</span>
        </span>
        {!compact && g.description && <span className="mt-1 line-clamp-2 block text-sm text-zinc-600 dark:text-zinc-400">{g.description}</span>}
        <span className="mt-1.5 block text-xs text-zinc-500">
          {g.topic}{g.pages ? ` · ${g.pages} səhifə` : ''}{g.size ? ` · ${fmtSize(g.size)}` : ''}
        </span>
      </span>
      <svg className="mt-1 size-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
    </a>
  );
}

function PdfModal({ g, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={g.title}>
      <div className="rise flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="text-xl">{g.icon}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{g.title}</span>
          <a href={g.href} target="_blank" rel="noopener" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 sm:block dark:text-zinc-300 dark:hover:bg-zinc-800">↗ Yeni tabda</a>
          <a href={g.href} download className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">⬇ Yüklə</a>
          <button onClick={onClose} aria-label="Bağla" className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button>
        </div>
        <iframe src={`${g.href}#view=FitH`} title={g.title} className="w-full flex-1 bg-zinc-100 dark:bg-zinc-950" />
      </div>
    </div>
  );
}

export default function FaqApp({ items, guides = [], updated }) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState(ALL);
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(null);
  const [pdf, setPdf] = useState(null);
  const inputRef = useRef(null);

  const index = useMemo(() => items.map((it) => ({
    it, q: norm(it.question), alt: norm(it.alt.join(' ')), a: norm(it.answer),
  })), [items]);

  const topics = useMemo(() => {
    const c = {};
    items.forEach((i) => (c[i.topic] = (c[i.topic] || 0) + 1));
    guides.forEach((g) => (c[g.topic] = c[g.topic] || 0)); // guide-only topics still get a chip
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [items, guides]);

  const terms = useMemo(() => norm(query.trim()).split(/\s+/).filter((t) => t.length > 1), [query]);
  const results = useMemo(() => {
    let rows = index.filter((r) => topic === ALL || r.it.topic === topic);
    if (terms.length) rows = rows.map((r) => [r, score(r, terms)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    return rows.map((r) => r.it);
  }, [index, topic, terms]);

  // guides: lenient match — any meaningful term hitting title/keywords is enough
  const guideIndex = useMemo(() => guides.map((g) => ({ g, k: norm([g.title, ...g.keywords].join(' ')) })), [guides]);
  const matchedGuides = useMemo(() => guideIndex
    .filter(({ g, k }) => (topic === ALL || g.topic === topic) && (!terms.length || terms.some((t) => t.length > 2 && k.includes(t))))
    .map(({ g }) => g), [guideIndex, topic, terms]);
  const guideForTopic = useMemo(() => Object.fromEntries(guides.map((g) => [g.topic, g])), [guides]);

  // desktop: open in modal; phones: let the link open the PDF natively in a new tab
  const openGuide = (e, g) => {
    if (window.matchMedia('(min-width: 640px)').matches) { e.preventDefault(); setPdf(g); }
  };

  // ⌘K / Ctrl+K / "/" focuses search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement !== inputRef.current)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) setQuery('');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  // deep link: /#s3 opens that question
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id && items.some((i) => i.id === id)) {
      setOpen(id);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }), 100);
    }
  }, [items]);

  // auto-open the top hit when search narrows down
  const autoOpen = terms.length > 0 && results.length > 0 && results.length <= 3 ? results[0].id : null;
  const isOpen = (id) => open === id || (open === null && autoOpen === id);

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  };

  const copyLink = async (id) => {
    const url = `${location.origin}${location.pathname}#${id}`;
    history.replaceState(null, '', `#${id}`);
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="relative overflow-x-clip">
      {/* flag strip */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 flex h-1">
        <span className="flex-1 bg-az-blue" /><span className="flex-1 bg-az-red" /><span className="flex-1 bg-az-green" />
      </div>

      {/* backdrop: soft glow in the flag's blue / red / green */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px]">
        <div className="dots absolute inset-0 text-zinc-300 dark:text-zinc-800" />
        <div className="absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-az-blue/30 via-az-red/15 to-az-green/30 blur-3xl dark:from-az-blue/20 dark:via-az-red/10 dark:to-az-green/20" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-24">
        {/* nav */}
        <nav className="flex items-center justify-between py-5">
          <a href="#" onClick={() => { setQuery(''); setTopic(ALL); setOpen(null); }} className="flex items-center gap-2 font-semibold tracking-tight">
            Milan Azərbaycanlıları
            <AzFlag className="h-3.5 w-7 rounded-[3px] shadow-sm ring-1 ring-black/10" />
          </a>
          <button onClick={toggleTheme} aria-label="Tema dəyiş"
            className="grid size-9 place-items-center rounded-full border border-zinc-200 bg-white/70 backdrop-blur transition hover:scale-105 dark:border-zinc-800 dark:bg-zinc-900/70">
            <svg className="size-4 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            <svg className="hidden size-4 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </button>
        </nav>

        {/* hero */}
        <header className="rise pt-10 pb-8 text-center sm:pt-16">
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            Milanda həyat,{' '}
            <span className="bg-gradient-to-r from-az-blue via-az-red to-az-green bg-clip-text text-transparent">sual-cavab</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-zinc-600 text-pretty dark:text-zinc-400">
            Qrupda ən çox soruşulan suallar və icmanın verdiyi cavablar — bir yerdə, axtarışla.
          </p>
          <p className="mt-3 text-xs text-zinc-500">Son yenilənmə: {updated}</p>
        </header>

        {/* guides */}
        {matchedGuides.length > 0 && (
          <section className="rise mb-8" style={{ animationDelay: '.15s' }}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-500">
              <span>📚</span> {terms.length ? 'Uyğun bələdçilər' : 'Bələdçilər'}
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </h2>
            <div className={`grid gap-2.5 ${matchedGuides.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {matchedGuides.map((g) => <GuideCard key={g.href} g={g} onOpen={openGuide} />)}
            </div>
          </section>
        )}

        {/* search */}
        <div className="sticky top-3 z-20 rise" style={{ animationDelay: '.05s' }}>
          <label className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3.5 shadow-xl shadow-zinc-900/5 backdrop-blur-xl transition focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/30">
            <svg className="size-5 shrink-0 text-zinc-400 group-focus-within:text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setOpen(null); }}
              type="search" placeholder="Nə axtarırsan? məs. permesso, metro kartı…" autoComplete="off"
              className="w-full bg-transparent text-base outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden" />
            {query ? (
              <button onClick={() => setQuery('')} className="rounded-md px-1.5 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label="Təmizlə">✕</button>
            ) : (
              <kbd className="hidden shrink-0 rounded-md border border-zinc-200 px-1.5 py-0.5 font-sans text-[11px] text-zinc-400 sm:block dark:border-zinc-700">Ctrl K</kbd>
            )}
          </label>
        </div>

        {/* topics */}
        <div className="rise -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" style={{ animationDelay: '.1s' }}>
          {[[ALL, items.length], ...topics].map(([t, n]) => {
            const active = topic === t;
            return (
              <button key={t} onClick={() => { setTopic(t); setOpen(null); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${active
                  ? 'border-transparent bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900'
                  : 'border-zinc-200 bg-white/60 text-zinc-700 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700'}`}>
                <span>{t === ALL ? '✨' : topicMeta(t).icon}</span>
                {t}
                <span className={`text-xs ${active ? 'opacity-60' : 'text-zinc-400'}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* results */}
        {(results.length > 0 || !matchedGuides.length) && (
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-500">
            <span>💬</span> Suallar
            <span className="font-normal">· {terms.length ? <><b className="text-zinc-900 dark:text-zinc-100">{results.length}</b> nəticə “{query.trim()}” üçün</> : results.length}</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </h2>
        )}

        <ul className="space-y-2.5">
          {results.map((it, i) => {
            const o = isOpen(it.id);
            const m = topicMeta(it.topic);
            return (
              <li key={it.id} id={it.id} style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
                className={`rise scroll-mt-28 rounded-2xl border bg-white transition dark:bg-zinc-900 ${o
                  ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'}`}>
                <button onClick={() => setOpen(o ? false : it.id)} aria-expanded={o}
                  className="flex w-full items-start gap-3 p-4 text-left sm:p-5">
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-base ${m.tone}`}>{m.icon}</span>
                  <span className="flex-1">
                    <span className="block font-semibold leading-snug"><Highlight text={it.question} terms={terms} /></span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      {it.topic}
                      {it.manual && <span className="rounded bg-emerald-500/10 px-1.5 py-px font-medium text-emerald-700 dark:text-emerald-300" title="Adminlər tərəfindən yazılıb">✓ Admin</span>}
                    </span>
                  </span>
                  <svg className={`mt-1.5 size-4 shrink-0 text-zinc-400 transition-transform duration-300 ${o ? 'rotate-180 text-emerald-500' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <div className="acc" data-open={o}>
                  <div>
                    <div className="px-4 pb-5 pl-[60px] sm:px-5 sm:pl-[64px]">
                      <p className="whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300"><Highlight text={it.answer} terms={terms} /></p>
                      {guideForTopic[it.topic] && (
                        <a href={guideForTopic[it.topic].href} target="_blank" rel="noopener" onClick={(e) => openGuide(e, guideForTopic[it.topic])}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-sm text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300">
                          📘 Ətraflı: {guideForTopic[it.topic].title} <span className="text-xs opacity-60">PDF</span>
                        </a>
                      )}
                      <Sources sources={it.sources} />
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {it.alt.map((a) => (
                          <button key={a} onClick={() => setQuery(a)}
                            className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">#{a}</button>
                        ))}
                        <button onClick={() => copyLink(it.id)}
                          className="ml-auto rounded-md px-2 py-0.5 text-xs text-zinc-500 transition hover:text-emerald-600">
                          {copied === it.id ? '✓ Kopyalandı' : '🔗 Link'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {!results.length && !matchedGuides.length && (
          <div className="rise rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
            <div className="text-4xl">🔍</div>
            <p className="mt-3 font-semibold">Heç nə tapılmadı</p>
            <p className="mt-1 text-sm text-zinc-500">Başqa söz yoxla və ya sualını qrupda soruş.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {POPULAR.map((p) => (
                <button key={p} onClick={() => { setQuery(p); setTopic(ALL); }}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-sm hover:border-emerald-500/50 hover:text-emerald-600 dark:border-zinc-700">{p}</button>
              ))}
            </div>
          </div>
        )}

        {pdf && <PdfModal g={pdf} onClose={() => setPdf(null)} />}

        <footer className="mt-16 text-center text-xs leading-relaxed text-zinc-500">
          Cavablar qrup söhbətlərindən süni intellektlə toplanıb — vacib məsələlərdə rəsmi mənbəni yoxlayın.        </footer>
      </div>
    </div>
  );
}
