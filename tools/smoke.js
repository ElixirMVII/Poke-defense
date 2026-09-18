/* ทดสอบเกมทั้งวงจร: เลือกตัวเริ่มต้น -> จับโปเกม่อน -> จัดทีม -> ลงด่าน -> เมก้า -> เควส */
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n  ' +
    (e.stack || '').split('\n').slice(1, 4).join('\n  ')));
  page.on('requestfailed', r => errors.push('[net] ' + r.url().slice(-50) + ' ' + (r.failure() || {}).errorText));

  const step = async (name, fn) => {
    try { const r = await fn(); console.log('✓', name, r === undefined ? '' : JSON.stringify(r)); return r; }
    catch (e) { console.log('✗', name, '—', e.message); errors.push(`[step ${name}] ${e.message}`); }
  };

  await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(900);

  /* ---------- 1. หน้าเลือกตัวเริ่มต้น ---------- */
  await step('หน้าเลือกตัวเริ่มต้นแสดงผล', async () => {
    const n = await page.locator('.starter-card').count();
    if (n !== 4) throw new Error('คาดว่ามี 4 ตัวเลือก แต่เจอ ' + n);
    await page.screenshot({ path: OUT + '/01-starter.png' });
    return { options: n };
  });

  await step('เลือก Charmander', async () => {
    await page.locator('.starter-card[data-id="4"]').click();
    await page.waitForTimeout(500);
    return await page.evaluate(() => ({
      screen: PTD.app.screen, box: PTD.save.data.box.length, party: PTD.save.data.party.length
    }));
  });

  await step('แผนที่โลกแสดงผล', async () => {
    await page.screenshot({ path: OUT + '/02-world.png' });
    return await page.evaluate(() => ({
      stages: document.querySelectorAll('[data-stage]').length,
      zones: document.querySelectorAll('[data-zone]').length,
      quests: document.querySelectorAll('[data-quest]').length
    }));
  });

  /* ---------- 2. ซาฟารี ---------- */
  await step('เข้าโซนซาฟารี', async () => {
    await page.locator('[data-zone="route"]').click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: OUT + '/03-safari.png' });
    return await page.evaluate(() => ({ screen: PTD.app.screen, zone: PTD.safari.state.zone.id }));
  });

  await step('จับโปเกม่อนได้ 12 ตัว', async () => {
    const got = await page.evaluate(async () => {
      const caught = [];
      for (let i = 0; i < 60 && caught.length < 12; i++) {
        // บังคับให้เจอตัว แล้วขว้างบอลจนกว่าจะจับได้หรือมันหนี
        PTD.safari.state.encounter = null;
        const zone = PTD.safari.state.zone;
        const pool = PTD.safari.poolOf(zone);
        const id = pool[i % pool.length];
        PTD.safari.state.encounter = { id, lv: 8, angry: 3, eating: 0, turns: 0 };
        PTD.save.addBalls(20);
        for (let k = 0; k < 12; k++) {
          const r = PTD.safari.act('ball');
          if (!r || r.result === 'caught') { if (r) caught.push(r.id); break; }
          if (r.result === 'fled' || r.result === 'noball') break;
        }
      }
      return { caught: caught.length, box: PTD.save.data.box.length, dex: PTD.save.dexCaught };
    });
    return got;
  });

  await step('เปิดมินิเกมจับจริง (UI)', async () => {
    await page.evaluate(() => {
      PTD.safari.state.encounter = { id: 25, lv: 9, angry: 0, eating: 0, turns: 0 };
      PTD.ui.showEncounter(PTD.safari.state.encounter);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + '/04-encounter.png' });
    const acts = await page.locator('#modal [data-act]').count();
    await page.locator('#modal [data-act="run"]').click();
    await page.waitForTimeout(200);
    return { buttons: acts, closed: await page.evaluate(() => document.getElementById('modal').hidden) };
  });

  /* ---------- 3. จัดทีม ---------- */
  await step('หน้าจัดทีม', async () => {
    await page.evaluate(() => PTD.app.go('party'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + '/05-party.png' });
    return await page.evaluate(() => ({
      slots: document.querySelectorAll('.slot').length,
      box: document.querySelectorAll('.mon').length,
      party: PTD.save.data.party.length
    }));
  });

  await step('ทีมเกิน 6 ตัวไม่ได้', async () => {
    return await page.evaluate(() => {
      // พยายามยัดทุกตัวในกล่องลงทีม
      for (const m of PTD.save.data.box) PTD.save.toggleParty(m.uid);
      const n = PTD.save.data.party.length;
      // จัดใหม่ให้เต็ม 6
      PTD.save.setParty(PTD.save.data.box.slice(0, 6).map(m => m.uid));
      return { afterSpam: n, party: PTD.save.data.party.length };
    });
  });

  /* ---------- 4. ด่านแรก ---------- */
  await step('เริ่มด่าน 1', async () => {
    await page.evaluate(() => PTD.app.go('world'));
    await page.waitForTimeout(300);
    await page.locator('[data-stage="s1"]').click();
    await page.waitForTimeout(700);
    return await page.evaluate(() => ({
      screen: PTD.app.screen, roster: PTD.battle.roster.length,
      waves: PTD.battle.waves.length, lives: PTD.battle.lives, map: PTD.map.id
    }));
  });

  await step('วางทีมลงสนาม', async () => {
    return await page.evaluate(() => {
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
      let n = 0;
      B.roster.forEach((s, i) => {
        if (!spots[i]) return;
        B.placing = s.mon.uid;
        if (B.tryPlace(spots[i].c, spots[i].r)) n++;
      });
      B.placing = null;
      return { placed: n, towers: B.towers.length };
    });
  });

  await step('วางเกิน 6 ตัวไม่ได้ (ตัวละครั้ง)', async () => {
    return await page.evaluate(() => {
      const B = PTD.battle, M = PTD.map;
      const before = B.towers.length;
      // ลองวางตัวเดิมซ้ำ
      const s = B.roster[0];
      B.placing = s.mon.uid;
      let free = null;
      for (let r = 0; r < M.ROWS && !free; r++) for (let c = 0; c < M.COLS && !free; c++)
        if (M.buildable(c, r) && !B.towerAt(c, r)) free = { c, r };
      const ok = B.tryPlace(free.c, free.r);
      B.placing = null;
      return { blocked: !ok, towersUnchanged: B.towers.length === before };
    });
  });

  await step('สู้จนจบด่าน 1', async () => {
    await page.evaluate(() => {
      const B = PTD.battle;
      B.money = 99999;
      B.speed = 3;
      B.startWave();
    });
    let st = null;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      st = await page.evaluate(() => {
        const B = PTD.battle;
        B.money = Math.max(B.money, 9000);
        if (B.state === 'break') B.startWave();
        return { state: B.state, wave: B.waveIndex + 1, lives: B.lives, kills: B.stats.kills };
      });
      if (i === 4) await page.screenshot({ path: OUT + '/06-battle.png' });
      if (st.state === 'won' || st.state === 'lost') break;
    }
    await page.screenshot({ path: OUT + '/07-result.png' });
    return st;
  });

  /* ---------- 5. เมก้าอีโวลูชัน ---------- */
  await step('เมก้าอีโวลูชัน', async () => {
    return await page.evaluate(async () => {
      const B = PTD.battle, M = PTD.map;
      // เตรียม: ใส่ Charizard เข้าทีม + ให้หิน
      PTD.save.addMon(6, 40);
      PTD.save.addStone(6);
      const mon = PTD.save.data.box.find(m => m.id === 6);
      PTD.save.setParty([mon.uid]);
      B.enter({ stage: PTD.campaign.stageById('s1') });

      let free = null;
      for (let r = 0; r < M.ROWS && !free; r++) for (let c = 0; c < M.COLS && !free; c++)
        if (M.buildable(c, r)) free = { c, r };
      B.placing = mon.uid;
      B.tryPlace(free.c, free.r);
      const t = B.towers[0];
      const before = { name: t.def.name, dmg: t.dmg, types: t.def.types.slice() };

      const opts = B.megaOptions(t);
      B.selected = t;
      B.doMega(opts[0].form);
      const after = { name: t.def.name, dmg: t.dmg, types: t.def.types.slice(), mega: t.megaActive };

      // ลองเมก้าซ้ำ — ต้องไม่ได้
      const t2 = t;
      const canAgain = B.canMega(t2);

      // จบด่านต้องคืนร่างเดิม
      B.finish(true);
      const reverted = !t.megaActive && t.def.dexId === 6;

      return {
        options: opts.map(o => o.n),
        before: before.name + ' ' + Math.round(before.dmg) + ' ' + before.types.join('/'),
        after: after.name + ' ' + Math.round(after.dmg) + ' ' + after.types.join('/'),
        megaOnce: !canAgain, revertedOnFinish: reverted
      };
    });
  });

  /* ---------- 6. เควสในตำนาน ---------- */
  await step('เควสล็อกอยู่ตอนยังไม่ถึงเงื่อนไข', async () => {
    return await page.evaluate(() => {
      const q = PTD.campaign.questById('q-mewtwo');
      return { unlocked: PTD.campaign.questUnlocked(q), need: q.need };
    });
  });

  await step('เล่นเควส Articuno', async () => {
    await page.evaluate(() => {
      // ปลดล็อกด้วยการทำเงื่อนไขให้ครบจริง ๆ
      for (const st of PTD.campaign.STAGES.slice(0, 2)) PTD.save.clearStage(st.id);
      for (let id = 1; id <= 14; id++) if (!PTD.save.data.caught.includes(id)) PTD.save.addMon(id, 30);
      PTD.save.setParty(PTD.save.data.box.slice(-6).map(m => m.uid));
      const q = PTD.campaign.questById('q-articuno');
      PTD.battle.enter({ quest: q });
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
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + '/08-quest.png' });
    let st = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      st = await page.evaluate(() => ({
        state: PTD.battle.state, best: Math.round(PTD.battle.questBest * 100),
        hasTarget: !!PTD.battle.questTarget
      }));
      if (st.state === 'won' || st.state === 'lost') break;
    }
    return st;
  });

  await step('เซฟค้างหลังรีโหลด', async () => {
    const before = await page.evaluate(() => ({
      box: PTD.save.data.box.length, caught: PTD.save.dexCaught, cleared: PTD.save.data.cleared.length
    }));
    await page.reload();
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({
      box: PTD.save.data.box.length, caught: PTD.save.dexCaught, cleared: PTD.save.data.cleared.length,
      screen: PTD.app.screen
    }));
    if (before.box !== after.box) throw new Error(`กล่องไม่ตรง ${before.box} -> ${after.box}`);
    return after;
  });

  await step('โปเกเด็กซ์', async () => {
    await page.evaluate(() => PTD.app.go('dex'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + '/09-dex.png' });
    return await page.evaluate(() => ({ cells: document.querySelectorAll('.dex-cell').length }));
  });

  console.log('\nERRORS:', errors.length);
  errors.slice(0, 12).forEach(e => console.log('  ' + e));
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
