/* =====================================================================
 * safari.js — โซนซาฟารี: แผนที่เดินได้สำหรับออกไปจับโปเกม่อนเอง
 *
 * แต่ละโซนดึงรายชื่อโปเกม่อนจาก habitat จริงของ Gen 1
 * (ทุ่งหญ้า/ป่า/เมือง/ริมน้ำ/ถ้ำ/ภูเขา) ส่วนโอกาสจับใช้ capture_rate จริง
 * กติกาเป็นแบบ Safari Zone ของเกมต้นฉบับ — ขว้างบอล โยนเหยื่อ ขว้างหิน หนี
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TILE = 48, COLS = 20, ROWS = 12;
  const W = TILE * COLS, H = TILE * ROWS;
  const TAU = Math.PI * 2;

  // รหัสช่อง
  const FLOOR = 0, TALL = 1, WATER = 2, BLOCK = 3, PATH = 4;

  /* ---------------- นิยามโซน ---------------- */
  // hb = habitat_id ของ PokeAPI: 1 ถ้ำ, 2 ป่า, 3 ทุ่งหญ้า, 4 ภูเขา,
  //                              5 หายาก, 6 ทุรกันดาร, 7 ทะเล, 8 เมือง, 9 ริมน้ำ
  const ZONES = [
    // stageW = น้ำหนักการเจอตามขั้นวิวัฒนาการ [ร่างแรก, ร่างกลาง, ร่างสุดท้าย]
    // bstCap = ค่าพลังรวมที่ถือว่า "ปกติ" ของโซนนี้ เกินจากนี้จะเจอยากขึ้นเรื่อย ๆ
    // โซนต้น ๆ จึงเจอแต่ตัวอ่อน ต้องเลี้ยงเอง ไม่ใช่เดินไปจับตัวเทพมาเลย
    { id: 'route',    name: 'ทุ่งหญ้าต้นทาง', hb: [3],    lv: [3, 7],   need: 0,
      stageW: [1, .06, 0], bstCap: 330,
      pal: { base: '#6fb552', alt: '#78bd5a', tall: '#2f6b28', block: 'tree' }, water: 0 },
    { id: 'forest',   name: 'ป่าลึก',        hb: [2],    lv: [5, 11],  need: 1,
      stageW: [1, .16, .01], bstCap: 370,
      pal: { base: '#4e8f46', alt: '#579a4c', tall: '#1f4d22', block: 'tree' }, water: 0 },
    { id: 'town',     name: 'ชานเมืองเก่า',  hb: [8],    lv: [8, 15],  need: 2,
      stageW: [1, .30, .04], bstCap: 385,
      pal: { base: '#9a9a86', alt: '#a4a48e', tall: '#4a6238', block: 'rock' }, water: 0 },
    { id: 'lake',     name: 'ริมทะเลสาบ',    hb: [9, 7], lv: [11, 19], need: 4,
      stageW: [.9, .48, .11], bstCap: 420,
      pal: { base: '#6fb552', alt: '#78bd5a', tall: '#2f6b28', block: 'tree' }, water: .30 },
    { id: 'cave',     name: 'ถ้ำมืด',        hb: [1, 6], lv: [14, 23], need: 6,
      stageW: [.7, .70, .26], bstCap: 460,
      pal: { base: '#5a5464', alt: '#645d70', tall: '#2a323a', block: 'rock' }, water: .08 },
    { id: 'mountain', name: 'ภูเขาไฟ',       hb: [4],    lv: [18, 28], need: 8,
      stageW: [.45, .85, .55], bstCap: 540,
      pal: { base: '#8a6a5a', alt: '#947264', tall: '#4a3628', block: 'rock' }, water: 0 }
  ];

  const ENCOUNTER_CHANCE = 0.17;   // โอกาสเจอต่อหนึ่งก้าวบนหญ้าสูง

  /* ---------------- ตัวสุ่มแบบ seed ---------------- */
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- สร้างแผนที่โซน ---------------- */
  const mapCache = new Map();

  function buildMap(zone) {
    if (mapCache.has(zone.id)) return mapCache.get(zone.id);
    let seed = 0;
    for (let i = 0; i < zone.id.length; i++) seed = (seed * 31 + zone.id.charCodeAt(i)) | 0;
    const rnd = mulberry(seed + 9001);

    const grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(FLOOR));

    // น้ำเป็นแอ่งด้านใดด้านหนึ่ง
    if (zone.water > 0) {
      const cx = rnd() < .5 ? COLS - 4 : 3, cy = rnd() < .5 ? 2 : ROWS - 3;
      const rad = 2 + zone.water * 8;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const d = Math.hypot(c - cx, (r - cy) * 1.5);
        if (d < rad + rnd() * 1.4) grid[r][c] = WATER;
      }
    }

    /* หญ้าสูงเป็นหย่อมกลม ๆ ไม่ใช่แถบยาวแนวนอน
     * เดิม rh=1 เสมอ หย่อมเลยออกมาเป็นแถวเดียวยาว ๆ ดูเหมือนแปลงผัก */
    const patches = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < patches; i++) {
      const cx = 2 + Math.floor(rnd() * (COLS - 4)), cy = 1 + Math.floor(rnd() * (ROWS - 2));
      const rw = 2 + Math.floor(rnd() * 2), rh = 1 + Math.floor(rnd() * 2);
      for (let r = cy - rh; r <= cy + rh; r++) for (let c = cx - rw; c <= cx + rw; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (grid[r][c] !== FLOOR) continue;
        // ขอบหย่อมบางลงตามระยะจากใจกลาง ได้รูปกลม ๆ แทนสี่เหลี่ยม
        const d = Math.hypot((c - cx) / (rw + .5), (r - cy) / (rh + .5));
        if (rnd() < 0.95 - d * 0.75) grid[r][c] = TALL;
      }
    }

    // ต้นไม้/หินขวางทาง
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== FLOOR) continue;
      if (rnd() < .09) grid[r][c] = BLOCK;
    }

    // จุดเริ่มต้นและรอบ ๆ ต้องโล่งเสมอ
    const spawn = { c: 1, r: ROWS - 2 };
    for (let r = spawn.r - 1; r <= spawn.r + 1; r++)
      for (let c = spawn.c - 1; c <= spawn.c + 1; c++)
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = PATH;

    // ช่องไหนเดินไปไม่ถึงก็ไม่มีประโยชน์ เปลี่ยนเป็นสิ่งกีดขวางเพื่อไม่ให้ดูเหมือนเดินได้
    const seen = reachable(grid, spawn);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === BLOCK || grid[r][c] === WATER) continue;
      if (!seen[r][c]) grid[r][c] = BLOCK;
    }

    const built = { grid, spawn, terrain: renderTerrain(zone, grid) };
    mapCache.set(zone.id, built);
    return built;
  }

  const walkable = (t) => t === FLOOR || t === TALL || t === PATH;

  function reachable(grid, from) {
    const seen = [];
    for (let r = 0; r < ROWS; r++) seen.push(new Array(COLS).fill(false));
    const q = [from];
    seen[from.r][from.c] = true;
    while (q.length) {
      const { c, r } = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        if (seen[nr][nc] || !walkable(grid[nr][nc])) continue;
        seen[nr][nc] = true;
        q.push({ c: nc, r: nr });
      }
    }
    return seen;
  }

  // หาเส้นทางสั้นสุดด้วย BFS เพื่อให้คลิกเดินได้
  function findPath(grid, from, to) {
    if (!walkable(grid[to.r][to.c])) return null;
    const prev = [];
    for (let r = 0; r < ROWS; r++) prev.push(new Array(COLS).fill(null));
    const q = [from];
    prev[from.r][from.c] = from;
    while (q.length) {
      const cur = q.shift();
      if (cur.c === to.c && cur.r === to.r) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        if (prev[nr][nc] || !walkable(grid[nr][nc])) continue;
        prev[nr][nc] = cur;
        q.push({ c: nc, r: nr });
      }
    }
    if (!prev[to.r][to.c]) return null;
    const path = [];
    let cur = to;
    while (cur.c !== from.c || cur.r !== from.r) { path.unshift(cur); cur = prev[cur.r][cur.c]; }
    return path;
  }

  /* ---------------- วาดฉากลงแคนวาสสำรอง ---------------- */
  /* ---------------- ไทล์แบบพิกเซลอาร์ต สไตล์ Pokémon FireRed ----------------
   * เดิมวาดหญ้าด้วยเส้นขีดสุ่ม ๆ ซึ่งดูเป็นรอยขูดมากกว่าหญ้า
   * ของจริงในเกม GBA เป็นไทล์ 16x16 พิกเซลชัด ๆ มีสามโทน (เข้ม/กลาง/สว่าง)
   * ที่นี่จึงวาดลงผืน 16x16 ก่อนแล้วค่อยขยาย 3 เท่าแบบไม่เกลี่ยขอบ
   * ได้ขอบพิกเซลคมเหมือนต้นฉบับ และเข้ากับสไปรท์ BW ที่ใช้อยู่ */
  const PXW = 16;                       // ความละเอียดตรรกะของหนึ่งไทล์
  const SCALE = TILE / PXW;             // 48 / 16 = 3

  // แผ่นวาดขนาด 16x16 ใช้ซ้ำ แล้ว blit ขยายลงผืนจริง
  function pxTile(draw) {
    const cv = document.createElement('canvas');
    cv.width = PXW; cv.height = PXW;
    const g = cv.getContext('2d');
    draw(g, (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
    return cv;
  }

  // ไล่เฉดสี: ใช้สีฐานของโซนแล้วปรับความสว่างเอา จะได้ทุกโซนมีสามโทนเข้าชุดกัน
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* หญ้าสูง — ใจกลางของหน้าตาแบบ FireRed
   * กอหญ้าเป็นใบแหลมปลายมน เรียงติดกันจนเต็มไทล์ ต่อกันได้ไม่เห็นรอยต่อ
   * ใบวางที่ตำแหน่ง x คงที่ (ไม่สุ่ม) ไทล์ที่ติดกันจึงเรียงเป็นผืนเดียว */
  function tallGrassTile(pal) {
    const out  = shade(pal.tall, .6),
          dark = shade(pal.tall, .8),
          mid  = pal.tall,
          lite = shade(pal.tall, 1.3),
          tip  = shade(pal.tall, 1.58);
    // ใบหญ้า [x, สูง] เรียงถี่จนต่อกันเป็นผืน ปลายลดหลั่นไม่เท่ากัน
    // [x, สูง, โคนอยู่แถวไหน] — โคนไม่เท่ากันด้วย ฐานกอจะได้ไม่เป็นเส้นตรงเป๊ะ
    const blades = [[0, 8, 15], [3, 11, 14], [6, 6, 15], [8, 10, 14], [11, 7, 15], [13, 9, 14]];
    return pxTile((g, px) => {
      for (const [bx, bh, bottom] of blades) {
        for (let i = 0; i < bh; i++) {
          const y = bottom - i;
          const f = i / (bh - 1);                     // 0 ที่โคน, 1 ที่ปลาย
          const w = f > .72 ? 1 : (f > .38 ? 2 : 3);  // เรียวขึ้นไปหาปลายจริง ๆ
          px(bx, y, w, 1, mid);
          px(bx, y, 1, 1, lite);                      // ไฮไลต์ขอบซ้าย
          if (w > 1) px(bx + w - 1, y, 1, 1, dark);   // เงาขอบขวา
          if (f > .8) px(bx, y, 1, 1, tip);           // ปลายใบสว่าง
        }
      }
      // เงาที่โคนเฉพาะใต้ใบ ไม่ลากเป็นคานเต็มความกว้าง (เดิมดูเหมือนรั้ว)
      for (const [bx, , bottom] of blades) {
        px(bx, bottom, 3, 1, dark);
        if (bottom < 15) px(bx + 1, bottom + 1, 2, 1, out);
      }
    });
  }

  /* พื้นหญ้าเตี้ย — เรียบ ๆ มีจุดประให้ไม่แบนจนเกินไป */
  function groundTile(pal, alt) {
    // สลับเฉดกันนิดเดียวพอให้มีผิว ถ้าต่างมากจะเห็นเป็นกระดานหมากรุก
    const base = alt ? shade(pal.base, 1.035) : pal.base;
    const dk = shade(base, .93), lt = shade(base, 1.06);
    return pxTile((g, px) => {
      px(0, 0, 16, 16, base);
      // ลายประจุดคงที่ ไม่สุ่ม ทุกไทล์เลยเหมือนกันและต่อกันเนียน
      const dots = [[2, 3], [9, 1], [13, 6], [5, 8], [11, 11], [1, 13], [7, 14]];
      for (const [x, y] of dots) { px(x, y, 2, 1, dk); px(x, y + 1, 1, 1, lt); }
    });
  }

  /* ทางเดินดิน */
  function pathTile() {
    return pxTile((g, px) => {
      px(0, 0, 16, 16, '#d8c088');
      const dots = [[3, 2], [10, 5], [6, 9], [13, 12], [1, 7]];
      for (const [x, y] of dots) px(x, y, 2, 2, '#c4a870');
    });
  }

  /* น้ำ — มีคลื่นขาวสองแถวแบบไทล์น้ำใน GBA */
  function waterTile(frame) {
    const o = frame ? 4 : 0;
    return pxTile((g, px) => {
      px(0, 0, 16, 16, '#4878c8');
      px(0, 0, 16, 8, '#5888d8');
      px((2 + o) % 16, 3, 5, 1, '#a8d0f8');
      px((9 + o) % 16, 7, 4, 1, '#a8d0f8');
      px((5 + o) % 16, 11, 5, 1, '#88b8e8');
      px((12 + o) % 16, 14, 3, 1, '#88b8e8');
    });
  }

  function renderTerrain(zone, grid) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;      // ต้องคมเป็นพิกเซล ห้ามเกลี่ยขอบ
    const P = zone.pal;

    // สร้างไทล์ครั้งเดียวต่อโซน แล้ววางซ้ำ เร็วกว่าวาดทีละช่อง
    const T = {
      ground: [groundTile(P, false), groundTile(P, true)],
      tall: tallGrassTile(P),
      path: pathTile(),
      water: waterTile(0)
    };
    const put = (tile, c, r) => g.drawImage(tile, 0, 0, PXW, PXW, c * TILE, r * TILE, TILE, TILE);

    let seed = 4242;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      put(T.ground[(r + c) % 2], c, r);
      if (t === WATER) put(T.water, c, r);
      else if (t === TALL) put(T.tall, c, r);
      else if (t === PATH) put(T.path, c, r);
      else if (t === BLOCK) drawBlock(g, P, c, r, rnd);
    }
    return cv;
  }

  /* ต้นไม้กับก้อนหินวาดเป็นพิกเซลอาร์ตเหมือนกัน จะได้เข้าชุดกับพื้น */
  function drawBlock(g, P, c, r, rnd) {
    const x = c * TILE, y = r * TILE;
    const S = SCALE;
    const px = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a * S, y + b * S, w * S, h * S); };
    if (P.block === 'tree') {
      px(3, 13, 10, 2, 'rgba(0,0,0,.24)');            // เงา
      px(7, 10, 2, 4, '#6b4423');                      // ลำต้น
      px(7, 10, 1, 4, '#8a5a2e');
      const cz = [[3, 3, 10, 7], [2, 5, 12, 4], [4, 2, 8, 2]];
      for (const [a, b, w, h] of cz) px(a, b, w, h, '#2f7a35');
      px(4, 3, 7, 2, '#3f9243');                       // ไฮไลต์บน
      px(4, 2, 4, 1, '#55a855');
      px(3, 8, 10, 2, '#245f2a');                      // เงาใต้พุ่ม
    } else {
      px(3, 13, 10, 2, 'rgba(0,0,0,.24)');
      px(3, 8, 10, 6, '#8f8f9a');
      px(4, 5, 8, 3, '#9d9da8');
      px(5, 3, 6, 2, '#a8a8b4');
      px(5, 3, 3, 1, '#c0c0cc');                       // ไฮไลต์
      px(4, 6, 2, 2, '#b4b4c0');
      px(3, 12, 10, 2, '#6e6e78');                     // ฐานเข้ม
    }
  }

  /* ---------------- ตัวผู้เล่น ---------------- */
  // วาดเองด้วยโค้ด (ไม่มีสไปรท์เทรนเนอร์ในคลังที่ใช้อยู่)
  function drawTrainer(g, x, y, dir, step) {
    const bob = Math.sin(step * 8) * 1.5;
    g.save();
    g.translate(x, y + bob);
    g.globalAlpha = .28;
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(0, 15, 11, 4, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;

    const swing = Math.sin(step * 8) * 3;
    // ขา
    g.fillStyle = '#2f3a52';
    g.fillRect(-6, 6 + (dir === 0 ? swing : 0), 5, 10);
    g.fillRect(1, 6 - (dir === 0 ? swing : 0), 5, 10);
    // ตัว
    g.fillStyle = '#d94f4f';
    g.beginPath(); g.roundRect(-8, -6, 16, 14, 4); g.fill();
    g.fillStyle = '#eceff5';
    g.fillRect(-3, -6, 6, 14);
    // แขน
    g.fillStyle = '#d94f4f';
    g.fillRect(-11, -4 + swing, 4, 9);
    g.fillRect(7, -4 - swing, 4, 9);
    // หัว
    g.fillStyle = '#f0c8a0';
    g.beginPath(); g.arc(0, -13, 8, 0, TAU); g.fill();
    // ผม/หมวก
    g.fillStyle = '#d94f4f';
    g.beginPath(); g.arc(0, -14, 8.3, Math.PI, 0); g.fill();
    g.fillStyle = '#eceff5';
    if (dir === 0) g.fillRect(-9, -15, 18, 3);          // หันลง: ปีกหมวกไปข้างหน้า
    else if (dir === 1) g.fillRect(2, -15, 10, 3);
    else if (dir === 3) g.fillRect(-12, -15, 10, 3);
    // หน้า
    if (dir !== 2) {
      g.fillStyle = '#2a2320';
      const ex = dir === 1 ? 2 : (dir === 3 ? -2 : 0);
      g.fillRect(ex - 3.5, -14, 2, 2.5);
      g.fillRect(ex + 1.5, -14, 2, 2.5);
    }
    g.restore();
  }

  /* ---------------- สถานะโซน ---------------- */
  const S = {
    zone: null, map: null,
    px: 0, py: 0, tc: 0, tr: 0,       // ตำแหน่งพิกเซลและช่อง
    dir: 0, moving: false, stepAcc: 0,
    target: null, path: null,
    encounter: null,                  // { id, lv, angry, eating, turns }
    msg: '', msgT: 0,
    onEncounter: null, onExit: null,
    keys: {}
  };

  const MOVE_SPEED = 150;   // พิกเซลต่อวินาที

  function zoneById(id) { return ZONES.find(z => z.id === id); }

  function poolOf(zone) {
    const ids = PTD.DEX.filter(d => !d.lg && zone.hb.includes(d.hb)).map(d => d.id);
    return ids.length ? ids : PTD.DEX.filter(d => !d.lg).map(d => d.id);
  }

  /* สายพันธุ์ที่ "เจอได้จริง" ในโซนนี้ — โอกาสเจออย่างน้อย MIN_SHOW ของทั้งหมด
   *
   * ตารางน้ำหนักมีหางยาวมาก ทุ่งหญ้าต้นทางระบุไว้ 35 สายพันธุ์ แต่ 12 ตัว
   * โอกาสเจอต่ำกว่า 0.1% (ร่างสุดท้ายอย่าง Nidoqueen/Vileplume ที่ควรได้จาก
   * การวิวัฒนาการ ไม่ใช่จากหญ้า) จำลองแล้วกว่าจะเห็นครบ 30 ตัวต้องเจอตัวป่า
   * 11,447 ครั้ง ตัวนับ "จับแล้ว x/35" จึงเป็นเป้าที่ไปไม่ถึงตลอดกาล
   * นับเฉพาะตัวที่เจอได้จริงแทน ส่วนที่เหลือบอกแยกว่าได้จากการวิวัฒนาการ */
  const MIN_SHOW = 0.01;
  const reachCache = new Map();
  function reachableIn(zone) {
    if (reachCache.has(zone.id)) return reachCache.get(zone.id);
    const t = weightsOf(zone);
    const ids = t.pool.filter((id, i) => t.w[i] / t.total >= MIN_SHOW);
    const out = ids.length ? ids : t.pool.slice();
    reachCache.set(zone.id, out);
    return out;
  }

  // ขั้นวิวัฒนาการ: 0 = ร่างแรก, 1 = ร่างกลาง, 2 = ร่างสุดท้าย
  const stageCache = new Map();
  function evoStage(id) {
    if (stageCache.has(id)) return stageCache.get(id);
    let n = 0, d = PTD.dex(id);
    while (d && d.from) { n++; d = PTD.dex(d.from); }
    stageCache.set(id, n);
    return n;
  }

  // น้ำหนักการเจอของแต่ละตัวในโซนนั้น
  function encounterWeight(zone, id) {
    const d = PTD.dex(id);
    if (!d) return 0;
    const sw = (zone.stageW || [1, 1, 1])[Math.min(2, evoStage(id))];
    if (sw <= 0) return 0;
    // ตัวที่พลังรวมเกินเพดานของโซนจะเจอยากขึ้นแบบทวีคูณ
    const over = Math.max(0, d.bst - (zone.bstCap || 999));
    const bstW = Math.pow(0.30, over / 60);
    // ตัวที่จับยากอยู่แล้วก็ควรเจอน้อยลงด้วย ไม่ใช่เจอบ่อยแต่จับไม่ได้
    const rareW = 0.35 + 0.65 * Math.min(1, d.cr / 120);
    return sw * bstW * rareW;
  }

  // ตารางน้ำหนักของโซน คำนวณครั้งเดียวแล้วเก็บไว้
  const weightCache = new Map();
  function weightsOf(zone) {
    if (weightCache.has(zone.id)) return weightCache.get(zone.id);
    const pool = poolOf(zone);
    const w = pool.map(id => encounterWeight(zone, id));
    const total = w.reduce((a, b) => a + b, 0);
    const table = { pool, w, total: total > 0 ? total : 1 };
    weightCache.set(zone.id, table);
    return table;
  }

  function rollWild(zone) {
    const t = weightsOf(zone);
    let r = Math.random() * t.total;
    for (let i = 0; i < t.pool.length; i++) {
      r -= t.w[i];
      if (r <= 0) return t.pool[i];
    }
    return t.pool[0];
  }

  function enter(zoneId) {
    const zone = zoneById(zoneId);
    if (!zone) return false;
    S.zone = zone;
    S.map = buildMap(zone);
    S.tc = S.map.spawn.c; S.tr = S.map.spawn.r;
    S.px = S.tc * TILE + TILE / 2;
    S.py = S.tr * TILE + TILE / 2;
    S.dir = 0; S.moving = false; S.path = null; S.target = null;
    S.encounter = null;
    S.pool = poolOf(zone);
    say(`เข้าสู่${zone.name} — เดินบนหญ้าสูงเพื่อหาโปเกม่อน`);
    return true;
  }

  function say(text) { S.msg = text; S.msgT = 3.4; }

  /* ---------------- การเดิน ---------------- */
  function tryStep(dc, dr) {
    const nc = S.tc + dc, nr = S.tr + dr;
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return false;
    if (!walkable(S.map.grid[nr][nc])) return false;
    S.tc = nc; S.tr = nr;
    S.moving = true;
    return true;
  }

  function onArrive() {
    // เหยียบหญ้าสูงแล้วมีสิทธิ์เจอโปเกม่อน
    if (S.map.grid[S.tr][S.tc] === TALL && Math.random() < ENCOUNTER_CHANCE) {
      startEncounter();
    }
  }

  function startEncounter() {
    const zone = S.zone;
    const id = rollWild(zone);
    const lv = zone.lv[0] + Math.floor(Math.random() * (zone.lv[1] - zone.lv[0] + 1));
    S.encounter = { id, lv, angry: 0, eating: 0, turns: 0 };
    S.path = null; S.target = null;
    PTD.save.markSeen(id);
    PTD.sfx.waveStart();
    if (S.onEncounter) S.onEncounter(S.encounter);
  }

  /* ---------------- มินิเกมจับ ---------------- */
  // โอกาสจับมาจาก capture_rate จริง (3 = Mewtwo ยากสุด, 255 = Caterpie ง่ายสุด)
  function catchChance(enc) {
    const d = PTD.dex(enc.id);
    let base = Math.pow(d.cr / 255, 0.62) * 0.80;
    if (enc.angry) base *= 1 + 0.35 * Math.min(enc.angry, 3);
    if (enc.eating) base *= 1 - 0.22 * Math.min(enc.eating, 3);
    // ตัวเลเวลสูงจับยากขึ้นนิดหน่อย
    base *= 1 - Math.min(0.3, enc.lv * 0.008);
    return Math.max(0.03, Math.min(0.93, base));
  }

  function fleeChance(enc) {
    const d = PTD.dex(enc.id);
    let base = 0.07 + (1 - d.cr / 255) * 0.20;
    if (enc.angry) base *= 1 + 0.5 * Math.min(enc.angry, 3);
    if (enc.eating) base *= 1 - 0.3 * Math.min(enc.eating, 3);
    return Math.max(0.02, Math.min(0.5, base));
  }

  // คืนผลลัพธ์ให้ UI เอาไปแสดง: {result, text}
  function act(kind) {
    const enc = S.encounter;
    if (!enc) return null;
    enc.turns++;
    const d = PTD.dex(enc.id);

    if (kind === 'ball') {
      if (!PTD.save.useBall()) return { result: 'noball', text: 'ลูกบอลหมดแล้ว!' };
      const p = catchChance(enc);
      if (Math.random() < p) {
        PTD.save.addMon(enc.id, enc.lv);
        PTD.sfx.evolve();
        S.encounter = null;
        return { result: 'caught', text: `จับ ${d.n} ได้แล้ว!`, id: enc.id, lv: enc.lv };
      }
      PTD.sfx.deny();
      // พลาดแล้วมีสิทธิ์หนี
      if (Math.random() < fleeChance(enc)) {
        S.encounter = null;
        return { result: 'fled', text: `${d.n} หนีไปแล้ว…` };
      }
      return { result: 'miss', text: `${d.n} ดิ้นหลุดออกมา!` };
    }

    if (kind === 'bait') {
      enc.eating = Math.min(3, enc.eating + 1);
      enc.angry = 0;
      PTD.sfx.place();
      if (Math.random() < fleeChance(enc)) {
        S.encounter = null;
        return { result: 'fled', text: `${d.n} กินเสร็จแล้วหนีไป…` };
      }
      return { result: 'bait', text: `${d.n} กำลังกินเหยื่อ — หนียากขึ้นแต่จับยากขึ้นด้วย` };
    }

    if (kind === 'rock') {
      enc.angry = Math.min(3, enc.angry + 1);
      enc.eating = 0;
      PTD.sfx.thud();
      if (Math.random() < fleeChance(enc)) {
        S.encounter = null;
        return { result: 'fled', text: `${d.n} โกรธแล้ววิ่งหนีไป!` };
      }
      return { result: 'rock', text: `${d.n} โกรธมาก — จับง่ายขึ้นแต่ก็หนีง่ายขึ้น` };
    }

    S.encounter = null;
    return { result: 'run', text: 'หนีออกมาแล้ว' };
  }

  /* ---------------- อัปเดต ---------------- */
  function update(dt) {
    if (S.msgT > 0) S.msgT -= dt;
    if (S.encounter) return;      // ระหว่างเจอตัว ไม่ต้องขยับ

    const cx = S.tc * TILE + TILE / 2, cy = S.tr * TILE + TILE / 2;
    const dx = cx - S.px, dy = cy - S.py;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const step = Math.min(dist, MOVE_SPEED * dt);
      S.px += dx / dist * step;
      S.py += dy / dist * step;
      S.stepAcc += dt;
      return;
    }
    S.px = cx; S.py = cy;
    if (S.moving) { S.moving = false; onArrive(); if (S.encounter) return; }

    // เดินตามเส้นทางที่คลิกไว้
    if (S.path && S.path.length) {
      const next = S.path.shift();
      S.dir = next.c > S.tc ? 1 : next.c < S.tc ? 3 : next.r > S.tr ? 0 : 2;
      tryStep(next.c - S.tc, next.r - S.tr);
      return;
    }
    S.path = null;

    // ปุ่มทิศทางบนจอ (กดค้างได้ และแตะสั้น ๆ ที่ค้างคิวไว้ก็เดินให้หนึ่งช่อง)
    const pv = S.padVec || S.padOnce;
    if (pv) {
      S.padOnce = null;
      S.padUsed = true;
      S.dir = pv.face;
      S.stepAcc += dt;
      tryStep(pv.dc, pv.dr);
      return;
    }

    // ปุ่มลูกศร / WASD
    const k = S.keys;
    let dc = 0, dr = 0;
    if (k.left) { dc = -1; S.dir = 3; }
    else if (k.right) { dc = 1; S.dir = 1; }
    else if (k.up) { dr = -1; S.dir = 2; }
    else if (k.down) { dr = 1; S.dir = 0; }
    if (dc || dr) { S.stepAcc += dt; tryStep(dc, dr); }
  }

  /* ---------------- ปุ่มทิศทางบนจอ ----------------
   * เดิมมีแต่ลูกศรกับการแตะช่อง ซึ่งบนแท็บเล็ตไม่มีอะไรบอกว่าทำได้
   * และในหน้าที่ฝังใน iframe คีย์บอร์ดก็ไม่ทำงานจนกว่าจะคลิกในกรอบก่อน */
  const PAD = { x: W - 92, y: H - 96, r: 30, gap: 34 };
  function padButtons() {
    const { x, y, gap } = PAD;
    return [
      { dir: 'up',    cx: x,       cy: y - gap, dc: 0,  dr: -1, face: 2 },
      { dir: 'down',  cx: x,       cy: y + gap, dc: 0,  dr: 1,  face: 0 },
      { dir: 'left',  cx: x - gap, cy: y,       dc: -1, dr: 0,  face: 3 },
      { dir: 'right', cx: x + gap, cy: y,       dc: 1,  dr: 0,  face: 1 }
    ];
  }

  function drawPad(ctx) {
    ctx.save();
    // แผ่นรองใต้ปุ่ม
    ctx.globalAlpha = .28;
    ctx.fillStyle = '#0b1018';
    ctx.beginPath();
    ctx.roundRect(PAD.x - 68, PAD.y - 68, 136, 136, 24);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (const b of padButtons()) {
      const held = S.padHeld === b.dir;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, PAD.r, 0, TAU);
      ctx.fillStyle = held ? 'rgba(214,59,47,.92)' : 'rgba(20,28,40,.82)';
      ctx.fill();
      ctx.strokeStyle = held ? '#ffd9a0' : 'rgba(236,239,241,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // หัวลูกศร
      ctx.fillStyle = '#eceff1';
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(b.dir === 'up' ? -Math.PI / 2 : b.dir === 'down' ? Math.PI / 2
               : b.dir === 'left' ? Math.PI : 0);
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(8, 0); ctx.lineTo(-6, 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // คืนปุ่มที่ถูกแตะ ถ้าแตะโดน
  function padHit(x, y) {
    for (const b of padButtons()) {
      if (Math.hypot(x - b.cx, y - b.cy) <= PAD.r + 4) return b;
    }
    return null;
  }

  /* ---------------- วาด ---------------- */
  function draw(ctx, t) {
    if (!S.map) return;
    ctx.drawImage(S.map.terrain, 0, 0);

    // เน้นช่องเป้าหมายที่คลิกไว้
    if (S.path && S.path.length) {
      const last = S.path[S.path.length - 1];
      ctx.save();
      ctx.globalAlpha = .35 + .2 * Math.sin(t * 6);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.strokeRect(last.c * TILE + 4, last.r * TILE + 4, TILE - 8, TILE - 8);
      ctx.restore();
    }

    drawTrainer(ctx, S.px, S.py, S.dir, S.stepAcc);
    drawPad(ctx);

    // แถบข้อมูลด้านบน
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,22,.78)';
    ctx.fillRect(0, 0, W, 34);
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffe37a';
    ctx.textBaseline = 'middle';
    ctx.fillText(S.zone.name, 14, 17);
    ctx.fillStyle = '#e8edf7';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`ลูกบอล ${PTD.save.balls}`, 180, 17);
    ctx.fillText(`เลเวลที่เจอ ${S.zone.lv[0]}–${S.zone.lv[1]}`, 280, 17);
    ctx.fillStyle = '#93a0bd';
    ctx.textAlign = 'right';
    ctx.fillText(PTD.ui && PTD.ui.TOUCH
      ? 'กดปุ่มทิศทางมุมล่างขวา หรือแตะช่องที่อยากไป'
      : 'ปุ่มทิศทางมุมล่างขวา · ลูกศร/WASD · คลิกช่องที่อยากไป · Esc ออก', W - 14, 17);
    ctx.restore();

    if (S.msgT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.msgT);
      ctx.fillStyle = 'rgba(10,14,22,.8)';
      const tw = ctx.measureText(S.msg).width;
      ctx.fillRect(W / 2 - tw / 2 - 16, 44, tw + 32, 30);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#e8edf7';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.msg, W / 2, 59);
      ctx.restore();
    }
  }

  /* ---------------- อินพุต ---------------- */
  function keyDown(key) {
    if (S.encounter) return;
    const k = S.keys;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') k.left = true;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') k.right = true;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') k.up = true;
    if (key === 'ArrowDown' || key === 's' || key === 'S') k.down = true;
    if (k.left || k.right || k.up || k.down) S.path = null;
  }
  function keyUp(key) {
    const k = S.keys;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') k.left = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') k.right = false;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') k.up = false;
    if (key === 'ArrowDown' || key === 's' || key === 'S') k.down = false;
  }
  function clearKeys() { S.keys = {}; S.padHeld = null; S.padVec = null; S.padOnce = null; }

  // กดค้างที่ปุ่มทิศทาง
  function press(x, y) {
    if (S.encounter || !S.map) return false;
    const b = padHit(x, y);
    if (!b) return false;
    S.padHeld = b.dir;
    S.padVec = { dc: b.dc, dr: b.dr, face: b.face };
    S.padOnce = null;
    S.padUsed = false;
    S.path = null;
    S.dir = b.face;
    // ยืนนิ่งอยู่ก็ขยับทันที ไม่ต้องรอเฟรมถัดไป
    if (!S.moving) { S.padUsed = true; tryStep(b.dc, b.dr); }
    return true;
  }
  function release() {
    // ปล่อยนิ้วก่อนที่ปุ่มจะได้ทำงานสักครั้ง (แตะเร็ว ๆ หรือกดตอนกำลังก้าวอยู่)
    // ให้ค้างคิวไว้หนึ่งก้าว จะได้ไม่มีอาการ "กดแล้วไม่ไปไหน"
    if (S.padVec && !S.padUsed) S.padOnce = S.padVec;
    S.padHeld = null; S.padVec = null;
  }

  function click(x, y) {
    if (S.encounter || !S.map) return;
    if (padHit(x, y)) return;          // แตะโดนปุ่มทิศทาง ไม่ใช่การสั่งเดินไปช่องนั้น
    S.padOnce = null;
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    if (!walkable(S.map.grid[r][c])) { say('ตรงนั้นเดินไปไม่ได้'); return; }
    const p = findPath(S.map.grid, { c: S.tc, r: S.tr }, { c, r });
    if (!p) { say('หาทางไปตรงนั้นไม่เจอ'); return; }
    S.path = p;
  }

  /* ---------------- โซนที่ปลดล็อกแล้ว ---------------- */
  function unlockedZones() {
    const cleared = PTD.save.data.cleared.length;
    return ZONES.map(z => ({ zone: z, unlocked: cleared >= z.need }));
  }

  PTD.safari = {
    ZONES, W, H, TILE,
    enter, update, draw, act, click, press, release, keyDown, keyUp, clearKeys, say,
    unlockedZones, zoneById, poolOf, rollWild, encounterWeight, evoStage, weightsOf,
    catchChance, fleeChance, padButtons, reachableIn,
    get state() { return S; },
    get encounter() { return S.encounter; },
    set onEncounter(fn) { S.onEncounter = fn; }
  };
})(window.PTD = window.PTD || {});
