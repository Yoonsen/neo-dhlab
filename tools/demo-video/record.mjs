// Records a narrated walkthrough of Neo-DHLAB from a scenario file.
// Usage: node record.mjs [scenarios/<name>.mjs]   (default scenarios/intro.mjs)
// Output: out/<name>/ with frames/, audio/, timeline.json (and fail.png if a step fails).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SCENARIO = path.resolve(process.argv[2] || path.join(HERE, 'scenarios', 'intro.mjs'));
const S = (await import(SCENARIO)).default;
const NAME = path.basename(SCENARIO, '.mjs');
const LANG = S.lang === 'en' ? 'en' : 'no';
const VOICE = S.voice || (LANG === 'en' ? 'Samantha' : 'Nora');
const RATE = String(S.rate || (LANG === 'en' ? 175 : 178));
// UI texts the recorder looks for (mirror src/i18n.ts)
const L = {
  no: {
    defineCorpus: /Definer korpus…|Nytt \/ endre korpus…/, applyCorpus: 'Bruk korpus', help: 'Om / Syntaks',
    corpusName: /Navn på korpus/, fromYear: 'Fra år', toYear: 'Til år', lang: 'Språk', form: 'Litterær form',
    author: /Forfatter/, arcFilter: 'Filtrer tittel/forfatter eller dhlabid…', locale: 'nb-NO',
  },
  en: {
    defineCorpus: /Define corpus…|New \/ edit corpus…/, applyCorpus: 'Apply corpus', help: 'About / Syntax',
    corpusName: /Corpus name/, fromYear: 'From year', toYear: 'To year', lang: 'Language', form: 'Literary form',
    author: /Author/, arcFilter: 'Filter title/author or dhlabid…', locale: 'en-GB',
  },
}[LANG];
const OUT = path.resolve(process.env.DEMO_WORK_DIR || path.join(HERE, 'out', NAME));
const FRAMES = path.join(OUT, 'frames');
const AUDIO = path.join(OUT, 'audio');
const APP_URL = process.env.APP_URL || 'http://localhost:5180/';
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(AUDIO, { recursive: true });
fs.rmSync(path.join(OUT, 'fail.png'), { force: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- narration (macOS say, Norwegian voice) ----------
let ttsIdx = 0;
function tts(text) {
  let spoken = text.replace(/\^/g, '');
  if (LANG === 'no') {
    spoken = spoken
      .replace(/DHLAB/g, 'D H lab')
      .replace(/1473/g, 'fjorten-syttitre')
      .replace(/Om \/ Syntaks/g, 'Om, Syntaks')
      .replace(/\bOR\b/g, 'O R');
  } else {
    spoken = spoken.replace(/DHLAB/g, 'D H Lab').replace(/About \/ Syntax/g, 'About, Syntax');
  }
  const file = path.join(AUDIO, `s${String(++ttsIdx).padStart(2, '0')}.aiff`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', file, spoken]);
  const dur = parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString(),
  );
  return { file, dur };
}

// ---------- browser + screencast ----------
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1.2,
  locale: L.locale,
});
await context.addInitScript((lang) => { try { localStorage.setItem('neo_dhlab_ui_lang_v1', lang); } catch {} }, LANG);
const page = await context.newPage();
await page.goto(APP_URL);
await page.waitForSelector('.omnibox-input');

const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  const t = Date.now() / 1000;
  const f = path.join(FRAMES, `f${String(frames.length).padStart(6, '0')}.jpg`);
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  frames.push({ f, t });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch {}
});

