/* Neon Swap Shop — one hand-drawn 16x16 pixel sprite per item.
 *
 * Palette letters: o outline, a body, d body shade, h body light, c accent, w white, y gold, r red, g teal,
 * p pink, u blue, m metal, n dark metal, T screen/dark, l glass, Y bread.
 * Fake-able details (each fake changes exactly one of these):
 *   *  logo mark   (fake: missing)
 *   k  colour patch (fake: wrong colour)
 *   e  spare button (fake: an extra button appears)
 *   b  button      (always drawn)
 * `sym` sprites list the left 8 columns and are mirrored. Shorter sprites are lowered towards the bottom. */
'use strict';

const Sprites = (() => {
  const S = {};

  // ---------- procedural helpers ----------

  function orb(P, cx, cy, r) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        let ch = 'a';
        if (d > r - 1.1) ch = 'o';
        else if (dx + dy < -r * 0.5) ch = 'h';
        else if (dx + dy > r * 0.6) ch = 'd';
        P.px(x, y, ch);
      }
    }
  }

  function star(P, cx, cy, col) {
    P.mark(cx, cy - 1, 1, 3, col);
    P.mark(cx - 1, cy, 3, 1, col);
  }

  function gear(P, rIn, rOut, teeth, hole) {
    const inside = (x, y) => {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const d = Math.hypot(dx, dy);
      return d <= (Math.cos(Math.atan2(dy, dx) * teeth) > -0.25 ? rOut : rIn);
    };
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inside(x, y)) continue;
        const dx = x + 0.5 - 8;
        const dy = y + 0.5 - 8;
        const d = Math.hypot(dx, dy);
        let ch = 'a';
        if (d <= hole) ch = 'T';
        else if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) ch = 'o';
        else if (d <= hole + 0.9) ch = 'o';
        else if (dx + dy < -3) ch = 'h';
        else if (dx + dy > 3) ch = 'd';
        P.px(x, y, ch);
      }
    }
  }

  // ---------- junk (tier 0) ----------

  S.bolt = { sym: true, rows: [
    '..oooooo',
    '.ohhhhhh',
    '.oahhhh*',
    '.oaaaaa*',
    '.oaddddd',
    '..oooooo',
    '....oaaa',
    '....ohha',
    '....okkk',
    '....oaaa',
    '....okkk',
    '....oaaa',
    '....okkk',
    '.....ooo',
  ] };

  S.cog = { draw(P) {
    gear(P, 5.6, 7.4, 8, 1.4);
    P.patch(9, 5, 2, 1); P.patch(10, 6, 1, 1);
    star(P, 5, 10);
  } };

  S.battery = { sym: true, rows: [
    '......oo',
    '......om',
    '...ooooo',
    '...ohhaa',
    '...ohaa*',
    '...ohaa*',
    '...ohaaa',
    '...okkkk',
    '...okkkk',
    '...ohaaa',
    '...ohaaa',
    '...oaaaa',
    '...oddda',
    '...ooooo',
  ] };

  S.coil = { sym: true, rows: [
    '.ooooooo',
    '.omhhhh*',
    '.ooooooo',
    '.oahaaha',
    '.oaddadd',
    '.okkkkkk',
    '.oaddadd',
    '.oahaaha',
    '.oaddadd',
    '.ooooooo',
    '.omddddd',
    '.ooooooo',
  ] };

  S.block = { sym: true, rows: [
    '..oooooo',
    '..ohhhhh',
    '..okkaaa',
    '..okkaaa',
    '..oaaaaa',
    '..oaaaa*',
    '..oaaa**',
    '..oaaaa*',
    '..oaaaaa',
    '..okkaaa',
    '..okkaaa',
    '..oddddd',
    '..oooooo',
  ] };

  S.mug = { rows: [
    '.oooooooooo.....',
    '.ohhaaaaddo.....',
    '.ohaa**addooo...',
    '.ohaa**addo..ao.',
    '.okkkkkkkko..ao.',
    '.okkkkkkkko..ao.',
    '.ohaaaaaddooo...',
    '.ohaaaaaddo.....',
    '.oaaaaaaddo.....',
    '.oddddddddo.....',
    '..oooooooo......',
  ] };

  S.marble = { draw(P) {
    orb(P, 8, 8, 6.6);
    P.patch(8, 9, 2, 1); P.patch(10, 8, 1, 1); P.patch(10, 7, 1, 1); P.patch(9, 6, 1, 1); P.patch(7, 10, 1, 1);
    P.mark(5, 5, 2, 2, '#ffffff');
  } };

  S.key = { rows: [
    '....oooooooo....',
    '...oahhhhhhao...',
    '...oa**hhhhao...',
    '...oa**TTTTao...',
    '...oaaTTTTddo...',
    '....oaaaaaao....',
    '.....oooooo.....',
    '.......oho......',
    '.......oao......',
    '.......oaooo....',
    '.......oakko....',
    '.......oao......',
    '.......oaooo....',
    '.......oakko....',
    '.......oao......',
    '........o.......',
  ] };

  // ---------- neat (tier 1) ----------

  S.toaster = { rows: [
    '...oooo..oooo...',
    '..oYYYYooYYYYo..',
    '..oYYYYooYYYYo..',
    '.oooooooooooooo.',
    'ohhhhhhhhhhhhhho',
    'ohhhhhhhhhhhhhho',
    'oaaaaaaaaaaaaaao',
    'oa**aaaaabbaeeao',
    'oa**aaaaaaaaeeao',
    'okkkkkkkkkkkkkko',
    'oaaaaaaaaaaaaaao',
    'oddddddddddddddo',
    '.oo..........oo.',
  ] };

  S.radio = { rows: [
    '.........o......',
    '........o.......',
    '.......o........',
    '.oooooooooooooo.',
    'ohhhhhhhhhhhhhho',
    'oaTuTuTaaaaaaaao',
    'oaTuTuTaakkkkaao',
    'oaTuTuTaakkkkaao',
    'oaTuTuTaaaaaaaao',
    'oa**aaaaaabaeeao',
    'oa**aaaaaaaaeeao',
    'oddddddddddddddo',
    '.oooooooooooooo.',
  ] };

  S.headphones = { sym: true, rows: [
    '....oooo',
    '..ooahh*',
    '.oahaooo',
    '.oahao..',
    '.oahao..',
    '.oahao..',
    'oooooo..',
    'ohhhaak.',
    'ohhaaak.',
    'ohaaaak.',
    'ohaaaak.',
    'oaaaaak.',
    'odddddk.',
    '.oooooo.',
  ] };

  S.clock = { draw(P) {
    orb(P, 8, 9.2, 6.8);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 8, y + 0.5 - 9.2) <= 4.3) P.px(x, y, 'w');
    }
    P.patch(8, 8, 1, 3); P.patch(9, 10, 3, 1);
    star(P, 8, 6, '#ff4fd8');
    P.r(1, 2, 4, 1, 'o'); P.r(1, 3, 1, 2, 'o'); P.r(2, 3, 3, 2, 'y');
    P.r(11, 2, 4, 1, 'o'); P.r(14, 3, 1, 2, 'o'); P.r(11, 3, 3, 2, 'y');
    P.r(4, 15, 3, 1, 'o'); P.r(9, 15, 3, 1, 'o');
  } };

  S.datapad = { sym: true, rows: [
    '...ooooo',
    '...ohhhh',
    '...oaaaa',
    '...oaTTT',
    '...oaTkk',
    '...oaTTT',
    '...oaTkk',
    '...oaTTT',
    '...oaTkk',
    '...oaaaa',
    '...oabae',
    '...oddda',
    '...ooooo',
  ], after(P) { star(P, 7, 6, '#ffffff'); } };

  S.camera = { sym: true, rows: [
    '....oooo',
    '...ohhh*',
    'oooooooo',
    'ohhhhhhh',
    'oaaaaaaa',
    'oakaaaaa',
    'oaaaaaaa',
    'oaaaaaaa',
    'oaaaaaaa',
    'oaaaaaaa',
    'oaaaaaaa',
    'oddddddd',
    'oooooooo',
  ], after(P) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 10);
        if (d > 4.3) continue;
        P.px(x, y, d > 3.3 ? 'o' : d > 2.4 ? 'm' : 'u');
      }
    }
    P.px(7, 9, 'w'); P.px(6, 9, 'w');
  } };

  // ---------- cool (tier 2) ----------

  S.cartridge = { sym: true, rows: [
    '..oooooo',
    '.ohhhhhh',
    '.oaaaaaa',
    '.oaowwww',
    '.oaokkkk',
    '.oaokkkk',
    '.oaowwww',
    '.oaowww*',
    '.oaooooo',
    '.oaaaaaa',
    '.oaaaaaa',
    '..oaaaaa',
    '..oyoyoy',
    '..oooooo',
  ] };

  S.plush = { sym: true, rows: [
    '..ooo...',
    '..oyo...',
    '...o....',
    '..oooooo',
    '.ohhhhhh',
    '.oaaaaaa',
    '.oaaTTaa',
    '.oaaTwaa',
    '.oaaTTaa',
    '.oaaaaaa',
    '.oaaaaaT',
    '..oaaaaa',
    '..ooaaaa',
    '.oaaakkk',
    '.oaaak*k',
    '..oooooo',
  ] };

  S.lamp = { sym: true, rows: [
    '......oo',
    '.....omm',
    '....ommm',
    '...oohhh',
    '...ohaaa',
    '..ohaakk',
    '..oaaakk',
    '..oaaaaa',
    '..oaakaa',
    '..ohaaaa',
    '..oaaaaa',
    '...oaaaa',
    '..ommmmm',
    '.ommmmmm',
    '.ommmmm*',
    '.ooooooo',
  ] };

  S.skates = { rows: [
    '....oooooo......',
    '...ohhhhhho.....',
    '...oaaaaaao.....',
    '...owwwwwwo.....',
    '...oaaaaaaoo....',
    '...oaaaaaaaaoo..',
    '...oaaa**aaaaao.',
    '...oaaa**aaaaao.',
    '...oddddddddddo.',
    '..oooooooooooooo',
    '..okko.okko.okko',
    '..okko.okko.okko',
    '...oo...oo...oo.',
  ] };

  S.boombox = { sym: true, rows: [
    '..oooooo',
    '..o.....',
    '..o.....',
    'oooooooo',
    'ohhhhhhh',
    'oaaaabae',
    'oaoooaTT',
    'ookkkoTu',
    'ookkkoTu',
    'ookkkoTT',
    'oaoooaaa',
    'oaaaaaa*',
    'oddddddd',
    'oooooooo',
  ] };

  S.bubble = { draw(P) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 5.6);
        if (d > 5.6) continue;
        if (d > 4.6) P.px(x, y, 'o');
        else if (d > 3.6) P.px(x, y, y < 5 ? 'h' : 'a');
        else if (d > 2.8) P.px(x, y, 'o');
        else if ((x + y) % 2 === 0) P.px(x, y, 'l');
      }
    }
    P.r(6, 11, 4, 5, 'o'); P.r(7, 11, 2, 4, 'a'); P.patch(7, 13, 2, 2);
    star(P, 3, 3, '#ffffff');
    P.r(12, 11, 3, 3, 'u'); P.r(13, 12, 1, 1, 'w');
    P.r(1, 11, 2, 2, 'u'); P.r(1, 11, 1, 1, 'w');
  } };

  // ---------- epic (tier 3) ----------

  S.robotpet = { sym: true, rows: [
    '......oo',
    '......oy',
    '......o.',
    '.ooooooo',
    'oahhhhhh',
    'oaaaaaaa',
    'oaaTTTaa',
    'oaaTggaa',
    'oaaTTTaa',
    '.oaaaaaa',
    '.oaaaaTT',
    '..oooooo',
    '..oookkk',
    '..oaaaaa',
    '..oaaaa*',
    '..ooddoo',
  ] };

  S.crystal = { sym: true, rows: [
    '.......o',
    '......oh',
    '.....ohh',
    '....ohha',
    '...ohha*',
    '..ohhaaa',
    '..ohaaaa',
    '..ohaaak',
    '..oaaakk',
    '..oaaakk',
    '..oaaaad',
    '...oaadd',
    '....oddd',
    '.....odd',
    '......od',
    '.......o',
  ] };

  S.rocket = { sym: true, rows: [
    '.......o',
    '......oh',
    '.....ohh',
    '....ohaa',
    '...ohaaa',
    '...oaaaa',
    '...okkkk',
    '...oaauu',
    '...oaauu',
    '...oaaa*',
    '..ooaaaa',
    '.odoaaaa',
    '.oddoddd',
    '....oyyy',
    '.....oyy',
    '......oy',
  ] };

  S.globe = { draw(P) {
    orb(P, 8, 6.2, 5.9);
    P.patch(6, 4, 3, 2); P.patch(9, 6, 2, 3); P.patch(5, 7, 2, 2);
    star(P, 13, 2, '#ffffff');
    P.r(7, 12, 2, 1, 'm');
    P.r(3, 13, 10, 2, 'n'); P.r(3, 13, 10, 1, 'm'); P.r(4, 15, 8, 1, 'o');
    P.r(6, 14, 4, 1, 'g');
  } };

  S.musicbox = { sym: true, rows: [
    '.....o.o',
    '....o.o.',
    '........',
    '.ooooooo',
    '.ohhhhhh',
    '.oaaaaaa',
    '.okkkkkk',
    '.oaaaaaa',
    '.oaaaaa*',
    '.oaaaaaa',
    '.okkkkkk',
    '.odddddd',
    '.ooooooo',
    '.oo.....',
  ], after(P) { P.r(15, 7, 1, 3, 'y'); P.r(14, 9, 2, 1, 'y'); } };

  S.rover = { rows: [
    '..........oo....',
    '..........oo....',
    '.......ooooooo..',
    '.......oTuuuTo..',
    '.......ooooooo..',
    '..oooooooooooo..',
    '.ohhhhhhhhhhhho.',
    '.oaaaaaaaaaaaao.',
    '.oaaTTTTabab**ao',
    '.oaaTTTTaabaeeao',
    '.oddddddddddddo.',
    '..oooooooooooo..',
    '.okko.okko.okko.',
    '.okko.okko.okko.',
    '..oo...oo...oo..',
  ] };

  // ---------- legend (tier 4) ----------

  S.helmet = { sym: true, rows: [
    '....oooo',
    '..oohhhh',
    '.ohhaaaa',
    '.ohaaaa*',
    '.oaooooo',
    'oaaoTTTT',
    'oaaoTuuT',
    'oaaoTuTT',
    'oaaoTTTT',
    'oaaooooo',
    '.oaaaaaa',
    '.okkkkkk',
    '.okkkkkk',
    '.oddddd.',
    '..oooooo',
  ] };

  S.goldgear = { draw(P) {
    gear(P, 6.2, 7.8, 10, 1.4);
    P.patch(11, 5, 2, 1); P.patch(12, 6, 1, 1); P.patch(4, 10, 2, 1); P.patch(4, 9, 1, 1);
    star(P, 8, 8);
  } };

  S.ufo = { sym: true, rows: [
    '....oooo',
    '...ouuuu',
    '...ouwuu',
    '..oouuuu',
    '.ooooooo',
    'oahhhhhh',
    'oaakaaka',
    'oaaaaaaa',
    '.ooddddd',
    '....odaa',
    '....odaa',
    '...ooooo',
    '..oaaaaa',
    '..oaaaa*',
    '..oddddd',
    '..oooooo',
  ] };

  S.moonorb = { draw(P) {
    orb(P, 8, 6.8, 6.4);
    P.patch(9, 4, 2, 2); P.patch(5, 7, 2, 2); P.patch(10, 9, 2, 1);
    star(P, 12, 2);
    P.r(6, 12, 4, 1, 'o');
    P.r(4, 13, 8, 2, 'm'); P.r(4, 13, 8, 1, 'w'); P.r(4, 15, 8, 1, 'o'); P.r(3, 13, 1, 2, 'o'); P.r(12, 13, 1, 2, 'o');
  } };

  return { S };
})();
