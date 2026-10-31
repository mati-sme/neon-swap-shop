/* Neon Swap Shop — the Junk Dump: scrolling scavenging with limited digs and a bag */
'use strict';

const Dump = (() => {
  const $ = UI.$;
  const WW = Art.DUMP_W;
  const WH = Art.DUMP_H;
  const player = { x: 180, y: 455, face: 1, moving: false };
  const EXIT = { x: 180, y: 492, r: 20 };
  let bg = null;
  let spots = [];
  let bunnies = [];
  let bots = [];
  let bag = [];
  let digsLeft = 0;
  let dig = null;
  let near = null; // spot object | EXIT | null
  let bumpCd = 0;
  let sawRare = false;
  let camX = 0;
  let camY = 0;

  const state = () => Game.state;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function bagCap() { return Game.bagCap(); }

  function enter() {
    const s = state();
    if (!bg) bg = Art.buildDump();
    Game.setScene('dump');
    s.trips++;
    player.x = 180; player.y = 455;
    bag = [];
    digsLeft = 5 + s.up.digs;
    dig = null;
    sawRare = false;
    spots = [];
    for (let tries = 0; spots.length < 9 && tries < 400; tries++) {
      const x = rnd(34, WW - 34);
      const y = rnd(40, 420);
      if (spots.every((o) => Math.hypot(o.x - x, o.y - y) > 52) && Math.hypot(x - player.x, y - player.y) > 60) {
        spots.push({ x, y, used: false, shake: 0 });
      }
    }
    bunnies = [];
    for (let i = 0; i < 6; i++) bunnies.push({ x: rnd(30, WW - 30), y: rnd(60, 400), vx: rnd(-14, 14), vy: rnd(-14, 14) });
    bots = [];
    for (let i = 0; i < 3; i++) bots.push({ x: rnd(40, WW - 40), y: rnd(80, 380) });
    bumpCd = 0;
    UI.toast('⛏️ ' + digsLeft + ' digs · 🎒 ' + bagCap());
  }

  function exit() {
    const got = bag.slice();
    bag = [];
    dig = null;
    $('digBtn').classList.add('hidden');
    for (const k of got) { Game.invAdd(k, 1); Game.markFound(k); }
    Game.setScene('shop');
    Shop.teleport(170, 264);
    Game.save();
    if (got.length) {
      let h = '<div class="grid5">';
      for (const k of got) h += '<div class="tile mini">' + UI.img(k, 2) + '</div>';
      h += '</div>';
      UI.queue(() => UI.info('🎒 ' + got.length, h, '✓'));
    }
  }

  function actionInfo() {
    if (!near) return null;
    if (near === EXIT) return { icon: '🏠', label: 'Home' };
    if (digsLeft <= 0) return null;
    if (bag.length >= bagCap()) return { icon: '🎒', label: 'Full' };
    return { icon: '⛏️', label: 'Dig' };
  }

  function action() {
    if (UI.isOpen() || dig || !near || !actionInfo()) return false;
    SFX.unlock();
    if (near === EXIT) { exit(); return true; }
    if (bag.length >= bagCap()) { UI.toast('🎒 Bag full! Go home 🏠'); SFX.play('bad'); return true; }
    dig = { spot: near, taps: 0 };
    $('digBtn').classList.remove('hidden');
    Input.reset();
    return true;
  }

  function roll() {
    const s = state();
    let r = Math.random();
    let rar = r < 0.03 ? 3 : r < 0.12 ? 2 : r < 0.4 ? 1 : 0;
    if (rar === 0 && s.pity >= 3) rar = 1;
    if (rar === 0 && digsLeft <= 1 && !sawRare) rar = 1;
    if (rar >= 1) { s.pity = 0; sawRare = true; } else s.pity++;
    const tier = rar === 0 ? (Math.random() < 0.6 ? 0 : 1) : rar + 1;
    const pool = Data.BY_TIER[tier];
    return { key: pool[Math.floor(Math.random() * pool.length)], rar };
  }

  function tap() {
    if (!dig) return;
    SFX.play('dig');
    dig.taps++;
    dig.spot.shake = 0.25;
    Parts.burst(dig.spot.x, dig.spot.y, '#c9a35a', 8, 40);
    if (dig.taps < 3) return;
    const sp = dig.spot;
    dig = null;
    $('digBtn').classList.add('hidden');
    sp.used = true;
    digsLeft--;
    const { key, rar } = roll();
    bag.push(key);
    const s = state();
    s.stats.digs++;
    Game.sticker('dig');
    Game.markFound(key);
    Game.addXp(3 + rar * 3);
    const col = Data.RARITY_COLORS[rar];
    UI.flash(col);
    Parts.burst(sp.x, sp.y - 6, col, 24, 70);
    Game.shake(rar >= 2 ? 3 : 1);
    SFX.play(rar ? 'rare' : 'pop');
    if (rar >= 2) UI.confetti(rar === 3 ? 90 : 40);
    if (rar === 3) Game.sticker('legend');
    const el = $('loot');
    el.innerHTML = UI.img(key, 5) + '<b style="color:' + col + '">' + Data.RARITY[rar].toUpperCase() + '</b><small>' + Data.ITEMS[key].name + '</small>';
    el.style.borderColor = col;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    if (digsLeft <= 0) UI.toast('No digs left — go home 🏠');
    else if (bag.length >= bagCap()) UI.toast('🎒 Bag full — go home 🏠');
  }

  function update(dt, t) {
    const s = state();
    for (const sp of spots) if (sp.shake > 0) sp.shake -= dt;
    const v = UI.isOpen() || dig ? { x: 0, y: 0 } : Input.vec();
    const sp = 55 * (1 + 0.1 * s.up.speed);
    player.x = Math.max(12, Math.min(WW - 12, player.x + v.x * sp * dt));
    player.y = Math.max(22, Math.min(WH - 10, player.y + v.y * sp * dt));
    player.moving = v.x * v.x + v.y * v.y > 0.01;
    if (v.x) player.face = v.x > 0 ? 1 : -1;

    near = null;
    let best = 1e9;
    for (const o of spots) {
      if (o.used) continue;
      const d = Math.hypot(player.x - o.x, player.y - o.y);
      if (d < 16 && d < best) { best = d; near = o; }
    }
    if (!near && Math.hypot(player.x - EXIT.x, player.y - EXIT.y) < EXIT.r) near = EXIT;

    bumpCd -= dt;
    for (const b of bunnies) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 14 || b.x > WW - 14) b.vx = -b.vx;
      if (b.y < 24 || b.y > WH - 40) b.vy = -b.vy;
      if (Math.random() < dt * 0.4) { b.vx = rnd(-16, 16); b.vy = rnd(-16, 16); }
      bump(b, 9);
    }
    for (const b of bots) bump(b, 10);
    Parts.update(dt);

    camX = Math.max(0, Math.min(WW - Art.W, Math.round(player.x - Art.W / 2)));
    camY = Math.max(0, Math.min(WH - Game.viewH, Math.round(player.y - Game.viewH / 2)));
  }

  // friendly hazard: lose a coin, get nudged away — never any damage
  function bump(o, r) {
    if (bumpCd > 0) return;
    const dx = player.x - o.x;
    const dy = player.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d >= r) return;
    bumpCd = 1.5;
    const k = d || 1;
    player.x = Math.max(12, Math.min(WW - 12, player.x + dx / k * 14));
    player.y = Math.max(22, Math.min(WH - 10, player.y + dy / k * 14));
    SFX.play('bump');
    Game.shake(1);
    if (state().coins > 0) { Game.addCoins(-1, { raw: true }); UI.pop('-1 🪙', '#ff8a8a'); }
    Parts.burst(o.x, o.y - 4, '#ffe27a', 6, 30);
  }

  function draw(ctx, t) {
    ctx.save();
    ctx.translate(-camX, -camY);
    ctx.drawImage(bg, 0, 0);
    for (const o of spots) {
      const ox = Math.round(o.x + (o.shake > 0 ? Math.round(Math.sin(t * 60) * 1.5) : 0));
      const oy = Math.round(o.y);
      if (o.used) {
        ctx.fillStyle = '#150d28'; ctx.fillRect(ox - 6, oy - 2, 12, 5);
      } else {
        const pulse = 0.35 + 0.25 * Math.sin(t * 4 + o.x);
        ctx.fillStyle = 'rgba(58,255,208,' + pulse + ')'; ctx.fillRect(ox - 9, oy - 5, 18, 10);
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(ox - 6, oy - 3, 12, 6);
        ctx.fillStyle = '#ffd84a'; ctx.fillRect(ox - 1, oy - 7 - Math.round(Math.sin(t * 5 + o.y)), 2, 2);
      }
    }
    for (const b of bots) {
      Art.drawCustomer(ctx, { id: 5, sp: 'robot', col: '#6a6f88', col2: '#4a4f68', vip: false }, b.x, b.y, 0, false);
      ctx.fillStyle = '#9ad'; ctx.fillRect(Math.round(b.x) + 6, Math.round(b.y) - 22 - Math.round(t * 4 % 4), 3, 1);
    }
    for (const b of bunnies) {
      const bx = Math.round(b.x);
      const by = Math.round(b.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx - 4, by + 1, 9, 2);
      ctx.fillStyle = '#b8a8d8'; ctx.fillRect(bx - 4, by - 6, 9, 7); ctx.fillRect(bx - 3, by - 8, 7, 2);
      ctx.fillStyle = '#102'; ctx.fillRect(bx - 2, by - 5, 1, 2); ctx.fillRect(bx + 2, by - 5, 1, 2);
    }
    Art.drawPlayer(ctx, player.x, player.y, t, player.face, player.moving);
    if (near && actionInfo()) {
      ctx.strokeStyle = 'rgba(255,207,58,' + (0.6 + 0.3 * Math.sin(t * 6)) + ')';
      ctx.strokeRect(Math.round(near.x) - 11.5, Math.round(near.y) - 7.5, 23, 15);
    }
    Parts.draw(ctx, 0);
    ctx.restore();
  }

  return {
    player, enter, exit, update, draw, action, actionInfo, tap,
    get near() { return near; },
    get bag() { return bag; },
    get digsLeft() { return digsLeft; },
    get spots() { return spots; },
    get digging() { return !!dig; },
    teleport(x, y) { player.x = x; player.y = y; },
  };
})();
