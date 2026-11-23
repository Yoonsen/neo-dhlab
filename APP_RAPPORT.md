# Neo-DHLAB: Arkitektur-, funksjons- og UI/UX-rapport

**Dato:** 23. november 2026  
**Applikasjon:** [Neo-DHLAB (`yoonsen.github.io/neo-dhlab`)](https://yoonsen.github.io/neo-dhlab/)  
**Kildekode:** `src/App.tsx` · `src/api.ts` · `src/styles.css`  
**Backend-motor:** Nasjonalbibliotekets `ft_bok` Roaring-arena (`https://api.nb.no/dhlab/imag/ft_bok`, 713 913 bøker, ~38,5 mrd. løpende ord i 103 shards, 1473–2026)

---

## 1. Formål og overordnet arkitektur

**Neo-DHLAB** er en lettvekts, tilstandsløs forskningsarbeidsflate («workbench») bygget i React, TypeScript og Vite mot Nasjonalbibliotekets nye Roaring-arena-motor for `ft_bok`. Målet med applikasjonen er å kombinere:
1. **Interaktiv responstid i millisekundklassen** på et korpus med 38,5 milliarder tokens.
2. **Kompakt korpusrepresentasjon på klientsiden**, der et vilkårlig delkorpus (fra 1 til 713 913 bøker) utveksles mellom klient og tjener som et kompakt `corpusToken` (base64-kodet, zlib-komprimert Roaring-bitmap, typisk fra noen hundre byte til ~90 KB).
3. **Et samlet, ekspressivt spørrespråk (`FTS5+`)** som lar forskeren veksle sømløst mellom makroskopiske tidsserier, statistiske kollokasjoner, dokumentnivå-spredning og mikroskopiske KWIC-konkordanser uten å bytte verktøy eller miste korpuskonteksten.

---

## 2. Spørrespråk (`FTS5+`) og korpusbygging

### 2.1 Tre spørredialekter i samme søkefelt
Spørreparseren i `src/api.ts` gjenkjenner og oversetter tre syntaksfamilier direkte i nettleseren, med støtte for komma-separerte sammenligningslister (med `\,` som escape-sekvens for bokstavelig komma):

| Dialekt | Eksempel | Semantikk i Arena-motoren |
| :--- | :--- | :--- |
| **Naturlig / DHLAB** | `demokrati ^diktatur` | Nærhetssøk innenfor valgt vindu med `^` som eksplisitt telle- og kontekstanker (`countMode: "anchor"`). |
| **Elastic / Lucene** | `"skib storm"~10` | Nærhetssøk med eksplisitt vindu `10`; støtter også eksakte fraser (`"i forhold til"` -> `matchMode: "sequence"`). |
| **FTS5+** | `NEAR(skib storm, +10)` | Utvidet SQLite FTS5-syntaks med `+W` for asymmetrisk/ordnet vindu (A -> B), `OR`-grupper, prefiks-jokertegn (`demokrati*`) og `^`-anker. |
| **FTS5+ Semijoin** | `a WHERE NEAR(a b, 10) AND NEAR(a c, 10)` | Mengde-/logikknotasjon (også `{ a \| NEAR(a b, 10) }`) som binder variabelen `a` som anker (`^a`) på tvers av flere nærhetskrav. |

### 2.2 Korpusbygging og bibliografisk autofullføring
I `src/components/CorpusBuilder.tsx` kan brukeren definere og kombinere korpus gjennom tre mekanismer som alle resulterer i et lagringsbart `corpusToken`:
- **Metadatafasetter (`POST /corpus` og `POST /corpus/facets`):** Frie årstallsgrenser helt tilbake til **1473** (uten kunstig 1800-grense), språk (`nob`, `nno`, `dan`, `eng`, `ger`), litterær form og sanntids autofullføring for **forfattere**, **emneord** og **Dewey / DDK (`ddc`)** (f.eks. `641.5` kokebøker).
- **Innholdsbasert korpusavgrensning (`returnCorpus: true`):** Uttrykk som `doc WHERE NEAR(skib storm, 10) AND forlis` kjeder metadata-bitmapet med ett eller flere fulltekstsøk og trekker ut bøkene som oppfyller alle tekstkravene.
- **Filopplasting (`src/excelCorpusParser.ts`):** Leser både RFC 4180-siterte CSV-filer (med komma i forfatter-/tittelfelt) og sparse Excel-arbeidsbøker (`.xlsx` fra pandas/openpyxl) og ekstraherer `dhlabid` eller `URN` automatisk.

---

## 3. Analysepanelene og statistiske mål

1. **∑ Tellinger (`src/components/OverviewTab.tsx`):**
   - Viser totale treff, antall bøker, korpusdekning (%) og intensitet (treff pr. bok), samt en interaktiv **Par vs. Anker-sammenligner** som illustrerer forskjellen mellom ikke-overlappende par/spenn (`pairs`/`spans`) og asymmetriske ankertellinger (`^a b` vs. `a ^b`).
2. **≡ Konkordans (`src/components/ConcordanceView.tsx`):**
   - KWIC-visning med fargekodede leddgrupper (`g0`–`g4`) og markert ankerord.
   - Slår opp tittel, forfatter og år via `POST /metadata`, lenker direkte til treffsiden i Nettbiblioteket (`nb.no/items/<urn>?searchText=...`), og har en hurtigknapp (`📈 Bue`) som sender boken direkte til narrativ spredningsanalyse.
3. **◎ Kollokasjoner (`src/components/CollocationsView.tsx`):**
   - Bruker `POST /collocations_dist` med retningsvalg (`Begge sider ±W`, `Foran | Etter`, `Kun foran −W`, `Kun etter +W`), vinduslengde opptil 50 ord, og utvalgsstyring (`sampleSize` opptil 50 000, `perBook` 1–50).
   - Kombinerer **rent lokale posisjonsmål** i vinduet med **korpusbaserte assosiasjonsmål** (`expected: true`):
     - **Masse (`Antall` og `Andel`)**: Observert frekvens $n$ i kollokasjonsvinduene.
     - **Avstand (`dist`)**: Gjennomsnittlig absolutt ordavstand til målordet/ankeret, vist med grafisk nærhetsindikator mot forventet tilfeldig avstand $\mu_0$.
     - **Spredning (`sd`)**: Standardavviket i avstand – lav `sd` (nær 0) identifiserer faste uttrykk og idiomer som alltid opptrer i samme relative posisjon.
     - **Nærhets-z (`z`)**: $(\mu_0 - \text{dist}) / \sqrt{\text{var}_0 / n}$ – et rent lokalt mål som veier masse og nærhet sammen uten oppslag i bakgrunnskorpuset.
     - **Poisson-Stirling (`ps`)** og **Ratio ($p(x|y)/p(x)$)**: Måler overrepresentasjon mot forventet frekvens $\lambda$ i shardene utvalget er trukket fra. Kan slås av med avkrysningsboksen `ps / ratio` når man kun ønsker lokale mål.
4. **📈 Trender (`src/components/TrendChart.tsx`):**
   - Fem visningsmodi: *Relativ frekvens (pr. million ord)*, *Kohort (100 %)*, *Bokdekning (% av bøker)*, *Intensitet (treff pr. bok med treff)* og *Råfrekvens*.
   - Henter hele den historiske serien tilbake til **1473** i ett kall, slik at årstallsfilteret (`År: [Fra] – [Til]`) i verktøylinjen zoomer og beskjærer tidsaksen momentant (0 ms) på klientsiden.
   - Har innebygd kurvestilverktøy (`Tykkelse`, `Alpha`, `Fyll under kurve`) og eksport til både Excel (`.xlsx`) og høyoppløselig 2x Retina PNG.
5. **〰 Vonnegut-bue (`src/components/DispersionView.tsx`):**
   - Plotter tekstlig spredning (`POST /dispersion`) gjennom 1–10 bøker samtidig (med tekstvindu i antall ord eller normaliserte prosent-bins 1–100 %), i tre oppsett: *Side om side (bok1 → bok2)*, *Stablet (bok over bok)* eller *Summert*.

---

## 4. Kommentarer om UI/UX-designet og faglige referanser

Utformingen av Neo-DHLAB bygger på etablerte prinsipper fra litteraturen om menneske–maskin-interaksjon (HCI), informasjonsvisualisering og skjemadesign:

### 4.1 Vertikal venstre-rail (Left Navigation Rail) på bredskjerm
- **Geometri og skalerbarhet:** Moderne skjermer har 16:9- eller 16:10-format der horisontal plass er rikelig, mens vertikal høyde er den knappe ressursen. Ved å flytte modulvalget (`Tellinger`, `Konkordans`, `Kollokasjoner`, `Trender`, `Vonnegut-bue`) fra en horisontal rad over søkefeltet til en vertikal venstrekolonne (`.vertical-tablist`), frigjøres ~60 px i høyden samtidig som menyen kan utvides med nye verktøy (f.eks. DTM og doc2vec) nedover uten å presse arbeidsflaten nedover (Laubheimer, 2021).
- **Romlig konsistens og F-mønster:** Blikksporingsstudier viser at brukere i vestlige leseretninger forankrer oppmerksomheten langs venstre marg (Pernice, 2017). Når korpus og søkefelt ligger fast i toppen og verktøyvalget ligger i venstre rail, oppstår en tydelig romlig arbeidsdeling mellom *hva man undersøker* (topp) og *hvilken linse man ser gjennom* (venstre).

### 4.2 «Overview First, Details on Demand» – Grafen over uttrykkskortene
- **Visuelt hierarki i analysepaneler:** Etter Shneidermans (1996) *Visual Information-Seeking Mantra* («Overview first, zoom and filter, then details-on-demand») og Fews (2006) prinsipper for dashboard-design skal primærvisualiseringen aldri skyves ned under skjermkanten («below the fold») av sekundære metadata.
- **Løsning i Trendpanelet:** Ved søk på 4–6 uttrykk samtidig genereres det én detaljbrikke per søkeuttrykk (med totalt antall treff, antall bøker, treff/bok og responstid). Tidligere lå disse kortene *over* grafen og dyttet kurven nedover for hvert nytt ledd. Nå ligger selve grafen øverst med en kompakt énlinjes fargenøkkel inne i grafkortet, mens de fulle oppsummeringskortene ligger *under* grafen. Det gir maksimal «data-ink ratio» i det primære synsfeltet (Tufte, 2001).

### 4.3 Figur–bakgrunn-kontrast og «papir-metaforen» for tekstinput
- **Affordance og signifiers (Norman, 2013):** Et brukergrensesnitt må signalisere tydelig hvilke flater som tar imot tekstinndata, hvilke som er klikkbare knapper, og hvilke som er passiv informasjon.
- **Hvit innside på tekstfelt vs. farget bakgrunn på verktøylinjer:** Kvantitative brukerstudier fra Google Material Design (Material Design Research, 2017) og Baymard Institute (Holst, 2020) viste at grå- eller fargefylte tekstbokser («filled text fields») på hvit bakgrunn ofte forveksles med deaktiverte felter, infobrikker eller sekundærknapper. Ved å snu kontrasten – slik at søkerammen (`.inline-search-bar`) og korpusbyggerdialogen (`.corpus-modal`) har en svak bakgrunnstone (`--surface-subtle`), mens selve tekstfeltene (`.omnibox-container`, `.field-stack input`) har **ren hvit innside (`--surface`)** med tydelig ramme og fokusring – trer inputfeltene umiddelbart frem som redigerbare flater.

### 4.4 Visuell identitet, fargevolumer og tilgjengelighet (WCAG 2.2 AA)
- **Nasjonalbibliotekets designmanual:** Fargepaletten bruker NB-profilens kjernefarger (*Aubergine* `#40263E`, *Plomme* `#550029`, *Fersken 20* `#FDF2F2`) fordelt på tre valgbare fargevolumer i toppmenyen: *Rolig (N-gram)*, *Fersken (NB varm)* og *Aubergine (mørk)*.
- **Tastatur- og skjermlesertilgjengelighet (W3C WAI-ARIA 1.2):**
  - Venstre-railen bruker `role="tablist"` med `aria-orientation="vertical"` og full piltastnavigasjon (`ArrowUp` / `ArrowDown` / `Home` / `End`).
  - Den aktive fanen markeres med en 3 px venstreramme (`border-inline-start: 3px solid var(--accent)`) på et `::after`-pseudoelement uten å endre knappens dimensjoner, slik at indikatoren ikke avhenger av farge alene (WCAG 1.4.1) og forblir synlig i Windows High Contrast / Forced Colors Mode.
  - Alle resultat- og kollokasjonstabeller har klikkbare sorteringsknapper inne i `<th scope="col">` med korrekt `aria-sort="ascending" | "descending" | "none"`.

---

## 5. Referanser

1. **Few, S.** (2006). *Information Dashboard Design: The Effective Visual Communication of Data*. O'Reilly Media.
2. **Holst, C.** (2020). *Form Field Usability: Avoid Extensive Multicolumn Layouts and Use Clear Field Affordances*. Baymard Institute UX Research.
3. **Laubheimer, P.** (2021). *Left-Hand Navigation vs. Top Navigation: Desktop Design*. Nielsen Norman Group (NN/g).
4. **Material Design Research / Zaraysky, S. et al.** (2017–2019). *The Evolution of Material Design's Text Fields* (600+ deltakere, blikksporing og oppgaveløsning). Google Design.
5. **Nasjonalbiblioteket.** *Designmanual for Nasjonalbiblioteket – Farger, typografi og fargevolum*. https://www.nb.no/design/
6. **Norman, D. A.** (2013). *The Design of Everyday Things* (Revised and Expanded Edition). Basic Books.
7. **Pernice, K.** (2017). *F-Shaped Pattern of Reading on the Web: Misunderstood, But Still Relevant*. Nielsen Norman Group (NN/g).
8. **Shneiderman, B.** (1996). *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations*. In *Proceedings of the IEEE Symposium on Visual Languages* (pp. 336–343). IEEE.
9. **Tufte, E. R.** (2001). *The Visual Display of Quantitative Information* (2nd ed.). Graphics Press.
10. **W3C.** (2023). *Web Content Accessibility Guidelines (WCAG) 2.2* & *WAI-ARIA Authoring Practices Guide (APG) – Tabs Pattern*. World Wide Web Consortium. https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
