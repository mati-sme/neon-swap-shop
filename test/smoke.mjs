/* Neon Swap Shop smoke test — run: node test/smoke.mjs
 * Serves the folder, plays the game on a 390x844 touch phone via Playwright, fails on any console error/warning. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'test', 'shots');
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const tries = ['playwright', 'playwright-core', process.env.PLAYWRIGHT_PATH].filter(Boolean);
  tries.push('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
  for (const t of tries) {
    try { return require(t); } catch (_) { /* try next */ }
  }
  throw new Error('playwright not found; set PLAYWRIGHT_PATH or npm i playwright-core');
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const { chromium } = loadPlaywright();
const server = await serve();
const url = 'http://127.0.0.1:' + server.address().port + '/?fast=1';
fs.mkdirSync(SHOTS, { recursive: true });

const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

const G = (fn, arg) => page.evaluate(fn, arg);
const gameReady = () => page.waitForFunction(() => window.__game && window.__game.state, null, { timeout: 10000 });
const exists = (sel) => page.$(sel).then((h) => !!h);
const click = (sel) => page.click(sel, { timeout: 3000 });

// close any info/chest/summary modals (all use #mOk); grabs the big rank-up card on its way past
let rankCardShot = false;
async function dismiss() {
  for (let i = 0; i < 12; i++) {
    if (!(await exists('#mOk'))) return;
    if (!rankCardShot && (await exists('.card.rankup'))) {
      rankCardShot = true;
      await sleep(900);
      await page.screenshot({ path: path.join(SHOTS, 'rankup.png') });
    }
    await click('#mOk');
    await sleep(60);
  }
}

async function tapHaggle() {
  return G(() => new Promise((ok) => {
    const t0 = performance.now();
    const loop = () => {
      const h = window.__game.haggle;
      if (h && Math.abs(h.pos - h.c0) < h.g / 2 * 0.5) { document.getElementById('hgTap').click(); ok(true); return; }
      if (performance.now() - t0 > 6000) { ok(false); return; }
      requestAnimationFrame(loop);
    };
    loop();
  }));
}

// one decision on the open trade card
async function handleTrade(opts) {
  const t = await G(() => { const x = window.__game.trade; return { kind: x.kind, fake: x.fake, rare: x.rare }; });
  if (opts.haggle && t.kind !== 'help' && (await exists('#bHaggle'))) {
    await click('#bHaggle');
    check(await tapHaggle(), 'haggle needle stopped in the green zone');
    opts.haggle = false;
    await sleep(100);
  }
  if (t.kind === 'sell') {
    if (t.rare && (await exists('#bAppraise'))) {
      await click('#bAppraise');
      for (let i = 0; i < 3; i++) await click('#spot' + i);
      await sleep(100);
    } else if (await exists('#bInspect')) {
      await click('#bInspect');
      await sleep(80);
      if (opts.shot) { await page.screenshot({ path: path.join(SHOTS, 'inspect.png') }); opts.shot = false; }
      await click(t.fake ? '#bFake' : '#bReal');
      if (t.fake) { await sleep(150); return; }
    }
    const c = await G(() => ({ coins: window.__game.state.coins, price: window.__game.trade && window.__game.trade.price }));
    if (c.price > c.coins) { await click('#bNo'); return; }
  }
  await click('#bAccept');
  await sleep(120);
}

// serve up to n customers (or until the day is done); returns how many were handled
async function serveCustomers(n, opts) {
  let handled = 0;
  const t0 = Date.now();
  while (handled < n && Date.now() - t0 < 60000) {
    await dismiss();
    const s = await G(() => ({ trade: !!window.__game.trade, phase: window.__game.state.phase, near: window.__game.nearStation, queued: window.__game.shop.queued, active: !!window.__game.shop.active }));
    if (s.phase === 'done') break;
    if (s.trade) {
      if (opts.tradeShot) { opts.tradeShot = false; await page.screenshot({ path: path.join(SHOTS, 'trade.png') }); }
      await handleTrade(opts);
      handled++;
      continue;
    }
    if (s.phase === 'prep' || (s.queued && !s.active)) {
      if (s.near !== 'counter') await G(() => window.__game.goTo('counter'));
      await sleep(80);
      // a rank-up / chest card can pop up at any moment and hides the button: skip, next loop dismisses it
      if (await G(() => !!window.__game.shop.actionInfo() && !window.__game.ui.isOpen())) {
        try { await click('#actionBtn'); } catch (_) { /* modal appeared in between */ }
      }
    }
    await sleep(100);
  }
  return handled;
}

