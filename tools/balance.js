/* =====================================================================
 * balance.js — จำลองการเล่นจนจบแบบไม่วาดภาพ เพื่อดูว่าความยากพอดีไหม
 *   node tools/balance.js [กลยุทธ์]
 * กลยุทธ์: starters | cheap | meta | mixed
 * ===================================================================== */
const { chromium } = require('playwright');
const path = require('path');
const { serve } = require('./server');

const REPO = path.resolve(__dirname, '..');
const SPRITES = process.env.SPRITES || '/tmp/claude-0/sprites';
const PORT = 8902;
const STRATEGY = process.argv[2] || 'mixed';

(async () => {
  const server = await serve([['/sprites', SPRITES], ['/', REPO]], PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(600);

  const result = await page.evaluate((STRATEGY) => {
    const PTD = window.PTD, G = PTD.G, M = PTD.map;
    G.reset();
    G.paused = true;                 // หยุด rAF ไม่ให้เดินซ้ำ แล้วเราเดินเอง
    if (PTD.audio.enabled) PTD.audio.toggle();

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

    const shop = PTD.shopList();
    const byCost = shop.slice().sort((a, b) => PTD.tower(a).cost - PTD.tower(b).cost);
    const byValue = shop.slice().sort((a, b) => {
      const A = PTD.tower(a), B = PTD.tower(b);
      return (B.dmg * B.rate) / B.cost - (A.dmg * A.rate) / A.cost;
    });
    const ORDERS = {
      starters: [1, 4, 7, 25, 74, 63, 66, 92, 27, 29, 32, 35],
      cheap: byCost.slice(0, 14),
      meta: byValue.slice(0, 14),
      mixed: [1, 4, 7, 25, 74, 63, 66, 92, 116, 129, 147, 43]
    };
    const order = ORDERS[STRATEGY] || ORDERS.mixed;

    let si = 0, oi = 0;
    function think() {
      for (const t of G.towers) {
        if (t.canEvolve && G.money >= t.def.evolveCost) {
          G.selected = t; G.evolveSelected(0); G.selected = null; return;
        }
      }
      if (si < spots.length && G.towers.length < G.teamCap) {
        const id = order[oi % order.length];
        const def = PTD.tower(id);
        if (G.money >= def.cost) {
          const s2 = spots[si];
          G.placing = id;
          if (G.tryPlace(s2.c, s2.r)) { si++; oi++; }
          G.placing = null;
          return;
        }
      }
      if (G.towers.length >= G.teamCap && G.extraSlots < G.EXTRA_SLOTS
          && G.money >= G.slotCost() * 2.2) { G.buySlot(); return; }
      const low = G.towers.filter(t => t.level < PTD.MAX_LEVEL).sort((a, b) => a.level - b.level);
      if (low.length) {
        const t = low[0], cost = G.candyCost(t);
        if (G.money >= cost * 2.5) { G.selected = t; G.buyCandy(); G.selected = null; }
      }
    }

    // ดักจับทุกครั้งที่ศัตรูหลุดเข้าฐาน เพื่อดูว่าใครเป็นตัวปัญหา
    const leaks = {};
    const origLeak = G.leak.bind(G);
    G.leak = function (e) {
      const k = e.def.name + (e.def.boss ? ' (บอส)' : '');
      leaks[k] = (leaks[k] || 0) + 1;
      return origLeak(e);
    };

    const dt = 1 / 30;
    const log = [];
    let steps = 0, thinkT = 0, lastWave = -1;
    const MAX = 30 * 60 * 50;

    think(); think(); think();
    G.startWave();
    while (G.state !== 'won' && G.state !== 'lost' && steps < MAX) {
      G.update(dt);
      steps++;
      thinkT += dt;
      if (thinkT >= 0.5) { thinkT = 0; think(); }
      if (G.state === 'break' && G.breakLeft < 8.5) G.startWave();
      if (G.waveIndex !== lastWave) {
        lastWave = G.waveIndex;
        const w = PTD.WAVES[Math.min(G.waveIndex, PTD.WAVES.length - 1)];
        const bossG = w.groups.find(g => g.boss);
        log.push({
          wave: G.waveIndex + 1, lives: G.lives, money: Math.round(G.money),
          team: G.towers.length + '/' + G.teamCap,
          maxLv: G.towers.reduce((m, t) => Math.max(m, t.level), 0),
          final: G.towers.filter(t => !t.def.evolveTo.length).length,
          dps: Math.round(G.towers.reduce((s, t) => s + t.dps, 0)),
          hpMul: w.hpMul,
          bossHp: bossG ? Math.round(PTD.enemy(bossG.id, { boss: true, bossX: bossG.bossX }).hp * w.hpMul) : 0
        });
      }
    }
    return {
      strategy: STRATEGY, state: G.state, reached: G.waveIndex + 1, lives: G.lives,
      minutes: +(steps * dt / 60).toFixed(1), kills: G.stats.kills, leaked: G.stats.leaked,
      team: G.towers.map(t => t.def.name + ' Lv' + t.level), log,
      leaks: Object.entries(leaks).sort((a, b) => b[1] - a[1])
    };
  }, STRATEGY);

  console.log(`\n=== กลยุทธ์: ${result.strategy} ===`);
  console.log(`${result.state === 'won' ? 'ชนะ 🏆' : 'แพ้ที่เวฟ ' + result.reached}` +
    ` | หัวใจ ${result.lives} | หลุด ${result.leaked} | ${result.minutes} นาที`);
  console.log('เวฟ | หัวใจ |  เงิน | ทีม   | maxLv | สุดสาย | DPS รวม | hpMul | HP บอส');
  for (const r of result.log) {
    if (r.wave % 2 === 1 || r.bossHp) {
      console.log(
        String(r.wave).padStart(3), '|', String(r.lives).padStart(5), '|',
        String(r.money).padStart(5), '|', r.team.padStart(5), '|',
        String(r.maxLv).padStart(5), '|', String(r.final).padStart(6), '|',
        String(r.dps).padStart(7), '|', String(r.hpMul).padStart(5), '|',
        r.bossHp ? String(r.bossHp) : '');
    }
  }
  console.log('ทีมสุดท้าย:', result.team.join(', '));
  console.log('ตัวที่หลุดเข้าฐาน:', result.leaks.map(([k, v]) => `${k} x${v}`).join(', ') || 'ไม่มี');
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5));
  await browser.close();
  server.close();
})();
