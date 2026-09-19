/* ทดสอบระบบบัญชีและหน้าผู้ดูแลแบบครบวงจร */
const { chromium } = require('playwright');
const path = require('path');
const { serve } = require('./server');
const REPO = path.resolve(__dirname, '..');
const SPRITES = process.env.SPRITES || '/tmp/claude-0/sprites';
const PORT = 8908;

(async () => {
  const server = await serve([['/sprites', SPRITES], ['/', REPO]], PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });

  const step = async (name, fn) => {
    try { const r = await fn(); console.log('✓', name, r === undefined ? '' : JSON.stringify(r)); return r; }
    catch (e) { console.log('✗', name, '—', e.message); errors.push(`[step ${name}] ${e.message}`); }
  };

  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => window.PTD && PTD.app && PTD.app.screen);

  await step('ยังไม่มีบัญชี ต้องเด้งหน้าสมัคร', async () =>
    await page.evaluate(() => ({ screen: PTD.app.screen, users: PTD.auth.count })));

  await step('สมัครคนแรกได้สิทธิ์ผู้ดูแล', async () => {
    await page.fill('#auName', 'เจ้าของเครื่อง');
    await page.fill('#auPass', 'rootpass');
    await page.click('#auCreate');
    await page.waitForTimeout(400);
    return await page.evaluate(() => ({
      screen: PTD.app.screen, role: PTD.auth.current().role, isAdmin: PTD.auth.isAdmin()
    }));
  });

  await step('เลือกตัวเริ่มต้นแล้วเซฟลงช่องของผู้ใช้คนนี้', async () => {
    await page.click('.starter-card[data-id="7"]');
    await page.waitForTimeout(400);
    return await page.evaluate(() => ({
      screen: PTD.app.screen, slot: PTD.save.slot(), box: PTD.save.data.box.length
    }));
  });

  await step('สมัครผู้เล่นคนที่สองจากหน้าผู้ดูแล — เซฟแยกกัน', async () => {
    await page.evaluate(async () => {
      await PTD.auth.register('น้องคนเล็ก', 'kidpass');
    });
    const u2 = await page.evaluate(() => PTD.auth.list().find(u => u.name === 'น้องคนเล็ก').id);
    await page.evaluate(async (id) => { await PTD.auth.login(id, 'kidpass'); PTD.app.afterLogin(); }, u2);
    await page.waitForTimeout(400);
    return await page.evaluate(() => ({
      screen: PTD.app.screen, role: PTD.auth.current().role,
      box: PTD.save.data.box.length, slot: PTD.save.slot()
    }));
  });

  await step('รหัสผิดเข้าไม่ได้', async () =>
    await page.evaluate(async () => {
      const id = PTD.auth.list()[0].id;
      try { await PTD.auth.login(id, 'wrong'); return { blocked: false }; }
      catch (e) { return { blocked: true, msg: e.message }; }
    }));

  await step('กลับมาเป็นผู้ดูแล เซฟเดิมยังอยู่', async () => {
    await page.evaluate(async () => {
      const id = PTD.auth.list()[0].id;
      await PTD.auth.login(id, 'rootpass');
      PTD.app.afterLogin();
    });
    await page.waitForTimeout(400);
    return await page.evaluate(() => ({
      name: PTD.auth.current().name, box: PTD.save.data.box.length, screen: PTD.app.screen
    }));
  });

  await step('เข้าหน้าผู้ดูแลได้', async () => {
    await page.evaluate(() => PTD.app.go('admin'));
    await page.waitForTimeout(300);
    return await page.evaluate(() => ({
      screen: PTD.app.screen,
      fields: document.querySelectorAll('.adm-field').length,
      tabs: document.querySelectorAll('.adm-tab').length
    }));
  });

  await step('แก้ค่าเกมแล้วมีผลจริง', async () => {
    const before = await page.evaluate(() => PTD.battle.BREAK_TIME);
    await page.evaluate(() => PTD.config.set('breakTime', 20));
    const after = await page.evaluate(() => PTD.battle.BREAK_TIME);
    await page.evaluate(() => PTD.config.set('partyMax', 3));
    const pm = await page.evaluate(() => PTD.save.PARTY_MAX);
    return { breakBefore: before, breakAfter: after, partyMax: pm, ok: after === 20 && pm === 3 };
  });

  await step('ค่าที่แก้อยู่ข้ามการรีโหลด', async () => {
    await page.reload();
    await page.waitForFunction(() => window.PTD && PTD.app && PTD.app.screen);
    await page.waitForTimeout(300);
    return await page.evaluate(() => ({
      breakTime: PTD.battle.BREAK_TIME, partyMax: PTD.save.PARTY_MAX,
      screen: PTD.app.screen, stillLoggedIn: !!PTD.auth.current()
    }));
  });

  await step('คืนค่าเดิมได้', async () => {
    await page.evaluate(() => PTD.config.resetAll());
    return await page.evaluate(() => ({
      breakTime: PTD.battle.BREAK_TIME, partyMax: PTD.save.PARTY_MAX
    }));
  });

  await step('ผู้ดูแลแก้ข้อมูลผู้เล่นคนอื่นได้', async () => {
    const kid = await page.evaluate(() => PTD.auth.list().find(u => u.name === 'น้องคนเล็ก').id);
    await page.evaluate((id) => {
      const d = PTD.auth.saveOf(id) || {};
      d.money = 99999; d.balls = 77;
      d.box = (d.box || []).concat([{ uid: 1, id: 150, lv: 30, exp: 0 }]);
      PTD.auth.writeSaveOf(id, d);
    }, kid);
    return await page.evaluate((id) => {
      const d = PTD.auth.saveOf(id);
      return { money: d.money, balls: d.balls, box: d.box.length };
    }, kid);
  });

  await step('ผู้เล่นธรรมดาเข้าหน้าผู้ดูแลไม่ได้', async () => {
    const kid = await page.evaluate(() => PTD.auth.list().find(u => u.name === 'น้องคนเล็ก').id);
    await page.evaluate(async (id) => { await PTD.auth.login(id, 'kidpass'); PTD.app.afterLogin(); }, kid);
    await page.waitForTimeout(300);
    await page.evaluate(() => PTD.app.go('admin'));
    await page.waitForTimeout(300);
    return await page.evaluate(() => ({
      isAdmin: PTD.auth.isAdmin(), screen: PTD.app.screen,
      money: PTD.save.money, blocked: PTD.app.screen !== 'admin'
    }));
  });

  await step('ลบ admin คนสุดท้ายไม่ได้', async () =>
    await page.evaluate(() => {
      const admin = PTD.auth.list().find(u => u.role === 'admin');
      try { PTD.auth.remove(admin.id); return { blocked: false }; }
      catch (e) { return { blocked: true, msg: e.message }; }
    }));

  await step('ออกจากระบบกลับไปหน้าเลือกผู้เล่น', async () => {
    await page.evaluate(() => PTD.app.logout());
    await page.waitForTimeout(300);
    return await page.evaluate(() => ({
      screen: PTD.app.screen, cards: document.querySelectorAll('.auth-user').length
    }));
  });

  console.log('\nERRORS:', errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ' + e));
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
