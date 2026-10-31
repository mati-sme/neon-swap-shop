/* Neon Swap Shop — procedural pixel art (everything is drawn from rects, no image files) */
'use strict';

const Art = (() => {
  const W = 195;           // low-res canvas width; height follows the screen aspect
  const SHOP_H = 400;      // shop world height (room + sidewalk)
  const DUMP_W = 360;
  const DUMP_H = 520;

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, v + amt));
    return 'rgb(' + ch(n >> 16) + ',' + ch((n >> 8) & 255) + ',' + ch(n & 255) + ')';
  }

  function invert(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgb(' + (255 - (n >> 16)) + ',' + (255 - ((n >> 8) & 255)) + ',' + (255 - (n & 255)) + ')';
  }

  // ---------- items (16x16 grid) ----------

  const regions = {
    logo: [2, 7, 3, 3],
    btn: [7, 8, 7, 2],
    color: [2, 11, 12, 1],
  };

  // fake: null | 'logo' | 'btn' | 'color' — exactly one detail differs from the genuine item
  function drawItem(ctx, key, x, y, s, fake) {
    const id = key.endsWith('+') ? key.slice(0, -1) : key;
    const shiny = key.length !== id.length;
    const it = Data.ITEMS[id];
    const lo = shade(it.c1, -60);
    const hi = shade(it.c1, 45);
    const r = (px, py, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(x + px * s, y + py * s, w * s, h * s);
    };
    // silhouette extras above the torso
    switch (it.kind) {
      case 'box': r(6, 4, 4, 2, lo); break;
      case 'ball': r(4, 3, 8, 3, lo); r(6, 2, 4, 1, lo); break;
      case 'tall': r(5, 1, 6, 5, lo); r(4, 0, 8, 1, it.c2); break;
      case 'wide': r(2, 3, 3, 3, lo); r(11, 3, 3, 3, lo); break;
      case 'plush': r(2, 2, 3, 4, it.c1); r(11, 2, 3, 4, it.c1); break;
      case 'bot': r(4, 1, 8, 5, it.c1); r(5, 3, 2, 1, '#3affd0'); r(9, 3, 2, 1, '#3affd0'); r(7, 0, 2, 1, it.c2); break;
      case 'gear': r(2, 4, 2, 2, lo); r(7, 3, 2, 3, lo); r(12, 4, 2, 2, lo); break;
      case 'helm': r(3, 1, 10, 5, it.c1); r(5, 3, 6, 2, '#66ccff'); break;
      case 'gem': r(4, 3, 8, 3, hi); r(6, 1, 4, 2, hi); break;
      case 'cart': r(4, 3, 8, 3, lo); break;
      default: break;
    }
    // torso
    r(0, 6, 16, 8, lo);
    r(1, 7, 14, 6, it.c1);
    r(1, 7, 14, 1, hi);
    if (it.kind === 'wide' || it.kind === 'bot' || it.kind === 'plush') { r(2, 14, 3, 2, lo); r(11, 14, 3, 2, lo); }
    // details a fake can get wrong
    if (fake !== 'logo') {
      r(3, 7, 1, 3, it.c2); r(2, 8, 3, 1, it.c2);
    }
    const n = fake === 'btn' ? (it.btn === 2 ? 3 : 2) : it.btn;
    for (let i = 0; i < n; i++) r(7 + i * 2, 8, 1, 2, '#ffffff');
    r(2, 11, 12, 1, fake === 'color' ? invert(it.c2) : it.c2);
    if (shiny) {
      r(13, 0, 1, 3, '#ffffff'); r(12, 1, 3, 1, '#ffffff');
      r(1, 3, 1, 1, '#ffffff'); r(0, 14, 1, 1, '#ffffff');
    }
  }

  const spriteCache = new Map();
  function sprite(key) {
    let c = spriteCache.get(key);
    if (!c) {
      c = mk(16, 16);
      drawItem(c.getContext('2d'), key, 0, 0, 1, null);
      spriteCache.set(key, c);
    }
    return c;
  }

  const iconCache = new Map();
  function icon(key, s, fake) {
    const k = key + '|' + s + '|' + (fake || '');
    let u = iconCache.get(k);
    if (!u) {
      const c = mk(16 * s, 16 * s);
      drawItem(c.getContext('2d'), key, 0, 0, s, fake || null);
      u = c.toDataURL();
      iconCache.set(k, u);
    }
    return u;
  }

  // black silhouette for undiscovered items in the book
  function silhouette(key, s) {
    const k = 'sil|' + key + '|' + s;
    let u = iconCache.get(k);
    if (!u) {
      const c = mk(16 * s, 16 * s);
      const g = c.getContext('2d');
      drawItem(g, key, 0, 0, s, null);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#1b1636';
      g.fillRect(0, 0, c.width, c.height);
      u = c.toDataURL();
      iconCache.set(k, u);
    }
    return u;
  }

  // ---------- characters ----------

  const SPECIES = ['alien', 'robot', 'cat', 'blob'];
  const COLORS = [
    ['#7aff9a', '#2a8a5a'], ['#ff7ad0', '#8a2a6a'], ['#7ad0ff', '#2a5a8a'], ['#ffd07a', '#8a5a2a'],
    ['#c09aff', '#5a2a8a'], ['#ff9a7a', '#8a3a2a'], ['#d0d8e8', '#4a5470'], ['#a0ff7a', '#4a8a2a'],
  ];

  function drawCustomer(ctx, c, x, y, t, moving) {
    const bob = moving ? Math.round(Math.sin(t * 12 + c.id) * 0.8) : Math.round(Math.sin(t * 2 + c.id) * 0.5);
    const ox = Math.round(x) - 7;
    const oy = Math.round(y) - 16 + bob;
    const r = (px, py, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(ox + px, oy + py, w, h);
    };
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox + 2, Math.round(y) - 1, 10, 2);
    if (c.vip) {
      ctx.fillStyle = 'rgba(255,210,60,' + (0.22 + 0.1 * Math.sin(t * 4)) + ')';
      ctx.fillRect(ox - 3, oy - 3, 20, 22);
    }
    const a = c.col, b = c.col2;
    switch (c.sp) {
      case 'alien':
        r(4, 0, 1, 2, b); r(9, 0, 1, 2, b); r(3, 0, 3, 1, b); r(8, 0, 3, 1, b);
        r(2, 2, 10, 7, a); r(3, 9, 8, 5, a);
        r(4, 4, 2, 3, '#fff'); r(8, 4, 2, 3, '#fff');
        r(5, 5, 1, 2, '#102'); r(9, 5, 1, 2, '#102'); r(6, 7, 2, 1, '#102');
        r(3, 14, 3, 2, b); r(8, 14, 3, 2, b);
        break;
      case 'robot':
        r(6, 0, 2, 1, b); r(2, 1, 10, 7, a);
        r(3, 3, 8, 3, '#1a1030'); r(4, 4, 2, 1, '#3affd0'); r(8, 4, 2, 1, '#3affd0');
        r(3, 8, 8, 6, b); r(6, 10, 2, 2, '#ff5ac8');
        r(1, 9, 2, 4, a); r(11, 9, 2, 4, a);
        r(3, 14, 3, 2, '#333'); r(8, 14, 3, 2, '#333');
        break;
      case 'cat':
        r(1, 1, 12, 9, 'rgba(150,230,255,0.35)');
        r(3, 1, 2, 2, a); r(9, 1, 2, 2, a); r(3, 3, 8, 6, a);
        r(5, 5, 1, 2, '#102'); r(8, 5, 1, 2, '#102'); r(6, 7, 2, 1, '#ff8aa0');
        r(3, 10, 8, 4, b); r(11, 11, 3, 1, a); r(3, 14, 3, 2, '#eee'); r(8, 14, 3, 2, '#eee');
        break;
      default: // blob
        r(4, 3, 6, 2, a); r(2, 7, 10, 6, a); r(3, 5, 8, 9, a);
        r(4, 6, 2, 2, '#fff'); r(8, 6, 2, 2, '#fff'); r(5, 7, 1, 1, '#102'); r(9, 7, 1, 1, '#102');
        r(5, 10, 4, 1, '#102'); r(3, 14, 2, 1, b); r(9, 14, 2, 1, b);
        break;
    }
    if (c.vip) { r(5, -2, 4, 2, '#ffcf3a'); r(5, -3, 1, 1, '#ffcf3a'); r(8, -3, 1, 1, '#ffcf3a'); }
  }

  function drawPlayer(ctx, x, y, t, face, moving) {
    const bob = moving ? Math.round(Math.sin(t * 14)) : 0;
    const step = moving ? (Math.sin(t * 14) > 0 ? 1 : 0) : 0;
    const ox = Math.round(x) - 7;
    const oy = Math.round(y) - 18 + bob;
    const r = (px, py, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(ox + px, oy + py, w, h);
    };
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ox + 2, Math.round(y) - 1, 10, 2);
    r(6, 0, 2, 2, '#ffd84a'); r(7, 0, 0, 0, '#fff');
    r(2, 2, 10, 8, '#e8ecff');
    r(3, 4, 8, 4, '#150d30');
    const e = face > 0 ? 1 : 0;
    r(4 + e, 5, 2, 2, '#3affd0'); r(8 + e, 5, 2, 2, '#3affd0');
    r(3, 10, 8, 5, '#ff4fd8'); r(5, 11, 4, 3, '#ffd0f0');
    r(1, 10, 2, 4, '#e8ecff'); r(11, 10, 2, 4, '#e8ecff');
    r(3 + step, 15, 3, 3, '#2a2250'); r(8 - step, 15, 3, 3, '#2a2250');
  }

  const portraitCache = new Map();
  function portrait(c, s) {
    const k = c.sp + c.col + c.col2 + (c.vip ? 'v' : '') + s;
    let u = portraitCache.get(k);
    if (!u) {
      const cv = mk(14 * s, 20 * s);
      const g = cv.getContext('2d');
      g.scale(s, s);
      drawCustomer(g, c, 7, 18, 0, false);
      u = cv.toDataURL();
      portraitCache.set(k, u);
    }
    return u;
  }

  // ---------- tiny 3x5 font (just what the neon sign needs) ----------

  const GLYPH = { S: [7, 4, 7, 1, 7], W: [5, 5, 7, 7, 5], A: [2, 5, 7, 5, 5], P: [7, 5, 7, 4, 4], H: [5, 5, 7, 5, 5], O: [7, 5, 5, 5, 7], ' ': [0, 0, 0, 0, 0] };
  function text(ctx, str, x, y, s, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const g = GLYPH[str[i]] || GLYPH[' '];
      for (let row = 0; row < 5; row++) {
        for (let b = 0; b < 3; b++) {
          if (g[row] & (4 >> b)) ctx.fillRect(x + (i * 4 + b) * s, y + row * s, s, s);
        }
      }
    }
  }

  // ---------- rooms ----------

  // floorA, floorB, wall, wall2, trimA, trimB
  const PAL = [
    ['#2a2248', '#251d40', '#1c1633', '#241c44', '#ff4fd8', '#ff4fd8'],
    ['#2c2a58', '#262350', '#1a2147', '#22305e', '#3affd0', '#ff4fd8'],
    ['#322c66', '#2a2458', '#221a4e', '#2e2468', '#ff4fd8', '#3affd0'],
    ['#3a2c70', '#30245f', '#2a1a58', '#3a2470', '#3affd0', '#ffcf3a'],
    ['#44307a', '#382868', '#321e60', '#44287a', '#ffcf3a', '#ff4fd8'],
  ];

  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

  const DECOR_DRAW = [
    (g) => { rect(g, 12, 150, 8, 7, '#7a4a2a'); rect(g, 10, 140, 12, 10, '#2aa84a'); rect(g, 13, 136, 6, 5, '#4aff7a'); },
    (g) => { rect(g, 148, 18, 20, 24, '#ff4fd8'); rect(g, 150, 20, 16, 20, '#150d30'); rect(g, 154, 26, 8, 8, '#3affd0'); },
    (g) => { rect(g, 64, 232, 68, 30, '#6a2a8a'); rect(g, 67, 235, 62, 24, '#8a3aa8'); rect(g, 74, 242, 48, 10, '#ff4fd8'); },
    (g) => { rect(g, 160, 60, 24, 16, '#0a2a4a'); rect(g, 162, 62, 20, 12, '#2a8ad0'); rect(g, 168, 66, 4, 2, '#ffb03a'); rect(g, 160, 76, 24, 2, '#3a3a5a'); },
    (g) => { rect(g, 95, 52, 1, 8, '#9aa3b8'); rect(g, 90, 60, 11, 11, '#d8e8ff'); rect(g, 92, 62, 3, 3, '#ff4fd8'); rect(g, 96, 66, 3, 3, '#3affd0'); },
    (g) => { rect(g, 14, 196, 22, 12, '#ffb03a'); rect(g, 16, 198, 18, 8, '#ffd88a'); rect(g, 20, 194, 4, 4, '#ff8a3a'); },
    (g) => { rect(g, 176, 196, 2, 20, '#9aa3b8'); rect(g, 171, 192, 12, 6, '#ffd84a'); rect(g, 173, 194, 8, 2, '#fff6b0'); },
    (g) => { rect(g, 150, 150, 20, 26, '#2a2a5a'); rect(g, 153, 153, 14, 10, '#3affd0'); rect(g, 155, 166, 3, 3, '#ff4fd8'); rect(g, 162, 166, 3, 3, '#ffcf3a'); },
    (g) => { rect(g, 52, 56, 14, 22, '#ff4fd8'); rect(g, 54, 58, 10, 18, '#ffd0f0'); rect(g, 57, 62, 4, 10, '#ff4fd8'); },
    (g) => { rect(g, 100, 290, 14, 24, '#ffcf3a'); rect(g, 102, 284, 10, 8, '#ffe27a'); rect(g, 98, 312, 18, 4, '#9a7a1a'); },
  ];

  function buildShop(rank, decorCount) {
    const c = mk(W, SHOP_H);
    const g = c.getContext('2d');
    const p = PAL[Math.min(rank, 4)];
    rect(g, 0, 0, W, SHOP_H, '#0b0820');
    // stars outside
    let seed = 7;
    for (let i = 0; i < 40; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const sx = seed % W;
      seed = (seed * 9301 + 49297) % 233280;
      rect(g, sx, 344 + (seed % 54), 1, 1, i % 3 ? '#5a5a9a' : '#ffffff');
    }
    // street
    rect(g, 0, 344, W, 56, '#12122e');
    for (let x = 4; x < W; x += 24) rect(g, x, 388, 12, 2, '#2a2a5a');
    for (const lx of [14, 170]) { rect(g, lx, 356, 3, 36, '#4a4a7a'); rect(g, lx - 4, 352, 11, 5, '#ff4fd8'); rect(g, lx - 6, 392, 15, 3, 'rgba(255,79,216,0.25)'); }
    // back wall
    rect(g, 0, 0, W, 52, p[2]);
    rect(g, 0, 38, W, 14, p[3]);
    rect(g, 0, 50, W, 2, p[4]);
    if (rank >= 1) {
      rect(g, 12, 8, 30, 24, p[4]); rect(g, 14, 10, 26, 20, '#070518');
      for (let i = 0; i < 6; i++) rect(g, 16 + ((i * 11) % 22), 12 + ((i * 7) % 16), 1, 1, '#fff');
    }
    if (rank >= 2) {
      rect(g, 153, 8, 30, 24, p[5]); rect(g, 155, 10, 26, 20, '#070518');
      for (let i = 0; i < 6; i++) rect(g, 157 + ((i * 9) % 22), 12 + ((i * 5) % 16), 1, 1, '#fff');
    }
    if (rank >= 3) {
      for (const px of [0, 189]) { rect(g, px, 0, 6, 330, p[5]); rect(g, px + 1, 0, 1, 330, '#fff6b0'); }
    }
    // floor
    for (let y = 52; y < 330; y += 14) {
      for (let x = 0; x < W; x += 14) rect(g, x, y, 14, 14, ((x + y) / 14) % 2 ? p[0] : p[1]);
    }
    rect(g, 0, 52, W, 3, 'rgba(0,0,0,0.35)');
    if (rank >= 1) { rect(g, 48, 100, 100, 3, p[4]); rect(g, 48, 150, 100, 3, p[4]); }
    if (rank >= 4) { rect(g, 80, 56, 36, 270, '#8a1a3a'); rect(g, 82, 56, 32, 270, '#b02a5a'); }
    // bottom wall + shutter frame
    rect(g, 0, 330, W, 14, p[3]);
    rect(g, 0, 330, W, 2, p[5]);
    rect(g, 68, 330, 59, 14, '#05040f');
    rect(g, 66, 328, 3, 16, p[4]); rect(g, 126, 328, 3, 16, p[4]);
    // counter
    rect(g, 52, 196, 90, 16, '#3a2a6a');
    rect(g, 52, 196, 90, 4, '#7a5ad0');
    rect(g, 52, 208, 90, 4, '#1a1038');
    rect(g, 54, 211, 86, 2, 'rgba(0,0,0,0.4)');
    rect(g, 52, 200, 90, 1, p[4]);
    rect(g, 106, 190, 14, 8, '#2a2a4a'); rect(g, 108, 192, 10, 3, '#3affd0');   // register
    rect(g, 92, 193, 7, 4, '#ffd84a'); rect(g, 94, 191, 3, 2, '#fff6b0');       // bell
    // workbench
    rect(g, 8, 96, 38, 24, '#4a3a2a'); rect(g, 8, 96, 38, 5, '#8a6a4a');
    rect(g, 10, 120, 4, 4, '#2a1a0a'); rect(g, 40, 120, 4, 4, '#2a1a0a');
    rect(g, 14, 98, 8, 3, '#9aa3b8'); rect(g, 28, 99, 10, 2, '#ff4fd8');
    rect(g, 12, 103, 30, 12, '#5a4a38');
    rect(g, 18, 106, 8, 6, '#c9a35a'); rect(g, 30, 107, 6, 4, '#3affd0');
    // storage box
    rect(g, 160, 96, 26, 24, '#3a4a6a'); rect(g, 160, 96, 26, 5, '#5a7aaa');
    rect(g, 160, 108, 26, 2, '#1a2a4a'); rect(g, 169, 102, 8, 5, '#ffd84a');
    // door to the dump
    rect(g, 186, 244, 9, 40, '#150d30'); rect(g, 186, 244, 2, 40, p[5]); rect(g, 186, 244, 9, 2, p[5]); rect(g, 186, 282, 9, 2, p[5]);
    rect(g, 189, 256, 4, 12, '#3affd0');
    // sleep pod
    rect(g, 8, 270, 32, 36, '#2a2a5a'); rect(g, 10, 272, 28, 32, '#8aa8ff');
    rect(g, 10, 272, 28, 10, '#e8ecff'); rect(g, 14, 284, 20, 18, 'rgba(120,230,255,0.45)');
    rect(g, 8, 306, 32, 3, '#ff4fd8');
    // decorations unlocked by levels
    for (let i = 0; i < Math.min(decorCount, DECOR_DRAW.length); i++) DECOR_DRAW[i](g);
    // sign
    rect(g, 62, 6, 72, 20, '#0a0618'); rect(g, 62, 6, 72, 1, p[4]); rect(g, 62, 25, 72, 1, p[4]);
    text(g, 'SWAP SHOP', 66, 10, 2, p[rank >= 2 ? 5 : 4]);
    return c;
  }

  function buildDump() {
    const c = mk(DUMP_W, DUMP_H);
    const g = c.getContext('2d');
    rect(g, 0, 0, DUMP_W, DUMP_H, '#241a3a');
    let seed = 99;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 260; i++) rect(g, rnd() * DUMP_W | 0, rnd() * DUMP_H | 0, 2, 1, i % 4 ? '#2e2248' : '#1c1430');
    const cols = ['#5a5f78', '#7a4a6a', '#3a6a7a', '#8a6a3a', '#6a3a8a'];
    for (let i = 0; i < 46; i++) {
      const x = rnd() * (DUMP_W - 20) | 0;
      const y = rnd() * (DUMP_H - 60) | 0;
      if (y > DUMP_H - 90 && x > 120 && x < 240) continue;
      const col = cols[i % cols.length];
      rect(g, x, y + 4, 10 + (i % 5) * 2, 6, col);
      rect(g, x + 2, y, 6, 6, shade(col, 25));
      rect(g, x + 3, y + 2, 2, 2, '#ffd84a');
    }
    // fence
    rect(g, 0, 0, DUMP_W, 14, '#3a2a5a'); rect(g, 0, 12, DUMP_W, 2, '#ff4fd8');
    rect(g, 0, 0, 6, DUMP_H, '#3a2a5a'); rect(g, DUMP_W - 6, 0, 6, DUMP_H, '#3a2a5a');
    rect(g, 0, DUMP_H - 8, DUMP_W, 8, '#3a2a5a');
    // exit door
    rect(g, 150, DUMP_H - 34, 60, 34, '#150d30'); rect(g, 150, DUMP_H - 34, 60, 3, '#3affd0');
    rect(g, 150, DUMP_H - 34, 3, 34, '#3affd0'); rect(g, 207, DUMP_H - 34, 3, 34, '#3affd0');
    rect(g, 172, DUMP_H - 24, 16, 12, '#ffd84a');
    return c;
  }

  return { W, SHOP_H, DUMP_W, DUMP_H, SPECIES, COLORS, regions, shade, drawItem, sprite, icon, silhouette, drawCustomer, drawPlayer, portrait, text, buildShop, buildDump };
})();
