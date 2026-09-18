/* ทดสอบเกมอัตโนมัติ: เปิดหน้า วางป้อม เร่งเวลา เก็บภาพ + error */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { serve } = require('./server');

const REPO = path.resolve(__dirname, '..');
const SPRITES = process.env.SPRITES || '/tmp/claude-0/sprites';
const OUT = process.env.OUT || '/tmp/claude-0/shots';
const PORT = 8901;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = await serve([['/sprites', SPRITES], ['/', REPO]], PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1420, height: 880 } });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n  ' +
    (e.stack || '').split('\n').slice(1, 4).join('\n  ')));
  page.on('requestfailed', r => errors.push('[net] ' + r.url().slice(-60) + ' ' + (r.failure() || {}).errorText));

  await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/01-start.png' });

  // วางป้อมลงช่องที่ติดทางเดิน
  const placed = await page.evaluate(() => {
    const PTD = window.PTD, G = PTD.G, M = PTD.map;
    G.money = 99999;
    const spots = [];
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      if (!M.buildable(c, r)) continue;
      let near = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < M.ROWS && cc >= 0 && cc < M.COLS && M.blocked[rr][cc] === 1) near++;
      }
      if (near >= 2) spots.push({ c, r });
    }
    // เลือกตัวหลากธาตุมาทดสอบ รวมถึงตัวที่มีรูปแบบโจมตีต่างกัน
    const picks = [1, 4, 7, 25, 74, 63, 66, 92, 81, 147, 129, 27];
    let n = 0;
    picks.forEach((id, i) => {
      if (!spots[i]) return;
      G.placing = id;
      if (G.tryPlace(spots[i].c, spots[i].r)) n++;
      G.placing = null;
    });
    return { n, team: G.towers.length, cap: G.teamCap, shop: PTD.shopList().length, dex: PTD.DEX.length };
  });

  await page.evaluate(() => { const G = window.PTD.G; G.speed = 3; G.startWave(); });

  const snaps = [];
  let shotMid = false, shotBoss = false;
  for (let i = 0; i < 46; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const G = window.PTD.G, PTD = window.PTD;
      G.money = Math.max(G.money, 9000);
      for (const t of G.towers) {
        if (t.canEvolve && G.money >= t.def.evolveCost) { G.selected = t; G.evolveSelected(0); }
      }
      G.selected = null;
      if (G.state === 'break') G.startWave();
      return { state: G.state, wave: G.waveIndex + 1, enemies: G.enemies.length, lives: G.lives,
               kills: G.stats.kills, boss: G.enemies.some(e => e.def.boss),
               sprites: PTD.sprites.ready, pending: PTD.sprites.pending };
    });
    snaps.push(st);
    if (i === 6) await page.screenshot({ path: OUT + '/02-battle.png' });
    if (!shotMid && st.wave >= 8) { shotMid = true; await page.screenshot({ path: OUT + '/03-midgame.png' }); }
    if (!shotBoss && st.boss) { shotBoss = true; await page.screenshot({ path: OUT + '/07-boss.png' }); }
    if (st.state === 'won' || st.state === 'lost') break;
  }

  // แผงข้อมูลป้อม
  await page.evaluate(() => {
    const G = window.PTD.G;
    if (G.towers.length) { G.selected = G.towers[0]; window.PTD.ui.refresh(); }
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/05-detail.png' });

  // ทดสอบค้นหาในร้าน
  await page.evaluate(() => { window.PTD.G.selected = null; window.PTD.ui.refresh(); });
  await page.fill('#fText', 'eevee');
  await page.waitForTimeout(300);
  const search = await page.evaluate(() => window.PTD.ui.visibleIds.slice());
  await page.fill('#fText', '');
  await page.selectOption('#fType', 'Dragon');
  await page.waitForTimeout(300);
  const dragons = await page.evaluate(() => window.PTD.ui.visibleIds.map(i => window.PTD.dex(i).n));
  await page.selectOption('#fType', '');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/06-shop.png' });

  const last = snaps[snaps.length - 1];
  console.log('ข้อมูล:', JSON.stringify(placed));
  console.log('ค้นหา "eevee" ->', JSON.stringify(search), '| กรองธาตุมังกร ->', JSON.stringify(dragons));
  console.log('ความคืบหน้า:', JSON.stringify(snaps.filter((s, i) => i % 8 === 0 || i === snaps.length - 1)));
  console.log('สรุปท้ายสุด:', JSON.stringify(last));
  console.log('ERRORS:', errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ' + e));

  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
