/* =====================================================================
 * waves.js — ตารางเวฟ 30 เวฟ (ทุก ๆ 5 เวฟเจอบอส)
 * แต่ละกลุ่ม: [รหัสศัตรู, จำนวน, ช่วงห่างระหว่างตัว(วินาที), หน่วงเวลาเริ่ม(วินาที)]
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const W = (hpMul, ...groups) => ({
    hpMul,
    groups: groups.map(([id, count, gap, delay]) => ({ id, count, gap: gap || .8, delay: delay || 0 }))
  });

  const WAVES = [
    /*  1 */ W(1.00, ['rattata', 8, .85]),
    /*  2 */ W(1.00, ['rattata', 6, .7], ['caterpie', 5, .8, 4]),
    /*  3 */ W(1.05, ['pidgey', 8, .6], ['rattata', 6, .6, 3]),
    /*  4 */ W(1.05, ['caterpie', 8, .55], ['weedle', 8, .55, 3]),
    /*  5 */ W(1.10, ['zubat', 10, .5], ['pidgey', 8, .5, 3]),
    /*  6 */ W(1.15, ['ekans', 9, .7], ['weedle', 10, .4, 2]),
    /*  7 */ W(1.20, ['sandshrew', 8, .8], ['rattata', 12, .35, 2]),
    /*  8 */ W(1.25, ['psyduck', 10, .65], ['zubat', 12, .4, 3]),
    /*  9 */ W(1.30, ['growlithe', 9, .7], ['ekans', 10, .5, 3]),
    /* 10 */ W(1.00, ['gyarados', 1, 1], ['zubat', 14, .35, 2]),

    /* 11 */ W(1.40, ['poliwag', 12, .55], ['sandshrew', 8, .7, 4]),
    /* 12 */ W(1.45, ['tentacool', 10, .7], ['psyduck', 10, .5, 3]),
    /* 13 */ W(1.50, ['voltorb', 14, .4], ['growlithe', 10, .55, 3]),
    /* 14 */ W(1.55, ['ponyta', 12, .5], ['poliwag', 10, .5, 4]),
    /* 15 */ W(1.10, ['snorlax', 1, 1], ['machopE', 8, .7, 2], ['voltorb', 12, .35, 5]),

    /* 16 */ W(1.70, ['machopE', 12, .6], ['tentacool', 12, .45, 3]),
    /* 17 */ W(1.80, ['haunterE', 14, .45], ['ponyta', 10, .5, 3]),
    /* 18 */ W(1.90, ['onix', 6, 1.1], ['machopE', 12, .5, 3]),
    /* 19 */ W(2.00, ['magmar', 10, .6], ['haunterE', 12, .4, 3]),
    /* 20 */ W(1.20, ['arcanine', 1, 1], ['magmar', 10, .55, 2], ['ponyta', 14, .3, 5]),

    /* 21 */ W(2.30, ['lapras', 8, .9], ['voltorb', 16, .3, 3]),
    /* 22 */ W(2.50, ['onix', 10, .8], ['magmar', 12, .45, 3]),
    /* 23 */ W(2.70, ['haunterE', 18, .35], ['lapras', 8, .9, 4]),
    /* 24 */ W(2.90, ['machopE', 16, .45], ['onix', 10, .7, 3]),
    /* 25 */ W(1.40, ['articuno', 1, 1], ['lapras', 10, .7, 2], ['tentacool', 16, .3, 5]),

    /* 26 */ W(3.40, ['zapdos', 1, 1], ['voltorb', 20, .28, 2]),
    /* 27 */ W(3.70, ['moltres', 1, 1], ['magmar', 14, .45, 2], ['ponyta', 16, .3, 5]),
    /* 28 */ W(4.10, ['onix', 14, .6], ['lapras', 12, .6, 3], ['machopE', 16, .4, 6]),
    /* 29 */ W(4.60, ['dragonite', 2, 3], ['haunterE', 20, .3, 2], ['magmar', 14, .4, 5]),
    /* 30 */ W(1.00, ['mewtwo', 1, 1], ['dragonite', 2, 4, 6], ['zapdos', 1, 1, 14], ['articuno', 1, 1, 20])
  ];

  PTD.WAVES = WAVES;
  PTD.TOTAL_WAVES = WAVES.length;

  // นับจำนวนศัตรูทั้งหมดในเวฟ (ใช้แสดงผลและเช็คว่าเวฟจบ)
  PTD.waveCount = (i) => WAVES[i].groups.reduce((s, g) => s + g.count, 0);
})(window.PTD = window.PTD || {});
