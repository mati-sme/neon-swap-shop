/* Neon Swap Shop — customer trade card: accept / haggle / inspect (spot the fake) / appraise / helper gifts */
'use strict';

const Trade = (() => {
  const $ = UI.$;
  let cur = null;
  let hg = null; // haggle needle {pos, dir, c0, g, speed}

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const repMod = () => clamp(1 + (Game.state.rep - 10) * 0.003, 0.9, 1.3);

  function stockKey() {
    const s = Game.state;
    const shown = s.display.slice(0, Game.slots()).filter(Boolean);
    if (shown.length) return pick(shown);
    const have = Object.keys(s.inv).filter((k) => s.inv[k] > 0);
    return have.length ? pick(have) : null;
  }

  function helpKey() {
    const have = Object.keys(Game.state.inv).filter((k) => Game.state.inv[k] > 0 && !k.endsWith('+') && Data.item(k).tier <= 1);
    return have.length ? pick(have) : null;
  }

  function sellKey(c) {
    const s = Game.state;
    let max = s.day <= 1 ? 1 : Math.min(4, 1 + Math.floor(s.level / 3) + (s.rank >= 2 ? 1 : 0));
    if (c.vip) max = Math.min(4, max + 1);
    const w = [40, 30, 18, 9, 3];
    let tot = 0;
    for (let t = 0; t <= max; t++) tot += w[t];
    let r = Math.random() * tot;
    let tier = 0;
    for (let t = 0; t <= max; t++) { r -= w[t]; if (r <= 0) { tier = t; break; } }
    return pick(Data.BY_TIER[tier]);
  }

  function build(c) {
    const s = Game.state;
    const o = { c, kind: c.want, key: null, price: 0, fake: null, rare: false, verified: false, haggled: false, mood: 'happy' };
    if (o.kind === 'buy') { o.key = stockKey(); if (!o.key) o.kind = 'sell'; }
    if (o.kind === 'help') { o.key = helpKey(); if (!o.key) o.kind = 'sell'; }
    if (o.kind === 'sell') {
      o.key = sellKey(c);
      const p = Data.price(o.key, s.news);
      const tier = Data.ITEMS[o.key].tier;
      const fakeChance = s.day >= 3 ? 0.25 : s.day >= 2 ? 0.15 : 0;
      if (Math.random() < fakeChance) o.fake = pick(Art.fakeTypes(o.key));
      else if (tier >= 3 && Math.random() < 0.35) o.rare = true;
      o.price = Math.max(1, Math.round(p * (o.rare ? 0.35 : 0.6) * (c.vip ? 1.2 : 1)));
    } else if (o.kind === 'buy') {
      o.price = Math.max(1, Math.round(Data.price(o.key, s.news) * 1.25 * repMod() * (c.vip ? 1.6 : 1)));
    }
    return o;
  }

  function removeStock(o) {
    const s = Game.state;
    const i = s.display.slice(0, Game.slots()).indexOf(o.key);
    if (i >= 0) s.display[i] = null;
    else Game.invTake(o.key);
  }

  function end(mood) {
    const c = cur.c;
    cur = null;
    hg = null;
    UI.close();
    Shop.release(c, mood);
  }

  function card() {
    const o = cur;
    const tag = o.kind === 'buy' ? '🛒' : o.kind === 'sell' ? '🎁' : '🙏';
    const word = o.kind === 'buy' ? 'BUY' : o.kind === 'sell' ? 'SELL' : 'HELP';
    let h = '<div class="card trade' + (o.c.vip ? ' vip' : '') + '"><div class="who">' +
      '<img class="px portrait" width="84" height="120" src="' + Art.portrait(o.c, 6) + '">' +
      '<div class="bubble"><span class="tag">' + tag + '</span>' + UI.img(o.key, 4) + '</div></div>' +
      '<div class="tk"><b>' + word + '</b> ' + Data.item(o.key).name + (o.verified ? ' ✅' : '') + (o.rare ? ' ✨?' : '') + '</div>' +
      '<div class="price">' + (o.kind === 'help' ? '💖 free' : '🪙 <b id="tPrice">' + o.price + '</b>') + '</div>' +
      '<div class="btns" id="tBtns">' +
      '<button id="bAccept" class="rb ok" data-act="accept">✅</button>';
    if (o.kind !== 'help' && !o.haggled) h += '<button id="bHaggle" class="rb" data-act="haggle">💬</button>';
    if (o.kind === 'sell' && o.rare) h += '<button id="bAppraise" class="rb" data-act="appraise">🔎✨</button>';
    else if (o.kind === 'sell' && !o.verified) h += '<button id="bInspect" class="rb" data-act="inspect">🔍</button>';
    h += '<button id="bNo" class="rb no" data-act="no">❌</button></div></div>';
    UI.show(h, onAct, null, o.c.vip ? 'gold' : '');
  }

  function open(c) {
    cur = build(c);
    c.key = cur.key;
    c.want = cur.kind;
    hg = null;
    Game.tutDone();
    card();
  }

  function accept() {
    const o = cur;
    const s = Game.state;
    if (o.kind === 'buy') {
      removeStock(o);
      Game.addCoins(o.price, { fromEl: $('mBody') });
      Game.success(6 + Data.item(o.key).tier * 2);
      end('happy');
    } else if (o.kind === 'sell') {
      if (s.coins < o.price) { UI.toast('Need 🪙 ' + o.price); SFX.play('bad'); return; }
      Game.addCoins(-o.price, { raw: true });
      if (o.fake) {
        Game.invAdd('bolt', 1);
        Game.rep(-2);
        Game.breakStreak();
        UI.toast('😿 It was a fake!');
        SFX.play('bad');
        end('meh');
      } else {
        Game.invAdd(o.key, 1);
        Game.success(5 + Data.item(o.key).tier * 2);
        if (Data.item(o.key).tier >= 4) Game.sticker('legend');
        end('happy');
      }
    } else {
      Game.invTake(o.key);
      Game.rep(3);
      s.stats.helped++;
      Game.sticker('helper');
      Game.success(10);
      UI.confetti(40);
      UI.toast('💖 Thank you!');
      end('love');
    }
  }

  // ---------- haggle ----------

  function haggle() {
    const o = cur;
    const g = 0.16 + 0.02 * Game.state.up.haggle;
    hg = { pos: 0, dir: 1, c0: 0.25 + Math.random() * 0.5, g, speed: 1.1 };
    $('tBtns').outerHTML = '<div id="tBtns" class="hg"><div class="hgbar" id="hgBar">' +
      '<i class="y" style="left:' + (hg.c0 - 0.2) * 100 + '%;width:40%"></i>' +
      '<i class="g" style="left:' + (hg.c0 - g / 2) * 100 + '%;width:' + g * 100 + '%"></i>' +
      '<b id="needle"></b></div><button id="hgTap" class="big ok" data-act="hgtap">👆 TAP!</button></div>';
    o.haggled = true;
  }

  function hgTap() {
    const o = cur;
    const d = Math.abs(hg.pos - hg.c0);
    const zone = d <= hg.g / 2 ? 'g' : d <= 0.2 ? 'y' : 'r';
    hg = null;
    const buy = o.kind === 'buy';
    if (zone === 'g') {
      o.price = Math.max(1, Math.round(o.price * (buy ? 1.35 : 0.7)));
      UI.toast('🟢 Great deal!');
      SFX.play('ok');
    } else if (zone === 'y') {
      o.price = Math.max(1, Math.round(o.price * (buy ? 1.12 : 0.88)));
      UI.toast('🟡 Nice!');
      SFX.play('tap');
    } else {
      Game.rep(-1);
      o.mood = 'meh';
      UI.toast('🔴 Grumpy…');
      SFX.play('bad');
    }
    card();
  }

  function haggleInfo() {
    return hg ? { pos: hg.pos, c0: hg.c0, g: hg.g } : null;
  }

  // ---------- inspect (spot the fake) ----------

  function inspect() {
    const o = cur;
    const base = Data.split(o.key)[0];
    const reg = o.fake ? Art.region(base, o.fake) : null;
    const ring = reg && Game.state.up.magnify
      ? '<i class="ring" style="left:' + (reg[0] - 1) * 8 + 'px;top:' + (reg[1] - 1) * 8 + 'px;width:' + (reg[2] + 2) * 8 + 'px;height:' + (reg[3] + 2) * 8 + 'px"></i>' : '';
    UI.show('<div class="card wide"><h2>🔍</h2><div class="cmp">' +
      '<div><small>📒</small><img class="px" width="128" height="128" src="' + Art.icon(base, 8) + '"></div>' +
      '<div class="cand"><small>?</small><img class="px" width="128" height="128" src="' + Art.icon(base, 8, o.fake) + '">' + ring + '</div></div>' +
      '<div class="row"><button id="bReal" class="big ok" data-act="real">✅</button><button id="bFake" class="big no" data-act="fake">🚫</button></div></div>', onAct);
  }

  function judge(sayFake) {
    const o = cur;
    if (sayFake && o.fake) {
      const bonus = Math.round(o.price * 0.5) + 10;
      Game.addCoins(bonus, { fromEl: $('mBody') });
      Game.rep(3);
      Game.state.stats.caught++;
      Game.sticker('caught');
      Game.success(14);
      UI.confetti(60);
      UI.toast('🕵️ Caught a fake! +' + bonus);
      SFX.play('sparkle');
      end('love');
    } else if (sayFake) {
      Game.rep(-2);
      Game.breakStreak();
      UI.toast('Oops, it was real!');
      SFX.play('bad');
      end('meh');
    } else {
      o.verified = true;
      SFX.play('tap');
      card();
    }
  }

  // ---------- appraise (find 3 hidden marks) ----------

  const SPOTS = [[22, 28], [68, 22], [46, 66]];

  function appraise() {
    const o = cur;
    o.found = 0;
    o.hit = [false, false, false];
    renderAppraise();
  }

  function renderAppraise() {
    const o = cur;
    const hint = Game.state.up.magnify ? ' hint' : '';
    let sp = '';
    for (let i = 0; i < 3; i++) {
      sp += '<button id="spot' + i + '" class="spot' + hint + (o.hit[i] ? ' hit' : '') + '" style="left:' + SPOTS[i][0] + '%;top:' + SPOTS[i][1] + '%" data-act="spot:' + i + '">' + (o.hit[i] ? '✨' : '') + '</button>';
    }
    UI.show('<div class="card wide"><h2>🔎 ' + o.found + '/3</h2><div class="apr"><img class="px" width="192" height="192" src="' + Art.icon(Data.split(o.key)[0], 12) + '">' + sp + '</div></div>', onAct);
  }

  function spot(i) {
    const o = cur;
    if (o.hit[i]) return;
    o.hit[i] = true;
    o.found++;
    SFX.play('sparkle');
    if (o.found < 3) { renderAppraise(); return; }
    const bonus = Math.round(Data.price(o.key, Game.state.news) * 1.2) + 15;
    o.rare = false;
    Game.addCoins(bonus, { fromEl: $('mBody') });
    Game.sticker('jackpot');
    Game.addXp(10);
    UI.confetti(90);
    UI.toast('💎 JACKPOT! +' + bonus);
    card();
  }

  function onAct(a) {
    if (!cur) return;
    if (a === 'accept') accept();
    else if (a === 'no') { SFX.play('tap'); end('meh'); }
    else if (a === 'haggle') { haggle(); SFX.play('tap'); }
    else if (a === 'hgtap') hgTap();
    else if (a === 'inspect') inspect();
    else if (a === 'appraise') appraise();
    else if (a === 'real') judge(false);
    else if (a === 'fake') judge(true);
    else if (a.startsWith('spot:')) spot(+a.slice(5));
  }

  // needle ping-pong on real (unscaled) time
  function tick(dt) {
    if (!hg) return;
    hg.pos += hg.dir * hg.speed * dt;
    if (hg.pos > 1) { hg.pos = 1; hg.dir = -1; }
    if (hg.pos < 0) { hg.pos = 0; hg.dir = 1; }
    const n = $('needle');
    if (n) n.style.left = hg.pos * 100 + '%';
  }

  // helper bot: serves a simple buy customer without a card
  function auto(c) {
    const o = build(c);
    if (o.kind !== 'buy') return false;
    removeStock(o);
    Game.addCoins(o.price, { raw: false, quiet: true });
    Game.success(4);
    return true;
  }

  return { open, tick, auto, haggleInfo, get cur() { return cur; } };
})();
