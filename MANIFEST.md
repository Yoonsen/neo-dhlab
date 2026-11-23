# MANIFEST.md — Project Structure & Component Inventory

**Project:** Neo-DHLAB (`neo-dhlab`)  
**Stack:** React 18 + TypeScript + Vite 6 (zero external UI/chart/XLSX runtime bloat; custom SVG charts and pure JS ZIP/XML `.xlsx` reader/writer)  
**Live URL:** `https://yoonsen.github.io/neo-dhlab/`

---

## 1. File Tree & Responsibilities

```text
/Users/larsj/Github/neo-dhlab/
├── AGENTS.md                        # Operational instructions, API contracts & gotchas for AI agents
├── MANIFEST.md                      # This file: codebase map, state architecture & feature status
├── APP_RAPPORT.md                   # Architecture, statistical metrics & UI/UX literature report
├── README.md                        # Quick start & project overview
├── TODO.md                          # Roadmap & upcoming features (DTM, chunks, doc2vec, bratio)
├── index.html                       # App entry HTML
├── package.json                     # Scripts: `npm run dev`, `npm run build`, `npm run preview`
├── vite.config.ts                   # Vite config (`base: '/neo-dhlab/'`)
├── .github/workflows/deploy.yml     # GitHub Actions Pages build & deploy (`upload-pages-artifact@v4`)
└── src/
    ├── main.tsx                     # React DOM root mount
    ├── App.tsx                      # Top-level state, corpus bar, search omnibox, vertical left-rail & tab router
    ├── api.ts                       # FTS5+/Elastic/native query parser, semijoin/AND resolver & API client
    ├── i18n.ts                      # Complete Norwegian (`no`) and English (`en`) UI translations (`UiStrings`)
    ├── styles.css                   # NB Design Manual color volumes (Calm, Peach 20, Dark Aubergine) & workbench CSS
    ├── excelCorpusParser.ts         # Browser-native `.xlsx` (sparse sheet1.xml/sharedStrings) & RFC 4180 `.csv` parser
    ├── excelExport.ts               # Browser-native `.xlsx` writer for downloading tables & time series
    └── components/
        ├── OverviewTab.tsx          # ∑ Counts tab: single hero metrics, multi-query table & Pair vs. Anchor comparison
        ├── ConcordanceView.tsx      # ≡ Concordance tab: color-coded KWIC (`marks`/`anchor`), `/metadata` links & `📈 Bue` trigger
        ├── CollocationsView.tsx     # ◎ Collocations tab: `/collocations_dist` (`dist`, `sd`, `z`, `ps`, `ratio`) & split view
        ├── TrendChart.tsx           # 📈 Trends tab: 1473–2026 SVG curves, 5 metrics, 0ms year filter, style toolbox & 2x PNG
        ├── DispersionView.tsx       # 〰 Vonnegut arcs tab: `/dispersion` across 1–10 books (`concat`, `stack`, `sum`) & cache
        ├── CorpusBuilder.tsx        # Modal for building `corpusToken` from Excel/CSV, text queries, or `/corpus/facets` (inc. Dewey)
        └── HelpDialog.tsx           # Interactive syntax & metric guide with clickable query examples
```

---

## 2. State & Data Flow Architecture

### 2.1 Corpus Context (`ActiveCorpus` in `src/api.ts`)
- Stored in `App.tsx` (`corpus`) and persisted to `localStorage` (`neo_dhlab_saved_corpora_v1`, up to 25 saved corpora under «Mine korpus ▾»).
- When `corpus.enabled` is `true`, `corpus.corpusToken` (a base64-encoded zlib-compressed Roaring bitmap of `dhlabid`s) is automatically attached to every API request across all 5 panels via `applyCorpusToPayload()`.
- If a query contains top-level `AND` document filters (e.g., `NEAR(a b, 5) AND c` or `doc WHERE ...`), `resolveEffectiveCorpus()` chains `/near_query` with `returnCorpus: true` before running the target panel's endpoint.