async function digTrip(maxDigs, shot) {
  await dismiss();
  await G(() => window.__game.goTo('door'));
  await sleep(100);
  await click('#actionBtn');
  await sleep(150);
  check((await G(() => window.__game.scene)) === 'dump', 'entered the junk dump');
  let dug = 0;
  for (let i = 0; i < maxDigs; i++) {
    const s = await G(() => ({ left: window.__game.dump.digsLeft, full: window.__game.dump.bag.length >= window.__game.bagCap() }));
    if (s.left <= 0 || s.full) break;
    await dismiss();
    await G(() => { const sp = window.__game.dump.spots.find((o) => !o.used); window.__game.dump.teleport(sp.x, sp.y); });
    await sleep(80);
    await click('#actionBtn');
    for (let k = 0; k < 3; k++) { await click('#digBtn'); await sleep(40); }
    dug++;
    if (shot && dug === 1) { await sleep(150); await page.screenshot({ path: path.join(SHOTS, 'junk-dump.png') }); }
    await sleep(60);
  }
  const bag = await G(() => window.__game.dump.bag.length);
  check(bag === dug && dug > 0, 'dug ' + dug + ' spots, bag holds ' + bag);
  await dismiss();
  await G(() => window.__game.dump.teleport(180, 492));
  await sleep(100);
  await click('#actionBtn');
  await sleep(150);
  await dismiss();
  check((await G(() => window.__game.scene)) === 'shop', 'returned to the shop');
  return dug;
}

async function sleepDay() {
  const day = await G(() => window.__game.state.day);
  await dismiss();
  await G(() => window.__game.goTo('bed'));
  await sleep(100);
  await click('#actionBtn');
  await sleep(150);
  check(await exists('#mOk'), 'day summary shown');
  await dismiss();
  const day2 = await G(() => window.__game.state.day);
  check(day2 === day + 1, 'slept to day ' + day2);
}

// put whatever is in the bag on the shelf through the real shelf UI
async function stockShelf() {
  await dismiss();
  await G(() => window.__game.goTo('shelf'));
  await sleep(100);
  await click('#actionBtn');
  await sleep(100);
  for (let i = 0; i < 10; i++) {
    const t = await page.$('.tile[data-act^="put:"]');
    if (!t) break;
    await t.click();
    await sleep(40);
  }
  await dismiss();
  await G(() => window.__game.goTo('counter'));
}

async function buyUpgrade() {
  await click('#bUp');
  const can = await exists('.tile.up.can');
  if (can) await click('.tile.up.can');
  await dismiss();
  return can;
}

// HUD / room / buttons must not collide, on any phone size
async function layoutCheck(pg, tag) {
  const r = await pg.evaluate(() => {
    const q = (s) => document.querySelector(s).getBoundingClientRect();
    const hud = q('#hud');
    const cv = q('#cv');
    const lbls = [...document.querySelectorAll('.lbl b')].map((e) => e.getBoundingClientRect());
    const btns = ['bUp', 'bBook', 'bHand', 'bMenu', 'hNews', 'hGoal'].map((id) => q('#' + id));
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const act = document.getElementById('actionBtn');
    return {
      hudBottom: hud.bottom, cvTop: cv.top, cvH: cv.height, vh: innerHeight, vw: innerWidth,
      labelsInside: lbls.length === 6 && lbls.every((l) => l.top >= cv.top - 1 && l.bottom <= cv.bottom && l.left >= 0 && l.right <= innerWidth),
      labelHitsButton: lbls.some((l) => btns.some((b) => hit(l, b))),
      toastTop: q('#toasts').top,
      btnsInHud: btns.every((b) => b.bottom <= hud.bottom + 1 && b.right <= innerWidth && b.left >= 0),
      goal: document.getElementById('hGoalTxt').textContent,
      roomFits: window.__game.viewH >= 332,
    };
  });
  check(r.hudBottom <= r.cvTop + 1, tag + ': room starts below the HUD (' + r.hudBottom + ' <= ' + r.cvTop + ')');
  check(r.btnsInHud, tag + ': side buttons live inside the HUD');
  check(r.labelsInside, tag + ': all 6 station labels are inside the room view');
  check(!r.labelHitsButton, tag + ': no station label under a HUD button');
  check(r.toastTop >= r.hudBottom, tag + ': toasts sit under the HUD');
  check(r.roomFits, tag + ': whole room fits without scrolling');
  check(r.goal.length > 0, tag + ': next-goal chip shows progress (' + r.goal + ')');
}

