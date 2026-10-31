/* Neon Swap Shop — the shop room: player, stations, customer queue, day flow */
'use strict';

// tiny shared particle pool (shop + dump)
const Parts = (() => {
  const N = 140;
  const p = [];
  for (let i = 0; i < N; i++) p.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, col: '#fff', s: 1 });
  function burst(x, y, col, n, spd) {
    let made = 0;
    for (let i = 0; i < N && made < n; i++) {
      const q = p[i];
      if (q.on) continue;
      made++;
      q.on = true; q.x = x; q.y = y; q.col = col; q.s = 1 + (i % 2);
      const a = Math.random() * 6.283;
      const v = (spd || 40) * (0.4 + Math.random());
      q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v - 20; q.life = 0.5 + Math.random() * 0.5;
    }
  }
  function update(dt) {
    for (let i = 0; i < N; i++) {
      const q = p[i];
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      q.vy += 90 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }
  function draw(ctx, camY) {
    for (let i = 0; i < N; i++) {
      const q = p[i];
      if (!q.on) continue;
      ctx.fillStyle = q.col;
      ctx.fillRect(Math.round(q.x), Math.round(q.y - camY), q.s, q.s);
    }
  }
  return { burst, update, draw };
})();

const Shop = (() => {
  const W = Art.W;
  const SOLIDS = [[52, 196, 90, 16], [8, 96, 38, 24], [160, 96, 26, 24], [8, 270, 32, 36]];
  const STATIONS = [
    { id: 'counter', x: 97, y: 182, r: 20 },
    { id: 'shelf', x: 97, y: 68, r: 26 },
    { id: 'bench', x: 28, y: 128, r: 20 },
    { id: 'storage', x: 172, y: 128, r: 20 },
    { id: 'door', x: 176, y: 264, r: 16 },
    { id: 'bed', x: 48, y: 288, r: 16 },
  ];
  const ICONS = { counter: '🔔', shelf: '🏷️', bench: '🔧', storage: '📦', door: '🚪', bed: '🛏️' };
  const LABELS = { counter: 'Counter', shelf: 'Shelf', bench: 'Bench', storage: 'Box', door: 'Dump', bed: 'Sleep' };
  const BOT = { id: 99, sp: 'robot', col: '#ffd84a', col2: '#ff8a3a', vip: false };

  const player = { x: 97, y: 150, face: 1, moving: false };
  const customers = [];
  const ents = [];
  let bg = null;
  let bgKey = '';
  let near = null;
  let shutter = 0;
  let spawnT = 0;
  let botT = 0;
  let nextId = 1;
  let active = null;
  let moved = 0;

  const state = () => Game.state;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function decorCount() { return Math.min(Data.DECOR.length, Math.max(0, state().level - 1)); }

  function ensureBg() {
    const key = state().rank + ':' + decorCount();
    if (key !== bgKey) { bg = Art.buildShop(state().rank, decorCount()); bgKey = key; }
  }

  function queued() {
    let n = 0;
    for (let i = 0; i < customers.length; i++) if (customers[i].state === 'queue') n++;
    return n;
  }

  function spawn() {
    const s = state();
    const cp = pick(Art.COLORS);
    let want = 'sell';
    const r = Math.random();
    if (s.day === 1 && s.served === 0 && !customers.length) want = 'buy';
    else if (s.day >= 2 && r < 0.12) want = 'help';
    else if (r < 0.55) want = 'buy';
    customers.push({
      id: nextId++, sp: pick(Art.SPECIES), col: cp[0], col2: cp[1],
      vip: s.day >= 2 && Math.random() < 0.12, want,
      x: 97 + (Math.random() * 40 - 20), y: 420, wp: [], state: 'queue', emo: '',
    });
  }

  function slotPos(i, out) {
    out.x = 97 + [0, -18, 18, -36, 36][i % 5];
    out.y = 356 + Math.floor(i / 5) * 16 + (i % 2) * 4;
  }

  const tmp = { x: 0, y: 0 };

  function moveTo(c, tx, ty, dt, speed) {
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) { c.x = tx; c.y = ty; return true; }
    c.x += dx / d * step;
    c.y += dy / d * step;
    return false;
  }

  function callNext() {
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      if (c.state === 'queue') {
        c.state = 'walkin';
        c.wp = [[97, 338], [97, 228]];
        active = c;
        SFX.play('bell');
        return true;
      }
    }
    return false;
  }

  function release(c, mood) {
    c.state = 'leave';
    c.emo = mood === 'love' ? '💖' : mood === 'happy' ? '😊' : '😐';
    c.wp = [[97, 300], [97, 345], [97, 440]];
    active = null;
    state().served++;
    Game.save();
  }

  function openShop() {
    const s = state();
    s.phase = 'open';
    spawnT = 0;
    SFX.play('bell');
    UI.toast('🔓 Open!');
  }

  function startDay() {
    customers.length = 0;
    active = null;
    const s = state();
    s.served = 0;
    s.quota = 5 + Math.min(s.rank, 3) + (s.day > 3 ? 1 : 0);
    s.phase = 'prep';
    s.today = { coins: 0, xp: 0, trades: 0 };
    player.x = 97; player.y = 150;
  }

  // ---------- stations ----------

  function actionInfo() {
    if (!near) return null;
    const s = state();
    if (near.id === 'counter') {
      if (s.phase === 'prep') return { icon: '🔓', label: 'Open' };
      if (s.phase === 'open' && !active && queued()) return { icon: '🔔', label: 'Next' };
      return null;
    }
    return { icon: ICONS[near.id], label: LABELS[near.id] };
  }

  function action() {
    if (UI.isOpen() || !near || !actionInfo()) return false;
    SFX.unlock();
    switch (near.id) {
      case 'counter':
        if (state().phase === 'prep') openShop(); else callNext();
        break;
      case 'shelf': UI.shelf(); break;
      case 'bench': UI.bench(); break;
      case 'storage': UI.storage(); break;
      case 'door': Dump.enter(); break;
      case 'bed': Game.sleep(); break;
      default: break;
    }
    return true;
  }

  // ---------- update ----------

  function blocked(x, y) {
    for (let i = 0; i < SOLIDS.length; i++) {
      const o = SOLIDS[i];
      if (x + 4 > o[0] && x - 4 < o[0] + o[2] && y > o[1] && y - 4 < o[1] + o[3]) return true;
    }
    return false;
  }

  function update(dt, t) {
    ensureBg();
    const s = state();
    const v = UI.isOpen() ? { x: 0, y: 0 } : Input.vec();
    const sp = 55 * (1 + 0.1 * s.up.speed);
    const nx = Math.max(10, Math.min(185, player.x + v.x * sp * dt));
    if (!blocked(nx, player.y)) player.x = nx;
    const ny = Math.max(56, Math.min(326, player.y + v.y * sp * dt));
    if (!blocked(player.x, ny)) player.y = ny;
    player.moving = v.x * v.x + v.y * v.y > 0.01;
    if (v.x) player.face = v.x > 0 ? 1 : -1;
    if (player.moving) moved += Math.hypot(v.x, v.y) * sp * dt;

    near = null;
    let best = 1e9;
    for (let i = 0; i < STATIONS.length; i++) {
      const st = STATIONS[i];
      const d = Math.hypot(player.x - st.x, player.y - st.y);
      if (d < st.r && d < best) { best = d; near = st; }
    }
    Game.tutCheck(moved, near && near.id === 'counter');

    shutter += ((s.phase === 'open' ? 1 : 0) - shutter) * Math.min(1, dt * 6);

    if (s.phase === 'open') {
      const alive = customers.length + s.served;
      spawnT -= dt;
      if (spawnT <= 0 && queued() < 5 && alive < s.quota) {
        spawn();
        spawnT = 2.5 + Math.random() * 1.5;
      }
      // helper bots serve a waiting buy customer on their own
      if (s.up.bot > 0 && !active && !UI.isOpen()) {
        botT += dt;
        if (botT > 14 - 3 * s.up.bot) {
          botT = 0;
          for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            if (c.state === 'queue' && c.want === 'buy' && Trade.auto(c)) {
              c.state = 'leave'; c.emo = '😊'; c.wp = [[97, 345], [97, 440]];
              s.served++;
              Parts.burst(c.x, c.y - 8, '#ffd84a', 8, 40);
              SFX.play('coin');
              break;
            }
          }
        }
      }
      if (s.served >= s.quota && !customers.length) {
        s.phase = 'done';
        UI.toast('🌙 All done! Sleep or dig!');
        UI.confetti(40);
        Game.save();
      }
    }

    let qi = 0;
    for (let i = customers.length - 1; i >= 0; i--) {
      const c = customers[i];
      if (c.state === 'queue') {
        slotPos(qi++, tmp);
        moveTo(c, tmp.x, tmp.y, dt, 40);
      } else if (c.wp.length) {
        if (moveTo(c, c.wp[0][0], c.wp[0][1], dt, 55)) c.wp.shift();
        if (!c.wp.length && c.state === 'walkin') {
          c.state = 'wait';
          if (!Trade.cur) Trade.open(c);
        }
        if (!c.wp.length && c.state === 'leave') customers.splice(i, 1);
      } else if (c.state === 'wait' && !Trade.cur && !UI.isOpen()) {
        Trade.open(c);
      }
    }
    Parts.update(dt);
  }

  // ---------- draw ----------

  function drawBubble(ctx, c, camY, t) {
    const bx = Math.round(c.x) - 10;
    const by = Math.round(c.y) - 46 - camY;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, 20, 18);
    ctx.fillRect(bx + 8, by + 18, 4, 3);
    ctx.fillStyle = c.want === 'buy' ? '#3affd0' : c.want === 'sell' ? '#ff4fd8' : '#ffcf3a';
    ctx.fillRect(bx, by, 20, 2);
    ctx.drawImage(Art.sprite(c.key || 'bolt'), bx + 2, by + 2 + Math.round(Math.sin(t * 5)));
  }

  function draw(ctx, camY, H, t) {
    const s = state();
    ctx.drawImage(bg, 0, -camY);
    // shutter slats over the doorway
    const sh = Math.round(14 * (1 - shutter));
    if (sh > 0) {
      ctx.fillStyle = '#6a6f88';
      ctx.fillRect(69, 330 - camY, 57, sh);
      ctx.fillStyle = '#4a4f68';
      for (let y = 332; y < 330 + sh; y += 3) ctx.fillRect(69, y - camY, 57, 1);
    }
    // neon bulbs (cosmetic upgrade)
    for (let i = 0; i < s.up.deco * 4; i++) {
      ctx.fillStyle = ((i + Math.floor(t * 2)) % 3) ? '#ff4fd8' : '#3affd0';
      ctx.fillRect(6 + Math.round(i * (183 / Math.max(1, s.up.deco * 4 - 1))), 3 - camY, 3, 3);
    }
    // shelf
    ctx.fillStyle = '#5a4a7a';
    ctx.fillRect(8, 40 - camY, 179, 4);
    ctx.fillStyle = '#ff4fd8';
    ctx.fillRect(8, 44 - camY, 179, 1);
    const n = Game.slots();
    for (let i = 0; i < n; i++) {
      const k = s.display[i];
      const sx = 12 + Math.round(i * (171 / Math.max(1, n)));
      if (k) ctx.drawImage(Art.sprite(k), sx, 24 - camY);
      else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + 4, 36 - camY, 8, 2); }
    }
    // station ring
    if (near && actionInfo()) {
      ctx.strokeStyle = 'rgba(58,255,208,' + (0.6 + 0.3 * Math.sin(t * 6)) + ')';
      ctx.strokeRect(Math.round(near.x) - near.r + 0.5, Math.round(near.y) - near.r / 2 - camY + 0.5, near.r * 2, near.r);
    }
    // sort entities by y
    ents.length = 0;
    ents.push(player);
    for (let i = 0; i < customers.length; i++) ents.push(customers[i]);
    if (s.up.bot > 0) ents.push(BOT);
    for (let i = 1; i < ents.length; i++) {
      const e = ents[i];
      let j = i - 1;
      while (j >= 0 && (ents[j] === BOT ? 186 : ents[j].y) > (e === BOT ? 186 : e.y)) { ents[j + 1] = ents[j]; j--; }
      ents[j + 1] = e;
    }
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e === player) Art.drawPlayer(ctx, e.x, e.y - camY, t, e.face, e.moving);
      else if (e === BOT) Art.drawCustomer(ctx, BOT, 66, 188 - camY, t, false);
      else {
        Art.drawCustomer(ctx, e, e.x, e.y - camY, t, e.state !== 'queue' && e.wp.length > 0);
        if (e.emo) { ctx.font = '10px sans-serif'; ctx.fillText(e.emo, Math.round(e.x) - 5, Math.round(e.y) - 22 - camY); }
      }
    }
    if (active && active.state === 'wait' && Trade.cur) drawBubble(ctx, active, camY, t);
    // tutorial arrow above the counter
    if (s.tut === 1) {
      const by = 160 + Math.round(Math.sin(t * 6) * 3) - camY;
      ctx.fillStyle = '#ffcf3a';
      ctx.fillRect(94, by, 7, 3); ctx.fillRect(95, by + 3, 5, 2); ctx.fillRect(96, by + 5, 3, 2); ctx.fillRect(97, by + 7, 1, 2);
    }
    Parts.draw(ctx, camY);
  }

  function teleport(x, y) { player.x = x; player.y = y; }

  function station(id) { return STATIONS.find((x) => x.id === id); }

  return {
    player, customers, STATIONS, startDay, update, draw, action, actionInfo, release, teleport, station, callNext, openShop,
    get near() { return near; },
    get active() { return active; },
    get queued() { return queued(); },
    get bgKey() { return bgKey; },
  };
})();
