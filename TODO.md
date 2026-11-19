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

## 2. Semantikk og forankring i søkespråket
- **Avsnitts- vs. dokumentforankring (`doc` vs. `para`):**
  - Tydeliggjøre og utvide syntaksen for hvor et søkeuttrykk eller en boolsk kombinasjon (`NEAR(...) AND NEAR(...)`) er forankret (innenfor samme vindu, samme avsnitt eller samme bok).
- **Videreutvikling av utvidet FTS5-dialekt:**
  - `NEAR(a b, 10)` (symmetrisk), `NEAR(a b, +10)` / `NEAR(a b, 10, asym)` (forover), og `NEAR(a ^b, 10)` (forankret på `b`).
  - Støtte for rikere kombinasjoner når backend åpner for flere anker- eller avsnittsoperatorer.
