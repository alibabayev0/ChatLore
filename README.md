# Milan Azərbaycanlıları 🇦🇿

WhatsApp qrup söhbəti → Gemini → Next.js statik FAQ saytı.

## Quraşdırma (bir dəfə)
```bash
npm install
```

## 1. Gemini key
1. https://aistudio.google.com/apikey → **Create API key** (pulsuz).
2. `.env.example` faylını `.env` adı ilə kopyala və key-i yaz:
   ```
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-2.5-flash
   ```

## 2. WhatsApp export
- **Android:** Qrup → ⋮ → Daha çox → **Söhbəti ixrac et** → **Mediasız**.
- **iPhone:** Qrup adı → aşağı → **Söhbəti ixrac et** → **Mediasız**.
- `.zip`-i aç, içindəki `.txt`-ni `input/` qovluğuna at.

## 3. Build
```bash
npm run build
```
1. `scripts/extract.js` — söhbəti parse edir (adlar hash-lənir, telefonlar silinir), 120-lik hissələrlə Gemini-yə göndərir (free tier limiti: dəqiqədə ≤10 sorğu, 429-da avtomatik gözləyir), nəticəni `faq.json`-a yığır.
2. `next build` — `faq.json`-dan statik sayt yaradır → `out/` qovluğu.

Növbəti dəfə yeni export atanda yalnız **yeni** mesajlar Gemini-yə gedir (`state.json`) və köhnə FAQ ilə birləşdirilir.
Hər şeyi sıfırdan: `npm run rebuild`.

`faq.json`-u əllə redaktə edə bilərsən (səhv cavabı düzəlt, sil). Saytda yalnız `confidence ≥ 0.5` göstərilir.

## Əllə sual əlavə etmək
`manual.json`-a yaz (Gemini və `rebuild` bu fayla toxunmur):
```json
[
  {
    "question": "Sual?",
    "answer": "Cavab.",
    "topic": "Sənədlər",
    "alt": ["başqa yazılış", "italyanca termin"]
  }
]
```
`topic` seçimləri: Sənədlər, Nəqliyyat, Ev, Bank, Təhsil, İş, Səhiyyə, Telefon/İnternet, Alış-veriş, Digər.
Bu suallar siyahıda birinci görünür və "✓ Admin" nişanı alır. Sonra `npx next build` (Gemini lazım deyil).

## 4. Lokal baxmaq
```bash
npm run dev
```
→ http://localhost:3000

## 5. Deploy (Cloudflare Pages)
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. `out/` qovluğunu sürüklə-burax → **Deploy**.
3. Yeniləmək: `npm run build` → eyni layihədə **Create new deployment** → `out/` yenidən at.

Saytda API key yoxdur — tam statikdir.