### 2.2 Query Parser (`parseMultiSearchQuery` / `parseSearchQuery` in `src/api.ts`)
- Splits comma-separated comparison lists on unescaped commas (supporting `\,`, `\(`, `\)`, `\|`, `\^`, `\*`).
- Supports three dialects:
  1. **Native DHLAB:** `ord1 ord2`, `ord1 ^ord2`, `(skib OR skip) storm`, `"eksakt frase"`, `demokrati*`
  2. **Elastic / Lucene:** `"ord1 ord2"~10`, `(skib OR skip)`
  3. **FTS5+:** `NEAR(a b, 10)`, `NEAR(a b, +10)` (ordered/asymmetric), `NEAR(^a (b OR c), 10)`, and semijoins `a WHERE NEAR(a b, 10) AND NEAR(a c, 10)` or `{ a | NEAR(a b, 10) }` (which merge multiple `NEAR` clauses bound to anchor `a` into `terms: ["^a", "b", "c"]`).

### 2.3 Client-Side Caching
- **Bibliographic Metadata Cache (`metadataById` in `App.tsx`):** Maps `dhlabid -> BookMetadataRow` (`urn`, `title`, `authors`, `year`), shared between `ConcordanceView` and `DispersionView`.
- **Collocations Cache (`COLLOCATION_CACHE` in `CollocationsView.tsx`):** Module-level `Map` keyed by query + corpusToken + direction + window + sampleSize + perBook + foldCase + includeExpected. Switching back and forth between tabs or previously inspected queries is instant (0 ms).
- **Per-Book Dispersion Cache (`bookDispCacheRef` in `DispersionView.tsx`):** Caches `/dispersion` bin/window arrays per `(querySignature, dhlabid)` so adding or removing a book from a multi-book Vonnegut arc only fetches the newly added book.

---

## 3. Feature Status & Next Steps

### Completed (Live on `main`)
- [x] Vertical left-rail workbench navigation (`.vertical-tablist`) with keyboard navigation (`ArrowUp`/`ArrowDown`).
- [x] Crisp white text inputs (`--surface`) against subtly tinted toolbars/dialogs (`--surface-subtle`).
- [x] Full historical year support (**1473–2026**) in `CorpusBuilder` and `TrendChart` (with 0 ms client-side year range filter in `TrendChart`).
- [x] `FTS5+` semijoin (`WHERE` / `{ x | P(x) }`), backslash escaping, OR-groups, wildcards, and anchor `^`.
- [x] `CorpusBuilder` with `/corpus/facets` autocomplete for `authors`, `subjects`, and **Dewey / DDK (`ddc`)**, plus RFC 4180 CSV and sparse `.xlsx` upload.
- [x] `CollocationsView` against `POST /collocations_dist` with `counts`, `dist`, `sd`, `z`, `ps` (Poisson-Stirling), and `ratio` ($p(x|y)/p(x)$), `ps / ratio` (`expected`) toggle, progress bar with elapsed timer, and Excel export.
- [x] `DispersionView` ("Vonnegut-bue" / "Vonnegut arcs") against `POST /dispersion` for 1–10 books (`concat`, `stack`, `sum`), author lookup, curve style toolbox, PNG & Excel export.
- [x] Complete Norwegian (`NO`) and English (`EN`) translations in `src/i18n.ts`.

### Upcoming / Planned (See `TODO.md` & `HANDOFF_TIL_CLAUDE_DHLAB1.md`)
- [ ] **DTM (Document-Term Matrix) & Text Chunks:** New panel/endpoints once backend exposes `/dtm` and chunking rules.
- [ ] **Corpus-matched `expected` baseline & `bratio` in `/collocations_dist`:** Backend work planned by Lars for period-matched baseline frequencies (e.g. 1800s vs 1800s) and Poisson-Gamma `bratio = (k + a)/(λ + a)`.
- [ ] **Doc2Vec / Semantic Similarity:** Integration with active `corpusToken`.
