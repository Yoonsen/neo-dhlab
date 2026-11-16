# Neo-DHLAB · `ft_bok` Korpusmotor (Arena)

Webapplikasjon (Vite + React + TypeScript) for Nasjonalbibliotekets korpusmotor `ft_bok` (713 913 bøker, 38,5 mrd. tokens i 103 Roaring-arena-shards).

## Funksjoner

- **Flytende kommandoboks (`<search>`):**
  - Enkeltord (`demokrati`) → `countMode: "tf"`
  - Ordpar (`demokrati diktatur`) → `countMode: "pairs"` (symmetrisk par-telling innenfor vindu `W`)
  - Anker (`demokrati ^diktatur`) → `countMode: "anchor"` (forekomster av det merkede ordet med det andre innenfor `W`)
  - Frase (`"i forhold til"`) → `matchMode: "sequence"` (`countMode: "sequence"`)
- **4 faner:**
  1. **Telling & Oversikt:** Store nøkkeltall (`total`, `docs`, `clientMs`), direkte **Par vs. Anker-sammenligner** og uttrekk av 30 konkordanseksempler.
  2. **Trender (år):** Tidsserier via `POST /near_query` med `mode: "year-count"` (`perMillion`, absolutt antall, andel bøker, glatting og CSV-eksport).
  3. **Konkordans:** Offentlig konkordans via `POST /concordance_public` (maks 25 ord klippet ved avsnitt, maks 10 % av hver bok, fast server-seed).
  4. **Korpusbygger:** Metadata-spørringer og fasetter via `POST /corpus` og `POST /corpus/facets`, innliming av `dhlabid`/`URN`, samt eksport/import av bærbar `corpusToken` (Roaring bitmap i base64).
- **Søkelogg med målt svartid:** Viser rundtur-tid i millisekunder for hvert API-kall.

## Kjøring lokalt

```bash
npm install
npm run dev
```

## Bygging og GitHub Pages

```bash
npm run build
```

Prosjektet bruker `base: './'` i `vite.config.ts` og har ferdig GitHub Actions-arbeidsflyt i `.github/workflows/deploy.yml` for publisering til GitHub Pages.

## Avhengigheter og lisenser

- `react`, `react-dom` (MIT)
- `vite`, `@vitejs/plugin-react` (MIT)
- `typescript` (Apache-2.0)
