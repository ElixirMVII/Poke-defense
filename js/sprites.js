/* =====================================================================
 * sprites.js — โหลดและวาดสไปรท์โปเกม่อนของจริง
 *
 * ใช้สไปรท์ชุด Black/White แบบเคลื่อนไหวจากคลัง PokeAPI/sprites
 * เบราว์เซอร์ส่วนใหญ่ "ไม่" เดินเฟรม GIF ให้ตอนวาดลง canvas เราเลยถอดเฟรมเอง
 * ด้วย ImageDecoder (WebCodecs) แล้วคุมเวลาเอง
 *
 * ลำดับการถอย: GIF เคลื่อนไหว -> PNG ภาพนิ่ง -> วงกลมสีธาตุ (ตอนยังโหลดไม่เสร็จ)
 *
 * รูปไม่ได้ถูกเก็บไว้ในรีโปนี้ — โหลดสด ๆ จาก CDN ตอนเล่น
 * ถ้าอยากเล่นออฟไลน์ ให้โหลดรูปมาไว้เองแล้วเรียก PTD.sprites.setBase('./sprites')
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TAU = Math.PI * 2;

  // ตั้ง window.PTD_SPRITE_BASE ก่อนโหลดสคริปต์นี้ เพื่อชี้ไปโฟลเดอร์รูปในเครื่อง
  // (โครงสร้างต้องเป็น <base>/<id>.png และ <base>/versions/generation-v/black-white/animated/<id>.gif)
  let BASE = window.PTD_SPRITE_BASE ||
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

  /* โหมดแพ็ก: สไปรท์ทั้งหมดถูกต่อกันเป็นก้อนเดียวพร้อมดัชนี
   * ใช้ตอนเผยแพร่เป็นหน้าเว็บ ซึ่งจำกัดทั้งจำนวนไฟล์ (255) และขนาดไฟล์ (16 MB)
   *   window.PTD_ANIM_PACK  = { idx: 'sprites/anim.json' }
   *   window.PTD_STILL_PACK = { idx: 'sprites/still.json' }
   * ไฟล์ดัชนีบอกว่าก้อนข้อมูลถูกหั่นเป็นกี่ชิ้นและแต่ละตัวอยู่ตำแหน่งไหน
   * เก็บเป็น base64 ในไฟล์ข้อความ เพราะที่เผยแพร่รับเฉพาะชนิดไฟล์มาตรฐานของเว็บ
   * (386 ตัวรวมกัน GIF 14 MB -> base64 ~19 MB จึงต้องหั่น) */
  function makePack(cfg) {
    if (!cfg) return null;
    const p = { cfg, promise: null, buf: null, idx: null };
    p.load = () => {
      if (p.promise) return p.promise;
      p.promise = (async () => {
        const meta = await (await fetch(cfg.idx)).json();
        p.idx = meta.index || meta;            // รองรับดัชนีรูปแบบเก่าด้วย
        const parts = meta.parts || [cfg.b64];
        const texts = await Promise.all(parts.map(u => fetch(u).then(r => {
          if (!r.ok) throw new Error('โหลดแพ็กสไปรท์ไม่ได้: ' + u);
          return r.text();
        })));
        // ถอด base64 ทีละชิ้นแล้วต่อกัน — แต่ละชิ้นหารด้วย 4 ลงตัวเสมอ
        const bins = texts.map(t => atob(t.trim()));
        const total = bins.reduce((n, b) => n + b.length, 0);
        const arr = new Uint8Array(total);
        let at = 0;
        for (const bin of bins) {
          for (let i = 0; i < bin.length; i++) arr[at + i] = bin.charCodeAt(i);
          at += bin.length;
        }
        p.buf = arr.buffer;
      })();
      return p.promise;
    };
    p.slice = async (id) => {
      await p.load();
      const ent = p.idx[id];
      return ent ? p.buf.slice(ent[0], ent[0] + ent[1]) : null;
    };
    return p;
  }

  const PACK = makePack(window.PTD_ANIM_PACK);

  /* ภาพนิ่งถูกแนบมาเป็น data: URL ในไฟล์เดียว (รวมกันแค่ ~340 KB)
   * โหลดครั้งเดียวตอนบูตแล้วเก็บไว้ในหน่วยความจำ stillURL() จึงยังคืนค่าทันที
   * ไม่ต้องแก้ทุกที่ที่เอาไปใส่ <img src> โดยตรง */
  const STILL_CFG = window.PTD_STILL_PACK || null;
  let stillMap = null;
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  function loadStills() {
    if (!STILL_CFG) return Promise.resolve();
    return fetch(STILL_CFG.idx)
      .then(r => r.json())
      .then(m => { stillMap = m; })
      .catch(e => console.warn('โหลดภาพนิ่งที่แนบมาไม่ได้:', e.message));
  }
  const animURL  = (id) => `${BASE}/versions/generation-v/black-white/animated/${id}.gif`;
  const stillURL = (id) => {
    if (STILL_CFG) return (stillMap && stillMap[id]) || BLANK;
    return `${BASE}/${id}.png`;
  };

  const MAX_FRAMES = 28;      // เก็บไว้ไม่เกินนี้ต่อหนึ่งตัว กันกินแรม
  const MAX_PARALLEL = 6;     // โหลดพร้อมกันได้กี่ตัว

  const cache = new Map();    // id -> entry
  const queue = [];
  let active = 0;

  /* entry = {
   *   state : 'queued' | 'loading' | 'ready' | 'failed'
   *   frames: [ImageBitmap|HTMLImageElement]
   *   cum   : [ms สะสมของแต่ละเฟรม]
   *   total : ความยาวลูปทั้งหมด (ms)
   *   w, h  : ขนาดจริงของสไปรท์
   * } */

  function entryFor(id) {
    let e = cache.get(id);
    if (!e) {
      e = { state: 'queued', frames: [], cum: [], total: 0, w: 0, h: 0 };
      cache.set(id, e);
      queue.push(id);
      pump();
    }
    return e;
  }

  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      const id = queue.shift();
      active++;
      load(id).finally(() => { active--; pump(); });
    }
  }

  // ขึ้นภาพนิ่งให้เห็นก่อน (เร็วและแทบไม่มีทางพลาด)
  // แล้วค่อยอัปเกรดเป็นแบบเคลื่อนไหวเบื้องหลัง — ผู้เล่นจึงไม่ต้องรอดูลูกบอลเปล่า
  async function load(id) {
    const e = cache.get(id);
    e.state = 'loading';
    const still = await loadStill(id, e);
    const anim = loadAnimated(id, e).catch(() => false);
    if (still) { upgradeLater(anim); return; }
    if (await anim) return;
    e.state = 'failed';
  }
  function upgradeLater(p) { p.then(() => {}); }

  /* ---------- ทางหลัก: ถอดเฟรมจาก GIF ---------- */
  async function animData(id) {
    if (PACK) return await PACK.slice(id);
    const resp = await fetch(animURL(id));
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  }

  async function loadAnimated(id, e) {
    if (typeof ImageDecoder === 'undefined') return false;
    let dec = null;
    try {
      const data = await animData(id);
      if (!data) return false;
      dec = new ImageDecoder({ data, type: 'image/gif' });
      await dec.tracks.ready;
      await dec.completed;
      const track = dec.tracks.selectedTrack;
      const n = track ? track.frameCount : 0;
      if (!n) return false;

      // ถอดทุกเฟรมเพื่อให้ได้เวลาที่ถูกต้อง แต่เก็บไว้แค่บางเฟรม
      const step = Math.max(1, Math.ceil(n / MAX_FRAMES));
      const frames = [], durs = [];
      let pending = 0;
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        // duration มาเป็นไมโครวินาที บางไฟล์ไม่ระบุ ให้ถือว่า 100ms
        pending += (image.duration ? image.duration / 1000 : 100);
        if (i % step === 0) {
          frames.push(await createImageBitmap(image));
          durs.push(0);           // เดี๋ยวเติมทีหลัง
        }
        if (i % step === step - 1 || i === n - 1) {
          durs[durs.length - 1] += pending;
          pending = 0;
        }
        image.close();
      }
      if (!frames.length) return false;

      // สลับทีเดียวตอนพร้อม เพื่อไม่ให้ลูปวาดเห็นสถานะครึ่ง ๆ กลาง ๆ
      let acc = 0;
      const first = frames[0];
      e.cum = durs.map(d => (acc += Math.max(16, d)));
      e.total = acc;
      e.frames = frames;
      e.w = first.width; e.h = first.height;
      e.kind = 'anim';
      e.state = 'ready';
      return true;
    } catch (err) {
      return false;
    } finally {
      if (dec) { try { dec.close(); } catch (_) {} }
    }
  }

  /* ---------- ทางสำรอง: PNG ภาพนิ่ง ---------- */
  function loadStill(id, e) {
    return new Promise((resolve) => {
      const img = new Image();
      // ไม่ตั้ง crossOrigin โดยตั้งใจ — เปิดไฟล์ตรง ๆ จาก file:// จะได้ยังโหลดรูปได้
      // (canvas จะกลายเป็น tainted แต่เกมไม่เคยอ่านพิกเซลกลับ จึงไม่มีผล)
      img.onload = () => {
        e.frames = [img];
        e.cum = [1000];
        e.total = 1000;
        e.w = img.naturalWidth;
        e.h = img.naturalHeight;
        e.kind = 'still';
        e.state = 'ready';
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = stillURL(id);
    });
  }

  /* ---------- เลือกเฟรมตามเวลา ---------- */
  function frameAt(e, tSec, phase) {
    if (e.frames.length === 1) return e.frames[0];
    const ms = ((tSec * 1000 + (phase || 0)) % e.total + e.total) % e.total;
    const cum = e.cum;
    for (let i = 0; i < cum.length; i++) if (ms < cum[i]) return e.frames[i];
    return e.frames[e.frames.length - 1];
  }

  /* ---------- วาด ---------- */
  // x,y = จุดกึ่งกลางตัว (เท้าจะอยู่ต่ำกว่านั้นเล็กน้อย)
  // opts: { scale, alpha, flash, tint, glow, phase, bob }
  function draw(ctx, id, x, y, size, tSec, opts) {
    opts = opts || {};
    const e = entryFor(id);
    const alpha = opts.alpha == null ? 1 : opts.alpha;

    // เงาใต้ตัว วาดเสมอ ทำให้ตัวละครดู "ยืนอยู่บนพื้น"
    ctx.save();
    ctx.globalAlpha = alpha * .3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + size * .40, size * .30, size * .11, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (opts.glow) {
      ctx.save();
      const g = ctx.createRadialGradient(x, y, size * .1, x, y, size * .85);
      g.addColorStop(0, opts.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = .5 * alpha; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, size * .85, 0, TAU); ctx.fill();
      ctx.restore();
    }

    if (e.state !== 'ready') { drawPlaceholder(ctx, x, y, size, tSec, opts, alpha); return; }

    const img = frameAt(e, tSec, opts.phase);
    // ปรับขนาดจากพิกเซลจริงของสไปรท์ ตัวใหญ่ในเกมจึงใหญ่จริงตามสัดส่วน
    const k = (size / 64) * (opts.scale || 1);
    const w = e.w * k, h = e.h * k;
    const bob = Math.sin(tSec * 3 + (opts.phase || 0)) * (size * .012);
    const dx = x - w / 2, dy = y + size * .40 - h + bob;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;     // สไปรท์พิกเซล ต้องคมไม่เบลอ
    ctx.drawImage(img, dx, dy, w, h);

    // แฟลชขาวตอนโดนตี — วาดทับเฉพาะรูปทรงตัวละคร
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = Math.min(.8, opts.flash) * alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(dx, dy, w, h);
    }
    ctx.restore();
  }

  // ระหว่างรอโหลด วาดลูกบอลสีธาตุกระพริบเบา ๆ
  function drawPlaceholder(ctx, x, y, size, t, opts, alpha) {
    const r = size * .26;
    ctx.save();
    ctx.globalAlpha = alpha * (.45 + .2 * Math.sin(t * 4));
    ctx.fillStyle = opts.tint || '#8aa0c0';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha * .8;
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
    ctx.restore();
  }

  /* ---------- ขนาดจริงของสไปรท์ (ใช้จัดตำแหน่ง/แถบเลือด) ---------- */
  function metrics(id, size, scale) {
    const e = cache.get(id);
    const k = (size / 64) * (scale || 1);
    if (!e || e.state !== 'ready') return { w: size * .5, h: size * .5 };
    return { w: e.w * k, h: e.h * k };
  }

  PTD.sprites = {
    draw, metrics,
    stillURL, loadStills,
    preload(ids) { for (const id of ids) entryFor(id); },
    setBase(url) { BASE = url.replace(/\/$/, ''); cache.clear(); },
    get ready() { let n = 0; for (const e of cache.values()) if (e.state === 'ready') n++; return n; },
    get pending() { return queue.length + active; },
    stateOf(id) { const e = cache.get(id); return e ? e.state : 'none'; },
    // ใช้ตอนทดสอบ: บอกว่าตัวนี้กำลังใช้ภาพเคลื่อนไหวหรือภาพนิ่ง
    debugKind(id) { const e = cache.get(id); return e ? (e.kind || e.state) : 'none'; }
  };
})(window.PTD = window.PTD || {});
