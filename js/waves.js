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
  /* ลักษณะพิเศษประจำเวฟ — ยืมแนวคิดจากเวฟพิเศษของ Bloons/Kingdom Rush
   * เดิมเวฟต่างกันแค่ "เลือดเยอะขึ้น" ซึ่งไม่ได้เปลี่ยนวิธีเล่นเลย
   * อันนี้บังคับให้ผู้เล่นเปลี่ยนแผน เช่น เวฟเกราะหนาต้องพึ่งตัวตีแรงทีละที
   * ทุกตัวปรับสองทางเสมอ (ได้อย่างเสียอย่าง) จะได้ไม่ใช่แค่ยากขึ้นเฉย ๆ */
  const MODIFIERS = {
    swift:   { name: 'ฝูงเร็ว',    th: 'เดินเร็วขึ้นมาก แต่เลือดบาง',
               icon: '»', color: '#6bc8ff', speed: 1.5,  hp: .72, armor: 1,   count: 1 },
    armored: { name: 'เกราะหนา',   th: 'เกราะหนาขึ้นมาก แต่เดินช้า',
               icon: '#', color: '#b8b8d0', speed: .78,  hp: 1,   armor: 2.1, count: 1 },
    horde:   { name: 'ฝูงใหญ่',    th: 'มากันเยอะมาก แต่ตัวละเอียดน้อย',
               icon: '+', color: '#ffb35a', speed: 1.05, hp: .52, armor: .8,  count: 1.8 },
    regen:   { name: 'ฟื้นเลือด',  th: 'ค่อย ๆ ฟื้นเลือดถ้าฆ่าไม่ขาด',
               icon: '~', color: '#5ec06d', speed: .95,  hp: .88, armor: 1,   count: 1, regen: .035 }
  };
  const MOD_KEYS = Object.keys(MODIFIERS);

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
      /* ถิ่นอาศัยบางแห่งมีสมาชิกน้อย ถ้าน้อยเกินไปก็ต้องผสมตัวอื่นเข้าไป
       * แต่ต้องเติมจาก "ช่วง id เดียวกับพูลเดิม" ไม่ใช่จากต้นเด็กซ์
       * ไม่งั้นด่านโจโต/โฮเอ็นจะมีตัวคันโตโผล่มาปนจนธีมภูมิภาคพัง */
      if (filtered.length < 12) {
        const lo = Math.min(...o.pool), hi = Math.max(...o.pool);
        const near = roster
          .filter(d => !allow.has(d.id) && d.id >= lo && d.id <= hi)
          .sort((a, b) => a.bst - b.bst);
        roster = filtered.concat(near.slice(0, 24 - filtered.length));
        if (roster.length < 8) roster = filtered.concat(near);   // เผื่อยังไม่พออีก
      } else {
        roster = filtered;
      }
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

      /* ลักษณะพิเศษ: เว้นสองเวฟแรกไว้ให้ผู้เล่นตั้งตัว แล้วโผล่ทุก ๆ 3 เวฟโดยประมาณ
       * เวฟบอสไม่ใส่ เพราะบอสมีลูกเล่นของตัวเองอยู่แล้ว */
      let mod = null;
      if (!o.bosses[w] && w > 2 && rnd() < .42) mod = MOD_KEYS[Math.floor(rnd() * MOD_KEYS.length)];
      const M = mod ? MODIFIERS[mod] : null;

      const groups = [];
      const used = new Set();
      /* หั่นจำนวนศัตรูรวมของเวฟไปตามกลุ่ม แทนที่จะให้ทุกกลุ่มเต็มจำนวน
       * เลยเพิ่มความหลากหลายของสายพันธุ์ได้โดยที่ภาระรวมไม่บานปลาย
       * (เดิม 1-4 ชนิดต่อเวฟ ด่าน 5 ทั้งด่านเจอแค่ 13 ชนิด) */
      const nGroups = w <= 1 ? 2 : (w <= 4 ? 3 : (w <= 9 ? 4 : 5));
      let total = Math.round((o.countBase + i * o.countStep * 2.4) * (M ? M.count : 1));
      total = Math.max(nGroups * 2, total);
      let delay = 0;

      for (let g = 0; g < nGroups; g++) {
        let r = rnd() * sum, tier = 0;
        for (let t = 0; t < weights.length; t++) { r -= weights[t]; if (r <= 0) { tier = t; break; } }
        const id = pick(tier, used);
        used.add(id);
        recent.push(id);
        while (recent.length > 9) recent.shift();

        const left = nGroups - g;
        const count = Math.max(2, Math.round(total / left));
        total -= count;
        const gap = Math.max(0.26, 0.85 - i * 0.018);
        groups.push({ id, count, gap, delay: Math.round(delay * 10) / 10 });
        // กลุ่มถัดไปตามมาไวขึ้นเมื่อด่านลึกขึ้น แถวจะได้ทับซ้อนกันบ้างแต่ไม่กองเป็นก้อนเดียว
        delay += Math.max(1.1, 2.6 - i * .06) + rnd() * 1.6;
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
        hasBoss: !!boss,
        mod, modInfo: M
      });
    }
    return waves;
  }

  PTD.buildWaves = buildWaves;
  PTD.WAVE_MODIFIERS = MODIFIERS;
  PTD.waveCount = (waves, i) => waves[i].groups.reduce((s, g) => s + g.count, 0);
})(window.PTD = window.PTD || {});
