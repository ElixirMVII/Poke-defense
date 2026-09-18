const { chromium } = require('playwright');
const path = require('path');
const { serve } = require('./server');
const PORT = 8905;
(async () => {
  const server = await serve([['/sprites', '/tmp/claude-0/sprites'],
                              ['/', path.resolve(__dirname, '..')]], PORT);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await p.goto(`http://127.0.0.1:${PORT}/index.html`);
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    const PTD = window.PTD, G = PTD.G;
    PTD.audio.toggle();
    G.stats = { kills: 1284, damage: 2934771, earned: 48210, leaked: 9 };
    G.waveIndex = 29; G.lives = 6;
    // วางป้อมจริงเพื่อให้จอจบเกมโชว์ทีมได้ถูกต้อง
    const team = [3, 6, 9, 26, 65, 68, 94, 76, 130, 143, 149, 131, 59, 112];
    const M = PTD.map;
    let n = 0;
    for (let r = 0; r < M.ROWS && n < team.length; r++)
      for (let c = 0; c < M.COLS && n < team.length; c++) {
        if (!M.buildable(c, r) || G.towerAt(c, r)) continue;
        const t = new PTD.Tower(1, c, r, G);
        t.def = PTD.tower(team[n]); t.level = 12 + n;
        G.towers.push(t); n++;
      }
    G.state = 'won';
    PTD.ui.showEnd(true);
  });
  await p.waitForTimeout(350);
  await p.screenshot({ path: '/tmp/claude-0/shots/08-win.png' });
  // แล้วลองจอแพ้
  await p.evaluate(() => { window.PTD.G.state='lost'; window.PTD.ui.showEnd(false); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: '/tmp/claude-0/shots/09-lose.png' });
  // กดเล่นอีกครั้งต้องรีเซ็ตได้จริง
  await p.click('#btnAgain');
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => {
    const G = window.PTD.G;
    return { state: G.state, money: G.money, lives: G.lives, wave: G.waveIndex,
             towers: G.towers.length, endHidden: document.getElementById('endscreen').hidden };
  });
  console.log('หลังกดเล่นอีกครั้ง:', JSON.stringify(after));
  console.log('errors:', errs.length, errs.slice(0,3));
  await b.close();
  server.close();
})();
