# AGENTS.md — Operational Guide & Self-Notes for AI Agents

This file is the primary handoff and context anchor for any AI agent (after `/compact`, in a new conversation, or when switching down the Gemini model hierarchy such as Gemini Flash) working on **Neo-DHLAB** (`/Users/larsj/Github/neo-dhlab`).

---

## 1. Communication, Build & Deployment Rules

1. **Language:** Always communicate with the user (Lars) in **Norwegian (Bokmål)**. Keep TypeScript/React code, identifiers, and commit messages in **English**.
2. **Build Verification:** Always run `npm run build` (`tsc -b && vite build`) before committing to ensure zero TypeScript or bundler errors.
3. **Git & GitHub Pages Deployment:**
   - Remote: `git@github.com:Yoonsen/neo-dhlab.git` (branch `main`).
   - Deployed automatically via [.github/workflows/deploy.yml](file:///Users/larsj/Github/neo-dhlab/.github/workflows/deploy.yml) to **`https://yoonsen.github.io/neo-dhlab/`** (`base: '/neo-dhlab/'` in [vite.config.ts](file:///Users/larsj/Github/neo-dhlab/vite.config.ts)).
   - Do **not** merge the `build` and `deploy` jobs in `deploy.yml` or downgrade `actions/upload-pages-artifact@v4` — `@v4` requires `deploy` to run as a separate job with `needs: build`.
4. **Sandbox & SSH/Git Network Rules:**
   - Always try commands in Standard Sandbox Mode (`BypassSandbox: false`) first.
   - Note that `curl https://api.nb.no/dhlab/imag/ft_bok/...` works **inside** the standard sandbox (`BypassSandbox: false`)!
   - `git push origin main` and `ssh dhlab1 "..."` require network/SSH access outside the sandbox and will fail with `-65563` in Standard Sandbox Mode; retry only that specific command with `BypassSandbox: true` and an identical `toolSummary`.

---

## 2. Backend Server & Specification Docs (`dhlab1`)

The backend (`ft_bok` Roaring arena engine, 713,913 books, 38.5B tokens across 103 shards, years **1473–2026**) is developed in parallel by Lars and Claude on `dhlab1`.

- **Public Production API Base URL:** `https://api.nb.no/dhlab/imag/ft_bok`
- **Coordination & Spec Directory on `dhlab1`:** `/mnt/disk4/repo_split_20261106/`
  - When Lars says *"se i repo_split"* or *"payload er oppdatert"*, inspect the latest markdown files on `dhlab1`:
    ```sh
    ssh dhlab1 "cd /mnt/disk4/repo_split_20261106 && ls -lt *.md"
    ```
  - Key specification files in `/mnt/disk4/repo_split_20261106/`:
    - `HANDOFF_TIL_CLAUDE_DHLAB1.md` — Chronological log of all backend commits, Docker image tags, benchmarks, and open design questions.
    - `PAYLOADS_COLLOCATIONS.md` & `COLLOCATIONS_DIST_PROPOSAL.md` — Spec for `POST /collocations_dist`.
    - `PAYLOADS_DISPERSION_METADATA.md` — Spec for `POST /dispersion` and `POST /metadata`.
    - `MELDING_APP_KONKORDANS_20261120.md` — Spec for `POST /concordance_public` (multi-group `marks`, `anchor`, OR-groups, wildcards).
    - `PUBLIC_API_8096.md` — General public API contract and copyright/text-access limits.

---

## 3. Backend API Endpoints & Contracts

All `POST` endpoints take `Content-Type: application/json` and accept optional `"corpusToken": "<base64>"` and/or `"dhlabids": [int, ...]`.

| Endpoint | Purpose & Key Payload Fields | Key Response Fields & Gotchas |
| :--- | :--- | :--- |
| `GET /health` | Health check & warm shard probe | `{"status": "ok", ...}` |
| `POST /corpus` | Build a Roaring `corpusToken` from metadata query (`query: {and: [...]}` with `k: "year" \| "lang_doc" \| "literaryform" \| "authors" \| "subjects" \| "ddc"`), `dhlabids`, or `urns` | `{"corpusToken": "...", "size": 22946}`. Note: Dewey (`ddc`) supports `v` (exact) or `prefix` (e.g. `"641.5"`). |
| `POST /corpus/facets` | Autocomplete metadata facets (`k: "authors" \| "subjects" \| "ddc"`, `prefix`, `limit`) | `{"values": [{"value": "...", "docs": 123}, ...]}` |
| `POST /metadata` | Fetch bibliographic metadata for up to **1,000** books (`dhlabids` or `corpusToken`, `fields: ["urn", "title", "authors", "year"]`) | **Hard limit: 1,000 books.** In `corpus_meta_v2.db`, some author names have a space before the comma (`"Fosse , Jon"` vs `"Fosse, Jon"`). Use `or: [{k: "authors", prefix: "Name ,"}, {k: "authors", prefix: "Name,"}]` when resolving an author to stay under 1,000 books, and normalize display with `normalizeAuthorName()`. |
| `POST /near_query` | Exact corpus counts (`mode` omitted) or yearly time series (`mode: "year-count"`, `startYear: 1450`, `endYear: 2026`). Supports `terms` or `termGroups`, `matchMode: "near" \| "sequence"`, `window: 1..50`, `symmetric: bool`, `returnCorpus: true`. | Count: `{"total": ..., "docs": ..., "countMode": "tf" \| "pairs" \| "spans" \| "anchor" \| "sequence", "corpusToken"?: "..."}`. Year-count: `{"rows": [{"year": 1473, "total": ..., "docs": ..., "books": ..., "tokens": ..., "perMillion": ...}, ...]}`. |
| `POST /concordance_public` | KWIC concordance (`terms` or `termGroups`, `matchMode`, `window: 1..24`, `symmetric`, `before`, `after`, `limit: 1..200`). Total snippet budget `before + hit + after <= 25`. | `{"rows": [{"dhlabid", "left", "hit", "right", "marks": [[tokenIdx, groupIdx], ...], "anchor": tokenIdx}], "lines", "books"}`. |
| `POST /collocations_dist` | Collocations with distance & association (`terms` or `termGroups`, `matchMode`, `window`, `symmetric`, `before: 0..50`, `after: 0..50`, `fold: bool`, `sampleSize: 1..50000`, `perBook: 1..50`, `minCount: 2`, `expected: bool`, `sides: bool`, `limit`). | `{"rows": [{"word", "counts", "dist", "bdist", "sd", "z", "expected"?, "ratio"?, "pmi"?, "ps"?, "wps"?, "left"?, "right"?, "skew"?}], "hits", "books", "mu0", "var0"}`. **Gotcha:** Server enforces `distanceMinCount = 5` (for text-reconstruction privacy). Rows with `counts` = 2, 3, or 4 have `dist: null, sd: null, z: null`, even though `ps` and `ratio` are populated. Always sort null distances to the bottom. |
| `POST /dispersion` | Narrative arcs ("Vonnegut arcs") across 1–10 books (`dhlabids: [..max 10..]`, `terms` or `termGroups` (max 10), and either `bins: 10..500` or `window: >=100`). | `{"labels": [...], "window": null \| int, "bins": int \| null, "books": [{"dhlabid", "tokens", "counts": [[...per bin...], ...]}]}`. |

---

## 4. Key Architectural & UI Invariants

1. **No Hardcoded 1800 Lower Year Limit:**
   - The backend has books back to **1473**. Keep `yearFrom` / `yearTo` empty by default in `CorpusBuilder.tsx` (meaning all years), and fetch `startYear: 1450` to `endYear: 2026` in `App.tsx` so `TrendChart.tsx` can filter/zoom any year range client-side in 0 ms.
2. **UI Layout & Ergonomics:**
   - **Left Vertical Rail (`.vertical-tablist` in `App.tsx` / `styles.css`):** The 5 analysis modules (`∑ Telling`, `≡ Konkordans`, `◎ Kollokasjoner`, `📈 Trender`, `〰 Vonnegut-bue`) live in a vertical left-hand rail below the search bar to save vertical height on 16:9 screens and scale cleanly as new tools (DTM, doc2vec) are added.
   - **Chart First in `TrendChart.tsx`:** The SVG trend chart (`<figure className="chart-figure">`) with its single-line compact color key must remain **above** the multi-expression summary cards (`.series-legend-row`) so adding 4–6 search expressions never pushes the chart below the fold.
   - **Crisp White Text Inputs (`--surface`) on Tinted Toolbars (`--surface-subtle`):** Editable text inputs (`.omnibox-container`, `.field-stack input`, `.field-stack textarea`) must always have a pure white background (`var(--surface)`) inside subtly tinted containers (`.inline-search-bar`, `.corpus-modal`) so they never look like disabled boxes or buttons.
3. **Collocations Table Columns (`CollocationsView.tsx`):**
   - Do **not** display `bdist` in the UI table or Excel export (`bdist` is kept on the backend only for legacy compatibility).
   - Display and allow sorting by: **Antall (`counts`)**, **Andel**, **Avstand (`dist`)**, **Spredning (`sd`)**, **Nærhets-z (`z`)**, and (when `ps / ratio` checkbox `includeExpected` is checked) **Poisson-Stirling (`ps`)** and **Ratio (`ratio`)**.
4. **Bilingual UI (`src/i18n.ts`):**
   - Every user-facing label in all 5 tabs and modals must use `t: UiStrings` from `src/i18n.ts` with complete `no` (Norsk) and `en` (English, e.g. `"Collocations"` and `"Vonnegut arcs"`) translations.
