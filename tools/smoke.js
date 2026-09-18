/* ทดสอบเกมอัตโนมัติ: เปิดหน้า วางป้อม เร่งเวลา แล้วเก็บภาพ + error */
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.env.OUT || '/tmp/claude-0/shots';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0,4).join('\n')));

  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/01-start.png' });

  // วางป้อมหลายตัวในช่องที่วางได้ ใกล้ ๆ เส้นทาง
  const placed = await page.evaluate(() => {
    const G = window.PTD.G, M = window.PTD.map;
    G.money = 99999;
    const picks = ['charmander','squirtle','bulbasaur','pikachu','geodude',
                   'abra','machop','gastly','magnemite','dratini'];
    const spots = [];
    for (let r = 0; r < M.ROWS && spots.length < 30; r++)
      for (let c = 0; c < M.COLS && spots.length < 30; c++) {
        if (!M.buildable(c, r)) continue;
        // เอาเฉพาะช่องที่ติดกับทางเดิน จะได้ยิงโดนจริง
        let near = false;
        for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
          const rr=r+dr, cc=c+dc;
          if (rr>=0&&rr<M.ROWS&&cc>=0&&cc<M.COLS&&M.blocked[rr][cc]===1) near = true;
        }
        if (near) spots.push([c, r]);
      }
    let n = 0;
    spots.forEach(([c, r], i) => {
      G.placing = picks[i % picks.length];
      if (G.tryPlace(c, r)) n++;
    });
    G.placing = null;
    return { n, towers: G.towers.length };
  });

  // เดินเกมไปเรื่อย ๆ หลายเวฟด้วยความเร็วสูงสุด
  await page.evaluate(() => {
    const G = window.PTD.G;
    G.speed = 3;
    G.startWave();
  });

  const snaps = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const G = window.PTD.G;
      G.money = Math.max(G.money, 5000);       // ให้มีเงินพอวิวัฒนาการ
      // ลองวิวัฒนาการทุกตัวที่พร้อม เพื่อทดสอบเส้นทางโค้ดนั้น
      for (const t of G.towers) {
        if (t.canEvolve && G.money >= t.def.evolveCost) { G.selected = t; G.evolveSelected(); }
      }
      G.selected = null;
      if (G.state === 'break') G.startWave();
      return { state: G.state, wave: G.waveIndex + 1, enemies: G.enemies.length,
               lives: G.lives, kills: G.stats.kills, towers: G.towers.length };
    });
    snaps.push(st);
    if (i === 4) await page.screenshot({ path: OUT + '/02-battle.png' });
    if (st.wave >= 11 && !snaps.midShot) { snaps.midShot = 1; await page.screenshot({ path: OUT + '/03-midgame.png' }); }
    if (st.state === 'won' || st.state === 'lost') break;
  }

  await page.screenshot({ path: OUT + '/04-final.png' });

  // เปิดแผงข้อมูลป้อมเพื่อเช็ค UI
  await page.evaluate(() => {
    const G = window.PTD.G;
    if (G.towers.length) { G.selected = G.towers[0]; window.PTD.ui.refresh(); }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/05-detail.png' });

  // เปิดหน้าวิธีเล่น
  await page.click('#btnHelp');
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/06-help.png' });

  const last = snaps[snaps.length - 1];
  console.log('placed:', JSON.stringify(placed));
  console.log('progress:', JSON.stringify(snaps.filter((s,i)=>i%6===0 || i===snaps.length-1)));
  console.log('last:', JSON.stringify(last));
  console.log('ERRORS:', errors.length);
  errors.slice(0, 12).forEach(e => console.log('  ' + e));

  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
