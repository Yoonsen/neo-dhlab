// English version of skrivemaater-or.mjs: spelling variants and OR, with the app UI in English.
// Same facts as the Norwegian scenario (checked against the API 2026-11-27):
//   frihed + frihet = «frihed OR frihet» exactly in hits; books with both forms count once.
//   The curves cross around 1915, about a decade after the 1907 spelling reform.
// voice: any `say -v '?'` voice. Premium/enhanced voices (System Settings → Accessibility →
// Spoken Content → Manage voices) sound clearly more natural, e.g. 'Ava (Premium)'.

export default {
  lang: 'en',
  voice: 'Samantha',
  title: 'Spelling variants and OR',
  subtitle: 'Merge old and new spellings in one search',
  endSubtitle: 'DHLAB Corpus Engine · yoonsen.github.io/neo-dhlab',
  welcome: 'Spelling variants and OR, in the DHLAB corpus engine.',

  scenes: [
    {
      id: 'twoForms',
      say: 'Many Norwegian words have changed their spelling. Freedom was once written frihed, and is now frihet. Separate them with a comma to get one row each.',
      do: async (d) => {
        await d.click(d.tab('Counts'));
        await d.search('frihed, frihet');
        await d.moveTo(d.ui.results());
      },
    },
    {
      id: 'trendsShift',
      say: 'Trends shows the shift. The spelling reform came in 1907, but the new form only overtakes the old one in books around 1915.',
      do: async (d) => {
        await d.goTab('Trends');
        await d.setYears(1850, 1950);
        await d.moveTo(d.ui.chart());
      },
    },
    {
      id: 'orSum',
      say: 'Put OR between the spellings to merge them. The third curve is the sum, and it runs smoothly across the change.',
      cap: 'Put OR (in capitals) between the spellings: «frihed OR frihet» merges them. The third curve is the sum.',
      do: async (d) => {
        await d.search('frihed, frihet, frihed OR frihet');
        await d.moveTo(d.ui.chart());
      },
    },
    {
      id: 'orCounts',
      say: 'In Counts, the hits add up exactly. Books are counted only once, even when they use both spellings.',
      do: async (d) => {
        await d.goTab('Counts');
        await d.moveTo(d.ui.results());
      },
    },
    {
      id: 'orConcordance',
      say: 'OR works in the concordance too, and the hits show both spellings. The text is blurred in this video.',
      do: async (d) => {
        await d.click(d.tab('Concordance'));
        await d.search('frihed OR frihet');
        await d.moveTo(d.ui.kwicHit());
      },
    },
    {
      id: 'orCollocations',
      say: 'In Collocations, the words around both spellings are counted together. A smaller sample answers faster, and proximity z brings the closest neighbours to the top.',
      do: async (d) => {
        await d.click(d.tab('Collocations'));
        await d.select(d.ui.collSampleSize(), 1000);
        await d.search('frihed OR frihet');
        await d.sortBy('Proximity z');
      },
    },
    {
      id: 'orAnchor',
      say: 'Groups also work in proximity searches. Here we find skib or skip, the old and new spellings of ship, near storm. The caret makes the whole group the anchor.',
      cap: 'Groups in proximity searches: «^(skib OR skip) storm» finds skib or skip near storm. ^ makes the whole group the anchor.',
      do: async (d) => {
        await d.click(d.tab('Concordance'));
        await d.search('^(skib OR skip) storm');
        await d.moveTo(d.ui.kwicHit());
      },
    },
    {
      id: 'help',
      say: 'About, Syntax has more examples of groups and proximity searches.',
      do: (d) => d.openHelp(),
    },
  ],
};
