/* Neon Swap Shop — synthesized WebAudio blips (no files, starts only after a user gesture) */
'use strict';

const SFX = (() => {
  let ac = null;
  let muted = false;

  function unlock() {
    if (muted) return;
    // creating a context before a gesture logs a browser warning, so wait for activation
    if (!ac && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, delay, slide) {
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    tap: () => tone(520, 0.05, 'square', 0.05),
    coin: () => { tone(880, 0.07, 'square', 0.06); tone(1320, 0.12, 'square', 0.06, 0.07); },
    ok: () => { tone(660, 0.08, 'triangle', 0.09); tone(990, 0.12, 'triangle', 0.09, 0.08); },
    bad: () => tone(220, 0.22, 'sawtooth', 0.06, 0, 0.6),
    bell: () => { tone(1568, 0.5, 'sine', 0.09); tone(2093, 0.4, 'sine', 0.05, 0.02); },
    level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.09)),
    dig: () => tone(140, 0.09, 'sawtooth', 0.07, 0, 0.5),
    rare: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'square', 0.06, i * 0.07)),
    pop: () => tone(300, 0.1, 'sine', 0.1, 0, 2.5),
    bump: () => tone(110, 0.12, 'square', 0.07, 0, 0.5),
    sparkle: () => { tone(1568, 0.08, 'sine', 0.06); tone(2093, 0.08, 'sine', 0.06, 0.06); tone(2637, 0.14, 'sine', 0.06, 0.12); },
  };

  function play(name) {
    if (muted || !ac || ac.state !== 'running') return;
    const fn = SOUNDS[name];
    if (fn) fn();
  }

  function setMuted(m) { muted = !!m; }
  function isMuted() { return muted; }

  return { unlock, play, setMuted, isMuted };
})();
