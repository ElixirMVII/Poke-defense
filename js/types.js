/* =====================================================================
 * types.js — ระบบธาตุ (Type Chart) ของเกม
 * ===================================================================== */
(function (PTD) {
  'use strict';

  // สีประจำธาตุ ใช้ทั้งใน UI และเอฟเฟกต์กระสุน
  const TYPE_COLOR = {
    Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Electric: '#f8d030',
    Grass: '#78c850', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0',
    Ground: '#e0c068', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
    Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848',
    Steel: '#b8b8d0', Fairy: '#ee99ac'
  };

  const TYPE_TH = {
    Normal: 'ธรรมดา', Fire: 'ไฟ', Water: 'น้ำ', Electric: 'ไฟฟ้า', Grass: 'หญ้า',
    Ice: 'น้ำแข็ง', Fighting: 'ต่อสู้', Poison: 'พิษ', Ground: 'ดิน', Flying: 'บิน',
    Psychic: 'พลังจิต', Bug: 'แมลง', Rock: 'หิน', Ghost: 'ผี', Dragon: 'มังกร',
    Dark: 'อสูร', Steel: 'เหล็ก', Fairy: 'แฟรี่'
  };

  // ตารางธาตุจริงของโปเกม่อน — เก็บเฉพาะช่องที่ไม่ใช่ 1x
  // TYPE_CHART[ธาตุของท่า][ธาตุของเป้าหมาย] = ตัวคูณ
  const TYPE_CHART = {
    Normal:   { Rock: .5, Ghost: 0, Steel: .5 },
    Fire:     { Fire: .5, Water: .5, Grass: 2, Ice: 2, Bug: 2, Rock: .5, Dragon: .5, Steel: 2 },
    Water:    { Fire: 2, Water: .5, Grass: .5, Ground: 2, Rock: 2, Dragon: .5 },
    Electric: { Water: 2, Electric: .5, Grass: .5, Ground: 0, Flying: 2, Dragon: .5 },
    Grass:    { Fire: .5, Water: 2, Grass: .5, Poison: .5, Ground: 2, Flying: .5, Bug: .5, Rock: 2, Dragon: .5, Steel: .5 },
    Ice:      { Fire: .5, Water: .5, Grass: 2, Ice: .5, Ground: 2, Flying: 2, Dragon: 2, Steel: .5 },
    Fighting: { Normal: 2, Ice: 2, Poison: .5, Flying: .5, Psychic: .5, Bug: .5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: .5 },
    Poison:   { Grass: 2, Poison: .5, Ground: .5, Rock: .5, Ghost: .5, Steel: 0, Fairy: 2 },
    Ground:   { Fire: 2, Electric: 2, Grass: .5, Poison: 2, Flying: 0, Bug: .5, Rock: 2, Steel: 2 },
    Flying:   { Electric: .5, Grass: 2, Fighting: 2, Bug: 2, Rock: .5, Steel: .5 },
    Psychic:  { Fighting: 2, Poison: 2, Psychic: .5, Dark: 0, Steel: .5 },
    Bug:      { Fire: .5, Grass: 2, Fighting: .5, Poison: .5, Flying: .5, Psychic: 2, Ghost: .5, Dark: 2, Steel: .5, Fairy: .5 },
    Rock:     { Fire: 2, Ice: 2, Fighting: .5, Ground: .5, Flying: 2, Bug: 2, Steel: .5 },
    Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: .5 },
    Dragon:   { Dragon: 2, Steel: .5, Fairy: 0 },
    Dark:     { Fighting: .5, Psychic: 2, Ghost: 2, Dark: .5, Fairy: .5 },
    Steel:    { Fire: .5, Water: .5, Electric: .5, Ice: 2, Rock: 2, Steel: .5, Fairy: 2 },
    Fairy:    { Fire: .5, Fighting: 2, Poison: .5, Dragon: 2, Dark: 2, Steel: .5 }
  };

  // ในเกมแนว TD ถ้าตัวคูณเป็น 0 ป้อมจะกลายเป็นขยะไปเลย
  // เราเลยยกพื้นเป็น 0.25x ("แทบไม่ได้ผล") แทนภูมิคุ้มกันเต็มรูปแบบ
  const IMMUNE_FLOOR = 0.25;

  function effectiveness(moveType, defenderTypes) {
    const row = TYPE_CHART[moveType];
    if (!row) return 1;
    let mult = 1;
    for (const t of defenderTypes) {
      const m = row[t];
      mult *= (m === undefined ? 1 : m);
    }
    return mult === 0 ? IMMUNE_FLOOR : mult;
  }

  function effLabel(mult) {
    if (mult >= 3.9) return { text: 'ได้ผลชะงัดสุด ๆ!', cls: 'eff-best' };
    if (mult >= 1.9) return { text: 'ได้ผลชะงัด!', cls: 'eff-good' };
    if (mult > 1) return { text: 'ได้ผลดี', cls: 'eff-good' };
    if (mult === 1) return { text: 'ปกติ', cls: 'eff-neutral' };
    if (mult > IMMUNE_FLOOR) return { text: 'ไม่ค่อยได้ผล', cls: 'eff-bad' };
    return { text: 'แทบไม่ได้ผล', cls: 'eff-worst' };
  }

  PTD.TYPE_COLOR = TYPE_COLOR;
  PTD.TYPE_TH = TYPE_TH;
  PTD.TYPE_CHART = TYPE_CHART;
  PTD.effectiveness = effectiveness;
  PTD.effLabel = effLabel;
})(window.PTD = window.PTD || {});
