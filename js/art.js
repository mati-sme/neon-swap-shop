/* Neon Swap Shop — procedural pixel art (everything is drawn from rects, no image files).
 * Item sprites live in sprites.js; everything static is cached on offscreen canvases. */
'use strict';

const Art = (() => {
  const W = 195;           // low-res canvas width; height follows the screen aspect
  const SHOP_H = 332;      // shop world height (wall + floor + entrance + street)
  const DUMP_W = 360;
  const DUMP_H = 520;

  // shop furniture rects [x, y, w, h] shared with shop.js
  const L = {
    counter: [52, 198, 90, 18],
    bench: [8, 100, 38, 26],
    storage: [156, 100, 30, 26],
    pod: [8, 238, 32, 42],
    door: [183, 216, 12, 40],
    shutter: [68, 300, 59, 14],
    sign: [61, 5, 74, 18],
    lights: [[20, 4, 22], [90, 4, 22], [160, 4, 22]],
  };

  // top-left of the item sprite for shelf slot i (5 per board, two boards)
  function slotPos(i, out) {
    out.x = 30 + (i % 5) * 30;
    out.y = i < 5 ? 36 : 62;
    return out;
  }

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

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  }

  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

  // ---------- items (16x16 grid) ----------

  const palCache = {};
  function palette(it) {
    let p = palCache[it.id];
    if (!p) {
      p = palCache[it.id] = {
        o: '#1b1236', a: it.c1, d: shade(it.c1, -55), h: shade(it.c1, 50), c: it.c2, w: '#ffffff', y: '#ffd84a',
        r: '#ff5a5a', g: '#3affd0', p: '#ff4fd8', u: '#5ab8ff', m: '#9aa3b8', n: '#5a5f78', T: '#241a44',
        l: '#cffbff', Y: '#ffd88a',
        mark: lum(it.c1) > 150 ? '#c0306a' : '#fff6a0',
      };
    }
    return p;
  }

  // draw item `id` (g may be null for a dry run that only records the fake-able regions into rec)
  function renderItem(g, id, fake, ox, oy, s, rec) {
    const it = Data.ITEMS[id];
    const pal = palette(it);
    const patchCol = fake === 'color' ? invert(it.c2) : it.c2;
    const track = (kind, x, y, w, h) => {
      if (!rec) return;
      const r = rec[kind];
      if (!r) { rec[kind] = [x, y, w, h]; return; }
      const x2 = Math.max(r[0] + r[2], x + w);
      const y2 = Math.max(r[1] + r[3], y + h);
      r[0] = Math.min(r[0], x); r[1] = Math.min(r[1], y); r[2] = x2 - r[0]; r[3] = y2 - r[1];
    };
    const P = {
      r(x, y, w, h, col) {
        if (!g) return;
        g.fillStyle = pal[col] || col;
        g.fillRect(ox + x * s, oy + y * s, w * s, h * s);
      },
      px(x, y, ch) { this.r(x, y, 1, 1, pal[ch]); },
      mark(x, y, w, h, col) { track('logo', x, y, w, h); if (fake !== 'logo') this.r(x, y, w, h, col || pal.mark); },
      patch(x, y, w, h) { track('color', x, y, w, h); this.r(x, y, w, h, patchCol); },
      extra(x, y, w, h) { track('btn', x, y, w, h); this.r(x, y, w, h, fake === 'btn' ? '#ffffff' : pal.a); },
    };
    const sp = Sprites.S[id];
    if (sp.draw) sp.draw(P);
    if (sp.rows) {
      const n = sp.rows.length;
      const top = 16 - n - ((16 - n) >> 2);
      for (let ry = 0; ry < n; ry++) {
        const row = sp.rows[ry];
        for (let cx = 0; cx < row.length; cx++) {
          const ch = row[cx];
          if (ch === '.') continue;
          for (let m = 0; m < (sp.sym ? 2 : 1); m++) {
            const x = m ? 15 - cx : cx;
            const y = top + ry;
            if (ch === '*') P.mark(x, y, 1, 1);
            else if (ch === 'k') P.patch(x, y, 1, 1);
            else if (ch === 'e') P.extra(x, y, 1, 1);
            else if (ch === 'b') P.px(x, y, 'w');
            else P.px(x, y, ch);
          }
        }
      }
    }
    if (sp.after) sp.after(P);
  }

  const infoCache = {};
  function info(id) {
    let i = infoCache[id];
    if (!i) {
      const rec = {};
      renderItem(null, id, null, 0, 0, 1, rec);
      i = infoCache[id] = { rec, types: ['logo', 'btn', 'color'].filter((k) => rec[k]) };
    }
    return i;
  }

  // which kinds of fake this item can be (every item has at least logo + color)
  function fakeTypes(id) { return info(id).types; }

  // [x, y, w, h] of the detail a fake changes (in 16x16 sprite pixels)
  function region(id, fake) { return info(id).rec[fake] || null; }

  // fake: null | 'logo' | 'btn' | 'color' — exactly one detail differs from the genuine item
  function drawItem(ctx, key, x, y, s, fake) {
    const [id, shiny] = Data.split(key);
    renderItem(ctx, id, fake, x, y, s, null);
    if (shiny) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 13 * s, y, s, 3 * s); ctx.fillRect(x + 12 * s, y + s, 3 * s, s);
      ctx.fillRect(x + s, y + 3 * s, s, s); ctx.fillRect(x, y + 14 * s, s, s);
    }
  }

  // 18x18 canvas (item at 1,1) with a 1px rarity outline for tier >= 1
  const spriteCache = new Map();
  function sprite(key) {
    let c = spriteCache.get(key);
    if (!c) {
      c = mk(18, 18);
      const g = c.getContext('2d');
      const tier = Data.item(key).tier;
      const raw = mk(16, 16);
      drawItem(raw.getContext('2d'), key, 0, 0, 1, null);
      if (tier >= 1) {
        const t = mk(16, 16);
        const tg = t.getContext('2d');
        tg.drawImage(raw, 0, 0);
        tg.globalCompositeOperation = 'source-in';
        tg.fillStyle = Data.TIER_COLORS[tier];
        tg.fillRect(0, 0, 16, 16);
        g.drawImage(t, 0, 1); g.drawImage(t, 2, 1); g.drawImage(t, 1, 0); g.drawImage(t, 1, 2);
      }
      g.drawImage(raw, 1, 1);
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

  function paintCustomer(g, c, oy) {
    const r = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(px, oy + py, w, h); };
    const a = c.col;
    const b = c.col2;
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

  // cached 14x20 body (3 rows of headroom for the crown)
  const custCache = new Map();
  function customerSprite(c) {
    const k = c.sp + c.col + c.col2 + (c.vip ? 'v' : '');
    let s = custCache.get(k);
    if (!s) {
      s = mk(14, 20);
      paintCustomer(s.getContext('2d'), c, 3);
      custCache.set(k, s);
    }
    return s;
  }

  function drawCustomer(ctx, c, x, y, t, moving) {
    const bob = moving ? Math.round(Math.sin(t * 12 + c.id) * 0.8) : Math.round(Math.sin(t * 2 + c.id) * 0.5);
    const ox = Math.round(x) - 7;
    const oy = Math.round(y) - 16 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox + 2, Math.round(y) - 1, 10, 2);
    if (c.vip) {
      ctx.fillStyle = 'rgba(255,210,60,' + (0.22 + 0.1 * Math.sin(t * 4)) + ')';
      ctx.fillRect(ox - 3, oy - 3, 20, 22);
    }
    ctx.drawImage(customerSprite(c), ox, oy - 3);
  }

  const playerCache = [];
  function playerSprite(face, step) {
    const k = (face > 0 ? 1 : 0) * 2 + step;
    let s = playerCache[k];
    if (!s) {
      s = playerCache[k] = mk(14, 18);
      const g = s.getContext('2d');
      const r = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(px, py, w, h); };
      const e = face > 0 ? 1 : 0;
      r(6, 0, 2, 2, '#ffd84a');
      r(2, 2, 10, 8, '#e8ecff');
      r(3, 4, 8, 4, '#150d30');
      r(4 + e, 5, 2, 2, '#3affd0'); r(8 + e, 5, 2, 2, '#3affd0');
      r(3, 10, 8, 5, '#ff4fd8'); r(5, 11, 4, 3, '#ffd0f0');
      r(1, 10, 2, 4, '#e8ecff'); r(11, 10, 2, 4, '#e8ecff');
      r(3 + step, 15, 3, 3, '#2a2250'); r(8 - step, 15, 3, 3, '#2a2250');
    }
    return s;
  }

  function drawPlayer(ctx, x, y, t, face, moving) {
    const bob = moving ? Math.round(Math.sin(t * 14)) : 0;
    const step = moving ? (Math.sin(t * 14) > 0 ? 1 : 0) : 0;
    const ox = Math.round(x) - 7;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ox + 2, Math.round(y) - 1, 10, 2);
    ctx.drawImage(playerSprite(face, step), ox, Math.round(y) - 18 + bob);
  }

  const portraitCache = new Map();
  function portrait(c, s) {
    const k = c.sp + c.col + c.col2 + (c.vip ? 'v' : '') + s;
    let u = portraitCache.get(k);
    if (!u) {
      const cv = mk(14 * s, 20 * s);
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.scale(s, s);
      drawCustomer(g, c, 7, 18, 0, false);
      u = cv.toDataURL();
      portraitCache.set(k, u);
    }
    return u;
  }

  // little dust bunny for the dump (cached once)
  let bunnyCv = null;
  function bunny() {
    if (!bunnyCv) {
      bunnyCv = mk(9, 9);
      const g = bunnyCv.getContext('2d');
      rect(g, 0, 2, 9, 7, '#b8a8d8'); rect(g, 1, 0, 7, 2, '#b8a8d8');
      rect(g, 2, 3, 1, 2, '#102'); rect(g, 6, 3, 1, 2, '#102');
      rect(g, 3, 6, 3, 1, '#8a78b8');
    }
    return bunnyCv;
  }

  // ---------- tiny 3x5 font (neon signs) ----------

  const GLYPH = {
    S: [7, 4, 7, 1, 7], W: [5, 5, 7, 7, 5], A: [2, 5, 7, 5, 5], P: [7, 5, 7, 4, 4], H: [5, 5, 7, 5, 5], O: [7, 5, 5, 5, 7],
    E: [7, 4, 7, 4, 7], X: [5, 5, 2, 5, 5], I: [7, 2, 2, 2, 7], T: [7, 2, 2, 2, 2], N: [5, 7, 7, 5, 5], ' ': [0, 0, 0, 0, 0],
  };
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

  // soft light pool made of stacked ellipse rows (pixel-art friendly, static use only)
  function glow(g, cx, cy, rx, ry, col, alpha) {
    g.fillStyle = col;
    for (let k = 3; k >= 1; k--) {
      g.globalAlpha = alpha * (4 - k) / 3;
      const hx = rx * k / 3;
      const hy = ry * k / 3;
      for (let y = -hy; y <= hy; y++) {
        const w = Math.round(hx * Math.sqrt(1 - (y * y) / (hy * hy)));
        g.fillRect(cx - w, cy + y, w * 2, 1);
      }
    }
    g.globalAlpha = 1;
  }

  // ---------- shop room ----------

  // floorA, floorB, wall, wall2, trimA, trimB
  const PAL = [
    ['#2a2248', '#251d40', '#1c1633', '#241c44', '#ff4fd8', '#ff4fd8'],
    ['#2c2a58', '#262350', '#1a2147', '#22305e', '#3affd0', '#ff4fd8'],
    ['#322c66', '#2a2458', '#221a4e', '#2e2468', '#ff4fd8', '#3affd0'],
    ['#3a2c70', '#30245f', '#2a1a58', '#3a2470', '#3affd0', '#ffcf3a'],
    ['#44307a', '#382868', '#321e60', '#44287a', '#ffcf3a', '#ff4fd8'],
  ];

  function pot(g, x, y) {
    rect(g, x + 1, y + 8, 10, 8, '#7a4a2a'); rect(g, x, y + 6, 12, 3, '#9a6a3a');
    rect(g, x + 3, y - 2, 6, 9, '#2aa84a'); rect(g, x - 2, y + 1, 6, 5, '#3acf5a'); rect(g, x + 8, y + 2, 6, 5, '#3acf5a');
    rect(g, x + 5, y - 4, 2, 4, '#4aff7a'); rect(g, x + 4, y, 2, 2, '#7affa0');
  }

  const DECOR_DRAW = [
    (g) => pot(g, 8, 144),                                                                                   // Plant
    (g) => {                                                                                                 // Poster
      rect(g, 3, 12, 16, 28, '#ff4fd8'); rect(g, 5, 14, 12, 24, '#150d30');
      rect(g, 8, 19, 6, 6, '#ffcf3a'); rect(g, 6, 22, 10, 1, '#ff4fd8'); rect(g, 7, 30, 8, 1, '#3affd0'); rect(g, 9, 33, 4, 1, '#3affd0');
      rect(g, 7, 16, 1, 1, '#fff'); rect(g, 14, 27, 1, 1, '#fff');
    },
    (g) => {                                                                                                 // Rug
      rect(g, 52, 122, 92, 52, '#6a2a8a'); rect(g, 55, 125, 86, 46, '#8a3aa8');
      rect(g, 66, 132, 64, 32, '#ff4fd8'); rect(g, 69, 135, 58, 26, '#c02aa0');
      rect(g, 86, 141, 24, 14, '#ffcf3a'); rect(g, 89, 144, 18, 8, '#8a3aa8');
    },
    (g) => {                                                                                                 // Fish tank
      rect(g, 152, 264, 34, 4, '#9aa3b8'); rect(g, 152, 268, 34, 24, '#0a2a4a'); rect(g, 154, 270, 30, 20, '#1a6ab0');
      rect(g, 154, 270, 30, 3, '#4aa8e8'); rect(g, 160, 278, 6, 3, '#ff8a3a'); rect(g, 158, 279, 2, 1, '#ff8a3a');
      rect(g, 172, 283, 5, 2, '#ffd84a'); rect(g, 178, 274, 1, 1, '#cfeaff'); rect(g, 156, 286, 28, 4, '#c9a35a');
      rect(g, 152, 292, 34, 4, '#4a3a5a');
    },
    (g) => {                                                                                                 // Disco ball
      rect(g, 170, 0, 1, 10, '#9aa3b8'); rect(g, 164, 10, 13, 13, '#d8e8ff');
      for (let y = 0; y < 13; y += 3) for (let x = (y / 3) % 2 ? 3 : 0; x < 13; x += 6) rect(g, 164 + x, 10 + y, 3, 3, '#8aa0d0');
      rect(g, 166, 12, 2, 2, '#fff');
    },
    (g) => {                                                                                                 // Cat bed
      rect(g, 46, 270, 24, 10, '#ffb03a'); rect(g, 49, 272, 18, 6, '#ffd88a');
      rect(g, 53, 267, 10, 7, '#8a8a9a'); rect(g, 53, 264, 2, 4, '#8a8a9a'); rect(g, 61, 264, 2, 4, '#8a8a9a');
      rect(g, 55, 269, 1, 2, '#102'); rect(g, 60, 269, 1, 2, '#102');
    },
    (g) => {                                                                                                 // Lamp
      rect(g, 12, 186, 2, 24, '#9aa3b8'); rect(g, 8, 209, 10, 3, '#4a4a6a');
      rect(g, 7, 177, 12, 9, '#ffd84a'); rect(g, 9, 179, 8, 5, '#fff6b0');
      glow(g, 13, 200, 16, 12, '#ffd84a', 0.12);
    },
    (g) => {                                                                                                 // Arcade
      g.translate(0, -16);
      rect(g, 162, 174, 24, 38, '#2a2a5a'); rect(g, 162, 174, 24, 5, '#ff4fd8');
      rect(g, 165, 181, 18, 13, '#0a1a1a'); rect(g, 167, 183, 14, 9, '#3affd0'); rect(g, 171, 186, 3, 3, '#ff4fd8');
      rect(g, 166, 198, 3, 3, '#ff4fd8'); rect(g, 174, 198, 3, 3, '#ffcf3a'); rect(g, 178, 198, 3, 3, '#3affd0');
      rect(g, 162, 210, 24, 2, '#150d30');
    },
    (g) => {                                                                                                 // Banner
      rect(g, 176, 8, 16, 3, '#9a7a1a'); rect(g, 177, 11, 14, 32, '#ff4fd8'); rect(g, 179, 13, 10, 26, '#ffd0f0');
      rect(g, 182, 19, 4, 4, '#ff4fd8'); rect(g, 183, 17, 2, 8, '#ff4fd8'); rect(g, 181, 21, 6, 1, '#ff4fd8');
      rect(g, 179, 39, 10, 2, '#ff4fd8'); rect(g, 181, 41, 6, 2, '#ff4fd8');
    },
    (g) => {                                                                                                 // Statue
      g.translate(-34, 0);
      rect(g, 166, 156, 20, 12, '#9aa3b8'); rect(g, 166, 156, 20, 2, '#dfe6f5');
      rect(g, 171, 142, 10, 14, '#ffcf3a'); rect(g, 172, 134, 8, 9, '#ffd84a');
      rect(g, 173, 137, 2, 2, '#150d30'); rect(g, 177, 137, 2, 2, '#150d30'); rect(g, 175, 131, 2, 3, '#ffcf3a');
      rect(g, 168, 144, 3, 8, '#ffcf3a'); rect(g, 181, 144, 3, 8, '#ffcf3a');
    },
  ];

  function crate(g, x, y, w, h, col) {
    rect(g, x, y, w, h, '#150d28'); rect(g, x + 1, y + 1, w - 2, h - 2, col);
    rect(g, x + 1, y + 1, w - 2, 2, shade(col, 35)); rect(g, x + 1, y + h / 2, w - 2, 1, shade(col, -40));
    rect(g, x + w / 2 - 1, y + 1, 2, h - 2, shade(col, -30));
  }

  function buildShop(rank, decorCount) {
    const c = mk(W, SHOP_H);
    const g = c.getContext('2d');
    const p = PAL[Math.min(rank, 4)];
    rect(g, 0, 0, W, SHOP_H, '#0b0820');
    // ---- street below the shop
    let seed = 7;
    for (let i = 0; i < 30; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const sx = seed % W;
      seed = (seed * 9301 + 49297) % 233280;
      rect(g, sx, 316 + (seed % 16), 1, 1, i % 3 ? '#5a5a9a' : '#ffffff');
    }
    rect(g, 0, 314, W, 18, '#12122e');
    rect(g, 0, 314, W, 2, '#2a2a5a');
    for (let x = 4; x < W; x += 24) rect(g, x, 326, 12, 2, '#2a2a5a');
    for (const lx of [14, 170]) {
      rect(g, lx, 316, 3, 16, '#4a4a7a'); rect(g, lx - 3, 314, 9, 3, p[4]);
      glow(g, lx + 1, 326, 14, 6, p[4], 0.22);
    }
    // ---- back wall
    rect(g, 0, 0, W, 84, p[2]);
    for (let x = 0; x < W; x += 12) rect(g, x, 8, 1, 74, shade(p[2], 10));
    rect(g, 0, 56, W, 28, p[3]);
    for (let x = 0; x < W; x += 12) rect(g, x, 56, 1, 28, p[2]);
    rect(g, 0, 56, W, 1, shade(p[3], 30));
    rect(g, 0, 0, W, 6, '#0d0a22');
    for (const l of L.lights) { rect(g, l[0], l[1] - 3, l[2], 3, '#e8f8ff'); rect(g, l[0] + 2, l[1], l[2] - 4, 1, '#7a8ab8'); }
    rect(g, 0, 82, W, 2, p[4]);
    // shelves (items are drawn live on top of the boards)
    for (const by of [52, 78]) {
      rect(g, 24, by, 148, 3, '#8a6a4a'); rect(g, 24, by + 3, 148, 1, '#2a1a0a');
      rect(g, 26, by + 3, 3, 4, '#4a3a2a'); rect(g, 167, by + 3, 3, 4, '#4a3a2a');
    }
    rect(g, 24, 32, 148, 50, 'rgba(0,0,0,0.18)');
    // sign
    const sg = L.sign;
    rect(g, sg[0] - 2, sg[1] - 2, sg[2] + 4, sg[3] + 4, 'rgba(255,79,216,0.18)');
    rect(g, sg[0], sg[1], sg[2], sg[3], '#0a0618');
    rect(g, sg[0], sg[1], sg[2], 1, p[4]); rect(g, sg[0], sg[1] + sg[3] - 1, sg[2], 1, p[4]);
    rect(g, sg[0], sg[1], 1, sg[3], p[4]); rect(g, sg[0] + sg[2] - 1, sg[1], 1, sg[3], p[4]);
    text(g, 'SWAP SHOP', sg[0] + 4, sg[1] + 4, 2, p[rank >= 2 ? 5 : 4]);
    if (rank >= 4) { rect(g, 94, 0, 8, 4, '#ffcf3a'); rect(g, 94, 0, 2, 5, '#ffcf3a'); rect(g, 100, 0, 2, 5, '#ffcf3a'); }
    // ---- floor
    for (let y = 84; y < 300; y += 14) {
      for (let x = 0; x < W; x += 14) rect(g, x, y, 14, 14, ((x + y) / 14) % 2 ? p[0] : p[1]);
    }
    if (rank >= 3) for (let y = 84; y < 300; y += 28) for (let x = 0; x < W; x += 28) rect(g, x + 13, y + 13, 2, 2, 'rgba(255,255,255,0.12)');
    rect(g, 0, 84, W, 4, 'rgba(0,0,0,0.35)');
    rect(g, 0, 296, W, 4, 'rgba(0,0,0,0.3)');
    if (rank === 0) {
      crate(g, 148, 262, 16, 14, '#8a6a3a'); crate(g, 152, 250, 14, 12, '#7a5a2a'); crate(g, 168, 266, 14, 12, '#8a6a3a');
      crate(g, 76, 150, 12, 10, '#7a5a2a');
    }
    if (rank >= 1) {
      rect(g, 4, 120, 187, 2, p[4]); rect(g, 4, 180, 187, 2, p[4]);
      pot(g, 44, 282); pot(g, 138, 282);
      rect(g, 0, 84, 3, 216, p[4]); rect(g, W - 3, 84, 3, 216, p[5]);
    }
    if (rank >= 2) {
      rect(g, 140, 8, 26, 22, p[5]); rect(g, 142, 10, 22, 18, '#070518');
      rect(g, 150, 14, 10, 10, '#4a6aff'); rect(g, 152, 16, 6, 6, '#9ab0ff'); rect(g, 148, 19, 14, 1, '#ffcf3a');
      for (let i = 0; i < 6; i++) rect(g, 143 + ((i * 7) % 20), 11 + ((i * 5) % 15), 1, 1, '#fff');
      rect(g, 28, 8, 30, 20, p[5]); rect(g, 30, 10, 26, 16, '#070518');
      text(g, 'OPEN', 34, 15, 1, '#3affd0'); rect(g, 33, 22, 22, 1, p[4]);
      rect(g, 4, 88, W - 8, 1, p[5]);
    }
    if (rank >= 3) {
      for (const rx of [58, 132]) { rect(g, rx, 268, 2, 28, '#ffcf3a'); rect(g, rx - 2, 266, 6, 3, '#ffe27a'); }
      rect(g, 60, 276, 72, 1, '#c02a5a');
      for (let i = 0; i < 10; i++) rect(g, 6 + i * 20, 90 + (i % 2) * 2, 2, 2, '#ffe27a');
    }
    if (rank >= 4) {
      rect(g, 84, 222, 28, 78, '#8a1a3a'); rect(g, 86, 222, 24, 78, '#b02a5a');
      rect(g, 84, 222, 2, 78, '#ffcf3a'); rect(g, 110, 222, 2, 78, '#ffcf3a');
      for (let y = 226; y < 298; y += 8) rect(g, 92, y, 12, 1, '#ffcf3a');
      rect(g, 46, 198, 6, 18, '#ffcf3a'); rect(g, 142, 198, 6, 18, '#ffcf3a');
    }
    // decorations unlocked by levels
    for (let i = 0; i < Math.min(decorCount, DECOR_DRAW.length); i++) { g.save(); DECOR_DRAW[i](g); g.restore(); }
    // ---- front wall + entrance
    rect(g, 0, 300, W, 14, p[3]);
    rect(g, 0, 300, W, 2, p[5]);
    rect(g, 68, 300, 59, 14, '#05040f');
    rect(g, 66, 298, 3, 16, p[4]); rect(g, 126, 298, 3, 16, p[4]);
    // ---- counter
    const cn = L.counter;
    rect(g, cn[0], cn[1], cn[2], cn[3], '#3a2a6a');
    rect(g, cn[0], cn[1], cn[2], 5, '#7a5ad0');
    rect(g, cn[0], cn[1] + 5, cn[2], 1, '#b09aff');
    rect(g, cn[0], cn[1] + cn[3] - 4, cn[2], 4, '#1a1038');
    rect(g, cn[0] + 3, cn[1] + 9, cn[2] - 6, 2, p[4]);
    for (let x = cn[0] + 6; x < cn[0] + cn[2] - 6; x += 12) rect(g, x, cn[1] + 12, 6, 1, 'rgba(255,255,255,0.25)');
    rect(g, cn[0] + 2, cn[1] + cn[3], cn[2] - 4, 2, 'rgba(0,0,0,0.4)');
    rect(g, 106, 189, 14, 9, '#2a2a4a'); rect(g, 108, 191, 10, 3, '#3affd0'); rect(g, 109, 195, 8, 1, '#7a7aaa');
    rect(g, 70, 193, 8, 5, '#ffd84a'); rect(g, 72, 191, 4, 2, '#fff6b0');
    rect(g, 92, 192, 10, 6, '#c9a35a'); rect(g, 93, 190, 8, 2, '#e8c880');
    rect(g, 124, 184, 22, 12, '#0a0618'); rect(g, 124, 184, 22, 1, p[4]); rect(g, 124, 195, 22, 1, p[4]);
    // ---- workbench
    const bn = L.bench;
    rect(g, bn[0], bn[1], bn[2], bn[3], '#4a3a2a'); rect(g, bn[0], bn[1], bn[2], 5, '#8a6a4a');
    rect(g, bn[0] + 2, bn[1] + 24, 4, 4, '#2a1a0a'); rect(g, bn[0] + 32, bn[1] + 24, 4, 4, '#2a1a0a');
    rect(g, bn[0] + 5, bn[1] - 8, 3, 8, '#9aa3b8'); rect(g, bn[0] + 3, bn[1] - 10, 8, 3, '#ff4fd8');
    rect(g, bn[0] + 22, bn[1] - 6, 10, 6, '#c9a35a'); rect(g, bn[0] + 24, bn[1] - 4, 6, 2, '#3affd0');
    rect(g, bn[0] + 4, bn[1] + 8, 30, 12, '#5a4a38');
    rect(g, bn[0] + 8, bn[1] + 10, 8, 6, '#c9a35a'); rect(g, bn[0] + 20, bn[1] + 11, 6, 4, '#3affd0');
    rect(g, bn[0] + 28, bn[1] + 9, 3, 8, '#9aa3b8');
    // ---- storage
    const sr = L.storage;
    crate(g, sr[0], sr[1] + 2, 16, 14, '#4a6a9a'); crate(g, sr[0] + 14, sr[1] + 8, 16, 18, '#3a4a6a');
    crate(g, sr[0] + 4, sr[1] - 8, 14, 12, '#5a7aaa');
    rect(g, sr[0] + 18, sr[1] + 12, 8, 4, '#ffd84a'); rect(g, sr[0] + 7, sr[1] - 5, 4, 3, '#ffd84a');
    // ---- dump door
    const dr = L.door;
    rect(g, dr[0] - 2, dr[1] - 10, 14, 10, '#150d30'); rect(g, dr[0] + 1, dr[1] - 8, 8, 7, '#3a2a5a');
    rect(g, dr[0] + 2, dr[1] - 8, 6, 2, '#5a4a7a'); rect(g, dr[0] + 3, dr[1] - 5, 1, 4, '#9aa3b8'); rect(g, dr[0] + 6, dr[1] - 5, 1, 4, '#9aa3b8');
    rect(g, dr[0], dr[1], dr[2], dr[3], '#150d30');
    rect(g, dr[0], dr[1], 2, dr[3], p[5]); rect(g, dr[0], dr[1], dr[2], 2, p[5]); rect(g, dr[0], dr[1] + dr[3] - 2, dr[2], 2, p[5]);
    for (let y = 4; y < dr[3] - 4; y += 6) { rect(g, dr[0] + 3, dr[1] + y, 8, 3, '#ffcf3a'); rect(g, dr[0] + 3, dr[1] + y + 3, 8, 3, '#2a2a3a'); }
    glow(g, dr[0] + 4, dr[1] + 20, 14, 22, '#3affd0', 0.1);
    // ---- sleep pod
    const pd = L.pod;
    rect(g, pd[0], pd[1], pd[2], pd[3], '#2a2a5a'); rect(g, pd[0] + 2, pd[1] + 2, pd[2] - 4, pd[3] - 6, '#8aa8ff');
    rect(g, pd[0] + 2, pd[1] + 2, pd[2] - 4, 12, '#e8ecff'); rect(g, pd[0] + 6, pd[1] + 16, 20, 20, 'rgba(120,230,255,0.45)');
    rect(g, pd[0] + 5, pd[1] + 5, 22, 6, '#c9d4ff');
    rect(g, pd[0], pd[1] + pd[3] - 4, pd[2], 3, '#ff4fd8');
    rect(g, pd[0] + 20, pd[1] + 20, 3, 3, '#fff'); rect(g, pd[0] + 22, pd[1] + 19, 3, 3, '#7ad0ff');
    return c;
  }

  // ---------- junk dump ----------

  const PILES = [
    [10, 48, 44, 30], [4, 150, 40, 28], [12, 258, 46, 30], [6, 372, 42, 28],
    [296, 62, 46, 30], [310, 182, 44, 28], [298, 296, 46, 30], [308, 396, 44, 26],
    [118, 96, 38, 24], [222, 138, 40, 24], [96, 312, 40, 26], [244, 372, 40, 24],
  ];
  const dumpBlockers = PILES.map((q) => ({ x: q[0], y: q[1], w: q[2], h: q[3] }));

  function pile(g, x, y, w, h, rnd) {
    const cols = ['#5a5f78', '#7a4a6a', '#3a6a7a', '#8a6a3a', '#6a3a8a', '#4a5a4a'];
    rect(g, x + 2, y + h - 3, w - 4, 4, 'rgba(0,0,0,0.35)');
    // heap body
    for (let row = 0; row < h; row += 2) {
      const half = Math.round((w / 2) * (0.35 + 0.65 * (row / h)));
      rect(g, x + w / 2 - half, y + row, half * 2, 2, row % 4 ? '#3a3050' : '#322a46');
    }
    // random scrap chunks
    for (let i = 0; i < 9; i++) {
      const cw = 6 + Math.floor(rnd() * 8);
      const ch = 4 + Math.floor(rnd() * 5);
      const cx = x + 2 + Math.floor(rnd() * (w - cw - 2));
      const cy = y + 4 + Math.floor(rnd() * (h - ch - 6));
      const col = cols[Math.floor(rnd() * cols.length)];
      rect(g, cx - 1, cy - 1, cw + 2, ch + 2, '#150d28'); rect(g, cx, cy, cw, ch, col);
      rect(g, cx, cy, cw, 1, shade(col, 40)); rect(g, cx, cy + ch - 1, cw, 1, shade(col, -40));
      if (rnd() < 0.35) rect(g, cx + 2, cy + 1, 2, 2, rnd() < 0.5 ? '#ff4fd8' : '#3affd0');
    }
    // a tyre and a crate on top of every heap
    const tx = x + 3 + Math.floor(rnd() * (w - 16));
    rect(g, tx, y + h - 11, 9, 9, '#150d28'); rect(g, tx + 1, y + h - 10, 7, 7, '#2a2a3a'); rect(g, tx + 3, y + h - 8, 3, 3, '#150d28');
    rect(g, tx + 2, y + h - 10, 3, 1, '#4a4a5a');
    crate(g, x + w - 15 - Math.floor(rnd() * 6), y + 2, 11, 10, '#8a6a3a');
    rect(g, x + w / 2, y - 3, 1, 4, '#9aa3b8'); rect(g, x + w / 2 - 1, y - 4, 3, 1, '#ff4fd8');
  }

  function lamp(g, x, y) {
    glow(g, x + 1, y + 26, 30, 20, '#ffcf6a', 0.16);
    rect(g, x, y + 4, 3, 28, '#4a4a6a'); rect(g, x - 2, y + 30, 7, 3, '#2a2a4a');
    rect(g, x - 4, y, 11, 5, '#150d28'); rect(g, x - 3, y + 1, 9, 3, '#fff2b0'); rect(g, x - 1, y + 1, 5, 2, '#ffffff');
  }

  function buildDump() {
    const c = mk(DUMP_W, DUMP_H);
    const g = c.getContext('2d');
    let seed = 99;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    // ground: two-tone dirt tiles + pebbles + cracks
    rect(g, 0, 0, DUMP_W, DUMP_H, '#2c2238');
    for (let y = 0; y < DUMP_H; y += 16) {
      for (let x = 0; x < DUMP_W; x += 16) {
        const v = rnd();
        rect(g, x, y, 16, 16, v < 0.3 ? '#322840' : v < 0.55 ? '#292034' : '#2e2439');
      }
    }
    for (let i = 0; i < 520; i++) rect(g, rnd() * DUMP_W | 0, rnd() * DUMP_H | 0, 1 + (i % 3 === 0), 1, i % 5 ? '#41355a' : '#241c2e');
    for (let i = 0; i < 18; i++) {
      let cx = rnd() * DUMP_W | 0;
      let cy = rnd() * DUMP_H | 0;
      for (let k = 0; k < 6; k++) { rect(g, cx, cy, 3, 1, '#1c1428'); cx += 2 + (rnd() * 3 | 0); cy += (rnd() * 3 | 0) - 1; }
    }
    // dirt path from the exit
    for (let y = 300; y < DUMP_H - 30; y += 2) {
      const w = 34 + Math.round(Math.sin(y / 18) * 4);
      rect(g, 180 - w / 2, y, w, 2, '#3a2e48');
      rect(g, 180 - w / 2, y, 2, 2, '#4a3c5c'); rect(g, 180 + w / 2 - 2, y, 2, 2, '#4a3c5c');
    }
    // neon puddles
    for (const [px, py, col] of [[90, 210, '#3affd0'], [250, 330, '#ff4fd8'], [160, 60, '#9a7aff']]) {
      glow(g, px, py, 20, 8, col, 0.28);
      rect(g, px - 8, py - 1, 6, 1, 'rgba(255,255,255,0.35)');
    }
    // junk heaps
    for (const q of PILES) pile(g, q[0], q[1], q[2], q[3], rnd);
    // neon lamps
    for (const [lx, ly] of [[40, 30], [320, 30], [60, 230], [300, 250], [180, 150]]) lamp(g, lx, ly);
    // fence: posts, mesh, neon rail
    const fence = (x, y, w, h, vert) => {
      rect(g, x, y, w, h, '#2a2040');
      if (!vert) {
        for (let fx = x; fx < x + w; fx += 6) { rect(g, fx, y + 4, 1, h - 6, '#4a3a6a'); rect(g, fx + 3, y + 5 + (fx / 6 % 2) * 2, 1, 3, '#3a2e58'); }
        for (let fx = x; fx < x + w; fx += 24) rect(g, fx, y, 3, h, '#5a4a7a');
      } else {
        for (let fy = y; fy < y + h; fy += 6) rect(g, x, fy, w, 1, '#4a3a6a');
        for (let fy = y; fy < y + h; fy += 24) rect(g, x, fy, w, 3, '#5a4a7a');
      }
    };
    fence(0, 0, DUMP_W, 22, false); rect(g, 0, 19, DUMP_W, 3, '#ff4fd8'); rect(g, 0, 18, DUMP_W, 1, '#ffb0f0');
    fence(0, 22, 7, DUMP_H - 22, true); fence(DUMP_W - 7, 22, 7, DUMP_H - 22, true);
    rect(g, 6, 22, 1, DUMP_H - 22, '#ff4fd8'); rect(g, DUMP_W - 7, 22, 1, DUMP_H - 22, '#ff4fd8');
    fence(0, DUMP_H - 14, 140, 14, false); fence(220, DUMP_H - 14, 140, 14, false);
    rect(g, 0, DUMP_H - 14, 140, 2, '#3affd0'); rect(g, 220, DUMP_H - 14, 140, 2, '#3affd0');
    // exit door with sign
    const dx = 150;
    const dy = DUMP_H - 38;
    glow(g, 180, DUMP_H - 18, 50, 22, '#3affd0', 0.22);
    rect(g, dx, dy, 60, 38, '#150d30'); rect(g, dx + 4, dy + 6, 52, 32, '#241a44');
    rect(g, dx, dy, 60, 3, '#3affd0'); rect(g, dx, dy, 3, 38, '#3affd0'); rect(g, dx + 57, dy, 3, 38, '#3affd0');
    rect(g, dx + 8, dy + 12, 20, 26, '#0a0618'); rect(g, dx + 32, dy + 12, 20, 26, '#0a0618');
    rect(g, dx + 26, dy + 24, 3, 3, '#ffd84a'); rect(g, dx + 31, dy + 24, 3, 3, '#ffd84a');
    rect(g, dx + 12, dy - 14, 36, 13, '#0a0618'); rect(g, dx + 12, dy - 14, 36, 1, '#3affd0'); rect(g, dx + 12, dy - 2, 36, 1, '#3affd0');
    // pixel house + EXIT
    rect(g, dx + 16, dy - 9, 7, 2, '#ffcf3a'); rect(g, dx + 14, dy - 7, 11, 2, '#ffcf3a'); rect(g, dx + 15, dy - 5, 9, 3, '#ff4fd8');
    rect(g, dx + 19, dy - 5, 2, 3, '#0a0618');
    text(g, 'EXIT', dx + 28, dy - 11, 1, '#3affd0');
    return c;
  }

  // dig spot: cached mounds, live glow + sparkles
  let moundCv = null;
  let usedCv = null;
  function mounds() {
    if (!moundCv) {
      moundCv = mk(18, 12);
      const g = moundCv.getContext('2d');
      rect(g, 1, 6, 16, 6, '#150d28'); rect(g, 3, 3, 12, 4, '#150d28');
      rect(g, 2, 7, 14, 4, '#5a4028'); rect(g, 4, 4, 10, 4, '#6a4a30'); rect(g, 5, 4, 5, 1, '#8a6a48');
      rect(g, 6, 8, 2, 1, '#3a2818'); rect(g, 11, 7, 2, 1, '#3a2818');
      usedCv = mk(18, 12);
      const u = usedCv.getContext('2d');
      rect(u, 2, 7, 14, 4, '#1c1228'); rect(u, 4, 8, 10, 2, '#120a1c');
    }
    return moundCv;
  }

  function drawSpot(ctx, x, y, t, used, shake, near) {
    mounds();
    const ox = Math.round(x) - 9 + (shake ? Math.round(Math.sin(t * 60) * 1.5) : 0);
    const oy = Math.round(y) - 7;
    if (used) { ctx.drawImage(usedCv, ox, oy); return; }
    const pulse = 0.28 + 0.2 * Math.sin(t * 4 + x);
    ctx.fillStyle = 'rgba(58,255,208,' + pulse + ')';
    ctx.fillRect(ox - 4, oy - 2, 26, 16);
    ctx.fillStyle = 'rgba(58,255,208,' + (pulse + 0.2) + ')';
    ctx.fillRect(ox - 1, oy + 1, 20, 10);
    ctx.drawImage(moundCv, ox, oy);
    // three orbiting sparkles
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const a = t * 2.2 + i * 2.09 + x;
      const sx = Math.round(x + Math.cos(a) * 11);
      const sy = Math.round(y - 4 + Math.sin(a) * 6);
      const tw = Math.sin(t * 9 + i * 2) > 0;
      ctx.fillRect(sx, sy, 1, 1);
      if (tw) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
    }
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(Math.round(x) - 1, oy - 5 - Math.round(Math.abs(Math.sin(t * 5 + y)) * 2), 2, 2);
    if (near) {
      ctx.strokeStyle = 'rgba(255,207,58,' + (0.6 + 0.3 * Math.sin(t * 6)) + ')';
      ctx.strokeRect(ox - 4.5, oy - 2.5, 27, 17);
    }
  }

  return {
    W, SHOP_H, DUMP_W, DUMP_H, L, SPECIES, COLORS, PAL, dumpBlockers,
    slotPos, shade, drawItem, sprite, icon, silhouette, fakeTypes, region,
    drawCustomer, drawPlayer, portrait, bunny, text, buildShop, buildDump, drawSpot,
  };
})();
