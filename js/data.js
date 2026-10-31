/* Neon Swap Shop — static data: items, news, ranks, upgrades, stickers */
'use strict';

const Data = (() => {
  // id, name, tier, value, category, art kind, body colour, accent colour, buttons
  const RAW = [
    ['bolt', 'Bolt', 0, 3, 'junk', 'gear', '#9aa3b8', '#dfe6f5', 2],
    ['cog', 'Cog', 0, 4, 'junk', 'gear', '#c9a35a', '#fff0b0', 3],
    ['battery', 'Battery', 0, 4, 'gadget', 'tall', '#3fcf6a', '#e8ffe0', 2],
    ['coil', 'Wire Coil', 0, 5, 'junk', 'ball', '#e07a3a', '#ffe1c0', 3],
    ['block', 'Toy Block', 0, 5, 'toy', 'box', '#ff5a8a', '#ffd0e0', 2],
    ['mug', 'Space Mug', 0, 5, 'junk', 'tall', '#5aa8ff', '#d8ecff', 3],
    ['marble', 'Marble', 0, 3, 'toy', 'ball', '#9a6bff', '#e6d8ff', 2],
    ['key', 'Old Key', 0, 6, 'junk', 'tall', '#d8b84a', '#fff6c0', 3],

    ['toaster', 'Toaster', 1, 12, 'gadget', 'box', '#c0c8d8', '#ff8a3a', 3],
    ['radio', 'Radio', 1, 16, 'gadget', 'box', '#3ad0c0', '#fff0a0', 2],
    ['headphones', 'Headphones', 1, 20, 'gadget', 'wide', '#ff4fa0', '#ffffff', 2],
    ['clock', 'Star Clock', 1, 18, 'gadget', 'ball', '#8a7bff', '#ffe27a', 3],
    ['datapad', 'Data Pad', 1, 22, 'gadget', 'box', '#2a3a6a', '#3affd0', 3],
    ['camera', 'Snap Cam', 1, 24, 'gadget', 'wide', '#5a5f78', '#ff6a6a', 2],

    ['cartridge', 'Game Cart', 2, 35, 'toy', 'cart', '#6a6f88', '#ff3aa0', 3],
    ['plush', 'Plush Alien', 2, 45, 'toy', 'plush', '#7aff9a', '#2a5a3a', 2],
    ['lamp', 'Lava Lamp', 2, 50, 'shiny', 'tall', '#ff4a8a', '#ffd04a', 3],
    ['skates', 'Hover Skates', 2, 60, 'toy', 'wide', '#3ac8ff', '#ffffff', 3],
    ['boombox', 'Boombox', 2, 55, 'gadget', 'box', '#ff8a3a', '#2a2a3a', 3],
    ['bubble', 'Bubble Wand', 2, 40, 'toy', 'ball', '#7affff', '#ff9ae0', 2],

    ['robotpet', 'Robot Pet', 3, 90, 'toy', 'bot', '#e8e8f8', '#ff5a8a', 3],
    ['crystal', 'Star Crystal', 3, 120, 'shiny', 'gem', '#9a7aff', '#e8d8ff', 2],
    ['rocket', 'Rocket Model', 3, 100, 'toy', 'tall', '#ff5a5a', '#fff0e0', 3],
    ['globe', 'Holo Globe', 3, 130, 'shiny', 'ball', '#3affd0', '#ffffff', 2],
    ['musicbox', 'Music Box', 3, 110, 'shiny', 'box', '#b06aff', '#ffd84a', 3],
    ['rover', 'Tiny Rover', 3, 95, 'toy', 'wide', '#ffb03a', '#3a3a5a', 2],

    ['helmet', 'Antique Helmet', 4, 250, 'shiny', 'helm', '#d8dcf0', '#ffcf3a', 3],
    ['goldgear', 'Golden Gear', 4, 400, 'shiny', 'gear', '#ffcf3a', '#fff6b0', 3],
    ['ufo', 'UFO Trophy', 4, 450, 'shiny', 'wide', '#ffd84a', '#ff5ac8', 2],
    ['moonorb', 'Moon Orb', 4, 300, 'shiny', 'ball', '#dfe8ff', '#7a9aff', 3],
  ];

  const ITEMS = {};
  const IDS = [];
  const BY_TIER = [[], [], [], [], []];
  for (const r of RAW) {
    const it = { id: r[0], name: r[1], tier: r[2], value: r[3], cat: r[4], kind: r[5], c1: r[6], c2: r[7], btn: r[8] };
    ITEMS[it.id] = it;
    IDS.push(it.id);
    BY_TIER[it.tier].push(it.id);
  }

  const TIER_NAMES = ['Junk', 'Neat', 'Cool', 'Epic', 'Legend'];
  const TIER_COLORS = ['#9aa3b8', '#5aff9a', '#4ab8ff', '#c070ff', '#ffcf3a'];
  const RARITY = ['common', 'rare', 'epic', 'legendary'];
  const RARITY_COLORS = ['#cfd6e8', '#4ab8ff', '#c070ff', '#ffcf3a'];

  const NEWS = [
    { icon: '🚀', text: 'Cargo ship docked: gadgets cheap today', cat: 'gadget', mult: 0.8 },
    { icon: '🎉', text: 'Toy fair! Toys are worth more', cat: 'toy', mult: 1.4 },
    { icon: '✨', text: 'Shiny rush! Shiny things are hot', cat: 'shiny', mult: 1.4 },
    { icon: '🧹', text: 'Junk drive: everyone wants junk', cat: 'junk', mult: 1.8 },
    { icon: '🌙', text: 'Quiet day on the station', cat: null, mult: 1 },
    { icon: '🎸', text: 'Retro craze: gadgets are cool again', cat: 'gadget', mult: 1.4 },
    { icon: '⚡', text: 'Power blip: gadgets cost more', cat: 'gadget', mult: 1.3 },
    { icon: '🍕', text: 'Pizza day: everyone is happy', cat: null, mult: 1.1 },
  ];

  const RANKS = ['Stall', 'Kiosk', 'Shop', 'Mega Store', 'Station Icon'];
  const FEES = [60, 150, 350, 800, 1800];

  // id, icon, name, base cost, cost growth, max level
  const UPGRADES = [
    ['slots', '🏷️', 'Shelf slots', 40, 1.3, 3],
    ['bag', '🎒', 'Bigger bag', 25, 1.25, 8],
    ['digs', '⛏️', 'More digs', 30, 1.3, 8],
    ['speed', '👟', 'Fast shoes', 20, 1.25, 6],
    ['haggle', '🎯', 'Haggle zone', 45, 1.3, 5],
    ['magnify', '🔍', 'Magnifier hint', 80, 1.35, 1],
    ['bench', '🔧', 'Fast bench', 30, 1.3, 5],
    ['bot', '🤖', 'Helper bot', 120, 1.35, 3],
    ['deco', '💡', 'Neon lights', 15, 1.2, 6],
  ];

  const STICKERS = {
    first: ['🤝', 'First trade!'],
    caught: ['🕵️', 'Caught a fake!'],
    dig: ['⛏️', 'First dig!'],
    helper: ['💖', 'Kind helper!'],
    jackpot: ['💎', 'Appraisal jackpot!'],
    trades10: ['🏪', '10 trades!'],
    level5: ['⭐', 'Level 5!'],
    rank: ['🏆', 'Shop rank up!'],
    legend: ['🌟', 'Legendary find!'],
    streak: ['🔥', 'Hot streak!'],
    bench: ['🔧', 'First polish!'],
    book: ['📖', 'Book complete!'],
  };

  // level N (2..) unlocks decoration N-2
  const DECOR = ['Plant', 'Poster', 'Rug', 'Fish tank', 'Disco ball', 'Cat bed', 'Lamp', 'Arcade', 'Banner', 'Statue'];

  function newsMult(it, newsIdx) {
    const n = NEWS[newsIdx || 0];
    return n.cat === null || n.cat === it.cat ? n.mult : 1;
  }

  function split(key) {
    return key.endsWith('+') ? [key.slice(0, -1), true] : [key, false];
  }

  function item(key) { return ITEMS[split(key)[0]]; }

  // coin value of one item right now (shiny = polished, worth more)
  function price(key, newsIdx) {
    const [id, shiny] = split(key);
    const it = ITEMS[id];
    return Math.max(1, Math.round(it.value * newsMult(it, newsIdx) * (shiny ? 1.5 : 1)));
  }

  function upCost(id, lvl) {
    const u = UPGRADES.find((x) => x[0] === id);
    return Math.round(u[3] * Math.pow(u[4], lvl));
  }

  function xpNeed(level) { return 10 + 8 * level; }

  return {
    ITEMS, IDS, BY_TIER, TIER_NAMES, TIER_COLORS, RARITY, RARITY_COLORS, NEWS, RANKS, FEES, UPGRADES, STICKERS, DECOR,
    split, item, price, upCost, xpNeed, newsMult,
  };
})();
