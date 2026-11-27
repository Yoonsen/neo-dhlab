# Instruksjonsvideo for Neo-DHLAB

Tar opp en fortalt gjennomgang av appen (ca. 2 min, 1920×1080, norsk tale og undertekster).
Verktøyet er ikke en del av app-bygget.

## Innhold

Søk og Telling → Trender (dekning, årstall) → Konkordans (anker `^`, vindu) → Kollokasjoner (nærhets-z)
→ Definer korpus (Knut Hamsun) → Vonnegut-bue (*Markens grøde*) → Om / Syntaks.

Konkordansens venstre og høyre kontekst er sløret med CSS, slik at videoen ikke viser tekstutdrag fra
samlingen. Bare treffordet og bokmetadata er lesbare.

## Forberede neste opptak

Alle valg ligger i [`scenario.mjs`](scenario.mjs): søkeuttrykk, årstall i Trender, ankersøk, kollokasjonsord,
korpus (navn, forfatter, år, språk, form), bok for Vonnegut-buen og taleteksten for hver scene. Du kan
bruke en annen fil med `DEMO_SCENARIO=min-scenario.mjs npm run record`.

Etter opptaket skriver skriptet ut taletid og ventetid for hver scene. Scener merket `SLOW` venter
lenger på API-et enn talen varer, så videoen står stille der. Bytt til raskere ord eller et mindre
korpus. Med første versjon var kollokasjoner over hele samlingen tregest (`frihet`: ca. 14 s mot 7,5 s tale).

## Krav

- macOS med stemmen `Nora` (`say -v '?' | grep nb_NO`)
- `ffmpeg` og `ffprobe`
- Node og Python 3
- Playwright 1.56.1 (Apache-2.0) med Chromium

## Kjøring

```bash
cd tools/demo-video && npm install && npx playwright install chromium
```

Start appen i en annen terminal (`npm run dev` i rotmappa, port 5180). Ta så opp og bygg videoen:

```bash
npm run record
```

```bash
python3 build.py ../../neo-dhlab-intro.mp4
```

`record.mjs` skriver bilder, lydfiler og `timeline.json` til `out/`. Du kan velge en annen mappe med
`DEMO_WORK_DIR`. En annen adresse for appen settes med `APP_URL`, f.eks. den publiserte siden.
`build.py` lager MP4-fila og en `.srt`-fil ved siden av den.

Hvis et steg feiler, lagres et skjermbilde i `out/fail.png`. Velgerne i `record.mjs` følger
UI-tekstene i `src/i18n.ts` (norsk), så de må oppdateres når knappetekster endres.

## Slik virker det

- Playwright styrer en Chromium uten vindu (1600×900 CSS-piksler, skalering 1,2) og fanger bilder via
  CDP-screencast med tidsstempler.
- En peker, klikkringer, en tekstlinje og tittelkort legges inn i siden som et `popover`-element, slik
  at de også ligger over modale `<dialog>`-vinduer.
- Hver scene får tale fra `say`. Scenen varer minst like lenge som talen.
- `build.py` legger bildene på riktig tid (concat), plasserer talen med `adelay` og koder til
  H.264/AAC med undertekster som eget spor (`mov_text`).
