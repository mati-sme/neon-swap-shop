/* Neon Swap Shop — invisible floating joystick (touch / mouse drag) + WASD/arrow keys */
'use strict';

const Input = (() => {
  const RADIUS = 42;   // css px of full deflection
  const DEAD = 6;
  const KEYMAP = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
  };
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, on: false };
  const held = [];
  const out = { x: 0, y: 0 };
  let ring = null;
  let knob = null;
  let enabled = true;

  function show(on) {
    if (ring) ring.classList.toggle('on', on);
  }

  function place() {
    ring.style.transform = 'translate(' + (stick.ox - 40) + 'px,' + (stick.oy - 40) + 'px)';
    let dx = stick.x - stick.ox;
    let dy = stick.y - stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }

  function down(e) {
    if (!enabled || stick.on) return;
    e.preventDefault();
    SFX.unlock();
    stick.on = true;
    stick.id = e.pointerId;
    stick.ox = stick.x = e.clientX;
    stick.oy = stick.y = e.clientY;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    place();
    show(true);
  }

  function move(e) {
    if (!stick.on || e.pointerId !== stick.id) return;
    e.preventDefault();
    stick.x = e.clientX;
    stick.y = e.clientY;
    place();
  }

  function up(e) {
    if (!stick.on || (e && e.pointerId !== stick.id)) return;
    stick.on = false;
    stick.id = null;
    show(false);
  }

  function bind(pad, ringEl, knobEl) {
    ring = ringEl;
    knob = knobEl;
    pad.addEventListener('pointerdown', down);
    pad.addEventListener('pointermove', move);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('lostpointercapture', up);
    window.addEventListener('keydown', (e) => {
      if (!KEYMAP[e.key] || !enabled) return;
      e.preventDefault();
      SFX.unlock();
      if (!held.includes(e.key)) held.push(e.key);
    });
    window.addEventListener('keyup', (e) => {
      const i = held.indexOf(e.key);
      if (i >= 0) held.splice(i, 1);
    });
    window.addEventListener('blur', reset);
  }

  // analog vector in [-1,1], magnitude <= 1 (no allocation: reuses `out`)
  function vec() {
    let x = 0;
    let y = 0;
    if (stick.on) {
      const dx = stick.x - stick.ox;
      const dy = stick.y - stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > DEAD) {
        const m = Math.min(1, (len - DEAD) / (RADIUS - DEAD));
        x = dx / len * m;
        y = dy / len * m;
      }
    }
    for (let i = 0; i < held.length; i++) {
      const k = KEYMAP[held[i]];
      x += k[0];
      y += k[1];
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    out.x = x;
    out.y = y;
    return out;
  }

  function reset() {
    stick.on = false;
    stick.id = null;
    held.length = 0;
    show(false);
  }

  function setEnabled(v) {
    enabled = v;
    if (!v) reset();
  }

  return { bind, vec, reset, setEnabled };
})();
