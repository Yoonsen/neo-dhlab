// Records a narrated walkthrough of Neo-DHLAB.
// Output: frames/ (jpeg + timestamps), timeline.json (scene start times + narration files).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const S = (await import(process.env.DEMO_SCENARIO ? path.resolve(process.env.DEMO_SCENARIO) : './scenario.mjs')).default;

// Working files (frames, narration, timeline) go to DEMO_WORK_DIR, default ./out (gitignored).
const OUT = path.resolve(process.env.DEMO_WORK_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), 'out'));
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
  const spoken = text
    .replace(/DHLAB/g, 'D H lab')
    .replace(/1473/g, 'fjorten-syttitre')
    .replace(/Om \/ Syntaks/g, 'Om, Syntaks')
    .replace(/\^/g, '');
  const file = path.join(AUDIO, `s${String(++ttsIdx).padStart(2, '0')}.aiff`);
  execFileSync('say', ['-v', 'Nora', '-r', '178', '-o', file, spoken]);
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
  locale: 'nb-NO',
});
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
    .waitForFunction(() => !document.querySelector('.loading-card, .spinner') && !/Beregner|Teller i arena/.test(document.body.innerText), null, { timeout: 30000 })
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

// ---------- script (choices come from scenario.mjs) ----------
const dlg = () => page.locator('dialog[open]');
await waitIdle(300);
await card(S.title, S.subtitle, true);
await sleep(1000);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080 });
t0Holder.t = Date.now() / 1000;
await scene('welcome', S.welcome.say, async () => { await sleep(1200); }, { cap: '' });
await card(S.title, S.subtitle, false);
await sleep(700);

await scene('overview', S.overview.say, async () => {
  await moveTo(page.locator('.context-bar-card'));
});

await scene('search', S.search.say, async () => {
  await click(tab('Telling'));
  await search(S.search.query);
});

await scene('counts', S.counts.say, async () => {
  await moveTo(page.locator('table:visible, .result-hero-card:visible').first());
});

await scene('trends', S.trends.say, async () => {
  await click(tab('Trender'));
  await waitIdle(600);
  await moveTo(page.locator('.chart-figure:visible').first());
});

await scene('trendsZoom', S.trendsZoom.say, async () => {
  if (S.trendsZoom.metricLabel) await click(page.getByText(S.trendsZoom.metricLabel, { exact: true }));
  await sleep(500);
  if (S.trendsZoom.fromYear) await typeInto(page.locator('.year-input:visible').first(), S.trendsZoom.fromYear);
  await sleep(600);
});

await scene('concordance', S.concordance.say, async () => {
  await click(tab('Konkordans'));
  await waitIdle(600);
  await moveTo(page.locator('.kwic-table tbody .col-hit').first());
});

await scene('anchor', S.anchor.say, async () => {
  await search(S.anchor.query);
  await moveTo(page.locator('input[type=range]:visible').first());
}, { cap: S.anchor.cap ?? S.anchor.say });

await scene('collocations', S.collocations.say, async () => {
  await click(tab('Kollokasjoner'));
  await search(S.collocations.query);
  if (S.collocations.sortBy) {
    await click(page.locator('thead th', { hasText: S.collocations.sortBy }).first());
    await waitIdle(400);
  }
});

await scene('corpus', S.corpus.say, async () => {
  const c = S.corpus;
  await click(tab('Telling'));
  await waitIdle(300);
  await click(page.getByRole('button', { name: 'Definer korpus…' }));
  await raise();
  await sleep(400);
  if (c.name) await typeInto(dlg().getByLabel(/Navn på korpus/), c.name);
  if (c.fromYear) await typeInto(dlg().getByLabel('Fra år', { exact: true }), c.fromYear);
  if (c.toYear) await typeInto(dlg().getByLabel('Til år', { exact: true }), c.toYear);
  for (const [label, value] of [['Språk', c.lang], ['Litterær form', c.form]]) {
    if (!value) continue;
    const sel = dlg().getByLabel(label, { exact: true });
    await moveTo(sel);
    await sel.selectOption(value);
    await sleep(400);
  }
  if (c.author) {
    await typeInto(dlg().getByLabel(/Forfatter/), c.author);
    await sleep(1500);
    if (c.authorPick) {
      const sugg = page.locator('.facet-suggest-item', { hasText: c.authorPick }).first();
      if (await sugg.count()) await click(sugg);
      else console.warn(`corpus: no author suggestion containing "${c.authorPick}"`);
    }
  }
});

await scene('corpusInUse', S.corpusInUse.say, async () => {
  await click(page.getByRole('button', { name: 'Bruk korpus' }));
  await waitIdle(800);
  await moveTo(page.locator('.context-bar-card'));
  await search(S.corpusInUse.query);
  await moveTo(page.locator('table:visible, .result-hero-card:visible').first()).catch(() => {});
});

await scene('arc', S.arc.say, async () => {
  await click(tab('Vonnegut-bue'));
  await waitIdle(600);
});

await scene('arcBook', S.arcBook.say, async () => {
  const want = S.arcBook.filter;
  await typeInto(page.getByPlaceholder('Filtrer tittel/forfatter eller dhlabid…'), want);
  await sleep(800);
  const chip = page.locator('.candidate-book-chip').first();
  if (!(await chip.count())) throw new Error(`arcBook: no book in the corpus matches "${want}"`);
  await click(chip);
  await sleep(500);
  for (let i = 0; i < 10; i++) {
    const pills = page.locator('.selected-book-pill').filter({ hasNotText: want });
    if (!(await pills.count())) break;
    await click(pills.first().locator('.pill-clear-btn'));
  }
  await waitIdle(800);
  await moveTo(page.locator('.chart-figure:visible').first());
});

await scene('help', S.help.say, async () => {
  await click(page.locator('button', { hasText: 'Om / Syntaks' }).first());
  await raise();
  await sleep(1500);
});
await sleep(800);
await caption('');
await card(S.title, S.endSubtitle, true);
await sleep(3000);

const tEnd = Date.now() / 1000;
await cdp.send('Page.stopScreencast');
await sleep(300);
fs.writeFileSync(
  path.join(OUT, 'timeline.json'),
  JSON.stringify({ t0: frames[0]?.t ?? t0Holder.t, tEnd, frames, scenes: timeline }, null, 1),
);
console.log(`frames: ${frames.length}, duration: ${(tEnd - (frames[0]?.t ?? 0)).toFixed(1)}s`);
console.log('\nscene          narration  actions');
for (const t of timings) {
  const slow = t.actions > t.narration + 1 ? `  SLOW (+${(t.actions - t.narration).toFixed(1)} s waiting on the app)` : '';
  console.log(`${t.id.padEnd(14)} ${t.narration.toFixed(1).padStart(6)} s ${t.actions.toFixed(1).padStart(6)} s${slow}`);
}
await browser.close();
