/* ทดสอบบนอุปกรณ์สัมผัสขนาด iPad — แตะอย่างเดียว ไม่ใช้คีย์บอร์ดหรือเมาส์ */
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const { serve } = require('./server');

const REPO = path.resolve(__dirname, '..');
const SPRITES = process.env.SPRITES || '/tmp/claude-0/sprites';
const OUT = process.env.OUT || '/tmp/claude-0/shots';
const PORT = 8906;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const server = await serve([['/sprites', SPRITES], ['/', REPO]], PORT);
  const browser = await chromium.launch();

  for (const [label, viewport] of [['portrait', { width: 834, height: 1194 }],
                                   ['landscape', { width: 1194, height: 834 }]]) {
    const ctx = await browser.newContext({
      viewport, hasTouch: true, isMobile: false, deviceScaleFactor: 2
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.waitForTimeout(900);

    const log = (...a) => console.log(`[${label}]`, ...a);

    log('โหมดสัมผัส:', await page.evaluate(() => PTD.ui.TOUCH));

    // แตะเลือกตัวเริ่มต้น
    await page.tap('.starter-card[data-id="7"]');
    await page.waitForTimeout(500);
    log('หลังเลือกตัวเริ่มต้น:', await page.evaluate(() => PTD.app.screen));
    await page.screenshot({ path: `${OUT}/t-${label}-world.png`, fullPage: false });

    // ไม่มีทูลทิปค้างหลังแตะ
    const tipStuck = await page.evaluate(() => {
      const t = document.getElementById('tip');
      return !!t && t.style.display === 'block';
    });
    log('ทูลทิปค้างหลังแตะ:', tipStuck ? '✗ ค้าง' : '✓ ไม่ค้าง');

    // เข้าซาฟารีแล้วแตะเดิน
    await page.tap('[data-zone="route"]');
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => ({ c: PTD.safari.state.tc, r: PTD.safari.state.tr }));
    const box = await page.locator('#game').boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.55, box.y + box.height * 0.45);
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => ({ c: PTD.safari.state.tc, r: PTD.safari.state.tr }));
    log('แตะเดิน:', JSON.stringify(before), '->', JSON.stringify(after),
        (before.c !== after.c || before.r !== after.r) ? '✓ ขยับ' : '✗ ไม่ขยับ');

    // กดปุ่มทิศทางบนจอ (ทางเดินหลักบนไอแพดที่ไม่มีคีย์บอร์ด)
    const padBefore = await page.evaluate(() => ({ c: PTD.safari.state.tc, r: PTD.safari.state.tr }));
    const pad = await page.evaluate(() => {
      const cv = document.getElementById('game');
      const b = PTD.safari.padButtons().find(p => p.dir === 'left');
      return { x: b.cx / cv.width, y: b.cy / cv.height };
    });
    await page.touchscreen.tap(box.x + box.width * pad.x, box.y + box.height * pad.y);
    await page.waitForTimeout(700);
    const padAfter = await page.evaluate(() => ({ c: PTD.safari.state.tc, r: PTD.safari.state.tr }));
    log('ปุ่มทิศทาง:', JSON.stringify(padBefore), '->', JSON.stringify(padAfter),
        (padBefore.c !== padAfter.c || padBefore.r !== padAfter.r) ? '✓ ขยับ' : '✗ ไม่ขยับ');
    await page.screenshot({ path: `${OUT}/t-${label}-safari.png` });

    // เดินบนหญ้าอาจเจอตัวป่าโผล่มาพอดี ปิดทิ้งก่อนไปทดสอบต่อ
    await page.evaluate(() => {
      if (PTD.safari.encounter) { PTD.safari.state.encounter = null; PTD.ui.closeModal(); }
    });
    await page.waitForTimeout(200);

    // กลับไปลงด่าน (ต้องมีตัวในทีมก่อน)
    await page.evaluate(() => {
      for (const id of [4, 7, 25, 74, 63, 92]) PTD.save.addMon(id, 12);
      PTD.save.setParty(PTD.save.data.box.slice(0, 6).map(m => m.uid));
      PTD.app.go('world');
    });
    await page.waitForTimeout(400);
    await page.tap('[data-stage="s1"]');
    await page.waitForTimeout(800);

    // แตะเลือกตัวในทีม แล้วแตะบนสนามเพื่อวาง
    await page.tap('.rmon[data-uid]');
    await page.waitForTimeout(300);
    const hasCancel = await page.locator('#btnCancelPlace').count();
    const gb = await page.locator('#game').boundingBox();
    const placed = await page.evaluate(() => {
      // หาช่องว่างที่วางได้จริงแล้วคืนพิกัดสัดส่วน
      const M = PTD.map;
      for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++)
        if (M.buildable(c, r)) return { fx: (c + .5) / M.COLS, fy: (r + .5) / M.ROWS };
      return null;
    });
    await page.touchscreen.tap(gb.x + gb.width * placed.fx, gb.y + gb.height * placed.fy);
    await page.waitForTimeout(400);
    log('ปุ่มยกเลิกการวาง:', hasCancel ? '✓ มี' : '✗ ไม่มี',
        '| วางด้วยการแตะ:', await page.evaluate(() => PTD.battle.towers.length) ? '✓ ได้' : '✗ ไม่ได้');
    await page.screenshot({ path: `${OUT}/t-${label}-battle.png` });

    // ปุ่มทั้งหมดต้องใหญ่พอให้นิ้วแตะ (>= 40px)
    const small = await page.evaluate(() => {
      const bad = [];
      for (const b of document.querySelectorAll('#hudActions button, .rmon, .mode')) {
        const r = b.getBoundingClientRect();
        if (r.width && r.height < 38) bad.push((b.id || b.className) + ` ${Math.round(r.height)}px`);
      }
      return bad;
    });
    log('ปุ่มที่เล็กเกินไป:', small.length ? small.join(', ') : '✓ ไม่มี');

    // ต้องไม่มีสกรอลแนวนอน
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log('ล้นแนวนอน:', overflow > 2 ? `✗ ${overflow}px` : '✓ ไม่ล้น');
    log('ERRORS:', errors.length, errors.slice(0, 3));
    await ctx.close();
  }

  await browser.close();
  server.close();
})();
