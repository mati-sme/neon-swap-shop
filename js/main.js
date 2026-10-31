/* Neon Swap Shop — boot, game rules (coins/xp/levels/days/rank) and the single rAF loop */
'use strict';

const Game = (() => {
  const $ = UI.$;
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const params = new URLSearchParams(location.search);

  let state = Save.load() || Save.defaults();
  const fresh = !localStorage.getItem(Save.KEY);
  let scene = 'shop';
  let viewH = 422;
  let hudBottom = 100;
  let camY = 0;
  let lastCam = -999;
  let shakeAmp = 0;
  let time = 0;
  let resetting = false;
  let hudT = 0;
  let saveT = 0;
  let lastAction = '';
  const api = { fast: params.get('fast') === '1' };
  const goalOut = { kind: '', icon: '', txt: '', pct: 0, can: false };

  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------- rules ----------

  const slots = () => Math.min(10, 3 + state.up.slots + state.rank);
  const bagCap = () => 6 + 2 * state.up.bag;
  const mult = () => (state.streak >= 10 ? 4 : state.streak >= 6 ? 3 : state.streak >= 3 ? 2 : 1);

  // progress (0..1) towards the next shop rank: coins earned this rank OR play time, whichever is further
  function rankPct() {
    const r = state.rank;
    if (r >= Data.RANKS.length - 1) return 1;
    return Math.min(1, Math.max(state.rankEarned / Data.RANK_EARN[r], state.rankT / Data.RANK_TIME[r]));
  }

  function checkRank() {
    if (state.rank >= Data.RANKS.length - 1 || rankPct() < 1) return;
    state.rank++;
    state.rankEarned = 0;
    state.rankT = 0;
    const rank = state.rank;
    sticker('rank');
    SFX.play('level');
    UI.queue(() => UI.rankUp(rank));
    save();
  }

  // the one goal shown in the HUD: something to buy as soon as it is affordable, else whatever is closest
  function goal() {
    const s = state;
    let up = null;
    let upPct = -1;
    let upTxt = '';
    for (let i = 0; i < Data.UPGRADES.length; i++) {
      const u = Data.UPGRADES[i];
      const lvl = s.up[u[0]];
      if (lvl >= u[5]) continue;
      const cost = Data.upCost(u[0], lvl);
      const p = Math.min(1, s.coins / cost);
      if (p > upPct) { upPct = p; up = u; upTxt = s.coins >= cost ? '🪙 ' + cost : s.coins + '/' + cost; }
    }
    const rp = rankPct();
    const xp = Math.min(1, s.xp / Data.xpNeed(s.level));
    goalOut.can = false;
    if (up && upPct >= 1) {
      goalOut.kind = 'up'; goalOut.icon = up[1]; goalOut.pct = 1; goalOut.can = true; goalOut.txt = upTxt;
    } else if (s.rank < Data.RANKS.length - 1 && rp >= xp && rp >= upPct) {
      goalOut.kind = 'rank'; goalOut.icon = '🏠'; goalOut.pct = rp; goalOut.txt = Math.floor(rp * 100) + '%';
    } else if (up && upPct >= xp) {
      goalOut.kind = 'up'; goalOut.icon = up[1]; goalOut.pct = upPct; goalOut.txt = upTxt;
    } else {
      goalOut.kind = 'xp'; goalOut.icon = '⭐'; goalOut.pct = xp; goalOut.txt = s.xp + '/' + Data.xpNeed(s.level);
    }
    return goalOut;
  }

  function addCoins(n, o) {
    o = o || {};
    if (n > 0 && !o.raw) n *= mult();
    n = Math.round(n);
    state.coins = Math.max(0, state.coins + n);
    if (n > 0) {
      state.today.coins += n;
      state.stats.earned += n;
      state.rankEarned += n;
      if (!o.quiet) {
        UI.pop('+' + n + (!o.raw && mult() > 1 ? ' x' + mult() : ''), '#ffe27a');
        UI.flyCoins(n, o.fromEl);
        SFX.play('coin');
      }
    }
  }

  function addXp(n) {
    state.xp += n;
    state.today.xp += n;
    while (state.xp >= Data.xpNeed(state.level)) {
      state.xp -= Data.xpNeed(state.level);
      state.level++;
      const lv = state.level;
      if (lv >= 5) sticker('level5');
      SFX.play('level');
      UI.queue(() => UI.chest(lv));
    }
  }

  function success(xp) {
    state.stats.trades++;
    state.today.trades++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    sticker('first');
    if (state.stats.trades >= 10) sticker('trades10');
    if (mult() > 1) sticker('streak');
    if (state.streak === 3 || state.streak === 6 || state.streak === 10) UI.toast('🔥 Streak x' + mult() + '!');
    addXp(xp);
  }

  function breakStreak() { state.streak = 0; }
  function rep(n) { state.rep = Math.max(0, Math.min(100, state.rep + n)); }

  function sticker(id) {
    if (state.stickers[id]) return;
    state.stickers[id] = 1;
    UI.toast(Data.STICKERS[id][0] + ' ' + Data.STICKERS[id][1]);
  }

  function markFound(key) {
    const id = Data.split(key)[0];
    if (state.found[id]) return;
    state.found[id] = 1;
    UI.toast('📖 New: ' + Data.ITEMS[id].name);
    const tier = Data.ITEMS[id].tier;
    if (!state.tiersDone[tier] && Data.BY_TIER[tier].every((x) => state.found[x])) {
      state.tiersDone[tier] = 1;
      addCoins(25 * (tier + 1), { raw: true });
      UI.toast('📖 ' + Data.TIER_NAMES[tier] + ' set complete!');
      UI.confetti(50);
    }
    if (Data.IDS.every((x) => state.found[x])) sticker('book');
  }

  function invAdd(key, n) {
    state.inv[key] = (state.inv[key] || 0) + n;
    markFound(key);
  }

  function invTake(key) {
    if (!state.inv[key]) return false;
    state.inv[key]--;
    if (state.inv[key] <= 0) delete state.inv[key];
    return true;
  }

  function buyUpgrade(id) {
    const u = Data.UPGRADES.find((x) => x[0] === id);
    const lvl = state.up[id];
    const cost = Data.upCost(id, lvl);
    if (!u || lvl >= u[5] || state.coins < cost) return false;
    state.coins -= cost;
    state.up[id]++;
    save();
    return true;
  }

  function tutCheck(moved, nearCounter) {
    if (state.tut === 0 && moved > 8) state.tut = 1;
    if (state.tut === 1 && nearCounter) state.tut = 2;
  }

  function tutDone() { state.tut = 3; }

  function sleep() {
    const lines = [];
    const cand = Object.keys(state.inv).filter((k) => state.inv[k] > 0 && !k.endsWith('+') && Data.item(k).tier <= 2);
    if (cand.length) {
      const k = pick(cand);
      invTake(k);
      invAdd(k + '+', 1);
      lines.push('✨ ' + Data.item(k).name);
    }
    const sum = { day: state.day, coins: state.today.coins, xp: state.today.xp, trades: state.today.trades, lines };
    state.day++;
    state.news = Math.floor(Math.random() * Data.NEWS.length);
    Shop.startDay();
    UI.flash('#000');
    save();
    UI.queue(() => UI.summary(sum));
    UI.toast(Data.NEWS[state.news].icon + ' ' + Data.NEWS[state.news].text);
  }

  function setScene(s) {
    scene = s;
    UI.flash('#000');
    Input.reset();
    $('app').dataset.scene = s;
  }

  function shake(n) { shakeAmp = Math.max(shakeAmp, n); }

  function save() {
    if (resetting) return;
    state.time = time;
    Save.write(state);
  }

  function reset() {
    resetting = true;
    Save.wipe();
    location.reload();
  }

  // ---------- loop ----------

  // the canvas fills everything below the HUD; its low-res height follows that area's aspect
  function resize() {
    hudBottom = Math.ceil($('hud').getBoundingClientRect().bottom);
    const availH = Math.max(200, innerHeight - hudBottom);
    viewH = Math.max(240, Math.min(560, Math.round(Art.W * availH / innerWidth)));
    cv.style.top = hudBottom + 'px';
    cv.style.height = availH + 'px';
    cv.width = Art.W;
    cv.height = viewH;
    document.documentElement.style.setProperty('--hudb', hudBottom + 'px');
    api.viewH = viewH;
    lastCam = -999;
  }

  function hudTick() {
    if (Math.ceil($('hud').getBoundingClientRect().bottom) !== hudBottom) resize();
    checkRank();
    UI.hud();
    const sc = scene === 'shop';
    $('labels').style.display = sc ? '' : 'none';
    $('hDump').style.display = sc ? 'none' : '';
    if (!sc) $('hDump').textContent = '⛏️ ' + Dump.digsLeft + '  🎒 ' + Dump.bag.length + '/' + bagCap();
    // tutorial
    const t = $('tut');
    const show = state.tut < 3 && sc && !UI.isOpen();
    t.style.display = show ? '' : 'none';
    if (show) {
      t.textContent = state.tut === 0 ? '👆 ➡️ 🏃' : state.tut === 1 ? '🏃 ➡️ 🔔' : '👇 🔓';
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - frame.last) / 1000);
    frame.last = now;
    const gdt = dt * (api.fast ? 3 : 1);
    time += gdt;
    state.rankT += gdt;
    if (scene === 'shop') Shop.update(gdt, time); else Dump.update(gdt, time);
    Trade.tick(dt);
    UI.tick(gdt);

    ctx.fillStyle = '#0b0820';
    ctx.fillRect(0, 0, cv.width, cv.height);
    let sx = 0;
    let sy = 0;
    if (shakeAmp > 0.1) {
      sx = Math.round((Math.random() - 0.5) * 2 * shakeAmp);
      sy = Math.round((Math.random() - 0.5) * 2 * shakeAmp);
      shakeAmp *= Math.pow(0.02, dt);
    } else shakeAmp = 0;
    ctx.save();
    ctx.translate(sx, sy);
    if (scene === 'shop') {
      // the whole room fits on normal phones; on short screens it scrolls with the player
      camY = viewH >= Art.SHOP_H ? 0 : Math.round(Math.max(0, Math.min(Art.SHOP_H - viewH, Shop.player.y - viewH / 2)));
      if (camY !== lastCam) { lastCam = camY; Shop.layout(camY, viewH, hudBottom); }
      Shop.draw(ctx, camY, viewH, time);
    } else Dump.draw(ctx, time);
    ctx.restore();

    const info = scene === 'shop' ? Shop.actionInfo() : Dump.actionInfo();
    const key = !info || UI.isOpen() || Dump.digging ? '' : info.icon + info.label;
    if (key !== lastAction) {
      lastAction = key;
      const b = $('actionBtn');
      b.style.display = key ? '' : 'none';
      if (key) { b.firstElementChild.textContent = info.icon; b.lastElementChild.textContent = info.label; }
    }
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.15; hudTick(); }
    saveT += dt;
    if (saveT > 5) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }
  frame.last = performance.now();

  function doAction() {
    SFX.unlock();
    if (UI.isOpen()) return;
    if (scene === 'shop') Shop.action(); else Dump.action();
  }

  function boot() {
    SFX.setMuted(state.mute);
    resize();
    addEventListener('resize', resize);
    Input.bind($('play'), $('joy'), $('joyKnob'));
    UI.bindModal();
    Shop.initLabels();
    $('actionBtn').addEventListener('click', doAction);
    $('digBtn').addEventListener('click', () => { SFX.unlock(); Dump.tap(); });
    $('bMenu').addEventListener('click', () => { SFX.unlock(); if (!UI.isOpen()) UI.menu(); });
    $('bUp').addEventListener('click', () => { SFX.unlock(); if (!UI.isOpen()) UI.upgrades(); });
    $('bBook').addEventListener('click', () => { SFX.unlock(); if (!UI.isOpen()) UI.book(); });
    $('bHand').addEventListener('click', () => { SFX.unlock(); if (!UI.isOpen()) UI.handbook(); });
    $('hNews').addEventListener('click', () => UI.toast(Data.NEWS[state.news].icon + ' ' + Data.NEWS[state.news].text));
    $('hGoal').addEventListener('click', () => {
      SFX.unlock();
      if (UI.isOpen()) return;
      if (goal().kind === 'up') UI.upgrades(); else UI.toast(goalOut.icon + ' ' + goalOut.txt);
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === ' ' || e.key === 'Enter') { if (!UI.isOpen()) { e.preventDefault(); doAction(); } }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    if (fresh) Shop.startDay();
    const today = Save.today();
    if (state.lastLogin !== today) {
      const y = new Date(Date.now() - 864e5);
      const yesterday = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
      state.loginStreak = state.lastLogin === yesterday ? state.loginStreak + 1 : 1;
      state.lastLogin = today;
      const streak = state.loginStreak;
      UI.queue(() => UI.gift(25 + 5 * Math.min(streak, 7), streak));
    }
    $('app').dataset.scene = scene;
    UI.toast(Data.NEWS[state.news].icon + ' ' + Data.NEWS[state.news].text);
    requestAnimationFrame(frame);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  Object.defineProperties(api, Object.getOwnPropertyDescriptors({
    slots, bagCap, mult, addCoins, addXp, success, breakStreak, rep, sticker, markFound, invAdd, invTake, buyUpgrade,
    tutCheck, tutDone, sleep, setScene, shake, save, reset, boot, doAction, goal, rankPct, checkRank,
    get state() { return state; },
    get scene() { return scene; },
    get time() { return time; },
    get viewH() { return viewH; },
    set viewH(v) { viewH = v; },
    get hudBottom() { return hudBottom; },
    get camY() { return camY; },
    get player() { return scene === 'shop' ? Shop.player : Dump.player; },
    get nearStation() {
      if (scene === 'shop') return Shop.near ? Shop.near.id : null;
      const n = Dump.near;
      return n ? (n.used === undefined ? 'exit' : 'spot') : null;
    },
    get trade() { return Trade.cur; },
    get haggle() { return Trade.haggleInfo(); },
    get phase() { return state.phase; },
    shop: Shop,
    dump: Dump,
    ui: UI,
    goTo(id) { const s = Shop.station(id); Shop.teleport(s.x, s.y); },
  }));
  return api;
})();

window.__game = Game;
Game.boot();
