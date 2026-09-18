/* จำลองการเล่นแบบผู้เล่นทั่วไป เพื่อดูว่าความยากพอดีไหม (ไม่วาดภาพ เดินลูปตรง ๆ) */
const { chromium } = require('playwright');
const path = require('path');

const STRATEGY = process.argv[2] || 'mixed';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(400);

  const result = await page.evaluate((STRATEGY) => {
    const PTD = window.PTD, G = PTD.G, M = PTD.map;
    G.reset();
    G.paused = true;              // หยุด rAF ไม่ให้เดินซ้ำ แล้วเราเดินเอง
    PTD.audio.toggle();           // ปิดเสียง

    // จุดวางที่ดี: ช่องที่ติดกับทางเดิน เรียงตามระยะจากจุดเข้า
    const spots = [];
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      if (!M.buildable(c, r)) continue;
      let near = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < M.ROWS && cc >= 0 && cc < M.COLS && M.blocked[rr][cc] === 1) near++;
      }
      if (near) spots.push({ c, r, near });
    }
    spots.sort((a, b) => b.near - a.near);

    const ORDERS = {
      mixed:   ['bulbasaur','charmander','squirtle','pikachu','geodude','gastly','machop','abra','magnemite','dratini'],
      cheap:   ['geodude','bulbasaur','squirtle','magnemite'],
      fire:    ['charmander','charmander','charmander','charmander'],
      balanced:['bulbasaur','geodude','charmander','squirtle','pikachu','gastly','machop','abra']
    };
    const order = ORDERS[STRATEGY] || ORDERS.mixed;

    let si = 0, oi = 0;
    function think() {
      // 1) วิวัฒนาการมาก่อนเสมอ — เป็นแหล่งพลังหลัก
      for (const t of G.towers) {
        if (t.canEvolve && G.money >= t.def.evolveCost) {
          G.selected = t; G.evolveSelected(); G.selected = null;
          return;
        }
      }
      // 2) ยังมีช่องว่าง -> ซื้อตัวใหม่
      if (si < spots.length && G.towers.length < G.teamCap) {
        const id = order[oi % order.length];
        const def = PTD.TOWERS[id];
        if (G.money >= def.cost) {
          const s2 = spots[si];
          G.placing = id;
          if (G.tryPlace(s2.c, s2.r)) { si++; oi++; }
          G.placing = null;
          return;
        }
      }
      // 3) ทีมเต็ม -> ขยายช่องถ้าเงินเหลือเยอะ
      if (G.towers.length >= G.teamCap && G.extraSlots < G.EXTRA_SLOTS
          && G.money >= G.slotCost() * 2.2) {
        G.buySlot();
        return;
      }
      // 4) เงินเหลือ -> ป้อนลูกอมให้ตัวที่เลเวลต่ำสุดก่อน
      const cands = G.towers.filter(t => t.level < 20).sort((a, b) => a.level - b.level);
      if (cands.length) {
        const t = cands[0], cost = G.candyCost(t);
        if (G.money >= cost * 2.5) { G.selected = t; G.buyCandy(); G.selected = null; }
      }
    }

    const dt = 1 / 30;
    const log = [];
    let steps = 0, thinkT = 0, lastWave = -1;
    const MAX = 30 * 60 * 45;   // จำลองได้สูงสุด 45 นาทีในเกม

    // ผู้เล่นจริงจะวางป้อมก่อนกดเริ่มเวฟ
    think(); think(); think();
    G.startWave();
    while (G.state !== 'won' && G.state !== 'lost' && steps < MAX) {
      G.update(dt);
      steps++;
      thinkT += dt;
      if (thinkT >= 0.5) { thinkT = 0; think(); }
      if (G.state === 'break' && G.breakLeft < 8.5) G.startWave();   // เรียกเวฟไว ๆ
      if (G.waveIndex !== lastWave) {
        lastWave = G.waveIndex;
        log.push({ wave: G.waveIndex + 1, lives: G.lives, money: G.money,
                   towers: G.towers.length,
                   maxLv: G.towers.reduce((m, t) => Math.max(m, t.level), 0),
                   evolved: G.towers.filter(t => !t.def.evolveTo).length,
                   stage2: G.towers.filter(t => t.invested > PTD.TOWERS[t.def.id] .cost).length,
                   dps: Math.round(G.towers.reduce((s2, t) => s2 + t.dps, 0)),
                   cap: G.teamCap });
      }
    }
    return {
      strategy: STRATEGY, state: G.state, reachedWave: G.waveIndex + 1,
      lives: G.lives, simMinutes: +(steps * dt / 60).toFixed(1),
      towers: G.towers.length, kills: G.stats.kills, leaked: G.stats.leaked,
      log
    };
  }, STRATEGY);

  console.log(`\n=== กลยุทธ์: ${result.strategy} ===`);
  console.log(`ผลลัพธ์: ${result.state === 'won' ? 'ชนะ 🏆' : 'แพ้ที่เวฟ ' + result.reachedWave}` +
              ` | หัวใจเหลือ ${result.lives} | ป้อม ${result.towers} | หลุด ${result.leaked} | ${result.simMinutes} นาที`);
  console.log('wave | lives | money | ทีม | maxLv | ร่างสุดท้าย | DPS รวม');
  for (const r of result.log) {
    if (r.wave % 2 === 1 || r.wave >= 25) {
      console.log(String(r.wave).padStart(4), '|', String(r.lives).padStart(5), '|',
        String(Math.round(r.money)).padStart(5), '|', String(r.towers).padStart(6), '|',
        String(r.maxLv).padStart(5), '|', String(r.evolved).padStart(10), '|', r.dps);
    }
  }
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5));
  await browser.close();
})();
