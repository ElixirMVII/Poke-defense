const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 780 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const PTD = window.PTD, G = PTD.G;
    PTD.audio.toggle();
    G.stats = { kills: 1284, damage: 2934771, earned: 48210, leaked: 9 };
    G.waveIndex = 29; G.lives = 6;
    for (let i = 0; i < 14; i++) G.towers.push({});
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
})();