// ---------- overlay: cursor, caption, title cards, blur of text excerpts ----------
await page.evaluate(() => {
  const css = `
  #demo-ov{position:fixed;inset:0;margin:0;padding:0;border:0;background:transparent;width:100vw;height:100vh;max-width:none;max-height:none;pointer-events:none;overflow:visible}
  #demo-cursor{position:fixed;left:800px;top:450px;width:26px;height:26px;transition:left .65s cubic-bezier(.4,0,.2,1),top .65s cubic-bezier(.4,0,.2,1);z-index:3}
  #demo-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  .demo-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #7a2b6e;animation:demo-rip .5s ease-out forwards;z-index:2}
  @keyframes demo-rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1180px;background:rgba(28,22,34,.88);color:#fff;font:500 21px/1.4 system-ui,-apple-system,sans-serif;padding:12px 22px;border-radius:10px;text-align:center;opacity:0;transition:opacity .3s;z-index:1}
  #demo-card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2b1630;color:#fff;font-family:system-ui,-apple-system,sans-serif;opacity:0;transition:opacity .6s;z-index:4}
  #demo-card h1{font-size:54px;margin:0 0 14px;font-weight:700}
  #demo-card p{font-size:24px;margin:0;opacity:.8}
  #demo-tick{position:fixed;right:0;bottom:0;width:2px;height:2px;animation:demo-tk .5s steps(2) infinite;z-index:5}
  @keyframes demo-tk{0%{background:rgba(255,255,255,.02)}100%{background:rgba(255,255,255,.04)}}
  .kwic-table tbody .col-left,.kwic-table tbody .col-right{filter:blur(5px)}
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  const ov = document.createElement('div');
  ov.id = 'demo-ov';
  ov.setAttribute('popover', 'manual');
  ov.innerHTML = `
    <div id="demo-card"><h1></h1><p></p></div>
    <div id="demo-cap"></div><div id="demo-tick"></div>
    <div id="demo-cursor"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`;
  document.body.appendChild(ov);
  ov.showPopover();
});

const raise = () => page.evaluate(() => { const o = document.getElementById('demo-ov'); o.hidePopover(); o.showPopover(); });
const caption = (text) =>
  page.evaluate((text) => {
    const c = document.getElementById('demo-cap');
    c.textContent = text;
    c.style.opacity = text ? '1' : '0';
  }, text);
const card = (title, sub, show) =>
  page.evaluate(([title, sub, show]) => {
    const c = document.getElementById('demo-card');
    c.querySelector('h1').textContent = title;
    c.querySelector('p').textContent = sub;
    c.style.opacity = show ? '1' : '0';
  }, [title, sub, show]);

async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  await page.evaluate(([x, y]) => {
    const c = document.getElementById('demo-cursor');
    c.style.left = x - 4 + 'px';
    c.style.top = y - 2 + 'px';
  }, [x, y]);
  await sleep(750);
  return { x, y };
}
async function click(locator) {
  const { x, y } = await moveTo(locator);
  await page.evaluate(([x, y]) => {
    const r = document.createElement('div');
    r.className = 'demo-ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    document.getElementById('demo-ov').appendChild(r);
    setTimeout(() => r.remove(), 600);
  }, [x, y]);
  await locator.click();
  await sleep(250);
}
async function typeInto(locator, text) {
  await click(locator);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: 85 });
  await sleep(300);
}
async function waitIdle(extra = 900) {
  await sleep(400);
  await page
    .waitForFunction(() => !document.querySelector('.loading-card, .spinner') && !/Beregner|Computing|Teller i arena|Counting in the arena/.test(document.body.innerText), null, { timeout: 30000 })
    .catch(() => console.warn('waitIdle timeout'));
  await sleep(extra);
}
const tab = (name) => page.locator('[role=tab]', { hasText: name });
async function search(q) {
  await typeInto(page.locator('.omnibox-input'), q);
  await page.keyboard.press('Enter');
  await waitIdle();
}

const timeline = [];
const t0Holder = {};
const timings = [];
async function scene(id, text, actions = async () => {}, { cap = text } = {}) {
  const { file, dur } = tts(text);
  const start = Date.now() / 1000;
  timeline.push({ id, start, file, dur, text: cap });
  await caption(cap);
  try { await actions(); } catch (e) { await page.screenshot({ path: path.join(OUT, 'fail.png') }); throw e; }
  const busy = Date.now() / 1000 - start;
  timings.push({ id, narration: dur, actions: busy });
  const left = start + dur + 0.6 - Date.now() / 1000;
  if (left > 0) await sleep(left * 1000);
}

// ---------- helpers handed to scenario scenes ----------
const dlg = () => page.locator('dialog[open]');
const d = {
  page, sleep, waitIdle, moveTo, click, typeInto, search, tab, raise,
  // Common places to point at
  ui: {
    corpusBar: () => page.locator('.context-bar-card'),
    results: () => page.locator('table:visible, .result-hero-card:visible').first(),
    chart: () => page.locator('.chart-figure:visible').first(),
    kwicHit: () => page.locator('.kwic-table tbody .col-hit').first(),
    windowSlider: () => page.locator('input[type=range]:visible').first(),
    yearFrom: () => page.locator('.year-input:visible').first(),
    yearTo: () => page.locator('.year-input:visible').nth(1),
    label: (text) => page.getByText(text, { exact: true }).first(),
    column: (text) => page.locator('thead th', { hasText: text }).first(),
    collSampleSize: () => page.locator('[title=sampleSize] select'),
  },
  async goTab(name) {
    await click(tab(name));
    await waitIdle(600);
  },
  async select(locator, value) {
    await moveTo(locator);
    await locator.selectOption(String(value));
    await sleep(400);
  },
  async setYears(from, to) {
    if (from) await typeInto(d.ui.yearFrom(), String(from));
    if (to) await typeInto(d.ui.yearTo(), String(to));
    await sleep(500);
  },
  async sortBy(column) {
    await click(d.ui.column(column));
    await waitIdle(400);
  },
  /** Opens «Definer korpus…» and fills the given fields (empty ones are skipped). Does not submit. */
  async defineCorpus({ name, author, authorPick, fromYear, toYear, lang, form } = {}) {
    await click(page.getByRole('button', { name: L.defineCorpus }));
    await raise();
    await sleep(400);
    if (name) await typeInto(dlg().getByLabel(L.corpusName), name);
    if (fromYear) await typeInto(dlg().getByLabel(L.fromYear, { exact: true }), String(fromYear));
    if (toYear) await typeInto(dlg().getByLabel(L.toYear, { exact: true }), String(toYear));
    if (lang) await d.select(dlg().getByLabel(L.lang, { exact: true }), lang);
    if (form) await d.select(dlg().getByLabel(L.form, { exact: true }), form);
    if (author) {
      await typeInto(dlg().getByLabel(L.author), author);
      await sleep(1500);
      if (authorPick) {
        const sugg = page.locator('.facet-suggest-item', { hasText: authorPick }).first();
        if (await sugg.count()) await click(sugg);
        else console.warn(`defineCorpus: no author suggestion containing "${authorPick}"`);
      }
    }
  },
  async applyCorpus() {
    await click(page.getByRole('button', { name: L.applyCorpus }));
    await waitIdle(800);
  },
  /** Vonnegut tab: picks the first corpus book matching `filter` and deselects all others. */
  async pickArcBook(filter) {
    await typeInto(page.getByPlaceholder(L.arcFilter), filter);
    await sleep(800);
    const chip = page.locator('.candidate-book-chip').first();
    if (!(await chip.count())) throw new Error(`pickArcBook: no book in the corpus matches "${filter}"`);
    await click(chip);
    await sleep(500);
    for (let i = 0; i < 10; i++) {
      const pills = page.locator('.selected-book-pill').filter({ hasNotText: filter });
      if (!(await pills.count())) break;
      await click(pills.first().locator('.pill-clear-btn'));
    }
    await waitIdle(800);
  },
  async openHelp() {
    await click(page.locator('button', { hasText: L.help }).first());
    await raise();
    await sleep(1500);
  },
};

// ---------- run the scenario ----------
await waitIdle(300);
await card(S.title, S.subtitle, true);
await sleep(1000);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080 });
t0Holder.t = Date.now() / 1000;
await scene('welcome', S.welcome, async () => { await sleep(1200); }, { cap: '' });
await card(S.title, S.subtitle, false);
await sleep(700);
for (const sc of S.scenes) {
  await scene(sc.id, sc.say, () => sc.do(d), { cap: sc.cap ?? sc.say });
}
await sleep(800);
await caption('');
await card(S.title, S.endSubtitle ?? 'yoonsen.github.io/neo-dhlab', true);
await sleep(3000);

const tEnd = Date.now() / 1000;
await cdp.send('Page.stopScreencast');
await sleep(300);
fs.writeFileSync(
  path.join(OUT, 'timeline.json'),
  JSON.stringify({ lang: LANG, t0: frames[0]?.t ?? t0Holder.t, tEnd, frames, scenes: timeline }, null, 1),
);
console.log(`frames: ${frames.length}, duration: ${(tEnd - (frames[0]?.t ?? 0)).toFixed(1)}s`);
console.log('\nscene          narration  actions');
for (const t of timings) {
  const slow = t.actions > t.narration + 1 ? `  SLOW (+${(t.actions - t.narration).toFixed(1)} s waiting on the app)` : '';
  console.log(`${t.id.padEnd(14)} ${t.narration.toFixed(1).padStart(6)} s ${t.actions.toFixed(1).padStart(6)} s${slow}`);
}
await browser.close();
