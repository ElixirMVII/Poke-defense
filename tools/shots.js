/* เก็บภาพหน้าจอทุกหน้าไว้ดูว่าหน้าตาเพี้ยนตรงไหน */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { serve, seedTestUser } = require('./server');

const REPO = path.resolve(__dirname, '..');
const PORT = 8912;
const OUT = '/tmp/claude-0/shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = await serve([['/sprites', '/tmp/claude-0/sprites'], ['/', REPO]], PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));


  await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await seedTestUser(page);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(1400);

  const shot = async (name) => { await page.screenshot({ path: `${OUT}/ui-${name}.png` }); };

  await shot('starter');
  await page.locator('.starter-card[data-id="4"]').click();
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    for (const id of [7, 25, 74, 63, 92, 1, 16, 19, 41, 27]) PTD.save.addMon(id, 12);
    PTD.save.setParty(PTD.save.data.box.slice(0, 6).map(m => m.uid));
    PTD.save.addMoney(8200); PTD.save.addStone(4);
    PTD.app.go('world');
  });
  await page.waitForTimeout(700);
  await shot('world');

  await page.evaluate(() => PTD.app.go('party'));
  await page.waitForTimeout(600);
  await shot('party');

  await page.evaluate(() => PTD.app.go('safari', 'route'));
  await page.waitForTimeout(800);
  await shot('safari');

  await page.evaluate(() => {
    PTD.safari.state.encounter = { id: 25, lv: 9, angry: 1, eating: 0, turns: 0 };
    PTD.ui.showEncounter(PTD.safari.state.encounter);
  });
  await page.waitForTimeout(500);
  await shot('encounter');
  await page.evaluate(() => PTD.ui.closeModal());

  await page.evaluate(() => { PTD.app.go('world'); });
  await page.waitForTimeout(300);
  await page.locator('[data-stage="s1"]').click();
  await page.waitForTimeout(700);
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
    B.placing = null; B.money = 5000; B.speed = 2; B.startWave();
    B.selected = B.towers[0];
    PTD.ui.refresh();
  });
  await page.waitForTimeout(5000);
  await shot('battle');

  await page.evaluate(() => { document.getElementById('help').hidden = false; });
  await page.waitForTimeout(400);
  await shot('help');

  console.log('errors:', errs.length, errs.slice(0, 3));
  await browser.close(); server.close();
})();
