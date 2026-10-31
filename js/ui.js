/* Neon Swap Shop — DOM UI: HUD, modals, toasts, juice (coin fly, confetti, popups) */
'use strict';

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const q = [];
  let handler = null;
  let onClose = null;
  let open = false;
  let job = null; // workbench job {key, mode, t, dur}
  let benchSel = null;

  const img = (key, s) => '<img class="px" width="' + 16 * s + '" height="' + 16 * s + '" src="' + Art.icon(key, s) + '">';
  const st = () => Game.state;

  // ---------- modal core ----------

  function show(html, h, closeCb, cls) {
    open = true;
    handler = h || null;
    onClose = closeCb || null;
    Input.reset();
    const m = $('modal');
    m.className = 'show ' + (cls || '');
    $('mBody').innerHTML = html;
    SFX.play('pop');
  }

  function close() {
    if (!open) return;
    open = false;
    job = null;
    $('modal').className = '';
    $('mBody').innerHTML = '';
    const cb = onClose;
    handler = null;
    onClose = null;
    if (cb) cb();
    next();
  }

  function next() {
    if (open || !q.length) return;
    q.shift()();
  }

  // run fn now if no modal is open, otherwise after the current one closes
  function queue(fn) {
    q.push(fn);
    next();
  }

  function isOpen() { return open; }

  function info(title, body, ok, cb) {
    show('<div class="card"><h2>' + title + '</h2><div class="bd">' + body + '</div>' +
      '<button id="mOk" class="big ok" data-act="close">' + (ok || 'OK') + '</button></div>', null, cb);
  }

  // ---------- juice ----------

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('toasts').appendChild(t);
    t.addEventListener('animationend', () => t.remove());
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  function pop(text, color, x, y) {
    const p = document.createElement('div');
    p.className = 'pop';
    p.textContent = text;
    p.style.color = color || '#ffe27a';
    p.style.left = (x === undefined ? innerWidth / 2 : x) + 'px';
    p.style.top = (y === undefined ? innerHeight * 0.4 : y) + 'px';
    $('fxlayer').appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }

  function flyCoins(n, fromEl) {
    const to = $('hCoins').getBoundingClientRect();
    const fr = fromEl ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const sx = fr.left + fr.width / 2;
    const sy = fr.top + fr.height / 2;
    for (let i = 0; i < Math.min(n, 8); i++) {
      const c = document.createElement('div');
      c.className = 'fly';
      c.textContent = '🪙';
      c.style.left = sx + 'px';
      c.style.top = sy + 'px';
      $('fxlayer').appendChild(c);
      const a = c.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + (to.left - sx + 10) + 'px,' + (to.top - sy + 10) + 'px) scale(0.5)', opacity: 0.9 },
      ], { duration: 550 + i * 60, easing: 'ease-in', delay: i * 50, fill: 'forwards' });
      a.onfinish = () => c.remove();
    }
  }

  function flash(color) {
    const f = $('flash');
    f.style.background = color;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  // confetti: pooled particles on a full-screen canvas
  const fx = $('fx');
  const fctx = fx.getContext('2d');
  const CONF = [];
  for (let i = 0; i < 90; i++) CONF.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, col: '#fff', s: 4 });
  const CCOL = ['#ff4fd8', '#3affd0', '#ffcf3a', '#9a7aff', '#ff7a5a', '#7aff9a'];
  let confOn = 0;

  function confetti(n) {
    let made = 0;
    for (let i = 0; i < CONF.length && made < (n || 70); i++) {
      const c = CONF[i];
      if (c.on) continue;
      c.on = true; made++; confOn++;
      c.x = fx.width / 2 + (Math.random() - 0.5) * fx.width * 0.4;
      c.y = fx.height * 0.45;
      c.vx = (Math.random() - 0.5) * 420;
      c.vy = -200 - Math.random() * 380;
      c.life = 1.6 + Math.random();
      c.col = CCOL[i % CCOL.length];
      c.s = 3 + (i % 3) * 2;
    }
    flash('rgba(255,255,255,0.25)');
  }

  function resizeFx() {
    fx.width = innerWidth;
    fx.height = innerHeight;
  }
  resizeFx();
  addEventListener('resize', resizeFx);

  function tickFx(dt) {
    if (!confOn) return;
    fctx.clearRect(0, 0, fx.width, fx.height);
    for (let i = 0; i < CONF.length; i++) {
      const c = CONF[i];
      if (!c.on) continue;
      c.life -= dt;
      c.vy += 700 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.life <= 0 || c.y > fx.height + 20) { c.on = false; confOn--; continue; }
      fctx.fillStyle = c.col;
      fctx.fillRect(c.x, c.y, c.s, c.s);
    }
    if (!confOn) fctx.clearRect(0, 0, fx.width, fx.height);
  }

  // ---------- HUD ----------

  function hud() {
    const s = st();
    $('hCoins').textContent = s.coins;
    $('hLvl').textContent = s.level;
    $('hXp').style.width = Math.min(100, s.xp / Data.xpNeed(s.level) * 100) + '%';
    $('hDay').textContent = s.day;
    const fee = Game.fee();
    $('hRent').style.width = Math.min(100, s.coins / fee * 100) + '%';
    $('hRentTxt').textContent = Math.max(0, s.feeDue - s.day) + 'd';
    $('hNews').textContent = Data.NEWS[s.news].icon;
    const m = Game.mult();
    $('hStreak').textContent = m > 1 ? '🔥 x' + m : '';
    $('hStreak').style.opacity = m > 1 ? 1 : 0;
  }

  // ---------- menu / info panels ----------

  function menu() {
    const s = st();
    show('<div class="card"><h2>⚙</h2><div class="grid3">' +
      '<button class="tile" data-act="mute">' + (SFX.isMuted() ? '🔇' : '🔊') + '<small>Sound</small></button>' +
      '<button class="tile" data-act="hand">📒<small>Handbook</small></button>' +
      '<button class="tile" data-act="book">📖<small>Book</small></button></div>' +
      '<div class="bd">Rank: <b>' + Data.RANKS[s.rank] + '</b> · Rep ❤ <b>' + Math.round(s.rep) + '</b><br>Fee: 🪙 ' + Game.fee() + ' due day ' + s.feeDue + '</div>' +
      '<button class="small warn" data-act="reset">Reset save</button>' +
      '<button id="mOk" class="big ok" data-act="close">✓</button></div>', (a) => {
      if (a === 'mute') { SFX.setMuted(!SFX.isMuted()); s.mute = SFX.isMuted(); SFX.unlock(); menu(); }
      else if (a === 'hand') handbook();
      else if (a === 'book') book();
      else if (a === 'reset') {
        show('<div class="card"><h2>Reset?</h2><div class="bd">Erase everything and start over.</div>' +
          '<div class="row"><button class="big no" data-act="close">✗</button><button class="big ok" data-act="reset2">✓</button></div></div>', (b) => {
          if (b === 'reset2') Game.reset();
          else if (b === 'close') close();
        });
      }
    });
  }

  function handbook() {
    const s = st();
    let h = '<div class="card wide"><h2>📒 Handbook</h2><div class="bd">Real items have: ⭐ logo · button count · stripe colour</div><div class="grid4 scroll">';
    for (const id of Data.IDS) {
      if (!s.found[id]) continue;
      h += '<div class="tile">' + img(id, 3) + '<small>' + Data.ITEMS[id].name + '</small></div>';
    }
    h += '</div><button id="mOk" class="big ok" data-act="close">✓</button></div>';
    show(h, null);
  }

  function book() {
    const s = st();
    const total = Data.IDS.length;
    const have = Data.IDS.filter((id) => s.found[id]).length;
    let h = '<div class="card wide"><h2>📖 ' + have + '/' + total + '</h2><div class="grid5 scroll">';
    for (const id of Data.IDS) {
      h += s.found[id]
        ? '<div class="tile mini">' + img(id, 2) + '</div>'
        : '<div class="tile mini"><img class="px" width="32" height="32" src="' + Art.silhouette(id, 2) + '"></div>';
    }
    h += '</div><div class="stick">';
    for (const k of Object.keys(s.stickers)) h += '<span title="' + Data.STICKERS[k][1] + '">' + Data.STICKERS[k][0] + '</span>';
    h += '</div><button id="mOk" class="big ok" data-act="close">✓</button></div>';
    show(h, null);
  }

  function upgrades() {
    const s = st();
    let h = '<div class="card wide"><h2>⬆ <span class="coinline">🪙 ' + s.coins + '</span></h2><div class="grid3">';
    for (const u of Data.UPGRADES) {
      const lvl = s.up[u[0]];
      const maxed = lvl >= u[5];
      const cost = Data.upCost(u[0], lvl);
      h += '<button class="tile up' + (!maxed && s.coins >= cost ? ' can' : '') + '" data-act="up:' + u[0] + '">' + u[1] +
        '<small>' + u[2] + '</small><small>' + (maxed ? 'MAX' : '🪙 ' + cost) + ' · ' + lvl + '/' + u[5] + '</small></button>';
    }
    h += '</div><button id="mOk" class="big ok" data-act="close">✓</button></div>';
    show(h, (a) => {
      if (a.startsWith('up:')) {
        if (Game.buyUpgrade(a.slice(3))) { SFX.play('ok'); upgrades(); }
        else SFX.play('bad');
      }
    });
  }

  function chest(level) {
    let stage = 0;
    const reward = 20 + 10 * level;
    const decorIdx = level - 2;
    const unlock = decorIdx >= 0 && decorIdx < Data.DECOR.length ? 'New decoration: ' + Data.DECOR[decorIdx] + '!' : 'Shop keeps growing!';
    show('<div class="card"><h2>⭐ Level ' + level + '</h2><div class="chest" id="chestIco">🎁</div><div class="bd" id="chestTxt">Tap to open!</div>' +
      '<button id="mOk" class="big ok" data-act="chest">🎁</button></div>', (a) => {
      if (a !== 'chest') return;
      if (stage === 0) {
        stage = 1;
        $('chestIco').textContent = '✨';
        $('chestTxt').innerHTML = '🪙 <b>+' + reward + '</b><br>' + unlock;
        Game.addCoins(reward, { raw: true });
        confetti();
        SFX.play('level');
        $('mOk').textContent = '✓';
      } else close();
    }, null, 'gold');
  }

  function gift(coins, streak) {
    info('🎁 Daily gift', '🪙 <b>+' + coins + '</b><br>Days in a row: ' + streak, '✓', () => {});
    Game.addCoins(coins, { raw: true });
  }

  function summary(sum) {
    let h = '<div class="card"><h2>🌙 Day ' + sum.day + '</h2><div class="bd">' +
      '🪙 +' + sum.coins + ' · ⭐ +' + sum.xp + ' · 🤝 ' + sum.trades + '<br>' + sum.lines.join('<br>') + '</div>' +
      '<button id="mOk" class="big ok" data-act="close">☀ ▶</button></div>';
    show(h, null, null, 'gold');
    confetti(40);
  }

  // ---------- shelf / storage / workbench ----------

  function invTiles(filter, act) {
    const s = st();
    let h = '';
    for (const k of Object.keys(s.inv)) {
      if (s.inv[k] <= 0 || (filter && !filter(k))) continue;
      h += '<button class="tile mini' + (benchSel === k ? ' sel' : '') + '" data-act="' + act + ':' + k + '">' + img(k, 2) +
        '<small>x' + s.inv[k] + '</small></button>';
    }
    return h || '<div class="bd">Empty! Go dig in the dump 🚪</div>';
  }

  function shelf() {
    const s = st();
    let h = '<div class="card wide"><h2>🏷️</h2><div class="slots">';
    const n = Game.slots();
    for (let i = 0; i < n; i++) {
      const k = s.display[i];
      h += '<button class="tile mini slot" data-act="slot:' + i + '">' + (k ? img(k, 2) : '＋') + '</button>';
    }
    h += '</div><div class="grid5 scroll">' + invTiles(null, 'put') + '</div><button id="mOk" class="big ok" data-act="close">✓</button></div>';
    show(h, (a) => {
      const [c, v] = a.split(':');
      if (c === 'put') {
        const i = s.display.slice(0, n).findIndex((x, ix) => !x && ix < n);
        const free = i >= 0 ? i : (s.display.length < n ? s.display.length : -1);
        if (free < 0) { toast('Shelf full!'); return; }
        Game.invTake(v);
        s.display[free] = v;
        SFX.play('tap');
        shelf();
      } else if (c === 'slot') {
        const k = s.display[+v];
        if (!k) return;
        s.display[+v] = null;
        Game.invAdd(k, 1);
        shelf();
      }
    });
  }

  function storage() {
    const s = st();
    let h = '<div class="card wide"><h2>📦</h2><div class="grid5 scroll">' + invTiles(null, 'item') + '</div>';
    const k = benchSel && s.inv[benchSel] > 0 ? benchSel : null;
    h += '<div class="bd">' + (k ? Data.item(k).name + ' · 🪙 ' + Data.price(k, s.news) : 'Tap an item') + '</div>';
    h += (k ? '<button class="small warn" data-act="recycle">♻ +' + Math.max(1, Math.floor(Data.price(k, s.news) * 0.5)) + '</button>' : '') +
      '<button id="mOk" class="big ok" data-act="close">✓</button></div>';
    show(h, (a) => {
      if (a.startsWith('item:')) { benchSel = a.slice(5); storage(); }
      else if (a === 'recycle' && k) {
        Game.invTake(k);
        Game.addCoins(Math.max(1, Math.floor(Data.price(k, s.news) * 0.5)), { raw: true });
        SFX.play('coin');
        storage();
      }
    });
  }

  function benchDur() { return 3 * Math.pow(0.85, st().up.bench) / (Game.fast ? 3 : 1); }

  function bench() {
    const s = st();
    const sel = benchSel && s.inv[benchSel] > 0 ? benchSel : null;
    const can = !job && sel;
    const plain = sel && !sel.endsWith('+') && Data.item(sel).tier <= 3;
    let h = '<div class="card wide"><h2>🔧</h2><div class="grid5 scroll">' +
      invTiles((k) => Data.item(k).tier <= 3, 'sel') + '</div>';
    if (job) {
      h += '<div class="bd">' + img(job.key, 4) + '<div class="bar big"><i id="jobBar"></i></div></div>';
    } else {
      h += '<div class="row">' +
        '<button class="big ok" id="bPolish" data-act="polish"' + (can && plain ? '' : ' disabled') + '>✨</button>' +
        '<button class="big ok" id="bMerge" data-act="merge"' + (can && plain && s.inv[sel] >= 3 ? '' : ' disabled') + '>x3 ➜ ⬆</button></div>';
    }
    h += '<button id="mOk" class="big ok" data-act="close">✓</button></div>';
    show(h, (a) => {
      if (a.startsWith('sel:')) { benchSel = a.slice(4); bench(); }
      else if ((a === 'polish' || a === 'merge') && can && plain) {
        if (a === 'merge' && s.inv[sel] < 3) return;
        job = { key: sel, mode: a, t: 0, dur: benchDur() };
        bench();
        SFX.play('dig');
      }
    });
  }

  function finishJob() {
    const s = st();
    const j = job;
    job = null;
    if (j.mode === 'polish') {
      Game.invTake(j.key);
      Game.invAdd(j.key + '+', 1);
      Game.sticker('bench');
      toast('✨ Polished!');
    } else {
      for (let i = 0; i < 3; i++) Game.invTake(j.key);
      const tier = Math.min(4, Data.item(j.key).tier + 1);
      const pool = Data.BY_TIER[tier];
      const res = pool[Math.floor(Math.random() * pool.length)];
      Game.invAdd(res, 1);
      toast('⬆ ' + Data.ITEMS[res].name + '!');
    }
    confetti(30);
    SFX.play('sparkle');
    Game.addXp(4);
    if (open) bench();
  }

  function tick(dt) {
    tickFx(dt);
    if (job && open) {
      job.t += dt;
      const b = $('jobBar');
      if (b) b.style.width = Math.min(100, job.t / job.dur * 100) + '%';
      if (job.t >= job.dur) finishJob();
    }
  }

  function bindModal() {
    $('mBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      SFX.unlock();
      const a = el.dataset.act;
      if (a === 'close') { close(); return; }
      if (handler) handler(a, el);
    });
  }

  return {
    $, img, show, close, queue, isOpen, info, toast, pop, flyCoins, flash, confetti, hud, menu, handbook, book, upgrades,
    chest, gift, summary, shelf, storage, bench, tick, bindModal,
    get handler() { return handler; },
  };
})();