// every item has its own sprite; each fake changes only a small detail
async function artCheck() {
  const art = await G(() => {
    const ids = Data.IDS;
    const urls = new Set(ids.map((id) => Art.icon(id, 4)));
    const px = (id, fake) => {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const g = c.getContext('2d');
      Art.drawItem(g, id, 0, 0, 1, fake);
      return g.getImageData(0, 0, 16, 16).data;
    };
    const bad = [];
    let maxDiff = 0;
    for (const id of ids) {
      const types = Art.fakeTypes(id);
      if (types.length < 2) bad.push(id + ' has few fake types');
      const real = px(id, null);
      for (const t of types) {
        const f = px(id, t);
        let d = 0;
        for (let i = 0; i < real.length; i += 4) if (real[i] !== f[i] || real[i + 1] !== f[i + 1] || real[i + 2] !== f[i + 2] || real[i + 3] !== f[i + 3]) d++;
        maxDiff = Math.max(maxDiff, d);
        if (d < 2) bad.push(id + ':' + t + ' fake barely differs (' + d + 'px)');
        if (d > 40) bad.push(id + ':' + t + ' fake differs too much (' + d + 'px)');
        if (!Art.region(id, t)) bad.push(id + ':' + t + ' has no ring region');
      }
    }
    return { n: ids.length, uniq: urls.size, bad, maxDiff };
  });
  check(art.n >= 30 && art.uniq === art.n, art.n + ' items, ' + art.uniq + ' distinct sprites');
  check(art.bad.length === 0, 'fakes differ by one small detail (max ' + art.maxDiff + 'px)' + (art.bad.length ? ': ' + art.bad.slice(0, 5).join('; ') : ''));
}

