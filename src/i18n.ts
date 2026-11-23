export type UiLang = 'no' | 'en';

export const UI_LANG_OPTIONS: { code: UiLang; label: string; short: string }[] = [
  { code: 'no', label: 'Norsk', short: 'NO' },
  { code: 'en', label: 'English', short: 'EN' },
];

export interface UiStrings {
  brandSub: string;
  profileCalm: string;
  profilePeach: string;
  profileDark: string;
  helpBtn: string;
  corpusBadge: string;
  wholeCollection: string;
  booksUnit: string;
  bookSingularUnit: string;
  wordsUnit: string;
  billionWords: string;
  myCorpora: string;
  defineCorpus: string;
  editCorpus: string;
  resetCorpus: string;
  tabCounts: string;
  tabConcordance: string;
  tabCollocations: string;
  tabTrends: string;
  tabDispersion: string;
  searchPlaceholder: string;
  recentSearches: string;
  recentSearchesHeader: string;
  closeBtn: string;
  searchBtn: string;
  searchingBtn: string;
  windowLabel: string;
  symmetricLabel: string;
  expressionsCount: string;
  fixSyntaxHint: string;
  hitsLabel: string;
  booksWithHitsLabel: string;
  responseTimeLabel: string;
  coverageLabel: string;
  intensityLabel: string;
  hitsPerBook: string;
  downloadExcel: string;
  showAsTrends: string;
  comparePairBtn: string;
  compareSpansBtn: string;
  comparingBtn: string;
  resultsCountHeader: string;
  colExpression: string;
  colCountMode: string;
  colHits: string;
  colBooks: string;
  colCoverage: string;
  colIntensity: string;
  colTime: string;
  colConcordance: string;
  showBtn: string;
  useThisQuery: string;
  metricPpm: string;
  metricCohort: string;
  metricCoverage: string;
  metricIntensity: string;
  metricTotal: string;
  smoothingLabel: string;
  smooth1: string;
  smooth3: string;
  smooth5: string;
  smooth11: string;
  showNumbers: string;
  hideNumbers: string;
  calculatingLabel: string;
  yearLabel: string;
  hoverHintPpm: string;
  hoverHintCohort: string;
  hoverHintCoverage: string;
  hoverHintIntensity: string;
  noTrendData: string;
  curveStyleBtn: string;
  curveThicknessLabel: string;
  curveAlphaLabel: string;
  curveFillLabel: string;
  curveResetBtn: string;
  exprLabel: string;
  linesCountLabel: string;
  refetchBtn: string;
  fetchingBtn: string;
  loadingConcordance: string;
  colBook: string;
  colLeft: string;
  colHit: string;
  colRight: string;
  colArc: string;
  arcBtnLabel: string;
  arcBtnTitle: (title: string) => string;
  linesFromBooks: (lines: number, books: number) => string;
  // Collocations
  collDirLabel: string;
  collDirBoth: (w: number) => string;
  collDirSplit: (w: number) => string;
  collDirBefore: (w: number) => string;
  collDirAfter: (w: number) => string;
  collWinLabel: string;
  collSampleLabel: string;
  collPerBookLabel: string;
  collPerBook1: string;
  collPerBookN: (n: number) => string;
  collFoldLabel: string;
  collHidePunctLabel: string;
  collFilterPlaceholder: string;
  collLoadingSub: (sample: string, perBook: number, w: number) => string;
  collColWord: string;
  collColWordBefore: string;
  collColWordAfter: string;
  collColCount: string;
  collColShare: string;
  collColDist: (mu0: string) => string;
  collColSd: string;
  collColZ: string;
  collCaptionBefore: (word: string, w: number, mu0: string) => string;
  collCaptionAfter: (word: string, w: number, mu0: string) => string;
  // Vonnegut arcs (Dispersion)
  dispHeaderTitle: (count: number) => string;
  dispHeaderSub: string;
  dispFilterPlaceholder: string;
  dispAddIdBtn: string;
  dispKeepFirstBtn: string;
  dispAxisLabel: string;
  dispAxisBins: (bins: number) => string;
  dispAxisWindow: (win: number) => string;
  dispPartsLabel: string;
  dispPartsOption: (n: number) => string;
  dispWordsPerWinLabel: string;
  dispMultiBooksLabel: string;
  dispMultiConcat: string;
  dispMultiStack: string;
  dispMultiSum: string;
  dispMetricLabel: string;
  dispMetricPer1k: string;
  dispMetricRaw: string;
  dispSmooth1: string;
  dispSmooth3: string;
  dispSmooth5: string;
  dispSmooth9: string;
  dispSmooth15: string;
  dispLoading: string;
  dispHoverSegment: (seg: number, total: number, pct: number) => string;
  dispPer1kUnit: string;
  dispRawLabel: string;
  dispHoverHint: string;
  dispEmptyHint: string;
  // CorpusBuilder
  corpusModalTitle: string;
  uploadFileTitle: string;
  uploadFileSub: string;
  chooseFileBtn: string;
  readingBtn: string;
  corpusNameLabel: string;
  corpusNamePlaceholder: string;
  textFilterLabel: string;
  fromYear: string;
  toYear: string;
  yearPlaceholderFrom: string;
  yearPlaceholderTo: string;
  langLabel: string;
  allLangs: string;
  formLabel: string;
  allForms: string;
  authorLabel: string;
  subjectLabel: string;
  ddcLabel: string;
  ddcPlaceholder: string;
  pasteIdsLabel: string;
  copyTokenBtn: string;
  cancelBtn: string;
  applyCorpusBtn: string;
  buildingCorpusBtn: string;
  helpTitle: string;
  helpIntro: string;
  helpSec1Title: string;
  helpSec1Desc: string;
  helpSec2Title: string;
  helpSec3Title: string;
  helpSec3Desc: string;
  helpSec4Title: string;
  helpCopyright: string;
}

