/* ตรวจว่า dist/ ที่รวมไฟล์แล้วยังเล่นได้จริง และสไปรท์มาจากแพ็กที่แนบไปด้วย */
const { chromium } = require('playwright');
const path = require('path');
const { serve, seedTestUser } = require('./server');
const PORT = 8907;
const OUT = '/tmp/claude-0/shots';

(async () => {
  const server = await serve([['/', path.resolve(__dirname, '../dist')]], PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:')) external.push(u);
  });

  await seedTestUser(page);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(1200);

  const boot = await page.evaluate(() => ({
    screen: PTD.app.screen, dex: PTD.DEX.length, mega: PTD.MEGA.length,
    starters: document.querySelectorAll('.starter-card').length
  }));
  console.log('บูต:', JSON.stringify(boot));

  await page.locator('.starter-card[data-id="4"]').click();
  await page.waitForTimeout(600);

  // ลงด่านแล้วดูว่าสไปรท์กลายเป็นแบบเคลื่อนไหวจากแพ็กไหม
  await page.evaluate(() => {
    for (const id of [7, 25, 74, 63, 92]) PTD.save.addMon(id, 14);
    PTD.save.setParty(PTD.save.data.box.slice(0, 6).map(m => m.uid));
    PTD.app.go('world');
  });
  await page.waitForTimeout(300);
  await page.locator('[data-stage="s1"]').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const B = PTD.battle, M = PTD.map;
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
    B.roster.forEach((s, i) => { if (spots[i]) { B.placing = s.mon.uid; B.tryPlace(spots[i].c, spots[i].r); } });
    B.placing = null;
    B.speed = 3;
    B.startWave();
  });

  // รอให้แพ็กโหลดเสร็จแล้วอัปเกรดเป็นเคลื่อนไหว
  await page.waitForFunction(() => {
    const ids = PTD.battle.towers.map(t => t.def.dexId);
    return ids.length && ids.every(id => PTD.sprites.stateOf(id) === 'ready');
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(6000);

  const kinds = await page.evaluate(() => {
    const out = {};
    for (const t of PTD.battle.towers) {
      const st = PTD.sprites.debugKind ? PTD.sprites.debugKind(t.def.dexId) : null;
      out[t.def.name] = st;
    }
    return out;
  });
  console.log('ชนิดสไปรท์ที่ใช้:', JSON.stringify(kinds));

  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + '/dist-battle.png' });
  const st = await page.evaluate(() => ({
    state: PTD.battle.state, wave: PTD.battle.waveIndex + 1, kills: PTD.battle.stats.kills
  }));
  console.log('สถานะการสู้:', JSON.stringify(st));
  console.log('คำขอไปโฮสต์ภายนอก:', external.length ? external.slice(0, 5) : 'ไม่มีเลย ✓');
  console.log('ERRORS:', errors.length);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));

  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
