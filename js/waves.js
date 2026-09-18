/* =====================================================================
 * waves.js — สร้างเวฟทั้ง 30 เวฟจากโปเกม่อนจริงทั้ง 151 ตัว
 *
 * ไม่ได้ไล่พิมพ์มือทีละเวฟ แต่แบ่งโปเกม่อนเป็นระดับตามค่า BST
 * แล้วค่อย ๆ เลื่อนส่วนผสมไปทางระดับที่แรงขึ้นเรื่อย ๆ
 * ใช้ตัวสุ่มแบบ seed คงที่ เวฟจึงเหมือนเดิมทุกครั้งที่เล่น
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TOTAL = 30;

  // บอสประจำเวฟ — กระจายตัวในตำนานให้เจอทีละตัว ไม่กองรวมท้ายเกม
  const BOSSES = {
    5:  { id: 95,  aura: null,    x: 5 },   // Onix
    10: { id: 130, aura: null,    x: 6 },   // Gyarados
    15: { id: 144, aura: 'chill', x: 6 },   // Articuno
    20: { id: 143, aura: null,    x: 7 },   // Snorlax
    25: { id: 146, aura: null,    x: 7 },   // Moltres
    30: { id: 150, aura: 'drain', x: 11 }   // Mewtwo
  };
  // ตัวเสริมที่โผล่ตามมาทีหลังในเวฟบอสใหญ่
  const ESCORT = { 25: [145], 30: [149, 151] };   // Zapdos / Dragonite + Mew

  // สุ่มแบบกำหนด seed ได้ ผลลัพธ์จึงคงที่
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function build() {
    const bossIds = new Set(Object.values(BOSSES).map(b => b.id));
    for (const arr of Object.values(ESCORT)) for (const id of arr) bossIds.add(id);

    // แบ่งเป็น 5 ระดับด้วยการหั่นตามลำดับ BST ให้แต่ละระดับมีสมาชิกพอ ๆ กัน
    // (ถ้าหั่นด้วยเลข BST ตายตัว ระดับบนสุดจะเหลือตัวเดียวแล้วโผล่ซ้ำทั้งเกม)
    const roster = PTD.DEX
      .filter(d => !d.lg && !bossIds.has(d.id))
      .sort((a, b) => a.bst - b.bst || a.id - b.id);
    const pools = [[], [], [], [], []];
    roster.forEach((d, i) => {
      pools[Math.min(4, Math.floor(i * 5 / roster.length))].push(d.id);
    });

    const rnd = mulberry(20260918);
    const waves = [];
    const recent = [];                 // ตัวที่เพิ่งใช้ไป เลี่ยงไม่ให้ซ้ำติด ๆ กัน

    function pick(tier, usedInWave) {
      // ไล่หาในระดับที่ต้องการก่อน ถ้าไม่เจอค่อยขยับระดับข้างเคียง
      for (let spread = 0; spread < 5; spread++) {
        for (const t of [tier - spread, tier + spread]) {
          if (t < 0 || t > 4 || !pools[t] || !pools[t].length) continue;
          const cand = pools[t].filter(id => !usedInWave.has(id) && !recent.includes(id));
          const from = cand.length ? cand : pools[t].filter(id => !usedInWave.has(id));
          if (from.length) return from[Math.floor(rnd() * from.length)];
        }
      }
      return pools[0][0];
    }

    for (let i = 0; i < TOTAL; i++) {
      const w = i + 1;
      const prog = i / (TOTAL - 1);
      const center = prog * 4;

      const weights = pools.map((p, t) => {
        if (!p.length) return 0;
        return Math.max(0, 1 - Math.abs(t - center) / 1.6);
      });
      const sum = weights.reduce((a, b) => a + b, 0) || 1;

      const groups = [];
      const used = new Set();
      const nGroups = w <= 2 ? 1 : (w <= 8 ? 2 : 3);
      let delay = 0;

      for (let g = 0; g < nGroups; g++) {
        let r = rnd() * sum, tier = 0;
        for (let t = 0; t < weights.length; t++) { r -= weights[t]; if (r <= 0) { tier = t; break; } }
        const id = pick(tier, used);
        used.add(id);
        recent.push(id);
        while (recent.length > 9) recent.shift();

        const count = Math.max(4, Math.round((6 + i * 0.38) * (g === 0 ? 1 : 0.8)));
        const gap = Math.max(0.28, 0.9 - i * 0.02);
        groups.push({ id, count, gap, delay: Math.round(delay * 10) / 10 });
        delay += 2.5 + rnd() * 2;
      }

      const boss = BOSSES[w];
      if (boss) {
        groups.unshift({ id: boss.id, count: 1, gap: 1, delay: 0, boss: true, aura: boss.aura, bossX: boss.x });
        for (const id of (ESCORT[w] || [])) {
          groups.push({ id, count: 1, gap: 1, delay: 10 + rnd() * 8, boss: true, aura: null, bossX: boss.x * .55 });
        }
      }

      waves.push({
        hpMul: Math.round((0.85 + Math.pow(i, 1.20) * 0.115) * 100) / 100,
        groups,
        hasBoss: !!boss
      });
    }
    return waves;
  }

  const WAVES = build();

  PTD.WAVES = WAVES;
  PTD.TOTAL_WAVES = WAVES.length;
  PTD.waveCount = (i) => WAVES[i].groups.reduce((s, g) => s + g.count, 0);
})(window.PTD = window.PTD || {});
