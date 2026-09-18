/* =====================================================================
 * map.js — ตารางช่อง, เส้นทางเดินของศัตรู และการวาดฉาก
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TILE = 48, COLS = 20, ROWS = 12;
  const W = TILE * COLS, H = TILE * ROWS;

  // จุดหักเลี้ยวของเส้นทาง (พิกัดช่อง) — เริ่มนอกจอซ้าย จบนอกจอขวา
  const WAYPOINTS_T = [
    [-1, 5], [4, 5], [4, 2], [10, 2], [10, 8], [15, 8], [15, 3], [18, 3], [18, 10], [20, 10]
  ];

  const t2p = ([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
  const WAYPOINTS = WAYPOINTS_T.map(t2p);

  // ความยาวสะสมของเส้นทาง ใช้เรียงว่าใครนำหน้าใคร
  const SEGS = [];
  let PATH_LEN = 0;
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i], b = WAYPOINTS[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    SEGS.push({ a, b, len, start: PATH_LEN });
    PATH_LEN += len;
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
  markPath();

  /* ---------- สุ่มของตกแต่งแบบคงที่ (seeded) ---------- */
  let seed = 20250918;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  const decor = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (blocked[r][c] !== 0) continue;
      const v = rnd();
      if (v < 0.075) {
        blocked[r][c] = 2;
        decor.push({ c, r, kind: v < 0.045 ? 'tree' : 'rock', j: rnd() });
      } else if (v < 0.14) {
        decor.push({ c, r, kind: 'flower', j: rnd() });   // ดอกไม้ไม่ขวางทาง
      }
    }
  }

  function buildable(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && blocked[r][c] === 0;
  }

  /* ---------- วาดฉากลงแคนวาสสำรองครั้งเดียว ---------- */
  function renderTerrain() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    // พื้นหญ้า
    seed = 777;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = rnd();
        const base = (r + c) % 2 ? '#5fa845' : '#69b34c';
        g.fillStyle = v < .12 ? '#74bd55' : base;
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
    stroke(TILE * 0.96, '#8a6a42');
    stroke(TILE * 0.80, '#c2a06a');
    stroke(TILE * 0.62, '#cfb17e');

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

  PTD.map = {
    TILE, COLS, ROWS, W, H,
    WAYPOINTS, PATH_LEN, pointAt, buildable, blocked, renderTerrain,
    tileOf: (x, y) => ({ c: Math.floor(x / TILE), r: Math.floor(y / TILE) }),
    centerOf: (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })
  };
})(window.PTD = window.PTD || {});
