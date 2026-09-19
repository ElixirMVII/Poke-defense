/* =====================================================================
 * map.js — ตารางช่อง, เส้นทางเดินของศัตรู และการวาดฉาก
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TILE = 48, COLS = 20, ROWS = 12;
  const W = TILE * COLS, H = TILE * ROWS;

  /* แผนที่ทั้งหมดในเกม — แต่ละอันมีเส้นทางและโทนสีของตัวเอง
   * เพิ่มแผนที่ใหม่ = เพิ่มหนึ่งก้อนตรงนี้ ที่เหลือคำนวณให้เอง */
  /* ธีมสีต่อด่าน — เดิมมีแผนที่ 3 แบบใช้วน 10 ด่าน
   * "ป่าลึก" "ถ้ำมืด" และ "ทะเลลึก" เลยเป็นแผนที่หินสีน้ำตาลอันเดียวกันหมด
   * แยกรูปทางเดิน (LAYOUTS) ออกจากจานสี (THEMES) ด่านเดิมเลยดูเป็นคนละที่ */
  const THEMES = {
    meadow:  { grass: ['#5fa845', '#69b34c', '#74bd55'], dirt: ['#8a6a42', '#c2a06a', '#cfb17e'], decor: 'forest' },
    forest:  { grass: ['#2f6b34', '#367a3b', '#3e8743'], dirt: ['#4a3a22', '#7d6742', '#8d7550'], decor: 'forest' },
    urban:   { grass: ['#7c8470', '#868e79', '#919982'], dirt: ['#5c5346', '#9c917c', '#aca18c'], decor: 'mixed' },
    lake:    { grass: ['#4f9a6a', '#58a575', '#63b080'], dirt: ['#7a6a4a', '#d4c08a', '#e0ce9c'], decor: 'mixed' },
    cave:    { grass: ['#3c3648', '#443d52', '#4d455c'], dirt: ['#2a2530', '#6a5f78', '#7a6e88'], decor: 'rock' },
    rocky:   { grass: ['#8a6a5a', '#947264', '#9e7c6c'], dirt: ['#5e4636', '#a8825e', '#b89070'], decor: 'rock' },
    storm:   { grass: ['#4a5a72', '#54657e', '#5e708a'], dirt: ['#3a3f52', '#8a8f6a', '#9aa078'], decor: 'rock' },
    sea:     { grass: ['#2c6a8e', '#32769c', '#3a83aa'], dirt: ['#6a6a4a', '#c8bd88', '#d6cb98'], decor: 'rock' },
    volcano: { grass: ['#5a3430', '#663c36', '#72443c'], dirt: ['#3a201c', '#a8502e', '#c0603a'], decor: 'rock' },
    summit:  { grass: ['#7a8898', '#8593a3', '#909eae'], dirt: ['#4e5a66', '#c8d2dc', '#dae2ea'], decor: 'rock' }
  };

  const LAYOUTS = {
    meadow: {
      name: 'ทุ่งหญ้า',
      waypoints: [[-1, 5], [4, 5], [4, 2], [10, 2], [10, 8], [15, 8], [15, 3], [18, 3], [18, 10], [20, 10]],
      grass: ['#5fa845', '#69b34c', '#74bd55'], dirt: ['#8a6a42', '#c2a06a', '#cfb17e'],
      decor: 'forest', seed: 20250918
    },
    canyon: {
      name: 'หุบเขา',
      waypoints: [[-1, 1], [16, 1], [16, 5], [3, 5], [3, 9], [17, 9], [17, 6], [20, 6]],
      grass: ['#8a6a5a', '#947264', '#9e7c6c'], dirt: ['#5e4636', '#a8825e', '#b89070'],
      decor: 'rock', seed: 776611
    },
    shore: {
      name: 'ชายฝั่ง',
      waypoints: [[-1, 10], [3, 10], [3, 6], [7, 6], [7, 10], [12, 10], [12, 3], [7, 3],
                  [7, 1], [17, 1], [17, 7], [20, 7]],
      grass: ['#4f9a6a', '#58a575', '#63b080'], dirt: ['#7a6a4a', '#d4c08a', '#e0ce9c'],
      decor: 'mixed', seed: 31337
    }
  };

  let ACTIVE = 'meadow';
  let WAYPOINTS_T = LAYOUTS[ACTIVE].waypoints;

  const t2p = ([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
  let WAYPOINTS = [];
  let SEGS = [];
  let PATH_LEN = 0;

  function buildPath() {
    WAYPOINTS = WAYPOINTS_T.map(t2p);
    SEGS = [];
    PATH_LEN = 0;
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const a = WAYPOINTS[i], b = WAYPOINTS[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      SEGS.push({ a, b, len, start: PATH_LEN });
      PATH_LEN += len;
    }
  }

  // แปลงระยะทางที่เดินมาแล้ว -> พิกัด + ทิศ
  function pointAt(dist) {
    if (dist <= 0) return { x: WAYPOINTS[0].x, y: WAYPOINTS[0].y, dx: 1, dy: 0 };
    for (const s of SEGS) {
      if (dist <= s.start + s.len) {
        const k = (dist - s.start) / s.len;
        return {
          x: s.a.x + (s.b.x - s.a.x) * k,
          y: s.a.y + (s.b.y - s.a.y) * k,
          dx: (s.b.x - s.a.x) / s.len,
          dy: (s.b.y - s.a.y) / s.len
        };
      }
    }
    const last = SEGS[SEGS.length - 1];
    return { x: last.b.x, y: last.b.y, dx: last.b.x > last.a.x ? 1 : -1, dy: 0 };
  }

  /* ---------- หาว่าช่องไหนเป็นทางเดิน ---------- */
  const blocked = [];               // 0 = วางได้, 1 = ทางเดิน, 2 = มีของตกแต่งขวาง
  for (let r = 0; r < ROWS; r++) { blocked[r] = new Array(COLS).fill(0); }

  function markPath() {
    for (let r = 0; r < ROWS; r++) blocked[r].fill(0);
    for (let i = 0; i < WAYPOINTS_T.length - 1; i++) {
      let [c0, r0] = WAYPOINTS_T[i];
      const [c1, r1] = WAYPOINTS_T[i + 1];
      const sc = Math.sign(c1 - c0), sr = Math.sign(r1 - r0);
      while (c0 !== c1 || r0 !== r1) {
        if (r0 >= 0 && r0 < ROWS && c0 >= 0 && c0 < COLS) blocked[r0][c0] = 1;
        if (c0 !== c1) c0 += sc; else if (r0 !== r1) r0 += sr;
      }
      if (r1 >= 0 && r1 < ROWS && c1 >= 0 && c1 < COLS) blocked[r1][c1] = 1;
    }
    // กันช่องที่ติดกับทางเดินแบบทแยง ไม่ต้องทำอะไร — วางได้หมด
  }

  /* ---------- สุ่มของตกแต่งแบบคงที่ (seeded) ---------- */
  let seed = 20250918;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  let decor = [];
  function buildDecor(layout) {
    seed = layout.seed;
    decor = [];
    const kinds = layout.decor === 'rock' ? ['rock', 'rock']
                : layout.decor === 'mixed' ? ['tree', 'rock'] : ['tree', 'rock'];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (blocked[r][c] !== 0) continue;
        const v = rnd();
        if (v < 0.075) {
          blocked[r][c] = 2;
          decor.push({ c, r, kind: v < 0.045 ? kinds[0] : kinds[1], j: rnd() });
        } else if (v < 0.14) {
          decor.push({ c, r, kind: 'flower', j: rnd() });   // ดอกไม้ไม่ขวางทาง
        }
      }
    }
  }

  /* ---------- แท่นวาง (build pad) ----------
   * เดิมวางได้เกือบทุกช่องว่าง (เช่น meadow วางได้ 186 ช่อง ติดทางเดิน 75)
   * ผู้เล่นใช้จริงแค่ 6 ช่อง ตำแหน่งเลยไม่เคยเป็นการตัดสินใจ
   * เปลี่ยนมาเป็นแท่นวางจำนวนจำกัดแบบ Kingdom Rush — ต้องแย่งกันว่าจะให้ใครยืนตรงไหน
   *
   * เลือกแท่นด้วยการให้คะแนน "ช่องนี้คุมทางเดินได้กี่ช่องในรัศมียิงทั่วไป"
   * แล้วไล่เก็บจากคะแนนสูงสุดโดยเว้นระยะกัน จะได้กระจายคุมคนละช่วงของทาง
   * คิดจากทางเดินโดยตรง เลยใช้ได้กับแผนที่ใหม่ที่เพิ่มทีหลังโดยไม่ต้องวางมือ */
  const PAD_RADIUS = 3.4;     // รัศมีที่ใช้ให้คะแนน (หน่วยช่อง ~ ระยะยิงกลาง ๆ)
  const PAD_SPACING = 1.9;    // แท่นสองอันต้องห่างกันอย่างน้อยเท่านี้
  let pads = [];              // [{c,r,score}]
  let padAt = [];             // padAt[r][c] = true

  let PAD_COUNT = 16;              // หน้า admin ปรับได้
  function buildPads(layout) {
    const want = layout.pads || PAD_COUNT;
    const cand = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (blocked[r][c] !== 0) continue;        // ทางเดินหรือของตกแต่งขวาง
      let score = 0;
      for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (blocked[rr][cc] !== 1) continue;
        const d = Math.hypot(cc - c, rr - r);
        if (d <= PAD_RADIUS) score += 1 - d / (PAD_RADIUS + 1);
      }
      if (score > 0) cand.push({ c, r, score });
    }
    cand.sort((a, b) => b.score - a.score || (a.r - b.r) || (a.c - b.c));

    pads = [];
    for (const p of cand) {
      if (pads.length >= want) break;
      if (pads.some(q => Math.hypot(q.c - p.c, q.r - p.r) < PAD_SPACING)) continue;
      pads.push(p);
    }
    padAt = [];
    for (let r = 0; r < ROWS; r++) padAt[r] = new Array(COLS).fill(false);
    for (const p of pads) padAt[p.r][p.c] = true;
  }

  function buildable(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && blocked[r][c] === 0 && padAt[r][c];
  }

  /* ---------- วาดฉากลงแคนวาสสำรองครั้งเดียว ---------- */
  function renderTerrain(layout) {
    layout = layout || LAYOUTS[ACTIVE];
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    // พื้นหญ้า
    seed = 777;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = rnd();
        const base = (r + c) % 2 ? layout.grass[0] : layout.grass[1];
        g.fillStyle = v < .12 ? layout.grass[2] : base;
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    // จุดหญ้าเล็ก ๆ
    g.globalAlpha = .18;
    for (let i = 0; i < 900; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.fillStyle = rnd() < .5 ? '#2f6b2a' : '#8fd06a';
      g.fillRect(x, y, 2, 2);
    }
    g.globalAlpha = 1;

    // ทางเดิน: เส้นหนาโค้งมน 2 ชั้น
    const stroke = (w, color) => {
      g.beginPath();
      g.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
      for (let i = 1; i < WAYPOINTS.length; i++) g.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
      g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = color; g.stroke();
    };
    stroke(TILE * 0.96, layout.dirt[0]);
    stroke(TILE * 0.80, layout.dirt[1]);
    stroke(TILE * 0.62, layout.dirt[2]);

    // กรวดบนทาง
    g.globalAlpha = .35;
    for (let d = 8; d < PATH_LEN; d += 11) {
      const p = pointAt(d);
      const off = (rnd() - .5) * TILE * .5;
      g.fillStyle = rnd() < .5 ? '#a8865a' : '#e0c79a';
      g.fillRect(p.x - p.dy * off, p.y + p.dx * off, 3, 3);
    }
    g.globalAlpha = 1;

    // ของตกแต่ง
    for (const d of decor) {
      const x = d.c * TILE + TILE / 2, y = d.r * TILE + TILE / 2;
      if (d.kind === 'tree') {
        g.globalAlpha = .25; g.fillStyle = '#000';
        g.beginPath(); g.ellipse(x, y + 15, 13, 5, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#7a5230'; g.fillRect(x - 3, y + 2, 6, 14);
        const leaf = ['#2f7a35', '#357f38', '#2a6f30'];
        for (let i = 0; i < 3; i++) {
          g.fillStyle = leaf[i];
          g.beginPath();
          g.arc(x + (i - 1) * 8, y - 2 - i * 5 + (i === 1 ? 0 : 3), 11 - i * 1.5, 0, 7);
          g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,.14)';
        g.beginPath(); g.arc(x - 5, y - 10, 5, 0, 7); g.fill();
      } else if (d.kind === 'rock') {
        g.globalAlpha = .25; g.fillStyle = '#000';
        g.beginPath(); g.ellipse(x, y + 10, 12, 4, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#8f8f9a';
        g.beginPath();
        g.moveTo(x - 12, y + 9); g.lineTo(x - 7, y - 6); g.lineTo(x + 3, y - 9);
        g.lineTo(x + 12, y + 2); g.lineTo(x + 8, y + 9);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.beginPath(); g.moveTo(x - 6, y - 5); g.lineTo(x + 2, y - 8); g.lineTo(x - 2, y + 1); g.closePath(); g.fill();
      } else {
        const cols = ['#f2e06a', '#f08aa8', '#ffffff', '#c58af0'];
        const col = cols[Math.floor(d.j * cols.length) % cols.length];
        for (let i = 0; i < 3; i++) {
          const fx = x + (i - 1) * 9 + d.j * 6 - 3, fy = y + ((i * 7) % 11) - 5;
          g.fillStyle = col;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.arc(fx + Math.cos(k * 1.57) * 2.4, fy + Math.sin(k * 1.57) * 2.4, 1.7, 0, 7);
            g.fill();
          }
          g.fillStyle = '#f7c948';
          g.beginPath(); g.arc(fx, fy, 1.3, 0, 7); g.fill();
        }
      }
    }

    // ป้ายจุดเข้า/ออก
    const drawSign = (p, text, color) => {
      g.save();
      g.fillStyle = color; g.globalAlpha = .85;
      g.beginPath(); g.roundRect(p.x - 26, p.y - 46, 52, 22, 6); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = 'bold 12px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, p.x, p.y - 35);
      g.restore();
    };
    drawSign({ x: 18, y: WAYPOINTS[0].y }, 'เข้า', '#2f7a35');
    drawSign({ x: W - 18, y: WAYPOINTS[WAYPOINTS.length - 1].y }, 'ออก', '#b23a3a');

    return cv;
  }

  const map = {
    TILE, COLS, ROWS, W, H,
    id: ACTIVE, name: '', WAYPOINTS, PATH_LEN, terrain: null,
    pointAt, buildable, blocked, renderTerrain,
    get pads() { return pads; },
    get padCount() { return PAD_COUNT; },
    tileOf: (x, y) => ({ c: Math.floor(x / TILE), r: Math.floor(y / TILE) }),
    centerOf: (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })
  };

  // สลับแผนที่โดยเขียนทับค่าในอ็อบเจ็กต์เดิม ไม่สร้างใหม่
  // (โมดูลอื่นถือ reference นี้ไว้ตั้งแต่ตอนโหลดแล้ว)
  function use(id, theme) {
    const base = LAYOUTS[id] || LAYOUTS.meadow;
    ACTIVE = LAYOUTS[id] ? id : 'meadow';
    // ธีมทับเฉพาะสีกับของตกแต่ง รูปทางเดินยังเป็นของ layout เดิม
    const t = THEMES[theme];
    const layout = t ? Object.assign({}, base, t) : base;
    WAYPOINTS_T = layout.waypoints;
    buildPath();
    markPath();
    buildDecor(layout);
    buildPads(layout);
    map.id = ACTIVE;
    map.name = layout.name;
    map.WAYPOINTS = WAYPOINTS;
    map.PATH_LEN = PATH_LEN;
    map.terrain = renderTerrain(layout);
    return map;
  }

  PTD.map = map;
  PTD.MAP_LAYOUTS = LAYOUTS;
  PTD.MAP_THEMES = THEMES;
  PTD.useMap = use;
  // เปลี่ยนจำนวนแท่นแล้วต้องสร้างใหม่ทันที ไม่งั้นค่าใหม่จะมีผลตอนเปลี่ยนแผนที่เท่านั้น
  PTD.setPadCount = (n) => { PAD_COUNT = Math.max(1, Math.round(n)); use(ACTIVE); };
})(window.PTD = window.PTD || {});
