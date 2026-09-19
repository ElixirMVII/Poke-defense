/* =====================================================================
 * balance.js — จำลองเล่นทั้งแคมเปญแบบไม่วาดภาพ
 *
 * จำลองตั้งแต่เลือกตัวเริ่มต้น -> จับโปเกม่อนในโซนที่ปลดล็อก -> จัดทีม 6 ตัว
 * -> ลงด่านทีละด่าน -> ลองเควสในตำนาน
 * แล้วรายงานว่าด่านไหนผ่าน/ไม่ผ่าน ทีมโตแค่ไหน และตัวไหนหลุดเข้าฐาน
 *
 *   node tools/balance.js [กลยุทธ์]
 * กลยุทธ์: best (เลือกตัว DPS สูงสุดที่จับได้) | random | starter
 * ===================================================================== */
const { chromium } = require('playwright');
const path = require('path');
const { serve } = require('./server');

const REPO = path.resolve(__dirname, '..');
const SPRITES = process.env.SPRITES || '/tmp/claude-0/sprites';
const PORT = 8902;
const STRATEGY = process.argv[2] || 'best';
const DIFF_HP = Number(process.env.DIFF_HP || 1);
const DIFF_COUNT = Number(process.env.DIFF_COUNT || 1);
const HP_BASE = Number(process.env.HP_BASE || 0);
const HP_STEP = Number(process.env.HP_STEP || 0);
const CATCH_PER_STAGE = Number(process.argv[3] || 10);

