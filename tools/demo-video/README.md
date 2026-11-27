# Instruksjonsvideoer for Neo-DHLAB

Tar opp fortalte gjennomganger av appen (1920×1080, norsk tale og undertekster) fra scenario-filer.
Verktøyet er ikke en del av app-bygget.

## Scenarier (`scenarios/`)

| Fil | Innhold | Lengde |
|---|---|---|
| [`intro.mjs`](scenarios/intro.mjs) | Søk og Telling → Trender → Konkordans (anker `^`) → Kollokasjoner → Definer korpus (Hamsun) → Vonnegut-bue → Om / Syntaks | ca. 2 min |
| [`skrivemaater-or.mjs`](scenarios/skrivemaater-or.mjs) | `frihed`/`frihet` som inngang til OR-grupper: Telling, skiftet rundt 1915 i Trender, summen som egen kurve, OR i Konkordans og Kollokasjoner, `^(skib OR skip) storm` | ca. 1 ¼ min |
| [`skrivemaater-or-en.mjs`](scenarios/skrivemaater-or-en.mjs) | Samme på engelsk: appen står i EN-modus, med engelsk stemme | ca. 1 ⅓ min |

Øverst i en scenario-fil kan `lang: 'en'` slå appen over til engelsk (standard er `'no'`), og `voice`
velge stemme fra `say -v '?'` (standard Nora for norsk og Samantha for engelsk). Premium-stemmer, som
lastes ned under Systeminnstillinger → Tilgjengelighet → Opplest innhold → Administrer stemmer, låter
tydelig mer naturlig.

Hver scene har `say` (talen), eventuelt `cap` (tekstlinjen, hvis den skal avvike fra talen) og `do`
(hva som skjer i appen). `do` bruker hjelpefunksjoner fra `record.mjs`: `d.search`, `d.goTab`,
`d.setYears`, `d.sortBy`, `d.select`, `d.defineCorpus`, `d.applyCorpus`, `d.pickArcBook`,
`d.openHelp` og pekemål i `d.ui` (`results`, `chart`, `kwicHit`, `windowSlider` …). Et nytt tema
lages ved å kopiere en scenario-fil og bytte ord, korpus og tekst.

Konkordansens venstre og høyre kontekst er alltid sløret med CSS, slik at videoene ikke viser
tekstutdrag fra samlingen. Bare treffordet og bokmetadata er lesbare.

## Raske og trege valg

Etter hvert opptak skrives taletid og ventetid ut for hver scene. Scener merket `SLOW` venter lenger
på API-et enn talen varer, så videoen står stille der. Bytt til sjeldnere ord, et mindre korpus eller
et mindre utvalg (`d.select(d.ui.collSampleSize(), 1000)`). Kollokasjoner over hele samlingen er
tregest: `frihet` med standardutvalget 5 000 tar ca. 14 s, mens `frihed OR frihet` med 1 000 tar ca. 8 s.

## Krav

- macOS med stemmen `Nora` (`say -v '?' | grep nb_NO`)
- `ffmpeg` og `ffprobe`
- Node og Python 3
- Playwright 1.56.1 (Apache-2.0) med Chromium

## Kjøring

```bash
cd tools/demo-video && npm install && npx playwright install chromium
```

Start appen i en annen terminal (`npm run dev` i rotmappa, port 5180). Ta så opp og bygg ett scenario:

```bash
node record.mjs scenarios/skrivemaater-or.mjs
```

```bash
python3 build.py skrivemaater-or
```

Arbeidsfiler og ferdig video havner i `out/<scenario>/` (gitignored), som `out/skrivemaater-or/skrivemaater-or.mp4`
med `.srt` ved siden av. Uten argument brukes `intro`. En annen adresse for appen settes med `APP_URL`,
f.eks. den publiserte siden.

Hvis et steg feiler, lagres et skjermbilde i `out/<scenario>/fail.png`. Knappene finnes via
UI-tekstene i `src/i18n.ts` (norsk), så `record.mjs` må oppdateres når knappetekster endres.

## Slik virker det

- Playwright styrer en Chromium uten vindu (1600×900 CSS-piksler, skalering 1,2) og fanger bilder via
  CDP-screencast med tidsstempler.
- En peker, klikkringer, en tekstlinje og tittelkort legges inn i siden som et `popover`-element, slik
  at de også ligger over modale `<dialog>`-vinduer.
- Hver scene får tale fra `say`. Scenen varer minst like lenge som talen.
- `build.py` legger bildene på riktig tid (concat), plasserer talen med `adelay` og koder til
  H.264/AAC med undertekster som eget spor (`mov_text`).
