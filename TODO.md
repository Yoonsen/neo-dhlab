# Veikart / TODO · Neo-DHLAB Korpusmotor

Dette dokumentet samler planlagte utvidelser av frontend og samspill med backend (`ft_bok`).

## 1. Ny navigasjonsstruktur for utvidede verktøy
Når antall verktøy vokser utover dagens tre kjernefaner (*Telling*, *Konkordans*, *Trender*), legger vi opp til en **vertikal meny, piller eller verktøyfliser** for å velge aktivt analysemodus uten at topplinjen blir overfylt:
- **Korpusanalyse (makro):**
  - Telling & kollokasjonsoversikt (`tf`, `pairs`, `spans`, `^anker`, sekvens)
  - Trender over tid (Relativ frekvens pr. million ord, Kohort-andel, Dekning `doc/N`, Intensitet `tf/doc`)
  - Konkordans (KWIC i kontekst med direktelenke til Nettbiblioteket)
- **Tekstanalyse / Boknivå (mikro):**
  - **Narrative buer (Vonnegut-kurver) / Dispersion plots:** Plotte hvor i løpet av én bok (eller sammenlignet på tvers av utvalgte bøker, f.eks. i 100 bøtter / tekstposisjon 0–100 %) bestemte ord, temaer eller sentiment/følelsesord opptrer.
- **Semantikk & Vektorrom:**
  - **Temamodellering (Topic Modeling):** Klynge- og temautforsking over det valgte korpuset basert på grunndata fra backend.
  - **Doc2Vec / Dokumentlikhet:** Finne bøker/tekster som ligner semantisk i vektorrommet, tilpasset fra eksisterende DHLAB-app og knyttet direkte til aktivt korpus (`corpusToken`).

## 2. Semantikk og forankring i søkespråket (`FTS5+`)
- **Bindende vs. frie predikater under `WHERE` / `{ x | P(x) }` ($A \ltimes_{\text{skop}} B$):**
  - `a WHERE NEAR(a b, 10) AND NEAR(a c, 10)`: `a` er bundet i begge predikatene, og evalueres mot samme posisjonsbitmaske $P_a \ \& \ \text{dilate}(P_b, 10) \ \& \ \text{dilate}(P_c, 10)$.
  - Frie predikater (`... AND c` eller `doc WHERE ...` / `{doc | ...}`): Evalueres som $O(1)$ Roaring-maskering på dokumentnivå (`returnCorpus: true`) før posisjonsoperasjonene.
- **Avsnitts- vs. dokumentforankring (`doc` vs. `para`):**
  - Siden `para`-posisjonene $P_{\text{para}} = [p_0, p_1, \dots, p_m]$ partisjonerer dokumentets token-akse i disjunkte halvåpne intervaller $[p_i, p_{i+1})$, er både `a WHERE para(b)` og `para WHERE a AND b` en `searchsorted`-projeksjon ned på avsnittsindeksene $\{i \mid \exists x \in P_b : p_i \le x < p_{i+1}\}$.
- **Vonnegut-buer direkte fra ankervektoren $P_{\text{resultat}}$:**
  - Når ethvert `FTS5+`-uttrykk produserer en sortert vektor av ankerposisjoner $P_{\text{resultat}}$ (token-posisjoner for `^a`, avsnittsstart for `^para`, eller sidestart for `^page`), blir dispersjonsplottet gjennom boka en lineær normalisering $x / N_{\text{tokens}} \in [0, 1]$ (eller mot `page`-ankrene) plottet som tetthet (KDE / 100 bøtter) eller kumulativ kurve over bokas lengde.
- **3+ ord i `/concordance_public`:**
  - Åpne for 3+ ord i `near`-modus også i konkordansendepunktet.
