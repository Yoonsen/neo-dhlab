import { UiLang } from './i18n';

declare global {
  const __APP_BUILD_ID__: string;
}

export const CURRENT_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

export interface ChangelogRelease {
  version: string;
  date: string;
  title: Record<UiLang, string>;
  items: Record<UiLang, string[]>;
}

/**
 * Øk `CURRENT_CHANGELOG_VERSION` (og legg til et nytt innslag øverst i `CHANGELOG_RELEASES`)
 * når du vil at alle brukere skal få en «ulest nyhet»-prikk på «Nyheter»-knappen i toppfeltet.
 */
export const CURRENT_CHANGELOG_VERSION = '2026-11-23.1';

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: '2026-11-23.1',
    date: '2026-11-23',
    title: {
      no: 'Vertikal venstre-rail, Kollokasjoner med z/ps og bøker tilbake til 1473',
      en: 'Vertical left rail, Collocations with z/ps, and books back to 1473',
    },
    items: {
      no: [
        'Ny vertikal venstremeny (left rail) for rask veksling mellom Telling, Konkordans, Kollokasjoner, Trender og Vonnegut-bue, og grafen plassert øverst i Trendpanelet.',
        'Kollokasjonspanelet viser nå avstand (dist), spredning (sd), lokal nærhets-z (z), Poisson-Stirling (ps) og Ratio (p(x|y)/p(x)), med ett-klikks sortering og Excel-eksport.',
        'Fjernet 1800-grensen: både Korpusbyggeren og Trender støtter nå hele boksamlingen tilbake til 1473, med momentant årstallsfilter (0 ms) i trendverktøylinjen.',
        'Korpusbyggeren har fått autofullføring på Dewey / DDK (f.eks. 641.5 kokebøker) i tillegg til forfatter og emne.',
        'Full engelsk oversettelse (NO / EN) på tvers av alle fem analysepaneler.',
      ],
      en: [
        'New vertical left-rail navigation for switching between Counts, Concordance, Collocations, Trends, and Vonnegut arcs, with the chart placed above expression cards in Trends.',
        'Collocations now display mean distance (dist), distance spread (sd), local proximity z-score (z), Poisson-Stirling (ps), and Ratio (p(x|y)/p(x)), with sortable columns and Excel export.',
        'Removed the 1800 lower year limit: Corpus Builder and Trends now support the entire collection back to 1473, with an instant (0 ms) year range filter in the Trends toolbar.',
        'Added Dewey / DDC autocomplete (e.g. 641.5 cookbooks) in the Corpus Builder alongside author and subject autocomplete.',
        'Completed English translations (NO / EN) across all five analysis modules.',
      ],
    },
  },
  {
    version: '2026-11-20.1',
    date: '2026-11-20',
    title: {
      no: 'Vonnegut-buer (narrativ spredning), kurvestil og fargekodet konkordans',
      en: 'Vonnegut arcs (narrative dispersion), curve styling, and color-coded concordance',
    },
    items: {
      no: [
        'Nytt panel «Vonnegut-bue» (/dispersion) for å plotte narrativ utvikling gjennom 1–10 bøker (etter hverandre, stablet eller summert 0–100 %).',
        'Fargekodede treffgrupper og ankerutheving i Konkordans, med tittel/forfatter/år, direktelenke til treffet i Nettbiblioteket og «📈 Bue»-knapp på hver rad.',
        'Kurvestilverktøy (linjetykkelse, gjennomsiktighet/alpha og flatefyll) samt 2x Retina PNG-eksport i Trender og Vonnegut-bue.',
        'Utvidet FTS5+-spørrespråk med semijoin (a WHERE NEAR(a b, 10) AND NEAR(a c, 10)) og mengdenotasjon ({ a | ... }).',
      ],
      en: [
        'New "Vonnegut arcs" (/dispersion) module to plot narrative trajectories across 1–10 books (sequential, stacked, or superimposed 0–100%).',
        'Color-coded term groups and anchor highlighting in Concordance, with bibliographic metadata, direct NB Digital Library search links, and a "📈 Arc" button per row.',
        'Curve style toolbox (line thickness, opacity/alpha, area fill) and 2x Retina PNG export in Trends and Vonnegut arcs.',
        'Extended FTS5+ query syntax with semijoins (a WHERE NEAR(a b, 10) AND NEAR(a c, 10)) and set builder notation ({ a | ... }).',
      ],
    },
  },
];
