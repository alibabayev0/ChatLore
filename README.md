# Chatlore

**English** · [Azərbaycanca](#chatlore--azərbaycanca)

*Group chat → searchable FAQ.* Chatlore turns a WhatsApp group chat export into a searchable FAQ website. An AI model (Gemini by default) finds questions that got real answers, merges duplicates, and keeps links to the original (anonymized) messages. PDF guides and hand-written questions can be added too. The result is a static Next.js site.

## Features
- Search that understands Azerbaijani letters typed in Latin (`seher` finds `şəhər`) and small typos
- Topic filter, dark mode, mobile friendly
- **📎 Source** button on every answer: the original messages with date, names hidden
- PDF guides with an in-page viewer
- Manual questions (`manual.json`) that the AI never overwrites
- Incremental: next time only new messages are sent to the AI

## Privacy
- Sender names become anonymous codes; phone numbers are removed
- Names inside message text (greetings like "Salam X", "X bəy/xanım", senders' own names) are hidden
- Raw chat files in `input/` (`.txt`, `.md`, `.zip`) are gitignored and never committed
- The site is fully static: no API key is shipped

## Setup
Requires Node.js 18+.
```bash
npm install
```

### 1. Gemini API key
1. Create a free key at https://aistudio.google.com/apikey
2. Copy `.env.example` to `.env` and fill it in:
   ```
   GEMINI_API_KEY=your_key
   GEMINI_MODEL=gemini-flash-lite-latest
   GEMINI_FALLBACK_MODEL=gemini-flash-latest
   ```
   The `-latest` names always point to Google's current models. The fallback is used when the main model is overloaded.

### 2. Export the chat
- **Android:** group → ⋮ → More → **Export chat** → **Without media**
- **iPhone:** group name → scroll down → **Export chat** → **Without media**
- Unzip and put the `.txt` file into `input/`.

### 3. Build
```bash
npm run build
```
1. `scripts/extract.js` parses the chat and sends new messages to Gemini in batches of 120 (free-tier safe: ≤10 requests/min, automatic retry on 429/503). Results go to `faq.json`.
2. `scripts/guides.js` copies PDFs from `input/` to the site.
3. `next build` generates the static site in `out/`.

Finished batches are cached in `.cache/`, so a failed run resumes where it stopped. `state.json` remembers the last processed message, so the next export only processes new messages, even if the file name changes.

Start over from scratch: `npm run rebuild`.

### 4. Preview
```bash
npm run dev
```
Open http://localhost:3000

## Adding content by hand

### Questions → `manual.json`
```json
[
  {
    "question": "Question?",
    "answer": "Answer.",
    "topic": "Permesso",
    "alt": ["other wording", "Italian term"]
  }
]
```
Topics: Permesso, Hərbi xidmət, Sənədlər, Təhsil, Təqaüd, Nəqliyyat, Səyahət, Ev, Bank, Səhiyyə, Telefon/İnternet, İş, Alış-veriş, Digər.
Manual questions are listed first with a "✓ Admin" badge.

### PDF guides → `input/` + `guides.json`
1. Put the PDF into `input/`.
2. Run `npm run guides`. A default entry is added to `guides.json`.
3. Edit the entry:
   ```json
   {
     "file": "BANK.pdf",
     "title": "Opening a bank account",
     "description": "Which bank, which documents.",
     "topic": "Bank",
     "icon": "💳",
     "pages": 3,
     "keywords": ["bank", "iban", "conto"]
   }
   ```
`topic` links the guide to questions of the same topic; `keywords` make it show up in search.

After manual changes, `npx next build` is enough (no AI call).

## Deploy (Vercel)
1. Push the repository to GitHub.
2. On https://vercel.com: **Add New → Project** → select the repository → **Deploy** (defaults are fine).

No API key is needed on Vercel: chat files aren't in the repository, so the build skips the AI step and only builds the site. Every push redeploys automatically.

**Updating:** put a new export into `input/`, run `npm run build` locally, then commit and push `faq.json` and `state.json`.

## Using another AI
Only `scripts/extract.js` talks to the AI (functions `gemini()` and `callModel()`). Replace them with another provider's API; the rest of the pipeline stays the same.

---

# Chatlore — Azərbaycanca

*Qrup söhbəti → axtarışlı FAQ.* Chatlore WhatsApp qrup söhbətinin exportunu axtarışlı FAQ saytına çevirir. Süni intellekt (standart olaraq Gemini) real cavab almış sualları tapır, təkrarları birləşdirir və orijinal (anonim) mesajlara keçid saxlayır. PDF bələdçilər və əllə yazılmış suallar da əlavə etmək olar. Nəticə statik Next.js saytıdır.

## Xüsusiyyətlər
- Latın hərfləri ilə yazılan Azərbaycan sözlərini başa düşən axtarış (`seher` → `şəhər`), kiçik yazı səhvlərinə dözümlü
- Mövzu filtri, qaranlıq rejim, mobil uyğun
- Hər cavabda **📎 Mənbə** düyməsi: orijinal mesajlar tarixi ilə, adlar gizli
- Səhifədə açılan PDF bələdçilər
- Süni intellektin toxunmadığı əllə yazılmış suallar (`manual.json`)
- Ardıcıl yeniləmə: növbəti dəfə yalnız yeni mesajlar göndərilir

## Məxfilik
- Göndərənlərin adları anonim kodlara çevrilir, telefon nömrələri silinir
- Mesaj mətnindəki adlar ("Salam X", "X bəy/xanım", göndərənlərin adları) gizlədilir
- `input/` içindəki xam söhbət faylları (`.txt`, `.md`, `.zip`) gitignore-dadır, heç vaxt commit olunmur
- Sayt tam statikdir, API key sayta düşmür

## Quraşdırma
Node.js 18+ lazımdır.
```bash
npm install
```

### 1. Gemini API key
1. https://aistudio.google.com/apikey ünvanında pulsuz key yaradın.
2. `.env.example` faylını `.env` adı ilə kopyalayıb doldurun:
   ```
   GEMINI_API_KEY=key_buraya
   GEMINI_MODEL=gemini-flash-lite-latest
   GEMINI_FALLBACK_MODEL=gemini-flash-latest
   ```
   `-latest` adları həmişə Google-un cari modelinə yönəlir. Əsas model yüklü olanda ehtiyat model işə düşür.

### 2. Söhbəti export etmək
- **Android:** qrup → ⋮ → Daha çox → **Söhbəti ixrac et** → **Mediasız**
- **iPhone:** qrupun adı → aşağı → **Söhbəti ixrac et** → **Mediasız**
- Zip-i açıb `.txt` faylını `input/` qovluğuna qoyun.

### 3. Build
```bash
npm run build
```
1. `scripts/extract.js` söhbəti oxuyur və yeni mesajları 120-lik hissələrlə Gemini-yə göndərir (pulsuz limitə uyğun: dəqiqədə ≤10 sorğu, 429/503-də avtomatik təkrar). Nəticə `faq.json`-a yazılır.
2. `scripts/guides.js` `input/` içindəki PDF-ləri sayta kopyalayır.
3. `next build` statik saytı `out/` qovluğunda yaradır.

Bitmiş hissələr `.cache/`-də saxlanılır, ona görə yarıda kəsilən run qaldığı yerdən davam edir. `state.json` son emal olunan mesajı yadda saxlayır — növbəti exportda (fayl adı dəyişsə belə) yalnız yeni mesajlar emal olunur.

Hər şeyi sıfırdan: `npm run rebuild`.

### 4. Lokal baxış
```bash
npm run dev
```
http://localhost:3000 ünvanını açın.

## Əllə məzmun əlavə etmək

### Suallar → `manual.json`
```json
[
  {
    "question": "Sual?",
    "answer": "Cavab.",
    "topic": "Permesso",
    "alt": ["başqa yazılış", "italyanca termin"]
  }
]
```
Mövzular: Permesso, Hərbi xidmət, Sənədlər, Təhsil, Təqaüd, Nəqliyyat, Səyahət, Ev, Bank, Səhiyyə, Telefon/İnternet, İş, Alış-veriş, Digər.
Əllə yazılan suallar siyahıda birinci, "✓ Admin" nişanı ilə görünür.

### PDF bələdçilər → `input/` + `guides.json`
1. PDF-i `input/` qovluğuna qoyun.
2. `npm run guides` işlədin — `guides.json`-a standart qeyd əlavə olunur.
3. Qeydi redaktə edin:
   ```json
   {
     "file": "BANK.pdf",
     "title": "Bank hesabı açmaq",
     "description": "Hansı bank, hansı sənədlər.",
     "topic": "Bank",
     "icon": "💳",
     "pages": 3,
     "keywords": ["bank", "iban", "conto"]
   }
   ```
`topic` bələdçini eyni mövzulu suallara bağlayır, `keywords` isə axtarışda göstərir.

Əllə dəyişiklikdən sonra `npx next build` kifayətdir (süni intellekt çağırılmır).

## Deploy (Vercel)
1. Repo-nu GitHub-a push edin.
2. https://vercel.com: **Add New → Project** → repo-nu seçin → **Deploy** (standart ayarlar uyğundur).

Vercel-də API key lazım deyil: söhbət faylları repo-da olmadığı üçün build süni intellekt addımını keçir və yalnız saytı yığır. Hər push avtomatik yenidən deploy edir.

**Yeniləmək:** yeni exportu `input/`-a qoyun, lokalda `npm run build` işlədin, sonra `faq.json` və `state.json`-u commit + push edin.

## Başqa süni intellektdən istifadə
Süni intellektlə yalnız `scripts/extract.js` danışır (`gemini()` və `callModel()` funksiyaları). Onları başqa provayderin API-si ilə əvəz edin — qalan proses eyni qalır.