export const TRANSLATIONS: Record<UiLang, UiStrings> = {
  no: {
    brandSub: 'DHLAB · Korpusmotor',
    profileCalm: 'Profil: Rolig',
    profilePeach: 'Profil: NB Fersken 20',
    profileDark: 'Profil: NB Aubergine (Mørk)',
    helpBtn: 'Om / Syntaks',
    corpusBadge: 'Korpus',
    wholeCollection: 'Hele boksamlingen',
    booksUnit: 'bøker',
    bookSingularUnit: 'bok',
    wordsUnit: 'ord',
    billionWords: '38,5 mrd. ord',
    myCorpora: 'Mine korpus',
    defineCorpus: 'Definer korpus…',
    editCorpus: 'Nytt / endre korpus…',
    resetCorpus: 'Hele samlingen',
    tabCounts: 'Telling',
    tabConcordance: 'Konkordans',
    tabCollocations: 'Kollokasjoner',
    tabTrends: 'Trender',
    tabDispersion: 'Vonnegut-bue',
    searchPlaceholder: 'Søk: demokrati, diktatur eller NEAR(skib storm, 10)',
    recentSearches: 'Siste søk ▾',
    recentSearchesHeader: 'Siste søk (lagret i nettleseren)',
    closeBtn: 'Lukk',
    searchBtn: 'Søk',
    searchingBtn: 'Søker…',
    windowLabel: 'Vindu',
    symmetricLabel: 'Symmetrisk',
    expressionsCount: 'uttrykk (komma-separert)',
    fixSyntaxHint: 'Rett syntaksfeilen over for å kjøre søket',
    hitsLabel: 'Antall treff',
    booksWithHitsLabel: 'Bøker med treff',
    responseTimeLabel: 'Svartid',
    coverageLabel: 'Dekning',
    intensityLabel: 'Intensitet',
    hitsPerBook: 'treff/bok',
    downloadExcel: 'Last ned Excel (.xlsx)',
    showAsTrends: 'Vis som trendkurver →',
    comparePairBtn: 'Sammenlign Par vs. Anker',
    compareSpansBtn: 'Sammenlign Spenn vs. ^anker',
    comparingBtn: 'Sammenligner…',
    resultsCountHeader: 'Resultater',
    colExpression: 'Søkeuttrykk',
    colCountMode: 'Tellemåte',
    colHits: 'Treff',
    colBooks: 'Bøker',
    colCoverage: 'Dekning (doc/N)',
    colIntensity: 'Intensitet (treff/bok)',
    colTime: 'Tid',
    colConcordance: 'Konkordans',
    showBtn: 'Vis →',
    useThisQuery: 'Bruk dette søket',
    metricPpm: 'Per million ord',
    metricCohort: 'Kohort (%)',
    metricCoverage: 'Dekning (andel bøker %)',
    metricIntensity: 'Intensitet (treff/bok)',
    metricTotal: 'Absolutt antall',
    smoothingLabel: 'Glatting',
    smooth1: 'Ingen (1 år)',
    smooth3: '3-års snitt',
    smooth5: '5-års snitt',
    smooth11: '11-års snitt',
    showNumbers: 'Vis tall',
    hideNumbers: 'Skjul tall',
    calculatingLabel: 'Beregner',
    yearLabel: 'År',
    hoverHintPpm: 'Hold pekeren over grafen for verdier per år.',
    hoverHintCohort:
      'Kohort (%): hver kurves relative andel av kurvegruppens samlede frekvens hvert år (summerer til 100 %).',
    hoverHintCoverage:
      'Dekning (bøker med treff / bøker i korpuset): prosentandel av bøkene hvert år som inneholder uttrykket.',
    hoverHintIntensity:
      'Intensitet (treff / bøker med treff): gjennomsnittlig antall forekomster per bok der uttrykket forekommer.',
    noTrendData: 'Ingen årsdata funnet for dette søket/korpuset.',
    curveStyleBtn: 'Kurvestil ▾',
    curveThicknessLabel: 'Tykkelse:',
    curveAlphaLabel: 'Alpha (dekkevne):',
    curveFillLabel: 'Fyll under kurve',
    curveResetBtn: 'Nullstill',
    exprLabel: 'Uttrykk:',
    linesCountLabel: 'Antall linjer',
    refetchBtn: 'Hent på nytt',
    fetchingBtn: 'Henter…',
    loadingConcordance: 'Henter konkordanslinjer…',
    colBook: 'Bok (Nettbiblioteket)',
    colLeft: 'Venstre kontekst',
    colHit: 'Treff',
    colRight: 'Høyre kontekst',
    colArc: 'Bue',
    arcBtnLabel: '📈 Bue',
    arcBtnTitle: (title) => `Vis Vonnegut-bue (narrativ bue) i «${title}»`,
    linesFromBooks: (lines, books) => `${lines} linjer fra ${books} bøker`,
    // Collocations
    collDirLabel: 'Retning:',
    collDirBoth: (w) => `Begge sider (±${w} ord)`,
    collDirSplit: (w) => `Foran | Etter (−${w} | +${w})`,
    collDirBefore: (w) => `Kun foran (−${w} ord)`,
    collDirAfter: (w) => `Kun etter (+${w} ord)`,
    collWinLabel: 'Vindu (lengde):',
    collSampleLabel: 'Utvalg (treff):',
    collPerBookLabel: 'Treff/bok:',
    collPerBook1: '1 (flest bøker)',
    collPerBookN: (n) => `${n} pr. bok`,
    collFoldLabel: 'Slå sammen A/a',
    collHidePunctLabel: 'Skjul tegn',
    collFilterPlaceholder: 'Filtrer kollokat…',
    collLoadingSub: (sample, perBook, w) =>
      `Utvalg: opptil ${sample} treff (maks ${perBook} pr. bok, vindu ±${w} ord)`,
    collColWord: 'Kollokat (ord)',
    collColWordBefore: 'Ord foran',
    collColWordAfter: 'Ord etter',
    collColCount: 'Antall',
    collColShare: 'Andel',
    collColDist: (mu0) => `Avstand (dist, μ₀=${mu0})`,
    collColSd: 'Spredning (sd)',
    collColZ: 'Nærhets-z (z)',
    collCaptionBefore: (word, w, mu0) =>
      `← Foran «${word}» (−${w} ord · μ₀=${mu0})`,
    collCaptionAfter: (word, w, mu0) =>
      `Etter «${word}» → (+${w} ord · μ₀=${mu0})`,
    // Vonnegut arcs (Dispersion)
    dispHeaderTitle: (count) => `Vonnegut-bue · Bøker (${count}/10):`,
    dispHeaderSub:
      'Narrativ bue gjennom teksten – velg 1–10 bøker fra korpuset eller klikk «📈 Bue» i Konkordans',
    dispFilterPlaceholder: 'Filtrer tittel/forfatter eller dhlabid…',
    dispAddIdBtn: '+ Legg til ID',
    dispKeepFirstBtn: 'Behold kun første',
    dispAxisLabel: 'Tekstakse:',
    dispAxisBins: (bins) => `Relativ posisjon (0–100 % i ${bins} deler)`,
    dispAxisWindow: (win) => `Faste tekstvinduer (${win} ord)`,
    dispPartsLabel: 'Deler:',
    dispPartsOption: (n) => `${n} deler`,
    dispWordsPerWinLabel: 'Ord/vindu:',
    dispMultiBooksLabel: 'Flere bøker:',
    dispMultiConcat: 'Etter hverandre (forfatterskap / tidslinje)',
    dispMultiStack: 'Under hverandre (én bue per bok)',
    dispMultiSum: 'Oppå hverandre (samlet 0–100 % profil)',
    dispMetricLabel: 'Mål:',
    dispMetricPer1k: 'Pr. 1 000 ord',
    dispMetricRaw: 'Antall treff i del/vindu',
    dispSmooth1: 'Ingen (1)',
    dispSmooth3: '±1 del (3)',
    dispSmooth5: '±2 deler (5)',
    dispSmooth9: '±4 deler (9)',
    dispSmooth15: 'Vonnegut-bue (±7)',
    dispLoading: 'Beregner narrativ bue gjennom teksten…',
    dispHoverSegment: (seg, total, pct) =>
      `Del ${seg} / ${total} (${pct} % ut i forløpet):`,
    dispPer1kUnit: 'pr. 1k ord',
    dispRawLabel: 'rå',
    dispHoverHint:
      'Hold pekeren over den narrative buen for å se tetthet gjennom teksten.',
    dispEmptyHint:
      'Velg en bok fra listen over (eller klikk «📈 Bue» på en linje i Konkordans) for å se den narrative buen gjennom teksten.',
    // CorpusBuilder
    corpusModalTitle: 'Definer korpus',
    uploadFileTitle: 'Last opp korpusfil (.xlsx eller .csv)',
    uploadFileSub: 'Konverterer kolonnen dhlabid eller urn til Roaring-bitmap',
    chooseFileBtn: 'Velg fil…',
    readingBtn: 'Leser…',
    corpusNameLabel: 'Navn på korpus (lagres automatisk under «Mine korpus»)',
    corpusNamePlaceholder:
      'f.eks. Skibsvrag, Ibsen-drama eller Avhandlinger 1990',
    textFilterLabel:
      'Begrens på søkeuttrykk i teksten (enkeltord, nærhetssøk eller frase)',
    fromYear: 'Fra år',
    toYear: 'Til år',
    yearPlaceholderFrom: 'Alle (f.eks. 1650 / 1800)',
    yearPlaceholderTo: 'Alle (f.eks. 1850 / 2026)',
    langLabel: 'Språk',
    allLangs: 'Alle språk',
    formLabel: 'Litterær form',
    allForms: 'Alle former',
    authorLabel: 'Forfatter (starter med)',
    subjectLabel: 'Emneord (starter med)',
    ddcLabel: 'Dewey / DDK (starter med)',
    ddcPlaceholder: '641 (mat) / 839.82 / 948.1',
    pasteIdsLabel: 'Eller lim inn dhlabid / URN direkte (valgfritt)',
    copyTokenBtn: 'Kopier Roaring-token',
    cancelBtn: 'Avbryt',
    applyCorpusBtn: 'Bruk korpus',
    buildingCorpusBtn: 'Bygger korpus…',
    helpTitle: 'Om DHLAB Korpusmotor',
    helpIntro:
      'Korpusmotoren søker i hele Nasjonalbibliotekets digitaliserte boksamling (713 913 bøker og 38,5 milliarder ord). Alle tellinger og trender beregnes eksakt uten utvalg ved hjelp av Roaring-bitmaps og arena-indekser.',
    helpSec1Title: '1. Bygge og bruke korpus («korpus i lomma»)',
    helpSec1Desc:
      'Klikk på «Definer korpus…» øverst for å avgrense hvilke bøker det søkes i (fra Excel/CSV med dhlabid/urn, fra katalogmetadata eller fra et søkeuttrykk i teksten). Korpuset lagres i nettleseren under «Mine korpus ▾».',
    helpSec2Title: '2. Søkesyntaks (klikk på et eksempel for å prøve)',
    helpSec3Title: '3. FTS5- og Elastic-syntaks',
    helpSec3Desc:
      'Søkemotoren forstår også FTS5-uttrykk (fra notebooks) og Elastic-nærhet (fra Nettbiblioteket). Dialekter kan ikke blandes i samme søk:',
    helpSec4Title: '4. Måltall i Trender og Telling',
    helpCopyright:
      'Konkordansvisningen følger Nasjonalbibliotekets rammer for opphavsrett: maks 25 ord per utdrag (klippet ved avsnitt), maks 200 linjer og maks 10 % av hver bok.',
  },
  en: {
    brandSub: 'DHLAB · Corpus Engine',
    profileCalm: 'Profile: Calm',
    profilePeach: 'Profile: NB Peach 20',
    profileDark: 'Profile: NB Aubergine (Dark)',
    helpBtn: 'About / Syntax',
    corpusBadge: 'Corpus',
    wholeCollection: 'Entire book collection',
    booksUnit: 'books',
    bookSingularUnit: 'book',
    wordsUnit: 'words',
    billionWords: '38.5B words',
    myCorpora: 'My corpora',
    defineCorpus: 'Define corpus…',
    editCorpus: 'New / edit corpus…',
    resetCorpus: 'Entire collection',
    tabCounts: 'Counts',
    tabConcordance: 'Concordance',
    tabCollocations: 'Collocations',
    tabTrends: 'Trends',
    tabDispersion: 'Vonnegut arcs',
    searchPlaceholder: 'Search: demokrati, diktatur or NEAR(skib storm, 10)',
    recentSearches: 'Recent ▾',
    recentSearchesHeader: 'Recent searches (saved in browser)',
    closeBtn: 'Close',
    searchBtn: 'Search',
    searchingBtn: 'Searching…',
    windowLabel: 'Window',
    symmetricLabel: 'Symmetric',
    expressionsCount: 'expressions (comma-separated)',
    fixSyntaxHint: 'Fix the syntax error above to run the search',
    hitsLabel: 'Total matches',
    booksWithHitsLabel: 'Books with matches',
    responseTimeLabel: 'Response time',
    coverageLabel: 'Coverage',
    intensityLabel: 'Intensity',
    hitsPerBook: 'hits/book',
    downloadExcel: 'Download Excel (.xlsx)',
    showAsTrends: 'View as trend lines →',
    comparePairBtn: 'Compare Pairs vs. Anchor',
    compareSpansBtn: 'Compare Spans vs. ^anchor',
    comparingBtn: 'Comparing…',
    resultsCountHeader: 'Results',
    colExpression: 'Query',
    colCountMode: 'Count mode',
    colHits: 'Matches',
    colBooks: 'Books',
    colCoverage: 'Coverage (doc/N)',
    colIntensity: 'Intensity (hits/book)',
    colTime: 'Time',
    colConcordance: 'Concordance',
    showBtn: 'View →',
    useThisQuery: 'Use this query',
    metricPpm: 'Per million words',
    metricCohort: 'Cohort (%)',
    metricCoverage: 'Coverage (% books)',
    metricIntensity: 'Intensity (hits/book)',
    metricTotal: 'Absolute count',
    smoothingLabel: 'Smoothing',
    smooth1: 'None (1 yr)',
    smooth3: '3-yr mean',
    smooth5: '5-yr mean',
    smooth11: '11-yr mean',
    showNumbers: 'Show table',
    hideNumbers: 'Hide table',
    calculatingLabel: 'Computing',
    yearLabel: 'Year',
    hoverHintPpm: 'Hover over the chart for yearly figures.',
    hoverHintCohort:
      'Cohort (%): each curve’s relative share of the group’s combined frequency per year (sums to 100%).',
    hoverHintCoverage:
      'Coverage (docs / books): percentage of books each year containing the expression.',
    hoverHintIntensity:
      'Intensity (hits / docs): average occurrences per book among books containing the expression.',
    noTrendData: 'No yearly data found for this query/corpus.',
    curveStyleBtn: 'Curve style ▾',
    curveThicknessLabel: 'Thickness:',
    curveAlphaLabel: 'Alpha (opacity):',
    curveFillLabel: 'Fill area under curve',
    curveResetBtn: 'Reset',
    exprLabel: 'Query:',
    linesCountLabel: 'Lines',
    refetchBtn: 'Refresh',
    fetchingBtn: 'Loading…',
    loadingConcordance: 'Loading concordance lines…',
    colBook: 'Book (NB Digital Library)',
    colLeft: 'Left context',
    colHit: 'Match',
    colRight: 'Right context',
    colArc: 'Arc',
    arcBtnLabel: '📈 Arc',
    arcBtnTitle: (title) =>
      `View Vonnegut arc (narrative dispersion) in "${title}"`,
    linesFromBooks: (lines, books) => `${lines} lines from ${books} books`,
    // Collocations
    collDirLabel: 'Direction:',
    collDirBoth: (w) => `Both sides (±${w} words)`,
    collDirSplit: (w) => `Before | After (−${w} | +${w})`,
    collDirBefore: (w) => `Before only (−${w} words)`,
    collDirAfter: (w) => `After only (+${w} words)`,
    collWinLabel: 'Window (length):',
    collSampleLabel: 'Sample (matches):',
    collPerBookLabel: 'Hits/book:',
    collPerBook1: '1 (most books)',
    collPerBookN: (n) => `${n} per book`,
    collFoldLabel: 'Fold case (A/a)',
    collHidePunctLabel: 'Hide punctuation',
    collFilterPlaceholder: 'Filter collocate…',
    collLoadingSub: (sample, perBook, w) =>
      `Sample: up to ${sample} matches (max ${perBook} per book, window ±${w} words)`,
    collColWord: 'Collocate (word)',
    collColWordBefore: 'Word before',
    collColWordAfter: 'Word after',
    collColCount: 'Count',
    collColShare: 'Share',
    collColDist: (mu0) => `Distance (dist, μ₀=${mu0})`,
    collColSd: 'Spread (sd)',
    collColZ: 'Proximity z (z)',
    collCaptionBefore: (word, w, mu0) =>
      `← Before "${word}" (−${w} words · μ₀=${mu0})`,
    collCaptionAfter: (word, w, mu0) =>
      `After "${word}" → (+${w} words · μ₀=${mu0})`,
    // Vonnegut arcs (Dispersion)
    dispHeaderTitle: (count) => `Vonnegut arcs · Books (${count}/10):`,
    dispHeaderSub:
      'Narrative arc across the text – select 1–10 books from the corpus or click "📈 Arc" in Concordance',
    dispFilterPlaceholder: 'Filter title/author or dhlabid…',
    dispAddIdBtn: '+ Add ID',
    dispKeepFirstBtn: 'Keep first only',
    dispAxisLabel: 'Text axis:',
    dispAxisBins: (bins) => `Relative position (0–100% in ${bins} bins)`,
    dispAxisWindow: (win) => `Fixed text windows (${win} words)`,
    dispPartsLabel: 'Bins:',
    dispPartsOption: (n) => `${n} bins`,
    dispWordsPerWinLabel: 'Words/win:',
    dispMultiBooksLabel: 'Multiple books:',
    dispMultiConcat: 'Sequential (authorship / timeline)',
    dispMultiStack: 'Stacked (one arc per book)',
    dispMultiSum: 'Superimposed (combined 0–100% profile)',
    dispMetricLabel: 'Metric:',
    dispMetricPer1k: 'Per 1,000 words',
    dispMetricRaw: 'Raw matches per segment',
    dispSmooth1: 'None (1)',
    dispSmooth3: '±1 bin (3)',
    dispSmooth5: '±2 bins (5)',
    dispSmooth9: '±4 bins (9)',
    dispSmooth15: 'Vonnegut arc (±7)',
    dispLoading: 'Computing narrative arc across the text…',
    dispHoverSegment: (seg, total, pct) =>
      `Segment ${seg} / ${total} (${pct}% through text):`,
    dispPer1kUnit: 'per 1k words',
    dispRawLabel: 'raw',
    dispHoverHint:
      'Hover over the narrative arc to inspect density across the text.',
    dispEmptyHint:
      'Select a book above (or click "📈 Arc" on a line in Concordance) to view its narrative arc across the text.',
    // CorpusBuilder
    corpusModalTitle: 'Define corpus',
    uploadFileTitle: 'Upload corpus file (.xlsx or .csv)',
    uploadFileSub: 'Converts dhlabid or urn column into a Roaring bitmap',
    chooseFileBtn: 'Choose file…',
    readingBtn: 'Reading…',
    corpusNameLabel: 'Corpus name (saved automatically under "My corpora")',
    corpusNamePlaceholder:
      'e.g. Shipwrecks, Ibsen plays, or 1990s dissertations',
    textFilterLabel:
      'Restrict by text search expression (word, proximity, or phrase)',
    fromYear: 'From year',
    toYear: 'To year',
    yearPlaceholderFrom: 'All (e.g. 1650 / 1800)',
    yearPlaceholderTo: 'All (e.g. 1850 / 2026)',
    langLabel: 'Language',
    allLangs: 'All languages',
    formLabel: 'Literary form',
    allForms: 'All forms',
    authorLabel: 'Author (starts with)',
    subjectLabel: 'Subject (starts with)',
    ddcLabel: 'Dewey / DDC (starts with)',
    ddcPlaceholder: '641 (food) / 839.82 / 948.1',
    pasteIdsLabel: 'Or paste dhlabid / URN directly (optional)',
    copyTokenBtn: 'Copy Roaring token',
    cancelBtn: 'Cancel',
    applyCorpusBtn: 'Apply corpus',
    buildingCorpusBtn: 'Building…',
    helpTitle: 'About DHLAB Corpus Engine',
    helpIntro:
      'Searches the National Library of Norway’s digitized book collection (713,913 books and 38.5 billion words). All counts and trends are computed exactly without sampling using Roaring bitmaps and arena indices.',
    helpSec1Title: '1. Building and using corpora ("corpus in your pocket")',
    helpSec1Desc:
      'Click "Define corpus…" at the top to restrict which books are searched (from Excel/CSV with dhlabid/urn, catalogue metadata, or a text query). Your corpora are saved in the browser under "My corpora ▾".',
    helpSec2Title: '2. Query syntax (click an example to try it)',
    helpSec3Title: '3. FTS5 and Elastic syntax',
    helpSec3Desc:
      'Also supports FTS5 expressions (from notebooks) and Elastic proximity. Dialects cannot be mixed within the same query:',
    helpSec4Title: '4. Metrics in Trends and Counts',
    helpCopyright:
      'Concordances respect copyright limits: max 25 words per snippet (clipped at paragraph), max 200 lines, and max 10% of any book.',
  },
};
