/* =====================================================================
 * waves.js — ตัวสร้างเวฟ
 *
 * ไม่ได้ไล่พิมพ์มือทีละเวฟ แต่แบ่งโปเกม่อนเป็นระดับตามค่า BST
 * แล้วค่อย ๆ เลื่อนส่วนผสมไปทางระดับที่แรงขึ้น
 * ใช้ตัวสุ่มแบบ seed คงที่ เวฟของด่านเดิมจึงเหมือนเดิมทุกครั้ง
 * ===================================================================== */
(function (PTD) {
  'use strict';

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* opts:
   *   count      จำนวนเวฟ
   *   seed       เลข seed ของด่านนี้
   *   tierFrom   ระดับความแรงตอนเริ่ม (0-4)
   *   tierTo     ระดับตอนจบ
   *   hpFrom     ตัวคูณ HP เวฟแรก
   *   hpPow/hpK  รูปโค้งของตัวคูณ HP
   *   countBase/countStep  จำนวนศัตรูต่อกลุ่ม
   *   pool       จำกัดสายพันธุ์ (เช่น เฉพาะถิ่นอาศัยของด่านนั้น) — ไม่ใส่ = ทั้งหมด
   *   bosses     { เลขเวฟ: {id, aura, x} }
   *   escort     { เลขเวฟ: [id, ...] }
   */
  function buildWaves(opts) {
    const o = Object.assign({
      count: 10, seed: 1, tierFrom: 0, tierTo: 3,
      hpFrom: 0.85, hpPow: 1.20, hpK: 0.115,
      countBase: 6, countStep: 0.38,
      pool: null, bosses: {}, escort: {}
    }, opts || {});

    const bossIds = new Set(Object.values(o.bosses).map(b => b.id));
    for (const arr of Object.values(o.escort)) for (const id of arr) bossIds.add(id);

    let roster = PTD.DEX.filter(d => !d.lg && !bossIds.has(d.id));
    if (o.pool && o.pool.length) {
      const allow = new Set(o.pool);
      const filtered = roster.filter(d => allow.has(d.id));
      // ถิ่นอาศัยบางแห่งมีสมาชิกน้อย ถ้าน้อยเกินไปก็ผสมตัวอื่นเข้าไปด้วย
      roster = filtered.length >= 12 ? filtered
             : filtered.concat(roster.filter(d => !allow.has(d.id)).slice(0, 24));
    }
    // เรียงตาม "ความน่ากลัวจริง" (อึดหลังคิดเกราะ) ไม่ใช่ BST
    // เพราะ BST ไม่บอกว่าตัวไหนแทงไม่เข้า — Chansey BST แค่ 450 แต่อึดกว่าใครในเกม
    roster.sort((a, b) => PTD.threatOf(a.id) - PTD.threatOf(b.id) || a.id - b.id);

    // แบ่งเป็น 5 ระดับด้วยการหั่นตามลำดับ ให้แต่ละระดับมีสมาชิกพอ ๆ กัน
    const pools = [[], [], [], [], []];
    roster.forEach((d, i) => pools[Math.min(4, Math.floor(i * 5 / roster.length))].push(d.id));

    const rnd = mulberry(o.seed);
    const waves = [];
    const recent = [];

    function pick(tier, usedInWave) {
      for (let spread = 0; spread < 5; spread++) {
        for (const t of [tier - spread, tier + spread]) {
          if (t < 0 || t > 4 || !pools[t] || !pools[t].length) continue;
          const cand = pools[t].filter(id => !usedInWave.has(id) && !recent.includes(id));
          const from = cand.length ? cand : pools[t].filter(id => !usedInWave.has(id));
          if (from.length) return from[Math.floor(rnd() * from.length)];
        }
      }
      return pools.flat()[0];
    }

    for (let i = 0; i < o.count; i++) {
      const w = i + 1;
      const prog = o.count > 1 ? i / (o.count - 1) : 1;
      const center = o.tierFrom + (o.tierTo - o.tierFrom) * prog;

      const weights = pools.map((p, t) => p.length ? Math.max(0, 1 - Math.abs(t - center) / 1.6) : 0);
      const sum = weights.reduce((a, b) => a + b, 0) || 1;

      const groups = [];
      const used = new Set();
      // มีป้อมได้แค่ 6 ตัว ถ้าปล่อย 4 กลุ่มพร้อมกันคือ 60 ตัวต่อเวฟ รับไม่ไหวแน่
      const nGroups = w <= 2 ? 1 : (w <= 6 ? 2 : 3);
      let delay = 0;

      for (let g = 0; g < nGroups; g++) {
        let r = rnd() * sum, tier = 0;
        for (let t = 0; t < weights.length; t++) { r -= weights[t]; if (r <= 0) { tier = t; break; } }
        const id = pick(tier, used);
        used.add(id);
        recent.push(id);
        while (recent.length > 9) recent.shift();

        const count = Math.max(4, Math.round((o.countBase + i * o.countStep) * (g === 0 ? 1 : 0.8)));
        const gap = Math.max(0.28, 0.9 - i * 0.02);
        groups.push({ id, count, gap, delay: Math.round(delay * 10) / 10 });
        delay += 2.5 + rnd() * 2;
      }

      const boss = o.bosses[w];
      if (boss) {
        groups.unshift({ id: boss.id, count: 1, gap: 1, delay: 0, boss: true, aura: boss.aura, bossX: boss.x });
        for (const id of (o.escort[w] || [])) {
          groups.push({ id, count: 1, gap: 1, delay: 10 + rnd() * 8, boss: true, aura: null, bossX: boss.x * .55 });
        }
      }

      waves.push({
        hpMul: Math.round((o.hpFrom + Math.pow(i, o.hpPow) * o.hpK) * 100) / 100,
        groups,
        hasBoss: !!boss
      });
    }
    return waves;
  }

  PTD.buildWaves = buildWaves;
  PTD.waveCount = (waves, i) => waves[i].groups.reduce((s, g) => s + g.count, 0);
})(window.PTD = window.PTD || {});
