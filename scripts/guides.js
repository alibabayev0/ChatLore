// input/*.pdf -> public/guides/<slug>.pdf, and keeps guides.json in sync.
// guides.json holds editable metadata (title, description, topic...). New PDFs get a default entry.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'input');
const OUT_DIR = path.join(ROOT, 'public', 'guides');
const META_FILE = path.join(ROOT, 'guides.json');

// "Təqaüd Sənədləri 2026" -> "teqaud-senedleri-2026"
const FOLD = { 'ə': 'e', 'ı': 'i', 'ö': 'o', 'ü': 'u', 'ş': 's', 'ç': 'c', 'ğ': 'g' };
const slug = (s) => s.normalize('NFC').replace(/İ/g, 'i').toLowerCase()
  .replace(/[əıöüşçğ]/g, (c) => FOLD[c])
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const pdfs = fs.existsSync(INPUT_DIR) ? fs.readdirSync(INPUT_DIR).filter((f) => /\.pdf$/i.test(f)) : [];
const meta = fs.existsSync(META_FILE) ? JSON.parse(fs.readFileSync(META_FILE, 'utf8')) : [];
const byFile = new Map(meta.map((m) => [m.file.normalize('NFC'), m]));

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const result = [];
for (const file of pdfs) {
  const key = file.normalize('NFC'); // macOS/WhatsApp names may be NFD
  const base = key.replace(/\.pdf$/i, '');
  const m = byFile.get(key) || { file: key, title: base, description: '', topic: 'Digər', icon: '📘', keywords: [] };
  const src = path.join(INPUT_DIR, file);
  const name = slug(base) + '.pdf';
  fs.copyFileSync(src, path.join(OUT_DIR, name));
  result.push({ ...m, file: key, href: `/guides/${name}`, size: fs.statSync(src).size });
  if (!byFile.has(key)) console.log(`  + yeni bələdçi: ${key} (guides.json-da başlıq/təsviri düzəldə bilərsən)`);
}

fs.writeFileSync(META_FILE, JSON.stringify(result.map(({ href, size, ...m }) => m), null, 2) + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(result));
console.log(`Bələdçilər: ${result.length} PDF → public/guides/`);
