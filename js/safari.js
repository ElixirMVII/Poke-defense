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
    { id: 'route',    name: 'ทุ่งหญ้าต้นทาง', hb: [3],    lv: [3, 8],   need: 0,
      pal: { base: '#6fb552', alt: '#78bd5a', tall: '#2f6b28', block: 'tree' }, water: 0 },
    { id: 'forest',   name: 'ป่าลึก',        hb: [2],    lv: [6, 13],  need: 1,
      pal: { base: '#4e8f46', alt: '#579a4c', tall: '#1f4d22', block: 'tree' }, water: 0 },
    { id: 'town',     name: 'ชานเมืองเก่า',  hb: [8],    lv: [9, 17],  need: 2,
      pal: { base: '#9a9a86', alt: '#a4a48e', tall: '#4a6238', block: 'rock' }, water: 0 },
    { id: 'lake',     name: 'ริมทะเลสาบ',    hb: [9, 7], lv: [12, 21], need: 3,
      pal: { base: '#6fb552', alt: '#78bd5a', tall: '#2f6b28', block: 'tree' }, water: .30 },
    { id: 'cave',     name: 'ถ้ำมืด',        hb: [1, 6], lv: [15, 25], need: 4,
      pal: { base: '#5a5464', alt: '#645d70', tall: '#2a323a', block: 'rock' }, water: .08 },
    { id: 'mountain', name: 'ภูเขาไฟ',       hb: [4],    lv: [19, 30], need: 5,
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

    // หญ้าสูงเป็นหย่อม ๆ
    const patches = 7 + Math.floor(rnd() * 4);
    for (let i = 0; i < patches; i++) {
      const cx = 1 + Math.floor(rnd() * (COLS - 2)), cy = 1 + Math.floor(rnd() * (ROWS - 2));
      const rw = 1 + Math.floor(rnd() * 3), rh = 1 + Math.floor(rnd() * 2);
      for (let r = cy - rh; r <= cy + rh; r++) for (let c = cx - rw; c <= cx + rw; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (grid[r][c] !== FLOOR) continue;
        if (rnd() < .78) grid[r][c] = TALL;
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
  function renderTerrain(zone, grid) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const P = zone.pal;
    let seed = 4242;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE, t = grid[r][c];
      g.fillStyle = (r + c) % 2 ? P.base : P.alt;
      g.fillRect(x, y, TILE, TILE);

      if (t === WATER) {
        g.fillStyle = '#3a78b8';
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,.14)';
        for (let i = 0; i < 3; i++) g.fillRect(x + 4 + rnd() * 30, y + 8 + i * 13, 12, 2);
      } else if (t === TALL) {
        g.fillStyle = P.tall;
        g.fillRect(x, y, TILE, TILE);
        // ขอบเข้มรอบช่อง ทำให้แยกออกจากพื้นหญ้าธรรมดาชัดเจน
        g.strokeStyle = 'rgba(0,0,0,.22)';
        g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        g.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
          const bx = x + 4 + rnd() * (TILE - 8), by = y + TILE - 2;
          const h = 12 + rnd() * 12;
          g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (rnd() - .5) * 9, by - h); g.stroke();
          g.strokeStyle = 'rgba(190,255,150,.34)'; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (rnd() - .5) * 9, by - h); g.stroke();
        }
      } else if (t === PATH) {
        g.fillStyle = '#c9ab7c';
        g.fillRect(x, y, TILE, TILE);
      } else if (t === BLOCK) {
        if (P.block === 'tree') {
          g.fillStyle = 'rgba(0,0,0,.22)';
          g.beginPath(); g.ellipse(x + 24, y + 40, 14, 5, 0, 0, TAU); g.fill();
          g.fillStyle = '#7a5230'; g.fillRect(x + 21, y + 26, 6, 14);
          const leaf = ['#2f7a35', '#357f38', '#2a6f30'];
          for (let i = 0; i < 3; i++) {
            g.fillStyle = leaf[i];
            g.beginPath(); g.arc(x + 24 + (i - 1) * 8, y + 22 - i * 5 + (i === 1 ? 0 : 3), 12 - i * 1.5, 0, TAU); g.fill();
          }
        } else {
          g.fillStyle = 'rgba(0,0,0,.22)';
          g.beginPath(); g.ellipse(x + 24, y + 38, 15, 5, 0, 0, TAU); g.fill();
          g.fillStyle = '#8f8f9a';
          g.beginPath();
          g.moveTo(x + 8, y + 38); g.lineTo(x + 13, y + 16); g.lineTo(x + 28, y + 11);
          g.lineTo(x + 40, y + 24); g.lineTo(x + 36, y + 38);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,.2)';
          g.beginPath(); g.moveTo(x + 15, y + 20); g.lineTo(x + 27, y + 15); g.lineTo(x + 20, y + 28); g.closePath(); g.fill();
        }
      }
    }
    return cv;
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
    const id = S.pool[Math.floor(Math.random() * S.pool.length)];
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

    // ปุ่มลูกศร / WASD
    const k = S.keys;
    let dc = 0, dr = 0;
    if (k.left) { dc = -1; S.dir = 3; }
    else if (k.right) { dc = 1; S.dir = 1; }
    else if (k.up) { dr = -1; S.dir = 2; }
    else if (k.down) { dr = 1; S.dir = 0; }
    if (dc || dr) { S.stepAcc += dt; tryStep(dc, dr); }
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
      ? 'แตะช่องที่อยากไป'
      : 'ลูกศร/WASD เดิน · คลิกเพื่อเดินไปจุดนั้น · Esc ออก', W - 14, 17);
    ctx.restore();

    if (S.msgT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.msgT);
      ctx.fillStyle = 'rgba(10,14,22,.8)';
      const tw = ctx.measureText(S.msg).width;
      ctx.fillRect(W / 2 - tw / 2 - 16, H - 52, tw + 32, 30);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#e8edf7';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.msg, W / 2, H - 37);
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
  function clearKeys() { S.keys = {}; }

  function click(x, y) {
    if (S.encounter || !S.map) return;
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
    enter, update, draw, act, click, keyDown, keyUp, clearKeys, say,
    unlockedZones, zoneById, poolOf,
    catchChance, fleeChance,
    get state() { return S; },
    get encounter() { return S.encounter; },
    set onEncounter(fn) { S.onEncounter = fn; }
  };
})(window.PTD = window.PTD || {});
