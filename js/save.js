/* Neon Swap Shop — state defaults + localStorage persistence */
'use strict';

const Save = (() => {
  const KEY = 'neonswap.save.v1';

  function defaults() {
    return {
      v: 1,
      coins: 30, xp: 0, level: 1, day: 1, rank: 0, rep: 10,
      rankEarned: 0, rankT: 0,
      inv: { bolt: 2, battery: 2, mug: 1, cog: 1 },
      display: ['block', 'toaster', 'radio'],
      up: { slots: 0, bag: 0, digs: 0, speed: 0, haggle: 0, magnify: 0, bench: 0, bot: 0, deco: 0 },
      found: { bolt: 1, battery: 1, mug: 1, cog: 1, block: 1, toaster: 1, radio: 1 },
      tiersDone: {},
      stickers: {},
      streak: 0, bestStreak: 0,
      lastLogin: '', loginStreak: 0,
      tut: 0, mute: false,
      news: 0, pity: 0, trips: 0,
      phase: 'prep', served: 0, quota: 5,
      today: { coins: 0, xp: 0, trades: 0 },
      stats: { trades: 0, caught: 0, digs: 0, helped: 0, earned: 0 },
      time: 0,
    };
  }

  // shallow-merge saved data over defaults, one level deep for the nested objects
  function merge(base, saved) {
    for (const k of Object.keys(saved)) {
      const b = base[k];
      // inv is a free-form map: saved keys replace the starter set instead of merging into it
      if (k !== 'inv' && b && typeof b === 'object' && !Array.isArray(b) && saved[k] && typeof saved[k] === 'object') {
        Object.assign(b, saved[k]);
      } else {
        base[k] = saved[k];
      }
    }
    return base;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return null;
      const st = merge(defaults(), s);
      if (st.phase === 'open') st.phase = 'prep';
      return st;
    } catch (_) {
      return null;
    }
  }

  function write(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* storage full or blocked */ }
  }

  function wipe() {
    try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  return { KEY, defaults, load, write, wipe, today };
})();
