const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(400);

  await p.evaluate(() => {
    const PTD = window.PTD, G = PTD.G, M = PTD.map;
    PTD.audio.toggle();
    G.money = 999999;
    const team = ['charizard','blastoise','venusaur','raichu','golem',
                  'alakazam','machamp','gengar','magneton','dragonite','charmeleon','wartortle'];
    const spots = [];
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      if (!M.buildable(c, r)) continue;
      let near = 0;
      for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++){
        const rr=r+dr, cc=c+dc;
        if (rr>=0&&rr<M.ROWS&&cc>=0&&cc<M.COLS&&M.blocked[rr][cc]===1) near++;
      }
      if (near>=3) spots.push({c,r});
    }
    team.forEach((id, i) => {
      if (!spots[i]) return;
      // วางร่างแรกแล้วบังคับให้เป็นร่างที่ต้องการ เพื่อโชว์ตัวท้ายสาย
      const base = Object.keys(PTD.TOWERS).find(k => PTD.evoLine(k).includes(id) && PTD.TOWERS[k].cost > 0);
      G.placing = base;
      if (G.tryPlace(spots[i].c, spots[i].r)) {
        const t = G.towers[G.towers.length-1];
        t.def = PTD.TOWERS[id];
        t.level = 14;
      }
      G.placing = null;
    });
    G.selected = null;
    G.waveIndex = 24;          // เวฟ 25 = Articuno
    G.speed = 2;
    G.startWave();
  });

  // รอจนบอสเดินเข้ามากลางสนาม
  await p.waitForFunction(() => {
    const G = window.PTD.G;
    return G.enemies.some(e => e.def.boss && e.x > 380 && e.x < 900);
  }, { timeout: 30000 }).catch(() => {});
  await p.screenshot({ path: '/tmp/claude-0/shots/07-boss.png' });
  console.log('errors:', errs.length, errs.slice(0,3));
  await b.close();
})();
