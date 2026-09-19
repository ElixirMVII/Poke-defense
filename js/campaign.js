/* =====================================================================
 * campaign.js — ด่านแคมเปญ และเควสพิเศษของโปเกม่อนในตำนาน
 *
 * ด่านธรรมดา: ป้องกันตามจำนวนเวฟที่กำหนด ศัตรูดึงจากถิ่นอาศัยของด่านนั้น
 * เควสในตำนาน: ตัวในตำนานเดินผ่านสนามรอบเดียว ต้องกดเลือดมันลงต่ำกว่าเกณฑ์
 *              ก่อนที่มันจะเดินพ้นสนาม ถึงจะได้สิทธิ์จับ
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const H = { CAVE: 1, FOREST: 2, GRASS: 3, MOUNTAIN: 4, RARE: 5, ROUGH: 6, SEA: 7, URBAN: 8, EDGE: 9 };

  const byHabitat = (...ids) => PTD.DEX.filter(d => !d.lg && ids.includes(d.hb)).map(d => d.id);

  /* ปุ่มปรับความยากรวมทั้งเกม — ปรับที่นี่ทีเดียวแล้วรัน tools/balance.js ดูผล
   *
   * HP_BASE/HP_STEP คือหัวใจของการไล่ระดับ: แทนที่จะไล่จูน hpK ของ 10 ด่านทีละอัน
   * เรากำหนด "พลังชีวิตรวมทั้งด่าน" เป็นเป้าหมาย แล้วให้ระบบสเกลตัวคูณ HP
   * ของทุกเวฟให้ไปถึงเป้านั้นเอง — รูปโค้งภายในด่าน (เวฟท้ายแรงกว่าเวฟต้น) ยังอยู่ครบ
   *
   * ตัวเลขนี้อิงจากที่วัดได้ว่า DPS ของทีมโตราวเท่าตัวทุก ๆ 2-3 ด่าน
   * ถ้าปล่อยให้ HP โตเร็วกว่านั้น จะตันที่ด่านกลางเกมทันที */
  const DIFF = { hp: 1, count: 1, boss: 1 };
  // พลังชีวิตรวมเป้าหมายของแต่ละด่าน (หน่วยพัน) — จูนจากการวัดจริงด้วย tools/balance.js
  // ตัวเลขนี้ไม่ใช่เส้นโค้งสวย ๆ เพราะพลังของทีมก็ไม่ได้โตเป็นเส้นตรง
  // ช่วงกลางเกมทีมโตเร็วกว่า (ได้ร่างวิวัฒนาการ) ด่านจึงต้องกระโดดตามให้ทัน
  let HP_TARGET = [26, 44, 66, 82, 112, 140, 172, 214, 282, 322].map(k => k * 1000);

  /* ---------------- ด่านแคมเปญ ---------------- */
  // hpK/countStep คือสองตัวหลักที่คุมความยาก ปรับแล้วรัน tools/balance.js ดูผลเสมอ
  const STAGES = [
    {
      id: 's1', no: 1, name: 'ทุ่งหญ้าต้นทาง', map: 'meadow', theme: 'meadow', startMoney: 400,
      desc: 'ด่านแรก ศัตรูยังอ่อน ใช้ทำความคุ้นเคยกับการวางทีม',
      waves: 10, seed: 1101, tierFrom: 0, tierTo: 1.8,
      hpFrom: 0.85, hpPow: 1.16, hpK: 0.115, countBase: 7, countStep: 0.299,
      habitats: [H.GRASS], lives: 18,
      bosses: { 10: { id: 20, aura: null, x: 5 } },
      reward: { money: 700, balls: 18 }
    },
    {
      id: 's2', no: 2, name: 'ป่าลึก', map: 'canyon', theme: 'forest', startMoney: 440,
      desc: 'ป่าทึบ ศัตรูสายแมลงกับพิษมาเป็นฝูงใหญ่',
      waves: 12, seed: 2202, tierFrom: 0.5, tierTo: 2.4,
      hpFrom: 1.00, hpPow: 1.20, hpK: 0.135, countBase: 8, countStep: 0.325,
      habitats: [H.FOREST], lives: 18,
      bosses: { 6: { id: 123, aura: null, x: 5 }, 12: { id: 95, aura: null, x: 6 } },
      reward: { money: 950, balls: 20, stone: 15 }
    },
    {
      id: 's3', no: 3, name: 'ชานเมืองเก่า', map: 'shore', theme: 'urban', startMoney: 480,
      desc: 'ทางคดเคี้ยว ศัตรูหลากหลาย ต้องมีธาตุครอบคลุม',
      waves: 14, seed: 3303, tierFrom: 0.9, tierTo: 2.8,
      hpFrom: 1.15, hpPow: 1.22, hpK: 0.155, countBase: 8, countStep: 0.351,
      habitats: [H.URBAN], lives: 18,
      bosses: { 14: { id: 115, aura: null, x: 6 } },
      reward: { money: 1300, balls: 22, stone: 3 }
    },
    {
      id: 's4', no: 4, name: 'ริมทะเลสาบ', map: 'meadow', theme: 'lake', startMoney: 520,
      desc: 'ศัตรูสายน้ำเดินเร็ว ต้องมีตัวหน่วง',
      waves: 15, seed: 4404, tierFrom: 1.3, tierTo: 3.1,
      hpFrom: 1.30, hpPow: 1.24, hpK: 0.175, countBase: 9, countStep: 0.377,
      habitats: [H.EDGE, H.SEA], lives: 16,
      bosses: { 8: { id: 121, aura: null, x: 5 }, 15: { id: 130, aura: null, x: 7 } },
      reward: { money: 1700, balls: 24, stone: 9 }
    },
    {
      id: 's5', no: 5, name: 'ถ้ำมืด', map: 'canyon', theme: 'cave', startMoney: 560,
      desc: 'ศัตรูเกราะหนา ป้อมยิงเบา ๆ เจาะไม่เข้า',
      waves: 16, seed: 5505, tierFrom: 1.7, tierTo: 3.4,
      hpFrom: 1.45, hpPow: 1.26, hpK: 0.195, countBase: 9, countStep: 0.403,
      habitats: [H.CAVE, H.ROUGH], lives: 16,
      bosses: { 16: { id: 76, aura: 'drain', x: 7 } },
      reward: { money: 2200, balls: 26, stone: 6 }
    },
    {
      id: 's6', no: 6, name: 'เทือกเขาหิน', map: 'shore', theme: 'rocky', startMoney: 600,
      desc: 'ศัตรูหนักและช้า แต่มาไม่หยุด',
      waves: 18, seed: 6606, tierFrom: 2.0, tierTo: 3.7,
      hpFrom: 1.60, hpPow: 1.28, hpK: 0.215, countBase: 10, countStep: 0.429,
      habitats: [H.ROUGH, H.MOUNTAIN], lives: 16,
      bosses: { 9: { id: 112, aura: null, x: 6 }, 18: { id: 142, aura: null, x: 8 } },
      reward: { money: 2700, balls: 28, stone: 142 }
    },
    {
      id: 's7', no: 7, name: 'โรงไฟฟ้าร้าง', map: 'meadow', theme: 'storm', startMoney: 640,
      desc: 'ศัตรูไฟฟ้าเร็วจี๋ พลาดนิดเดียวทะลุทันที',
      waves: 18, seed: 7707, tierFrom: 2.2, tierTo: 3.9,
      hpFrom: 1.75, hpPow: 1.30, hpK: 0.235, countBase: 10, countStep: 0.455,
      habitats: [H.URBAN, H.GRASS], lives: 14,
      bosses: { 18: { id: 143, aura: null, x: 8 } },
      reward: { money: 3200, balls: 30, stone: 94 }
    },
    {
      id: 's8', no: 8, name: 'ทะเลลึก', map: 'canyon', theme: 'sea', startMoney: 680,
      desc: 'ฝูงใหญ่จากใต้น้ำ ต้องมีตัวโจมตีเป็นวง',
      waves: 20, seed: 8808, tierFrom: 2.5, tierTo: 4,
      hpFrom: 1.95, hpPow: 1.32, hpK: 0.26, countBase: 11, countStep: 0.481,
      habitats: [H.SEA, H.EDGE], lives: 14,
      bosses: { 10: { id: 131, aura: null, x: 7 }, 20: { id: 134, aura: 'chill', x: 8 } },
      reward: { money: 3800, balls: 32, stone: 130 }
    },
    {
      id: 's9', no: 9, name: 'ภูเขาไฟ', map: 'shore', theme: 'volcano', startMoney: 720,
      desc: 'ศัตรูธาตุไฟล้วน สายน้ำกับหินได้เปรียบเต็ม ๆ',
      waves: 20, seed: 9909, tierFrom: 2.8, tierTo: 4,
      hpFrom: 2.15, hpPow: 1.34, hpK: 0.285, countBase: 11, countStep: 0.507,
      habitats: [H.MOUNTAIN, H.ROUGH], lives: 14,
      bosses: { 20: { id: 59, aura: 'drain', x: 9 } },
      reward: { money: 4500, balls: 34, stone: 65 }
    },
    {
      id: 's10', no: 10, name: 'ยอดเขาสูงสุด', map: 'meadow', theme: 'summit', startMoney: 760,
      desc: 'ด่านสุดท้าย ทุกอย่างที่เคยเจอกลับมารวมกัน',
      waves: 24, seed: 10010, tierFrom: 3.0, tierTo: 4,
      hpFrom: 2.40, hpPow: 1.36, hpK: 0.315, countBase: 12, countStep: 0.546,
      habitats: [H.MOUNTAIN, H.URBAN, H.GRASS, H.ROUGH], lives: 12,
      bosses: { 12: { id: 149, aura: 'drain', x: 8 }, 24: { id: 150, aura: 'drain', x: 11 } },
      escort: { 24: [143, 142] },
      reward: { money: 6000, balls: 40, stone: 150 }
    }
  ];

  /* ---------------- เควสในตำนาน ---------------- */
  // ต้องกดเลือดให้ต่ำกว่า threshold ก่อนที่มันจะเดินพ้นสนาม
  const QUESTS = [
    {
      id: 'q-articuno', species: 144, name: 'ถ้ำน้ำแข็งลึก', map: 'canyon', theme: 'cave',
      desc: 'Articuno บินผ่านถ้ำรอบเดียว ออร่าเย็นทำให้ทีมยิงช้าลง',
      need: { stages: 3, caught: 15 },
      hpX: 22, threshold: 0.25, aura: 'chill', adds: [87, 91],   // Dewgong, Cloyster
      reward: { money: 1500, balls: 10 }
    },
    {
      id: 'q-zapdos', species: 145, name: 'โรงไฟฟ้าร้าง', map: 'meadow', theme: 'storm',
      desc: 'Zapdos เร็วมาก ต้องมีป้อมยิงถี่หรือธาตุที่ได้เปรียบ',
      need: { stages: 5, caught: 26 },
      hpX: 28, threshold: 0.25, aura: null, adds: [81, 100, 125],
      reward: { money: 1800, balls: 10 }
    },
    {
      id: 'q-moltres', species: 146, name: 'ปล่องภูเขาไฟ', map: 'shore', theme: 'volcano',
      desc: 'Moltres เผาทุกอย่างระหว่างทาง สายน้ำกับหินได้เปรียบ',
      need: { stages: 7, caught: 38 },
      hpX: 32, threshold: 0.25, aura: null, adds: [126, 59, 78],
      reward: { money: 2200, balls: 10 }
    },
    {
      id: 'q-mewtwo', species: 150, name: 'ห้องทดลองใต้ดิน', map: 'canyon', theme: 'urban',
      desc: 'Mewtwo ลดพลังโจมตีของป้อมรอบตัว อย่าวางกระจุกที่เดียว',
      need: { stages: 9, caught: 55 },
      hpX: 46, threshold: 0.20, aura: 'drain', adds: [94, 65, 122],
      reward: { money: 4000, balls: 15, stone: 150 }
    },
    {
      id: 'q-mew', species: 151, name: 'ใต้รถบรรทุกท่าเรือ', map: 'shore', theme: 'sea',
      desc: 'ตำนานเล่าขานที่ต้องเก็บโปเกเด็กซ์ให้ได้ครึ่งหนึ่งก่อนจะเจอ',
      need: { stages: 10, caught: 80 },
      hpX: 42, threshold: 0.20, aura: null, adds: [],
      reward: { money: 5000, balls: 20 }
    }
  ];

  /* ---------------- สร้างข้อมูลด่านตอนจะเล่นจริง ---------------- */
  function stageWaves(stage) {
    const bosses = {};
    for (const k in (stage.bosses || {})) {
      const b = stage.bosses[k];
      bosses[k] = Object.assign({}, b, { x: b.x * DIFF.boss });
    }
    const waves = PTD.buildWaves({
      count: stage.waves, seed: stage.seed,
      tierFrom: stage.tierFrom, tierTo: stage.tierTo,
      hpFrom: stage.hpFrom, hpPow: stage.hpPow, hpK: stage.hpK,
      countBase: stage.countBase, countStep: stage.countStep * DIFF.count,
      pool: byHabitat(...stage.habitats),
      bosses, escort: stage.escort || {}
    });
    return normalize(waves, stage);
  }

  // สเกลตัวคูณ HP ของทุกเวฟให้พลังชีวิตรวมทั้งด่านไปถึงเป้าหมาย
  // รูปโค้งภายในด่านไม่เปลี่ยน แค่ยกทั้งชุดขึ้นหรือลงพร้อมกัน
  function totalHpOf(waves) {
    let sum = 0;
    for (const w of waves) for (const g of w.groups) {
      const e = PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX });
      if (e) sum += g.count * e.hp * w.hpMul;
    }
    return sum;
  }

  function normalize(waves, stage) {
    const target = (HP_TARGET[stage.no - 1] || HP_TARGET[HP_TARGET.length - 1]) * DIFF.hp;
    const actual = totalHpOf(waves);
    if (actual <= 0) return waves;
    const k = target / actual;
    for (const w of waves) w.hpMul = Math.round(w.hpMul * k * 1000) / 1000;
    return waves;
  }

  // เควสมีเวฟเดียว: ตัวในตำนาน + ลูกสมุนไม่กี่ตัว
  function questWaves(quest) {
    const groups = [{
      id: quest.species, count: 1, gap: 1, delay: 2,
      boss: true, aura: quest.aura, bossX: quest.hpX
    }];
    quest.adds.forEach((id, i) => {
      groups.push({ id, count: 5 + i * 2, gap: .8, delay: 6 + i * 5 });
    });
    return [{ hpMul: 1, groups, hasBoss: true }];
  }

  /* ---------------- เงื่อนไขปลดล็อก ---------------- */
  function stageUnlocked(stage) {
    if (stage.no === 1) return true;
    const prev = STAGES[stage.no - 2];
    return PTD.save.isCleared(prev.id);
  }

  function questUnlocked(quest) {
    const s = PTD.save;
    return s.data.cleared.length >= quest.need.stages && s.dexCaught >= quest.need.caught;
  }

  function questProgress(quest) {
    const s = PTD.save;
    return {
      stages: [s.data.cleared.length, quest.need.stages],
      caught: [s.dexCaught, quest.need.caught]
    };
  }

  const stageById = (id) => STAGES.find(s => s.id === id) || null;
  const questById = (id) => QUESTS.find(q => q.id === id) || null;
  const questOf = (species) => QUESTS.find(q => q.species === species) || null;

  PTD.campaign = {
    STAGES, QUESTS, DIFF,
    stageWaves, questWaves, totalHpOf,
    setHpTargets(arr) { HP_TARGET = arr.slice(); },
    // หน้า admin ใช้ปรับความยากรวมทั้งเกมโดยไม่ต้องแตะตารางทีละด่าน
    setHpScale(k) { DIFF.hp = k; },
    get hpScale() { return DIFF.hp; },
    get hpTargets() { return HP_TARGET.slice(); },
    stageUnlocked, questUnlocked, questProgress,
    stageById, questById, questOf,
    byHabitat
  };
})(window.PTD = window.PTD || {});
