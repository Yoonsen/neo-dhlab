# Teksten som gror ut av objektet: Om artefakt-forankret AI-skriving

**Notat · 23. november 2026**

---

## Utgangspunkt

Det er en grunnleggende forskjell mellom to måter å generere tekst med språkmodeller på:
1. **Kontekstløs prompt-generering («skriv en detektivhistorie» / «skriv et essay om X»):** Teksten springer ut av et nesten tomt prompt uten et underliggende objekt. Modellen må fylle et tomrom med det statistiske gjennomsnittet fra treningsdataene sine – det som ofte oppleves som generisk, glatt og uforankret prosa.
2. **Tekst som gror ut av et objekt:** Teksten springer ut av et faktisk, motstandsdyktig arbeidsobjekt – f.eks. en applikasjon, en kodebase, et korpus med 38,5 milliarder ord, konkrete arkitekturvalg, feil som måtte løses underveis, og en levd utviklingshistorikk mellom forsker og agent. Her trenger ikke modellen «finne på» innhold; teksten er en artikulering av struktur, friksjon og beslutninger som allerede har funnet sin form i artefaktet.

---

## 1. Skillet mellom «tomrom-generering» (*zero-shot*) og artefakt-forankret samskriving

Mye av den offentlige debatten om folk som blir «tatt i å bruke AI i skriving» handler i realiteten om **kontekstløs tekstgenerering** (*zero-shot prompting*): man ber en modell produsere en tekst uten at det ligger et reelt kunnskapsobjekt, egne data eller egne beslutninger bak.

I kontrast står det forskere innen HCI (Human–Computer Interaction), skriveforskning og kognisjonsvitenskap beskriver som **artefakt-forankret** eller **epistemisk integrert AI-skriving**:

- **Forankring (*Grounding*) gjennom motstand (Bender & Koller, 2020):** I sitt kjente tankeksperiment om språkmodeller peker Bender og Koller på at en modell som kun er trent på tekstform, mangler *kommunikativ intensjon* og *forankring i en verden* (*grounding*). Men når en dialog mellom forsker og språkmodell er koplet direkte til et eksternt, funksjonelt objekt som gir reell motstand – en TypeScript-kompilator som feiler, en database på `dhlab1` som svarer med faktiske tall, eller et brukergrensesnitt som må passe på en skjerm – får språket nettopp den **referensielle forankringen** som mangler i et frittstående prompt.
- **Kognitiv arbeidsdeling og sam-intelligens (Mollick, 2024):** Når menneske og modell har bygget et felles objekt (kode, eksperimenter, statistiske modeller) gjennom mange iterasjoner, fungerer den avsluttende rapportskrivingen ikke som en erstatning for tenkning, men som en **destillering og kartlegging** av et terreng man faktisk har gått opp sammen.

---

## 2. «Teksten som gror ut av objektet» i vitenskaps- og teknologiteori (STS)

Tanken om at god fagtekst ikke oppstår i et vakuum, men *gror ut av et objekt og dets utviklingshistorie*, har dype røtter i klassisk vitenskapsteori og kognisjonsvitenskap:

1. **Epistemiske ting og skrift som spor (Rheinberger, 1997):**  
   Vitenskapshistorikeren Hans-Jörg Rheinberger skiller mellom *tekniske objekter* (ferdige verktøy) og *epistemiske ting* (*epistemic things* – forskningsgjenstander under utvikling som ennå ikke er helt fastlåst, slik som en ny korpusmotor eller en eksperimentell analyseflate). Hos Rheinberger er ikke vitenskapelig skriving noe man først tenker ut abstrakt og deretter skriver ned; skriften vokser frem som et **spor** (*trace*) av at forskeren manipulerer det epistemiske objektet, støter på uventet motstand (f.eks. navnevarianter i metadata eller personverngrenser for ordavstand) og tar konkrete designvalg.
