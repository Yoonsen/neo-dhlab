// Spelling variants and OR (~1½ min): frihed/frihet as a low-threshold way into OR groups.
// Facts checked against the API (2026-11-27):
//   frihet 1 119 160 hits / 200 109 books, frihed 348 101 / 44 513,
//   «frihed OR frihet» 1 467 261 hits (exact sum) / 235 106 books (books with both forms count once).
//   Per million words: 1905 frihed 58.3 vs frihet 1.3; 1915 18.9 vs 18.7; 1920 23.1 vs 31.7.
//   So the 1907 spelling reform shows up in books with a lag: the curves cross around 1915.
// OR works the same way in Telling, Trender, Konkordans and Kollokasjoner.

export default {
  title: 'Skrivemåter og OR',
  subtitle: 'Slå sammen gamle og nye skrivemåter i ett søk',
  endSubtitle: 'DHLAB Korpusmotor · yoonsen.github.io/neo-dhlab',
  welcome: 'Skrivemåter og OR i DHLAB Korpusmotor.',

  scenes: [
    {
      id: 'twoForms',
      say: 'Mange ord har endret skrivemåte. Vi søker på frihed og frihet, skilt med komma, og får hver sin linje.',
      do: async (d) => {
        await d.click(d.tab('Telling'));
        await d.search('frihed, frihet');
        await d.moveTo(d.ui.results());
      },
    },
    {
      id: 'trendsShift',
      say: 'I Trender ser vi skiftet. Rettskrivingen ble endret i 1907, men først rundt 1915 tar frihet over for frihed i bøkene.',
      do: async (d) => {
        await d.goTab('Trender');
        await d.setYears(1850, 1950);
        await d.moveTo(d.ui.chart());
      },
    },
    {
      id: 'orSum',
      say: 'Skriv OR mellom skrivemåtene for å slå dem sammen. Den tredje kurven er summen, og den går jevnt over skiftet.',
      cap: 'Skriv OR (store bokstaver) mellom skrivemåtene: «frihed OR frihet» slår dem sammen. Den tredje kurven er summen.',
      do: async (d) => {
        await d.search('frihed, frihet, frihed OR frihet');
        await d.moveTo(d.ui.chart());
      },
    },
    {
      id: 'orCounts',
      say: 'I Telling blir treffene summen av begge skrivemåtene. Bøkene telles bare én gang, selv om de bruker begge.',
      do: async (d) => {
        await d.goTab('Telling');
        await d.moveTo(d.ui.results());
      },
    },
    {
      id: 'orConcordance',
      say: 'OR virker også i Konkordans. Treffene viser begge skrivemåtene om hverandre. Teksten er sløret i denne videoen.',
      do: async (d) => {
        await d.click(d.tab('Konkordans'));
        await d.search('frihed OR frihet');
        await d.moveTo(d.ui.kwicHit());
      },
    },
    {
      // Smaller sample keeps this step fast; the default (5 000) took ~14 s for «frihet» alone.
      id: 'orCollocations',
      say: 'Og i Kollokasjoner telles ordene rundt begge skrivemåtene sammen. Et mindre utvalg gir raskere svar, og nærhets-z løfter fram ordene som står tettest.',
      do: async (d) => {
        await d.click(d.tab('Kollokasjoner'));
        await d.select(d.ui.collSampleSize(), 1000);
        await d.search('frihed OR frihet');
        await d.sortBy('Nærhets-z');
      },
    },
    {
      id: 'orAnchor',
      say: 'Grupper kan også brukes i nærhetssøk. Her finner vi skib eller skip nær storm, og hatten gjør hele gruppen til anker.',
      cap: 'Grupper i nærhetssøk: «^(skib OR skip) storm» finner skib eller skip nær storm. ^ gjør hele gruppen til anker.',
      do: async (d) => {
        await d.click(d.tab('Konkordans'));
        await d.search('^(skib OR skip) storm');
        await d.moveTo(d.ui.kwicHit());
      },
    },
    {
      id: 'help',
      say: 'Under Om, Syntaks finner du flere eksempler på grupper og nærhetssøk.',
      do: (d) => d.openHelp(),
    },
  ],
};
