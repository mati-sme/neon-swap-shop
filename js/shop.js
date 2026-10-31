/* Neon Swap Shop — the shop room: player, stations, customer queue, ambience, day flow */
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
  const L = Art.L;
  const SOLIDS = [L.counter, L.bench, L.storage, L.pod];
  // x/y: where the player must stand; r: reach; lx/ly: label anchor; hl: highlight rect
  const STATIONS = [
    { id: 'counter', x: 97, y: 187, r: 24, lx: 97, ly: 181, ico: '🛎️', hl: [48, 194, 98, 26] },
    { id: 'shelf', x: 97, y: 98, r: 34, lx: 97, ly: 92, ico: '🗄️', hl: [22, 34, 152, 50] },
    { id: 'bench', x: 28, y: 138, r: 20, lx: 27, ly: 94, ico: '🔧', hl: [5, 96, 44, 36] },
    { id: 'storage', x: 172, y: 138, r: 20, lx: 171, ly: 86, ico: '📦', hl: [153, 90, 36, 40] },
    { id: 'door', x: 176, y: 238, r: 18, lx: 179, ly: 204, ico: '🚪', hl: [181, 212, 14, 48] },
    { id: 'bed', x: 52, y: 262, r: 20, lx: 24, ly: 232, ico: '🛏️', hl: [5, 236, 40, 48] },
  ];
  const ICONS = { counter: '🔔', shelf: '🏷️', bench: '🔧', storage: '📦', door: '🚪', bed: '🛏️' };
  const LABELS = { counter: 'Counter', shelf: 'Shelf', bench: 'Bench', storage: 'Box', door: 'Dump', bed: 'Sleep' };
  const BOT = { id: 99, sp: 'robot', col: '#ffd84a', col2: '#ff8a3a', vip: false };
  const WANT_COL = { buy: '#3affd0', sell: '#ff4fd8', help: '#ffcf3a' };
  const COUNTER_Y = 236;

  const player = { x: 97, y: 150, face: 1, moving: false };
  const customers = [];
  const ents = [];
  const motes = [];
  for (let i = 0; i < 16; i++) motes.push({ x: Math.random() * 195, y: 90 + Math.random() * 210, ph: Math.random() * 6.28, c: i % 3 });
  const MOTE_COL = ['rgba(120,255,230,0.55)', 'rgba(255,120,220,0.5)', 'rgba(255,240,160,0.5)'];
  let bg = null;
  let bgKey = '';
  let near = null;
  let nextId = null;
  let shutter = 0;
  let spawnT = 0;
  let botT = 0;
  let cid = 1;
  let active = null;
  let moved = 0;
  const slot = { x: 0, y: 0 };

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
      id: cid++, sp: pick(Art.SPECIES), col: cp[0], col2: cp[1],
      vip: s.day >= 2 && Math.random() < 0.12, want,
      x: 97 + (Math.random() * 30 - 15), y: 348, wp: [], state: 'queue', emo: '',
    });
  }

  // the line forms just below the counter and runs towards the door
  function slotPos(i, out) {
    out.x = 97 + (i % 2 ? 8 : -6);
    out.y = 254 + i * 11;
  }

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
        c.wp = [[97, 246], [97, COUNTER_Y]];
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
    c.wp = [[120, 246], [120, 322], [100, 352]];
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

  // ---------- "what next?" hint ----------

  function stockCount() {
    let n = 0;
    const inv = state().inv;
    for (const k in inv) n += inv[k];
    return n;
  }

  function emptySlot() {
    const d = state().display;
    const n = Game.slots();
    for (let i = 0; i < n; i++) if (!d[i]) return true;
    return false;
  }

  function computeNext() {
    const s = state();
    if (s.phase === 'prep') return emptySlot() && stockCount() > 0 ? 'shelf' : 'counter';
    if (s.phase === 'open') return !active && queued() ? 'counter' : null;
    return stockCount() < 4 ? 'door' : 'bed';
  }

  // ---------- floating station labels (crisp DOM emoji over the canvas) ----------

  function initLabels() {
    const box = UI.$('labels');
    for (const st of STATIONS) {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.innerHTML = '<b>' + st.ico + '</b>';
      box.appendChild(el);
      st.el = el;
    }
  }

  function layout(camY, viewH, hudBottom) {
    const sx = innerWidth / Art.W;
    const sy = (innerHeight - hudBottom) / viewH;
    for (const st of STATIONS) {
      if (!st.el) continue;
      st.el.style.transform = 'translate(' + Math.round(st.lx * sx) + 'px,' + Math.round(hudBottom + (st.ly - camY) * sy) + 'px)';
    }
  }

  function markNext() {
    for (const st of STATIONS) if (st.el) st.el.classList.toggle('next', st.id === nextId);
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
    const ny = Math.max(92, Math.min(296, player.y + v.y * sp * dt));
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

    const nid = computeNext();
    if (nid !== nextId) { nextId = nid; markNext(); }

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
              c.state = 'leave'; c.emo = '😊'; c.wp = [[120, 246], [120, 322], [100, 352]];
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
        UI.toast('🌙 Done! 🚪 or 🛏️');
        UI.confetti(40);
        Game.save();
      }
    }

    let qi = 0;
    for (let i = customers.length - 1; i >= 0; i--) {
      const c = customers[i];
      if (c.state === 'queue') {
        slotPos(qi++, slot);
        moveTo(c, slot.x, slot.y, dt, 42);
      } else if (c.wp.length) {
        if (moveTo(c, c.wp[0][0], c.wp[0][1], dt, 58)) c.wp.shift();
        if (!c.wp.length && c.state === 'walkin') {
          c.state = 'wait';
          if (!Trade.cur) Trade.open(c);
        }
        if (!c.wp.length && c.state === 'leave') customers.splice(i, 1);
      } else if (c.state === 'wait' && !Trade.cur && !UI.isOpen()) {
        Trade.open(c);
      }
    }

    // ambient dust motes drift upwards through the neon light
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.y -= (3 + m.c) * dt;
      m.x += Math.sin(t * 0.8 + m.ph) * 4 * dt;
      if (m.y < 86) { m.y = 296; m.x = Math.random() * 195; }
    }
    Parts.update(dt);
  }

  // ---------- draw ----------

  function drawBubble(ctx, c, camY, t) {
    const bx = Math.round(c.x) - 11;
    const by = Math.round(c.y) - 48 - camY;
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, 22, 20);
    ctx.fillRect(bx + 9, by + 20, 4, 3);
    ctx.fillStyle = WANT_COL[c.want] || '#ffcf3a';
    ctx.fillRect(bx, by, 22, 2);
    ctx.drawImage(Art.sprite(c.key || 'bolt'), bx + 2, by + 2 + Math.round(Math.sin(t * 5)));
  }

  function flick(t, i) { return Math.sin(t * 37 + i * 5) * Math.sin(t * 11 + i) > 0.9 ? 0.2 : 1; }

  function draw(ctx, camY, H, t) {
    const s = state();
    if (H > Art.SHOP_H) { ctx.fillStyle = '#12122e'; ctx.fillRect(0, Art.SHOP_H - camY, Art.W, H - Art.SHOP_H + camY); }
    ctx.drawImage(bg, 0, -camY);
    // shutter slats over the doorway
    const sh = Math.round(14 * (1 - shutter));
    if (sh > 0) {
      ctx.fillStyle = '#6a6f88';
      ctx.fillRect(69, 300 - camY, 57, sh);
      ctx.fillStyle = '#4a4f68';
      for (let y = 302; y < 300 + sh; y += 3) ctx.fillRect(69, y - camY, 57, 1);
    }
    // flickering ceiling tubes + light shafts
    for (let i = 0; i < L.lights.length; i++) {
      const l = L.lights[i];
      const f = flick(t, i);
      ctx.fillStyle = f > 0.5 ? '#ffffff' : '#3a4a6a';
      ctx.fillRect(l[0] + 1, l[1] - 3 - camY, l[2] - 2, 2);
      ctx.fillStyle = 'rgba(190,235,255,' + 0.07 * f + ')';
      ctx.fillRect(l[0] - 4, l[1] - camY, l[2] + 8, 30);
    }
    // neon sign shimmer
    const sg = L.sign;
    if (Math.sin(t * 3.1) * Math.sin(t * 7.3) > 0.9) { ctx.fillStyle = 'rgba(10,6,24,0.55)'; ctx.fillRect(sg[0] + 2, sg[1] + 2 - camY, sg[2] - 4, sg[3] - 4); }
    else { ctx.fillStyle = 'rgba(255,79,216,' + (0.05 + 0.04 * Math.sin(t * 2)) + ')'; ctx.fillRect(sg[0] - 3, sg[1] - 3 - camY, sg[2] + 6, sg[3] + 6); }
    // neon bulbs (cosmetic upgrade)
    for (let i = 0; i < s.up.deco * 4; i++) {
      ctx.fillStyle = ((i + Math.floor(t * 2)) % 3) ? '#ff4fd8' : '#3affd0';
      ctx.fillRect(6 + Math.round(i * (183 / Math.max(1, s.up.deco * 4 - 1))), 8 - camY, 3, 3);
    }
    // shelf: the items actually on display
    const n = Game.slots();
    for (let i = 0; i < 10; i++) {
      Art.slotPos(i, slot);
      if (i >= n) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(slot.x + 2, slot.y + 12 - camY, 12, 3);
        continue;
      }
      const k = s.display[i];
      if (k) ctx.drawImage(Art.sprite(k), slot.x - 1, slot.y - 1 - camY);
      else {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.06 * Math.sin(t * 3 + i)) + ')';
        ctx.fillRect(slot.x + 3, slot.y + 13 - camY, 10, 2);
        ctx.fillRect(slot.x + 7, slot.y + 9 - camY, 2, 6);
      }
    }
    // counter "OPEN" light
    Art.text(ctx, 'OPEN', 127, 187 - camY, 1, s.phase === 'open' ? '#3affd0' : '#6a4a7a');
    // "do this next" pulse + the station you are standing at
    for (let i = 0; i < STATIONS.length; i++) {
      const st = STATIONS[i];
      const isNext = st.id === nextId;
      const isNear = near === st && actionInfo();
      if (!isNext && !isNear) continue;
      const h = st.hl;
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      if (isNext) {
        ctx.fillStyle = 'rgba(255,226,80,' + (0.07 + 0.1 * pulse) + ')';
        ctx.fillRect(h[0], h[1] - camY, h[2], h[3]);
        ctx.strokeStyle = 'rgba(255,226,80,' + (0.45 + 0.45 * pulse) + ')';
        ctx.strokeRect(h[0] - 0.5 - pulse, h[1] - camY - 0.5 - pulse, h[2] + 1 + pulse * 2, h[3] + 1 + pulse * 2);
      }
      if (isNear) {
        ctx.strokeStyle = 'rgba(58,255,208,' + (0.6 + 0.3 * Math.sin(t * 6)) + ')';
        ctx.strokeRect(h[0] + 0.5, h[1] - camY + 0.5, h[2] - 1, h[3] - 1);
      }
    }
    // sort entities by y
    ents.length = 0;
    ents.push(player);
    for (let i = 0; i < customers.length; i++) ents.push(customers[i]);
    if (s.up.bot > 0) ents.push(BOT);
    for (let i = 1; i < ents.length; i++) {
      const e = ents[i];
      let j = i - 1;
      while (j >= 0 && (ents[j] === BOT ? 192 : ents[j].y) > (e === BOT ? 192 : e.y)) { ents[j + 1] = ents[j]; j--; }
      ents[j + 1] = e;
    }
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e === player) Art.drawPlayer(ctx, e.x, e.y - camY, t, e.face, e.moving);
      else if (e === BOT) Art.drawCustomer(ctx, BOT, 68, 192 - camY, t, false);
      else {
        Art.drawCustomer(ctx, e, e.x, e.y - camY, t, e.state !== 'queue' && e.wp.length > 0);
        if (e.state === 'queue') {
          ctx.fillStyle = WANT_COL[e.want];
          ctx.fillRect(Math.round(e.x) - 2, Math.round(e.y) - 24 - camY + Math.round(Math.sin(t * 4 + e.id)), 4, 4);
        }
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
    // dust motes
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      ctx.fillStyle = MOTE_COL[m.c];
      ctx.fillRect(Math.round(m.x), Math.round(m.y - camY), 1, 1);
    }
    Parts.draw(ctx, camY);
  }

  function teleport(x, y) { player.x = x; player.y = y; }

  function station(id) { return STATIONS.find((x) => x.id === id); }

  return {
    player, customers, STATIONS, startDay, update, draw, action, actionInfo, release, teleport, station, callNext, openShop,
    initLabels, layout,
    get near() { return near; },
    get next() { return nextId; },
    get active() { return active; },
    get queued() { return queued(); },
    get bgKey() { return bgKey; },
  };
})();
