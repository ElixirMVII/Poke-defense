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

  const out = await page.evaluate(({ STRATEGY, CATCH_PER_STAGE }) => {
    const PTD = window.PTD, B = PTD.battle, M = PTD.map;
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
      } else if (STRATEGY === 'starter') {
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
      const leaks = {};
      const orig = B.leak.bind(B);
      B.leak = function (e) {
        const k = e.def.name + (e.def.boss ? '(บอส)' : '');
        leaks[k] = (leaks[k] || 0) + 1;
        return orig(e);
      };

      const spots = goodSpots();
      B.roster.forEach((s, i) => {
        if (!spots[i]) return;
        B.placing = s.mon.uid;
        B.tryPlace(spots[i].c, spots[i].r);
      });
      B.placing = null;

      const dt = 1 / 30;
      let steps = 0, thinkT = 0;
      const MAX = 30 * 60 * 25;
      B.startWave();
      while (B.state !== 'won' && B.state !== 'lost' && steps < MAX) {
        B.update(dt);
        steps++;
        thinkT += dt;
        if (thinkT >= .5) {
          thinkT = 0;
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
        if (B.state === 'break' && B.breakLeft < 9) B.startWave();
      }
      B.leak = orig;
      return {
        label, won: B.state === 'won', wave: B.waveIndex + 1, waves: B.waves.length,
        lives: B.lives, dps: Math.round(B.towers.reduce((s, t) => s + t.dps, 0)),
        team: B.towers.map(t => t.def.name + ' Lv' + t.level),
        maxLv: B.towers.reduce((m, t) => Math.max(m, t.level), 0),
        questBest: B.mode === 'quest' ? Math.round(B.questBest * 100) : null,
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
  }, { STRATEGY, CATCH_PER_STAGE });

  console.log(`\n=== กลยุทธ์: ${out.strategy} (จับ ${CATCH_PER_STAGE} ตัวก่อนแต่ละด่าน) ===`);
  console.log('ผล  ด่าน                       เวฟ    หัวใจ  DPS   maxLv  จับได้  ตัวที่หลุด');
  for (const r of out.log) {
    console.log(
      (r.won ? ' ✓ ' : ' ✗ '),
      r.label.padEnd(24),
      `${r.wave}/${r.waves}`.padStart(5),
      String(r.lives).padStart(6),
      String(r.dps).padStart(6),
      String(r.maxLv).padStart(6),
      String(r.dexCaught).padStart(6), ' ',
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
