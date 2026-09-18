/* =====================================================================
 * audio.js — เสียงประกอบสังเคราะห์สด ๆ ด้วย WebAudio (ไม่ต้องมีไฟล์เสียง)
 * ===================================================================== */
(function (PTD) {
  'use strict';
  let ctx = null, master = null, enabled = true;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = .22;
    master.connect(ctx.destination);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!enabled) return;
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol == null ? .5 : vol, ctx.currentTime + .008);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + .02);
  }

  function noise(dur, vol, filterHz) {
    if (!enabled) return;
    init();
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterHz || 1200;
    const g = ctx.createGain(); g.gain.value = vol == null ? .35 : vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  const SFX = {
    shoot:   () => blip(680, .06, 'square', .18, 420),
    hitFire: () => blip(300, .12, 'sawtooth', .2, 120),
    zap:     () => blip(1400, .08, 'square', .2, 600),
    thud:    () => noise(.14, .3, 700),
    splash:  () => noise(.2, .28, 2200),
    place:   () => { blip(520, .08, 'sine', .35); setTimeout(() => blip(780, .1, 'sine', .35), 70); },
    evolve:  () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, .18, 'triangle', .4), i * 90)); },
    sell:    () => { blip(500, .09, 'triangle', .3, 300); },
    leak:    () => { blip(220, .3, 'sawtooth', .35, 90); },
    waveStart: () => { [392, 523, 659].forEach((f, i) => setTimeout(() => blip(f, .14, 'triangle', .3), i * 70)); },
    levelUp: () => { [784, 1046].forEach((f, i) => setTimeout(() => blip(f, .12, 'sine', .3), i * 70)); },
    boss:    () => { [147, 131, 110].forEach((f, i) => setTimeout(() => blip(f, .45, 'sawtooth', .35), i * 160)); },
    win:     () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, .3, 'triangle', .4), i * 130)); },
    lose:    () => { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(f, .4, 'sawtooth', .35), i * 200)); },
    deny:    () => blip(160, .12, 'square', .25)
  };

  PTD.sfx = new Proxy(SFX, { get: (t, k) => (enabled && t[k]) ? t[k] : () => {} });
  PTD.audio = {
    toggle() { enabled = !enabled; if (enabled) init(); return enabled; },
    get enabled() { return enabled; },
    unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  };
})(window.PTD = window.PTD || {});
