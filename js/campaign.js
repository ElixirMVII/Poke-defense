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

  /* ---------------- ด่านแคมเปญ ---------------- */
  const STAGES = [
    {
      id: 's1', no: 1, name: 'ทุ่งหญ้าต้นทาง', map: 'meadow',
      desc: 'ด่านแรก ศัตรูยังอ่อน ใช้ทำความคุ้นเคยกับการวางทีม',
      waves: 8, seed: 1101, tierFrom: 0, tierTo: 1.6,
      hpFrom: 0.80, hpPow: 1.15, hpK: 0.10, countBase: 5, countStep: 0.30,
      habitats: [H.GRASS], lives: 20,
      bosses: { 8: { id: 20, aura: null, x: 5 } },              // Raticate
      reward: { money: 600, balls: 15 }
    },
    {
      id: 's2', no: 2, name: 'ป่าลึก', map: 'canyon',
      desc: 'ป่าทึบ ศัตรูสายแมลงกับพิษเยอะ',
      waves: 10, seed: 2202, tierFrom: 0.5, tierTo: 2.3,
      hpFrom: 0.95, hpPow: 1.18, hpK: 0.115, countBase: 6, countStep: 0.34,
      habitats: [H.FOREST], lives: 20,
      bosses: { 5: { id: 123, aura: null, x: 5 }, 10: { id: 95, aura: null, x: 6 } },  // Scyther, Onix
      reward: { money: 900, balls: 18, stone: 3 }               // หิน Venusaurite
    },
    {
      id: 's3', no: 3, name: 'ริมทะเลสาบ', map: 'shore',
      desc: 'ทางน้ำคดเคี้ยว ศัตรูสายน้ำเดินเร็ว',
      waves: 10, seed: 3303, tierFrom: 1.0, tierTo: 2.8,
      hpFrom: 1.10, hpPow: 1.21, hpK: 0.138, countBase: 6, countStep: 0.40,
      habitats: [H.EDGE, H.SEA], lives: 18,
      bosses: { 10: { id: 130, aura: null, x: 6 } },            // Gyarados
      reward: { money: 1300, balls: 20, stone: 9 }              // Blastoisinite
    },
    {
      id: 's4', no: 4, name: 'ถ้ำมืด', map: 'canyon',
      desc: 'ศัตรูเกราะหนา ป้อมยิงเบา ๆ เจาะไม่เข้า',
      waves: 12, seed: 4404, tierFrom: 1.5, tierTo: 3.3,
      hpFrom: 1.45, hpPow: 1.27, hpK: 0.21, countBase: 7, countStep: 0.52,
      habitats: [H.CAVE, H.ROUGH], lives: 18,
      bosses: { 6: { id: 76, aura: null, x: 5 }, 12: { id: 112, aura: 'drain', x: 7 } },  // Golem, Rhydon
      reward: { money: 1800, balls: 22, stone: 6 }              // Charizardite
    },
    {
      id: 's5', no: 5, name: 'ชานเมืองเก่า', map: 'meadow',
      desc: 'ศัตรูหลากหลายมาก ต้องมีธาตุครอบคลุม',
      waves: 12, seed: 5505, tierFrom: 2.0, tierTo: 3.7,
      hpFrom: 1.85, hpPow: 1.31, hpK: 0.28, countBase: 8, countStep: 0.58,
      habitats: [H.URBAN, H.GRASS], lives: 16,
      bosses: { 12: { id: 143, aura: null, x: 7 } },            // Snorlax
      reward: { money: 2400, balls: 25, stone: 94 }             // Gengarite
    },
    {
      id: 's6', no: 6, name: 'ภูเขาไฟ', map: 'shore',
      desc: 'ด่านสุดท้าย ศัตรูแรงที่สุดและมาเป็นฝูง',
      waves: 14, seed: 6606, tierFrom: 2.4, tierTo: 4,
      hpFrom: 2.20, hpPow: 1.35, hpK: 0.35, countBase: 9, countStep: 0.66,
      habitats: [H.MOUNTAIN, H.ROUGH], lives: 16,
      bosses: { 7: { id: 59, aura: null, x: 6 }, 14: { id: 149, aura: 'drain', x: 9 } }, // Arcanine, Dragonite
      escort: { 14: [142] },                                    // Aerodactyl
      reward: { money: 3500, balls: 30, stone: 150 }            // Mewtwonite
    }
  ];

  /* ---------------- เควสในตำนาน ---------------- */
  // ต้องกดเลือดให้ต่ำกว่า threshold ก่อนที่มันจะเดินพ้นสนาม
  const QUESTS = [
    {
      id: 'q-articuno', species: 144, name: 'ถ้ำน้ำแข็งลึก', map: 'canyon',
      desc: 'Articuno บินผ่านถ้ำรอบเดียว ออร่าเย็นทำให้ทีมยิงช้าลง',
      need: { stages: 2, caught: 12 },
      hpX: 22, threshold: 0.25, aura: 'chill', adds: [87, 91],   // Dewgong, Cloyster
      reward: { money: 1500, balls: 10 }
    },
    {
      id: 'q-zapdos', species: 145, name: 'โรงไฟฟ้าร้าง', map: 'meadow',
      desc: 'Zapdos เร็วมาก ต้องมีป้อมยิงถี่หรือธาตุที่ได้เปรียบ',
      need: { stages: 3, caught: 20 },
      hpX: 28, threshold: 0.25, aura: null, adds: [81, 100, 125],
      reward: { money: 1800, balls: 10 }
    },
    {
      id: 'q-moltres', species: 146, name: 'ปล่องภูเขาไฟ', map: 'shore',
      desc: 'Moltres เผาทุกอย่างระหว่างทาง สายน้ำกับหินได้เปรียบ',
      need: { stages: 4, caught: 28 },
      hpX: 32, threshold: 0.25, aura: null, adds: [126, 59, 78],
      reward: { money: 2200, balls: 10 }
    },
    {
      id: 'q-mewtwo', species: 150, name: 'ห้องทดลองใต้ดิน', map: 'canyon',
      desc: 'Mewtwo ลดพลังโจมตีของป้อมรอบตัว อย่าวางกระจุกที่เดียว',
      need: { stages: 6, caught: 40 },
      hpX: 46, threshold: 0.20, aura: 'drain', adds: [94, 65, 122],
      reward: { money: 4000, balls: 15, stone: 150 }
    },
    {
      id: 'q-mew', species: 151, name: 'ใต้รถบรรทุกท่าเรือ', map: 'shore',
      desc: 'ตำนานเล่าขานที่ต้องเก็บโปเกเด็กซ์ให้ได้ครึ่งหนึ่งก่อนจะเจอ',
      need: { stages: 6, caught: 75 },
      hpX: 42, threshold: 0.20, aura: null, adds: [],
      reward: { money: 5000, balls: 20 }
    }
  ];

  /* ---------------- สร้างข้อมูลด่านตอนจะเล่นจริง ---------------- */
  function stageWaves(stage) {
    return PTD.buildWaves({
      count: stage.waves, seed: stage.seed,
      tierFrom: stage.tierFrom, tierTo: stage.tierTo,
      hpFrom: stage.hpFrom, hpPow: stage.hpPow, hpK: stage.hpK,
      countBase: stage.countBase, countStep: stage.countStep,
      pool: byHabitat(...stage.habitats),
      bosses: stage.bosses || {}, escort: stage.escort || {}
    });
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
    STAGES, QUESTS,
    stageWaves, questWaves,
    stageUnlocked, questUnlocked, questProgress,
    stageById, questById, questOf,
    byHabitat
  };
})(window.PTD = window.PTD || {});