(async () => {
  const server = await serve([['/sprites', SPRITES], ['/', REPO]], PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(700);

  const out = await page.evaluate(({ STRATEGY, CATCH_PER_STAGE, DIFF_HP, DIFF_COUNT, HP_BASE, HP_STEP }) => {
    const PTD = window.PTD, B = PTD.battle, M = PTD.map;
    PTD.campaign.DIFF.hp = DIFF_HP;
    PTD.campaign.DIFF.count = DIFF_COUNT;
    if (HP_BASE) {
      // ปรับทั้งเส้นด้วยตัวคูณเดียว ใช้ตอนกวาดหาค่า
      PTD.campaign.setHpTargets(PTD.campaign.hpTargets.map(v => v * HP_BASE));
    }
    if (PTD.audio.enabled) PTD.audio.toggle();
    PTD.save.reset();
    PTD.save.data.started = true;
    PTD.save.addMon(4, 5);            // Charmander เป็นตัวเริ่มต้น

    let rndSeed = 12345;
    const rnd = () => {
      rndSeed = (rndSeed * 1103515245 + 12345) & 0x7fffffff;
      return rndSeed / 0x7fffffff;
    };

    /* ---- จำลองการออกไปจับในโซนที่ปลดล็อกแล้ว ---- */
    function goCatch(n) {
      const zones = PTD.safari.unlockedZones().filter(z => z.unlocked).map(z => z.zone);
      if (!zones.length) return 0;
      let got = 0;
      for (let i = 0; i < n * 4 && got < n; i++) {
        const z = zones[Math.floor(rnd() * zones.length)];
        const pool = PTD.safari.poolOf(z);
        const id = pool[Math.floor(rnd() * pool.length)];
        const lv = z.lv[0] + Math.floor(rnd() * (z.lv[1] - z.lv[0] + 1));
        // ใช้โอกาสจับจริงตัดสิน แต่ถือว่าขว้างหินก่อน (angry 2)
        const enc = { id, lv, angry: 2, eating: 0, turns: 0 };
        let tries = 6;
        while (tries-- > 0) {
          if (!PTD.save.balls) break;
          PTD.save.useBall();
          if (rnd() < PTD.safari.catchChance(enc)) { PTD.save.addMon(id, lv); got++; break; }
          if (rnd() < PTD.safari.fleeChance(enc)) break;
        }
      }
      return got;
    }

    /* ---- เลือกทีม 6 ตัวที่ดีที่สุด ---- */
    function pickParty() {
      const box = PTD.save.data.box.slice();
      if (STRATEGY === 'random') {
        box.sort(() => rnd() - .5);
      } else if (STRATEGY === 'starterX') {
        box.sort((a, b) => a.uid - b.uid);
      } else {
        // best: เรียงตาม DPS โดยประมาณที่เลเวลปัจจุบัน แล้วเลือกให้ธาตุไม่ซ้ำกันมาก
        const score = (m) => {
          const t = PTD.tower(m.id);
          return t.dmg * (1 + .10 * (m.lv - 1)) * t.rate * (t.targets || 1);
        };
        box.sort((a, b) => score(b) - score(a));
        const chosen = [], types = new Set();
        for (const m of box) {
          const t = PTD.tower(m.id);
          if (chosen.length >= 6) break;
          if (types.has(t.moveType) && chosen.length < 5) continue;
          chosen.push(m); types.add(t.moveType);
        }
        for (const m of box) { if (chosen.length >= 6) break; if (!chosen.includes(m)) chosen.push(m); }
        PTD.save.setParty(chosen.slice(0, 6).map(m => m.uid));
        return;
      }
      PTD.save.setParty(box.slice(0, 6).map(m => m.uid));
    }

    /* ---- หาช่องวางที่ครอบคลุมเส้นทางมากที่สุด ---- */
    function goodSpots() {
      const spots = [];
      for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
        if (!M.buildable(c, r)) continue;
        let near = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < M.ROWS && cc >= 0 && cc < M.COLS && M.blocked[rr][cc] === 1) near++;
        }
        if (near) spots.push({ c, r, near });
      }
      spots.sort((a, b) => b.near - a.near);
      return spots;
    }

    /* ---- เล่นหนึ่งด่าน ---- */
    function play(cfg, label) {
      B.enter(cfg);
      // HP รวมทั้งด่าน เทียบกับ DPS ของทีม = "ต้องยิงกี่วินาทีถึงจะเคลียร์หมด"
      let totalHp = 0;
      for (const w of B.waves) for (const g of w.groups)
        totalHp += g.count * PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX }).hp * w.hpMul;
      const leaks = {};
      const orig = B.leak.bind(B);
      B.leak = function (e) {
        const k = e.def.name + (e.def.boss ? '(บอส)' : '');
        leaks[k] = (leaks[k] || 0) + 1;
        return orig(e);
      };

      /* ตอนนี้ลงสนามต้องจ่ายเงิน วางครบ 6 ตั้งแต่แรกไม่ได้แล้ว
       * ทั้งสองกลยุทธ์จึงต้องทยอยวางตามเงินที่หามาได้ */
      const spots = goodSpots();
      let nextSpot = 0;
      function deployAffordable() {
        for (const s of B.roster) {
          if (s.placed) continue;
          if (!B.canAfford(s.mon)) continue;
          while (nextSpot < spots.length && B.towerAt(spots[nextSpot].c, spots[nextSpot].r)) nextSpot++;
          if (nextSpot >= spots.length) return;
          B.placing = s.mon.uid;
          B.tryPlace(spots[nextSpot].c, spots[nextSpot].r);
          B.placing = null;
        }
      }
      // แพงสุดก่อน จะได้ไม่เอาเงินไปถมตัวอ่อนจนวางตัวหลักไม่ได้
      B.roster.sort((a, b) => B.deployCost(b.mon) - B.deployCost(a.mon));
      deployAffordable();
      // กลยุทธ์ idle = วางเท่าที่เงินตั้งต้นพอ แล้วไม่แตะอะไรอีกเลย
      // ใช้ทดสอบว่าเกม "ปล่อยทิ้งก็ชนะ" ไหม
      const IDLE = STRATEGY === 'idle';

      const dt = 1 / 30;
      let steps = 0, thinkT = 0;
      const MAX = 30 * 60 * 25;
      B.startWave();
      while (B.state !== 'won' && B.state !== 'lost' && steps < MAX) {
        B.update(dt);
        steps++;
        thinkT += dt;
        if (thinkT >= .5 && !IDLE) {
          thinkT = 0;
          deployAffordable();           // เอาตัวที่เหลือลงสนามทันทีที่เงินพอ
          // วิวัฒนาการก่อน แล้วค่อยป้อนลูกอม
          let did = false;
          for (const t of B.towers) {
            if (t.canEvolve && B.money >= t.def.evolveCost) {
              B.selected = t; B.evolveSelected(0); B.selected = null; did = true; break;
            }
          }
          if (!did) {
            // ใช้เมก้าทันทีที่มีหินและเจอบอส
            if (!B.megaUsed && B.enemies.some(e => e.def.boss)) {
              for (const t of B.towers) {
                if (B.canMega(t)) { B.selected = t; B.doMega(B.megaOptions(t)[0].form); B.selected = null; break; }
              }
            }
            const low = B.towers.filter(t => t.level < PTD.MAX_LEVEL).sort((a, b) => a.level - b.level);
            if (low.length) {
              const t = low[0], cost = B.candyCost(t);
              if (B.money >= cost * 2) { B.selected = t; B.buyCandy(); B.selected = null; }
            }
          }
        }
        if (B.state === 'break' && B.breakLeft < 3) B.startWave();
      }
      B.leak = orig;
      return {
        label, won: B.state === 'won', wave: B.waveIndex + 1, waves: B.waves.length,
        lives: B.lives, dps: Math.round(B.towers.reduce((s, t) => s + t.dps, 0)),
        team: B.towers.map(t => t.def.name + ' Lv' + t.level),
        maxLv: B.towers.reduce((m, t) => Math.max(m, t.level), 0),
        placed: B.towers.length, moneyLeft: Math.round(B.money),
        questBest: B.mode === 'quest' ? Math.round(B.questBest * 100) : null,
        totalHp: Math.round(totalHp),
        secNeeded: Math.round(totalHp / Math.max(1, B.towers.reduce((s, t) => s + t.dps, 0))),
        leaks: Object.entries(leaks).sort((a, b) => b[1] - a[1]).slice(0, 4)
      };
    }

    /* ---- เดินแคมเปญ ---- */
    const log = [];
    for (const st of PTD.campaign.STAGES) {
      PTD.save.addBalls(60);
      const caught = goCatch(CATCH_PER_STAGE);
      pickParty();
      const r = play({ stage: st }, `ด่าน ${st.no} ${st.name}`);
      r.caught = caught;
      r.box = PTD.save.data.box.length;
      r.dexCaught = PTD.save.dexCaught;
      log.push(r);
      if (!r.won) break;
    }

    /* ---- เควสที่ปลดล็อกได้ ---- */
    const quests = [];
    for (const q of PTD.campaign.QUESTS) {
      if (!PTD.campaign.questUnlocked(q)) {
        quests.push({ label: q.name, locked: true, need: q.need,
                      have: { stages: PTD.save.data.cleared.length, caught: PTD.save.dexCaught } });
        continue;
      }
      pickParty();
      quests.push(play({ quest: q }, q.name + ' (' + PTD.dex(q.species).n + ')'));
    }

    return { strategy: STRATEGY, log, quests,
             final: { box: PTD.save.data.box.length, dex: PTD.save.dexCaught,
                      money: PTD.save.money, stones: PTD.save.data.stones.length } };
  }, { STRATEGY, CATCH_PER_STAGE, DIFF_HP, DIFF_COUNT, HP_BASE, HP_STEP });

  console.log(`\n=== ${out.strategy} · จับ ${CATCH_PER_STAGE}/ด่าน · hp×${DIFF_HP} count×${DIFF_COUNT} ===`);
  console.log('ผล  ด่าน                       เวฟ    หัวใจ  ลง  เงินเหลือ  DPS   maxLv  จับ  HPรวม  วิ.ที่ต้องยิง  ตัวที่หลุด');
  for (const r of out.log) {
    console.log(
      (r.won ? ' ✓ ' : ' ✗ '),
      r.label.padEnd(24),
      `${r.wave}/${r.waves}`.padStart(5),
      String(r.lives).padStart(6),
      String(r.placed).padStart(3),
      String(r.moneyLeft).padStart(9),
      String(r.dps).padStart(6),
      String(r.maxLv).padStart(6),
      String(r.dexCaught).padStart(4),
      String(Math.round(r.totalHp / 1000) + 'k').padStart(7),
      String(r.secNeeded).padStart(9), '  ',
      r.leaks.map(([k, v]) => `${k}x${v}`).join(', ') || '—');
  }
  console.log('\nเควสในตำนาน:');
  for (const q of out.quests) {
    if (q.locked) {
      console.log(`  🔒 ${q.label} — ต้องผ่าน ${q.need.stages} ด่าน (มี ${q.have.stages}) และจับ ${q.need.caught} สายพันธุ์ (มี ${q.have.caught})`);
    } else {
      console.log(`  ${q.won ? '✓' : '✗'} ${q.label} — กดเลือดต่ำสุด ${q.questBest}% · DPS ${q.dps}`);
    }
  }
  console.log('\nท้ายเกม:', JSON.stringify(out.final));
  if (out.log.length) console.log('ทีมสุดท้าย:', out.log[out.log.length - 1].team.join(', '));
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5));
  await browser.close();
  server.close();
})();
