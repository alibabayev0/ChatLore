import fs from 'fs';
import path from 'path';
import faq from '../faq.json';
import manual from '../manual.json';
import FaqApp from './FaqApp';

// Runs at build time only: faq.json, manual.json and the guides list are baked into the static HTML.
function loadGuides() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'guides', 'index.json'), 'utf8'));
  } catch {
    return []; // scripts/guides.js not run yet
  }
}

const toItem = (i, id, extra) => ({
  id, question: i.question, answer: i.answer, topic: i.topic || 'Digər', alt: i.alt || [], sources: i.sources || [], ...extra,
});

export default function Page() {
  const items = [
    // admin-written questions first; Gemini never touches manual.json
    ...manual.filter((i) => i.question && i.answer).map((i, n) => toItem(i, `m${n + 1}`, { manual: true })),
    ...faq.filter((i) => (i.confidence ?? 1) >= 0.5).map((i, n) => toItem(i, `s${n + 1}`)),
  ];
  const guides = loadGuides().map((g) => ({
    title: g.title, description: g.description || '', topic: g.topic || 'Digər', icon: g.icon || '📘',
    pages: g.pages || null, keywords: g.keywords || [], href: g.href, size: g.size,
  }));
  const updated = new Date().toLocaleDateString('az-AZ', { day: 'numeric', month: 'long', year: 'numeric' });
  return <FaqApp items={items} guides={guides} updated={updated} />;
}