2. **Sirkulerende referanse og inskripsjonskjeder (Latour, 1987, 1999):**  
   Bruno Latour beskriver vitenskapelig tekst som sluttleddet i en sammenhengende kjede av *inskripsjoner* (fra rådata og primærkilder $\rightarrow$ indekser og bitmaps $\rightarrow$ tabeller og kurver $\rightarrow$ fagprosa). Kvaliteten på en tekst avgjøres av om den bevarer **sirkulerende referanse** bakover i kjeden: kan hver påstand i teksten følges tilbake til en konkret formel, en kodefil, en parameter eller en visuell observasjon i objektet? Når en tekst skrives direkte ut fra et slikt objekt, bærer hver setning med seg denne referansekjeden.
3. **Situert kunnskap (Haraway, 1988) og distribuert kognisjon (Hutchins, 1995; Clark & Chalmers, 1998):**  
   Tenkningen og forfatterskapet sitter ikke isolert inne i én enkelt hjerne eller i en språkmodell, men i det **distribuerte kognisjonssystemet** som består av forskeren, kodebasen, databasen, de visuelle flatene og dialoghistorikken. Teksten blir spesifikk og levende nettopp fordi den er *situert* i et konkret arbeidsfellesskap rundt et objekt.

---

## 3. Hvorfor debatten om å «bli tatt i AI-bruk» vil stabilisere seg

Dagens uro rundt hvem eller hva som har formulert enkeltsetninger i en tekst minner sterkt om tidligere teknologiske overganger i akademia og kulturliv (innføringen av tekstbehandlere, søkemotorer, stave-/grammatikkontroll og statistikkpakker):

- **Fra verktøymoral til substans- og ansvarskrav:** I en tidlig fase forsøker man ofte å trekke en formell eller moralsk grense rundt selve *verktøyet* («har en språkmodell rørt teksten?»). Over tid viser denne grensen seg uholdbar fordi verktøyet blir vevd inn i selve arbeidsprosessen.
- **Det avgjørende skillet:** Normen vil i stedet stabilisere seg rundt **epistemisk eierskap, forankring og etterprøvbarhet**:
  - *Ligger det et reelt arbeid, egne valg, egne data eller et eget objekt bak teksten?*
  - *Forstår forfatteren – og kan forfatteren stå faglig inne for – hver eneste beslutning, mekanisme og referanse som teksten beskriver?*

En tekst som har vokst ut av et objekt man selv har bygget, testet, feilsøkt og formet, har en helt annen faglig og intellektuell tyngde enn en tekst generert ut av løse luften – uavhengig av om en språkmodell bidro til å sette ord på strukturen til slutt.

---

## Referanser

- **Bender, E. M., & Koller, A.** (2020). *Climbing towards NLU: On Meaning, Form, and Understanding in the Age of Data*. In *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL)* (pp. 5185–5198). https://doi.org/10.18653/v1/2020.acl-main.463
- **Clark, A., & Chalmers, D.** (1998). *The Extended Mind*. *Analysis*, 58(1), 7–19.
- **Haraway, D.** (1988). *Situated Knowledges: The Science Question in Feminism and the Privilege of Partial Perspective*. *Feminist Studies*, 14(3), 575–599.
- **Hutchins, E.** (1995). *Cognition in the Wild*. MIT Press.
- **Latour, B.** (1987). *Science in Action: How to Follow Scientists and Engineers through Society*. Harvard University Press.
- **Latour, B.** (1999). *Pandora's Hope: Essays on the Reality of Science Studies* (Kap. 2: *«Circulating Reference: Sampling the Soil in the Amazon Forest»*, pp. 24–79). Harvard University Press.
- **Mollick, E.** (2024). *Co-Intelligence: Living and Working with AI*. Portfolio / Penguin.
- **Rheinberger, H.-J.** (1997). *Toward a History of Epistemic Things: Synthesizing Proteins in the Test Tube*. Stanford University Press.
