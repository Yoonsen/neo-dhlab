// Choices for the walkthrough: queries, corpus, book and narration.
// Edit this file to prepare the next recording; record.mjs only drives the UI.
// Narration (`say`) is read by the voice Nora; `cap` is the on-screen caption when it should differ.
// Tip: run `npm run record` and read the per-scene timing printed at the end. Scenes marked SLOW
// spent longer waiting for the app than the narration lasts, so the video stalls there.

export default {
  title: 'DHLAB Korpusmotor',
  subtitle: 'Kom i gang – søk i Nasjonalbibliotekets boksamling',
  endSubtitle: 'yoonsen.github.io/neo-dhlab',

  welcome: { say: 'Velkommen til DHLAB Korpusmotor.' },
  overview: {
    say: 'Her kan du søke i over sju hundre tusen bøker fra Nasjonalbiblioteket, med trettiåtte milliarder ord fra 1473 til i dag.',
  },

  // 1. Search + Telling (comma-separated expressions)
  search: {
    query: 'demokrati, diktatur',
    say: 'Skriv ett eller flere uttrykk i søkefeltet, skilt med komma. Vi sammenligner demokrati og diktatur.',
  },
  counts: { say: 'Fanen Telling viser antall treff, hvor mange bøker ordene står i, og hvor tett de opptrer.' },

  // 2. Trends (uses the query above)
  trends: { say: 'Under Trender ser du bruken år for år, målt per million ord.' },
  trendsZoom: {
    metricLabel: 'Dekning (andel bøker %)', // radio label in TrendChart (src/i18n.ts)
    fromYear: '1850',
    say: 'Du kan bytte mål, for eksempel til andelen bøker som bruker ordet, og zoome inn på en periode med årstallene.',
  },

  // 3. Concordance (left/right context is blurred in the recording)
  concordance: {
    say: 'Konkordans viser treffene i sammenheng, med lenke til boka i Nettbiblioteket. Teksten er sløret i denne videoen.',
  },
  anchor: {
    query: 'diktatur ^demokrati',
    say: 'Med en hatt foran et ord gjør du det til anker. Nå finner vi demokrati bare der diktatur står i nærheten. Glidebryteren styrer hvor stort vinduet er.',
    cap: 'Med ^ foran et ord gjør du det til anker: «diktatur ^demokrati» finner demokrati der diktatur står i nærheten. Glidebryteren styrer vinduet.',
  },

  // 4. Collocations (the slowest step on the full collection — pick a moderately frequent word)
  collocations: {
    query: 'frihet',
    sortBy: 'Nærhets-z', // column header text, or null to skip sorting
    say: 'Kollokasjoner viser hvilke ord som står nær søkeordet. Sorter på nærhets-z for å finne ord som ofte står tett ved.',
  },

  // 5. Corpus builder. Any field left empty is skipped.
  corpus: {
    name: 'Hamsun',
    author: 'Hamsun, K', // typed into «Forfatter (starter med)»
    authorPick: 'Knut', // click the first facet suggestion containing this text
    fromYear: '',
    toYear: '',
    lang: '', // nob | nno | dan | eng | ger
    form: '', // Skjønnlitteratur | Faglitteratur | Uklassifisert
    say: 'Med Definer korpus avgrenser du hvilke bøker du søker i: etter år, språk, sjanger, forfatter, emne eller Dewey. Vi lager et korpus med bøker av Knut Hamsun.',
  },
  corpusInUse: {
    query: 'Isak, Inger', // searched in Telling within the new corpus, reused by the Vonnegut arc
    say: 'Korpuset vises øverst, og alle verktøyene søker nå bare i disse bøkene.',
  },

  // 6. Vonnegut arc: one book from the corpus
  arc: { say: 'Vonnegut-buen viser hvordan ordene fordeler seg gjennom en bok, fra første til siste side.' },
  arcBook: {
    filter: 'Markens', // typed into the book filter; first matching book is chosen, others deselected
    say: 'Velg en bok fra korpuset. Her ser vi hvor i Markens grøde Isak og Inger nevnes.',
  },

  help: { say: 'Under Om, Syntaks finner du flere eksempler på søkeuttrykk. Lykke til!' },
};
