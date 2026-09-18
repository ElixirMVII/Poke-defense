/* พิมพ์ตารางเวฟทั้งหมดออกมาดู ว่าองค์ประกอบสมเหตุสมผลไหม */
const { chromium } = require('playwright');
const path = require('path');
const { serve } = require('./server');
const PORT = 8903;
(async () => {
  const server = await serve([['/sprites', '/tmp/claude-0/sprites'], ['/', path.resolve(__dirname, '..')]], PORT);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await p.goto(`http://127.0.0.1:${PORT}/index.html`);
  await p.waitForTimeout(400);
  const rows = await p.evaluate(() => window.PTD.WAVES.map((w, i) => ({
    w: i + 1, hpMul: w.hpMul,
    total: w.groups.reduce((s, g) => s + g.count, 0),
    hp: Math.round(w.groups.reduce((s, g) =>
      s + g.count * window.PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX }).hp * w.hpMul, 0)),
    g: w.groups.map(g => `${window.PTD.dex(g.id).n}${g.boss ? '👑' : ''}x${g.count}`).join(' ')
  })));
  console.log('เวฟ hpMul  ตัว   HP รวม   องค์ประกอบ');
  for (const r of rows) console.log(
    String(r.w).padStart(3), String(r.hpMul).padStart(5), String(r.total).padStart(4),
    String(r.hp).padStart(8), ' ', r.g);
  const count = {};
  for (const r of rows) for (const m of r.g.matchAll(/([A-Za-z♀♂.'-]+)[👑]?x(\d+)/g))
    count[m[1]] = (count[m[1]] || 0) + Number(m[2]);
  console.log('\nตัวที่โผล่บ่อยสุด:', Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([k,v])=>`${k} ${v}`).join(', '));
  console.log('จำนวนสายพันธุ์ที่ใช้:', Object.keys(count).length);
  await b.close(); server.close();
})();
