// Intro: a walk through all five tools and the corpus builder (~2 min).
// Each scene: `say` is narrated (voice Nora), `cap` is the caption if it should differ,
// `do` drives the app with the helpers in record.mjs (d.search, d.goTab, d.ui.*, …).
// The scene lasts at least as long as the narration; the timing report flags SLOW scenes.

export default {
  title: 'DHLAB Korpusmotor',
  subtitle: 'Kom i gang – søk i Nasjonalbibliotekets boksamling',
  endSubtitle: 'yoonsen.github.io/neo-dhlab',
  welcome: 'Velkommen til DHLAB Korpusmotor.',

  scenes: [
    {
      id: 'overview',
      say: 'Her kan du søke i over sju hundre tusen bøker fra Nasjonalbiblioteket, med trettiåtte milliarder ord fra 1473 til i dag.',
      do: (d) => d.moveTo(d.ui.corpusBar()),
    },
    {
      id: 'search',
      say: 'Skriv ett eller flere uttrykk i søkefeltet, skilt med komma. Vi sammenligner demokrati og diktatur.',
      do: async (d) => {
        await d.click(d.tab('Telling'));
        await d.search('demokrati, diktatur');
      },
    },
    {
      id: 'counts',
      say: 'Fanen Telling viser antall treff, hvor mange bøker ordene står i, og hvor tett de opptrer.',
      do: (d) => d.moveTo(d.ui.results()),
    },
    {
      id: 'trends',
      say: 'Under Trender ser du bruken år for år, målt per million ord.',
      do: async (d) => {
        await d.goTab('Trender');
        await d.moveTo(d.ui.chart());
      },
    },
    {
      id: 'trendsZoom',
      say: 'Du kan bytte mål, for eksempel til andelen bøker som bruker ordet, og zoome inn på en periode med årstallene.',
      do: async (d) => {
        await d.click(d.ui.label('Dekning (andel bøker %)'));
        await d.setYears(1850);
      },
    },
    {
      id: 'concordance',
      say: 'Konkordans viser treffene i sammenheng, med lenke til boka i Nettbiblioteket. Teksten er sløret i denne videoen.',
      do: async (d) => {
        await d.goTab('Konkordans');
        await d.moveTo(d.ui.kwicHit());
      },
    },
    {
      id: 'anchor',
      say: 'Med en hatt foran et ord gjør du det til anker. Nå finner vi demokrati bare der diktatur står i nærheten. Glidebryteren styrer hvor stort vinduet er.',
      cap: 'Med ^ foran et ord gjør du det til anker: «diktatur ^demokrati» finner demokrati der diktatur står i nærheten. Glidebryteren styrer vinduet.',
      do: async (d) => {
        await d.search('diktatur ^demokrati');
        await d.moveTo(d.ui.windowSlider());
      },
    },
    {
      // Slowest step on the full collection (~14 s for «frihet»)
      id: 'collocations',
      say: 'Kollokasjoner viser hvilke ord som står nær søkeordet. Sorter på nærhets-z for å finne ord som ofte står tett ved.',
      do: async (d) => {
        await d.click(d.tab('Kollokasjoner'));
        await d.search('frihet');
        await d.sortBy('Nærhets-z');
      },
    },
    {
      id: 'corpus',
      say: 'Med Definer korpus avgrenser du hvilke bøker du søker i: etter år, språk, sjanger, forfatter, emne eller Dewey. Vi lager et korpus med bøker av Knut Hamsun.',
      do: async (d) => {
        await d.goTab('Telling');
        await d.defineCorpus({ name: 'Hamsun', author: 'Hamsun, K', authorPick: 'Knut' });
      },
    },
    {
      id: 'corpusInUse',
      say: 'Korpuset vises øverst, og alle verktøyene søker nå bare i disse bøkene.',
      do: async (d) => {
        await d.applyCorpus();
        await d.moveTo(d.ui.corpusBar());
        await d.search('Isak, Inger');
        await d.moveTo(d.ui.results());
      },
    },
    {
      id: 'arc',
      say: 'Vonnegut-buen viser hvordan ordene fordeler seg gjennom en bok, fra første til siste side.',
      do: (d) => d.goTab('Vonnegut-bue'),
    },
    {
      id: 'arcBook',
      say: 'Velg en bok fra korpuset. Her ser vi hvor i Markens grøde Isak og Inger nevnes.',
      do: async (d) => {
        await d.pickArcBook('Markens');
        await d.moveTo(d.ui.chart());
      },
    },
    {
      id: 'help',
      say: 'Under Om, Syntaks finner du flere eksempler på søkeuttrykk. Lykke til!',
      do: (d) => d.openHelp(),
    },
  ],
};