try {
  console.log('Neon Swap Shop smoke test');
  await page.goto(url);
  await gameReady();
  await sleep(500);
  check(await exists('#modal.show'), 'daily gift popup appears on first launch');
  await dismiss();
  await page.screenshot({ path: path.join(SHOTS, 'shop.png') });

  // ---- art, layout, toasts
  await artCheck();
  await layoutCheck(page, '390x844');
  await G(() => { for (let i = 0; i < 6; i++) window.__game.ui.toast('toast ' + i); });
  check((await G(() => document.querySelectorAll('.toast').length)) <= 2, 'at most 2 toasts visible at once');
  const small = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page2 = await small.newPage();
  page2.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('360: ' + m.type() + ': ' + m.text()); });
  page2.on('pageerror', (e) => logs.push('360 pageerror: ' + e.message));
  await page2.goto(url);
  await page2.waitForFunction(() => window.__game && window.__game.state, null, { timeout: 10000 });
  await sleep(500);
  for (let i = 0; i < 3 && (await page2.$('#mOk')); i++) { await page2.click('#mOk'); await sleep(80); }
  await sleep(300);
  await page2.screenshot({ path: path.join(SHOTS, 'shop-360.png') });
  await layoutCheck(page2, '360x740');
  await small.close();

  // ---- floating joystick via real touch events
  const cdp = await ctx.newCDPSession(page);
  const p0 = await G(() => ({ x: window.__game.player.x, y: window.__game.player.y }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 420, id: 1 }] });
  await sleep(50);
  check(await G(() => document.getElementById('joy').classList.contains('on')), 'joystick ring shows while touching');
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 420 + i * 8, id: 1 }] });
    await sleep(80);
  }
  await sleep(300);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const p1 = await G(() => ({ x: window.__game.player.x, y: window.__game.player.y, near: window.__game.nearStation }));
  check(p1.y > p0.y + 5, 'joystick moved the player (' + p0.y.toFixed(0) + ' -> ' + p1.y.toFixed(0) + ')');
  check(p1.near === 'counter', 'walked to the counter (near=' + p1.near + ')');
  check(!(await G(() => document.getElementById('joy').classList.contains('on'))), 'joystick ring hides on release');
  check(await G(() => getComputedStyle(document.getElementById('actionBtn')).display !== 'none'), 'action button visible at the counter');

  // ---- open the shop and let a queue build up (screenshot: customers lining up for the counter)
  await G(() => window.__game.goTo('counter'));
  await sleep(100);
  await click('#actionBtn');
  const t1 = Date.now();
  while ((await G(() => window.__game.shop.queued)) < 3 && Date.now() - t1 < 20000) await sleep(150);
  const queuedNow = await G(() => window.__game.shop.queued);
  check(queuedNow >= 3, 'customers line up in a visible queue (' + queuedNow + ')');
  await page.screenshot({ path: path.join(SHOTS, 'queue.png') });

  // ---- serve customers incl. haggle
  const opts = { haggle: true, shot: true, tradeShot: true };
  const handled = await serveCustomers(4, opts);
  check(handled >= 4, 'served ' + handled + ' customers');
  check((await G(() => window.__game.state.stats.trades)) >= 1, 'trades counted');

  // ---- scavenging
  await dismiss();
  await digTrip(3, true);

  // ---- feature tour: shelf, bench, storage, book
  await G(() => window.__game.goTo('shelf')); await sleep(80); await click('#actionBtn'); await sleep(100); await dismiss();
  await G(() => window.__game.goTo('bench')); await sleep(80); await click('#actionBtn'); await sleep(100);
  const sel = await page.$('.tile[data-act^="sel:"]');
  if (sel) {
    await sel.click();
    await click('#bPolish');
    await page.waitForFunction(() => !document.getElementById('jobBar'), null, { timeout: 8000 });
    check(true, 'workbench polish finished');
  }
  await dismiss();
  await G(() => window.__game.goTo('storage')); await sleep(80); await click('#actionBtn'); await sleep(100); await dismiss();
  await click('#bBook'); await sleep(100); await dismiss();
  await click('#bHand'); await sleep(100); await dismiss();
  await click('#bMenu'); await sleep(100); await dismiss();

  // ---- sleep
  await sleepDay();

  // ---- ~3 minutes of (3x speed) play
  const t0 = await G(() => window.__game.time);
  const wall = Date.now();
  let days = 0;
  let upgrades = 0;
  let rankShot = false;
  while ((await G(() => window.__game.time)) - t0 < 180 && Date.now() - wall < 240000) {
    await serveCustomers(99, { haggle: Math.random() < 0.5 });
    await dismiss();
    if (await buyUpgrade()) upgrades++;
    await digTrip(10, false);
    if (await buyUpgrade()) upgrades++;
    await sleepDay();
    days++;
    if (!rankShot && (await G(() => window.__game.state.rank)) >= 1) {
      rankShot = true;
      await dismiss();
      await stockShelf();
      await sleep(600);
      await page.screenshot({ path: path.join(SHOTS, 'shop-rank1.png') });
    }
  }
  const simmed = (await G(() => window.__game.time)) - t0;
  console.log('  simulated ' + simmed.toFixed(0) + 's of game time over ' + days + ' days, ' + upgrades + ' upgrades');
  check(simmed >= 170, 'simulated about 3 minutes of play');
  const rank = await G(() => window.__game.state.rank);
  check(rank >= 1 && rankShot, 'shop rank-up happened during play (rank ' + rank + ', ' + (await G(() => Data.RANKS[window.__game.state.rank])) + ')');
  check(rankCardShot, 'big rank-up screen was shown');

  // ---- persistence
  await G(() => window.__game.save());
  const snap = () => G(() => { const s = window.__game.state; return { day: s.day, level: s.level, coins: s.coins, rank: s.rank, inv: Object.keys(s.inv).length, up: JSON.stringify(s.up) }; });
  const before = await snap();
  check(!!(await G(() => localStorage.getItem('neonswap.save.v1'))), 'save exists in localStorage');
  await page.reload();
  await gameReady();
  await sleep(400);
  const after = await snap();
  check(JSON.stringify(before) === JSON.stringify(after), 'reload restores progress ' + (JSON.stringify(before) === JSON.stringify(after) ? '' : JSON.stringify(before) + ' vs ' + JSON.stringify(after)));
  await dismiss();
  await page.screenshot({ path: path.join(SHOTS, 'shop-later.png') });
  console.log('  progress: day ' + after.day + ', level ' + after.level + ', coins ' + after.coins + ', rank ' + after.rank);
} catch (e) {
  problems.push('exception: ' + e.message);
  console.log('  ✗ exception: ' + e.stack);
  try { await page.screenshot({ path: path.join(SHOTS, 'failure.png') }); } catch (_) { /* ignore */ }
}

check(logs.length === 0, 'zero console errors/warnings' + (logs.length ? '\n    ' + logs.slice(0, 8).join('\n    ') : ''));
await browser.close();
server.close();
console.log(problems.length ? '\nFAILED (' + problems.length + ')' : '\nPASSED');
process.exit(problems.length ? 1 : 0);
