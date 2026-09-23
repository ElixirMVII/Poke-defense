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
  let HP_TARGET = [ 20,  34,  52,  72,  96, 124,    // คันโต
                   158, 196, 240, 292, 350, 415,    // โจโต
                   480, 550, 625, 700, 780, 865     // โฮเอ็น
                  ].map(k => k * 1000);

  /* ---------------- ด่านแคมเปญ ---------------- */
  // hpK/countStep คือสองตัวหลักที่คุมความยาก ปรับแล้วรัน tools/balance.js ดูผลเสมอ
  /* ---------------- ภูมิภาค ----------------
   * ด่านของแต่ละภูมิภาคดึงศัตรูจากช่วง id ของภูมิภาคนั้น
   * (ข้อมูลของ PokeAPI ไม่มีฟิลด์ภูมิภาค แต่ id เรียงตามภูมิภาคอยู่แล้ว) */
  const REGIONS = {
    kanto: { name: 'คันโต', ids: [1, 151] },
    johto: { name: 'โจโต', ids: [152, 251] },
    hoenn: { name: 'โฮเอ็น', ids: [252, 386] },
    all:   { name: 'ทุกภูมิภาค', ids: [1, 386] }
  };

  const byHabitatIn = (region, ids) => {
    const [lo, hi] = (REGIONS[region] || REGIONS.all).ids;
    const out = PTD.DEX.filter(d => !d.lg && d.id >= lo && d.id <= hi && ids.includes(d.hb))
      .map(d => d.id);
    // ถิ่นอาศัยบางแห่งในบางภูมิภาคมีสมาชิกน้อยมาก ถ้าน้อยเกินไปก็เปิดให้ทั้งภูมิภาค
    // เกณฑ์ต้องสูงกว่าของ waves.js (12) เพื่อไม่ให้มันไปเติมพูลเองซ้ำอีกชั้น
    return out.length >= 16 ? out
      : PTD.DEX.filter(d => !d.lg && d.id >= lo && d.id <= hi).map(d => d.id);
  };

  /* ---------------- ตารางด่าน ----------------
   * เขียนเป็นตารางแทนการไล่พิมพ์ทีละบล็อก เพราะ 18 ด่านซ้ำกันเกือบหมด
   * ค่าที่เหลือ (ระดับศัตรู รูปโค้ง HP จำนวนต่อเวฟ หัวใจ) คำนวณจากลำดับด่าน
   * ส่วนพลังชีวิตรวมจริง ๆ ถูก normalize() บังคับให้ตรง HP_TARGET อยู่แล้ว
   * hpFrom/hpPow/hpK จึงคุมแค่ "รูปโค้งภายในด่าน" ไม่ใช่ความยากรวม
   *
   * คอลัมน์: ชื่อ · คำโปรย · ภูมิภาค · แผนที่ · ธีม · ถิ่นอาศัย · บอส · หินที่ได้ */
  const T = [
    // ---- คันโต ----
    ['ทุ่งหญ้าต้นทาง', 'ด่านแรก ศัตรูยังอ่อน ใช้ทำความคุ้นเคยกับการวางทีม',
      'kanto', 'meadow', 'meadow', [H.GRASS], { last: 20 }, 0],
    ['ป่าลึก', 'ป่าทึบ ศัตรูสายแมลงกับพิษมาเป็นฝูงใหญ่',
      'kanto', 'canyon', 'forest', [H.FOREST], { mid: 123, last: 95 }, 15],
    ['ชานเมืองเก่า', 'ทางคดเคี้ยว ศัตรูหลากหลาย ต้องมีธาตุครอบคลุม',
      'kanto', 'shore', 'urban', [H.URBAN], { last: 115 }, 3],
    ['ริมทะเลสาบ', 'ศัตรูสายน้ำเดินเร็ว ต้องมีตัวหน่วง',
      'kanto', 'meadow', 'lake', [H.EDGE, H.SEA], { mid: 121, last: 130 }, 9],
    ['ถ้ำมืด', 'ศัตรูเกราะหนา ป้อมยิงเบา ๆ เจาะไม่เข้า',
      'kanto', 'canyon', 'cave', [H.CAVE, H.ROUGH], { last: 76 }, 6],
    ['เทือกเขาหิน', 'ศัตรูหนักและช้า แต่มาไม่หยุด',
      'kanto', 'shore', 'rocky', [H.ROUGH, H.MOUNTAIN], { mid: 112, last: 142 }, 142],
    // ---- โจโต ----
    ['ทางไปโจโต', 'ข้ามแดนสู่ภูมิภาคใหม่ สายพันธุ์ที่ไม่เคยเจอมาก่อน',
      'johto', 'meadow', 'meadow', [H.GRASS, H.FOREST], { last: 162 }, 181],
    ['ป่าไผ่', 'ศัตรูแมลงกับหญ้าโจโตมาเป็นฝูงแน่น',
      'johto', 'canyon', 'forest', [H.FOREST], { mid: 214, last: 212 }, 212],
    ['หอระฆังไหม้', 'สายผีกับอสูร ธาตุปกติทำอะไรแทบไม่ได้',
      'johto', 'shore', 'urban', [H.URBAN, H.RARE], { last: 229 }, 229],
    ['ทะเลสาบโกรธเกรี้ยว', 'น้ำเชี่ยว ศัตรูว่ายเร็วและอึด',
      'johto', 'meadow', 'lake', [H.SEA, H.EDGE], { mid: 226, last: 230 }, 208],
    ['ถ้ำน้ำแข็ง', 'เกราะหนาบวกน้ำแข็ง ต้องมีตัวเจาะเกราะ',
      'johto', 'canyon', 'cave', [H.CAVE, H.MOUNTAIN], { last: 221 }, 214],
    ['ยอดเขาเงิน', 'ด่านปิดโจโต ศัตรูแรงที่สุดของภูมิภาค',
      'johto', 'shore', 'summit', [H.MOUNTAIN, H.ROUGH, H.RARE], { mid: 232, last: 248 }, 248],
    // ---- โฮเอ็น ----
    ['ป่าฝนโฮเอ็น', 'ภูมิภาคที่สาม ศัตรูหลากหลายกว่าเดิมมาก',
      'hoenn', 'meadow', 'forest', [H.FOREST, H.GRASS], { last: 286 }, 254],
    ['ทะเลทรายร้อน', 'ศัตรูดินกับไฟ เดินช้าแต่ทนมาก',
      'hoenn', 'canyon', 'rocky', [H.ROUGH, H.CAVE], { mid: 323, last: 306 }, 306],
    ['เมืองใต้น้ำ', 'ฝูงใหญ่จากใต้ทะเล ต้องมีตัวโจมตีเป็นวง',
      'hoenn', 'shore', 'sea', [H.SEA, H.EDGE], { mid: 319, last: 350 }, 319],
    ['ปล่องภูเขาไฟ', 'ไฟล้วน ธาตุน้ำกับหินได้เปรียบชัดเจน',
      'hoenn', 'meadow', 'volcano', [H.MOUNTAIN, H.ROUGH], { last: 324 }, 257],
    ['หอคอยฟ้า', 'สายมังกรกับบิน เดินเร็วและเลือดหนา',
      'hoenn', 'canyon', 'storm', [H.RARE, H.GRASS, H.MOUNTAIN], { mid: 334, last: 373 }, 373],
    ['ศึกสุดท้าย', 'ทุกภูมิภาครวมกัน ศัตรูแรงที่สุดในเกม',
      'all', 'shore', 'summit', [H.MOUNTAIN, H.ROUGH, H.URBAN, H.RARE, H.SEA],
      { mid: 376, last: 248 }, 376]
  ];

  const STAGES = T.map((row, i) => {
    const [name, desc, region, map, theme, habitats, boss, stone] = row;
    const n = i + 1;                       // ลำดับด่าน 1-18
    const p = i / (T.length - 1);          // 0 ที่ด่านแรก 1 ที่ด่านสุดท้าย
    const waves = 10 + Math.round(p * 14); // 10 -> 24 เวฟ
    const bosses = {};
    if (boss.mid) bosses[Math.round(waves * 0.55)] = { id: boss.mid, aura: null, x: 5 + Math.round(p * 3) };
    if (boss.last) bosses[waves] = { id: boss.last, aura: n >= 13 ? 'drain' : null, x: 5 + Math.round(p * 4) };
    return {
      id: 's' + n, no: n, name, desc, region, map, theme,
      startMoney: 400 + i * 30,
      waves, seed: n * 1103 + 101,
      tierFrom: Math.min(4, i * 0.25),
      tierTo: Math.min(4.6, 1.8 + i * 0.16),
      // รูปโค้งภายในด่านเท่านั้น ยอดรวมถูก normalize() บังคับให้ตรง HP_TARGET
      hpFrom: 0.85 + i * 0.05, hpPow: 1.16 + i * 0.008, hpK: 0.115 + i * 0.008,
      countBase: 7 + Math.round(i * 0.4), countStep: 0.30 + i * 0.011,
      habitats, lives: 18 - Math.floor(i / 4) * 2,
      bosses,
      reward: {
        money: 700 + Math.round(i * i * 11 + i * 120),
        balls: 18 + Math.round(i * 1.2),
        stone
      }
    };
  });

  /* ---------------- เควสในตำนาน ---------------- */
  // ต้องกดเลือดให้ต่ำกว่า threshold ก่อนที่มันจะเดินพ้นสนาม
  /* เควสในตำนานครบทั้ง 21 ตัวของ Gen 1-3
   * คอลัมน์: id · ชื่อสถานที่ · แผนที่ · ธีม · คำโปรย · [ด่านที่ต้องผ่าน, สายพันธุ์ที่ต้องจับ]
   *          · ตัวคูณเลือด · เกณฑ์ที่ต้องกดลงให้ได้ · ออร่า · ลูกน้องที่มาด้วย · หินที่ได้ */
  const QT = [
    // ---- คันโต ----
    [144, 'ถ้ำน้ำแข็งลึก', 'canyon', 'cave',
      'Articuno บินผ่านถ้ำรอบเดียว ออร่าเย็นทำให้ทีมยิงช้าลง',
      [3, 15], 22, .25, 'chill', [87, 91], 0],
    [145, 'โรงไฟฟ้าร้าง', 'meadow', 'storm',
      'Zapdos เร็วมาก ต้องมีป้อมยิงถี่หรือธาตุที่ได้เปรียบ',
      [5, 26], 28, .25, null, [81, 100, 125], 0],
    [146, 'ปล่องภูเขาไฟคันโต', 'shore', 'volcano',
      'Moltres เผาทุกอย่างระหว่างทาง สายน้ำกับหินได้เปรียบ',
      [7, 38], 34, .25, null, [126, 59, 78], 0],
    [150, 'ห้องทดลองใต้ดิน', 'canyon', 'urban',
      'Mewtwo ลดพลังโจมตีของป้อมรอบตัว อย่าวางกระจุกที่เดียว',
      [9, 55], 48, .20, 'drain', [94, 65, 122], 150],
    [151, 'ใต้รถบรรทุกท่าเรือ', 'shore', 'sea',
      'ตำนานเล่าขานที่ต้องเก็บโปเกเด็กซ์ให้ได้พอสมควรก่อนจะเจอ',
      [10, 78], 44, .20, null, [], 0],
    // ---- โจโต ----
    [243, 'ทุ่งสายฟ้า', 'meadow', 'storm',
      'Raikou วิ่งเร็วที่สุดในสามพี่น้อง พลาดนิดเดียวก็หลุด',
      [8, 92], 58, .22, null, [125, 179, 181], 0],
    [244, 'ซากหอไฟ', 'canyon', 'volcano',
      'Entei วิ่งฝ่าเปลวไฟ เลือดหนากว่าพี่น้องอีกสองตัว',
      [9, 100], 66, .22, null, [126, 218, 229], 0],
    [245, 'น้ำพุใส', 'shore', 'lake',
      'Suicune เกราะหนามาก ป้อมยิงเบาเจาะแทบไม่เข้า',
      [10, 108], 72, .22, 'chill', [186, 226, 230], 0],
    [249, 'หอคอยหมุนวน', 'canyon', 'sea',
      'Lugia ออร่ากดพลังโจมตีทั้งสนาม ต้องกระจายป้อมให้ดี',
      [11, 118], 88, .20, 'drain', [230, 226, 131], 208],
    [250, 'หอระฆังสีรุ้ง', 'shore', 'volcano',
      'Ho-oh บินสูงและเผาไหม้ตลอดทาง ธาตุหินกับไฟฟ้าได้เปรียบ',
      [12, 128], 94, .20, null, [146, 250, 157], 248],
    [251, 'ป่าต้องมนตร์', 'meadow', 'forest',
      'Celebi โผล่มาเมื่อเก็บสายพันธุ์ได้มากพอ เดินช้าแต่ฟื้นเลือดเอง',
      [12, 140], 76, .18, null, [], 0],
    // ---- โฮเอ็น ----
    [377, 'ห้องหินโบราณ', 'canyon', 'rocky',
      'Regirock เกราะหนาที่สุดในเกม ต้องมีตัวทะลุเกราะ',
      [13, 150], 108, .22, null, [299, 304, 305], 0],
    [378, 'ห้องน้ำแข็งโบราณ', 'canyon', 'cave',
      'Regice ออร่าเย็นจัด ทีมทั้งสนามยิงช้าลง',
      [14, 158], 118, .22, 'chill', [361, 363, 364], 0],
    [379, 'ห้องเหล็กโบราณ', 'canyon', 'urban',
      'Registeel ทั้งหนาทั้งต้านทาน ธาตุไฟกับต่อสู้ได้เปรียบ',
      [15, 166], 128, .22, null, [303, 304, 374], 0],
    [380, 'ถ้ำใต้ทะเล', 'shore', 'sea',
      'Latias ว่องไวและหลบเก่ง ต้องมีป้อมยิงถี่คุมทาง',
      [15, 175], 124, .20, null, [380, 373, 334], 380],
    [381, 'ถ้ำใต้ทะเลลึก', 'shore', 'sea',
      'Latios แรงกว่าน้องสาว และลดพลังป้อมรอบตัว',
      [16, 184], 138, .20, 'drain', [381, 373, 334], 381],
    [382, 'ร่องน้ำลึก', 'shore', 'sea',
      'Kyogre เรียกฝนมาทั้งสนาม เลือดหนามหาศาล',
      [16, 193], 152, .18, null, [321, 350, 370], 382],
    [383, 'ปล่องแมกมา', 'canyon', 'volcano',
      'Groudon แผดเผาทั้งสนาม เดินช้าแต่แทบฆ่าไม่ลง',
      [17, 202], 166, .18, null, [323, 324, 306], 383],
    [384, 'ยอดหอคอยฟ้า', 'meadow', 'storm',
      'Rayquaza เจ้าแห่งท้องฟ้า ทั้งเร็วทั้งหนา ด่านที่ยากที่สุด',
      [18, 212], 195, .16, 'drain', [373, 334, 330], 384],
    [385, 'ดาวตกหลับใหล', 'meadow', 'summit',
      'Jirachi ตื่นทุกพันปี ต้องเก็บโปเกเด็กซ์ให้ได้เกือบครบ',
      [18, 225], 158, .18, null, [], 0],
    [386, 'อุกกาบาตปริศนา', 'canyon', 'urban',
      'Deoxys เปลี่ยนรูปตลอดเวลา ตัวสุดท้ายของเกม',
      [18, 240], 210, .15, 'drain', [], 0]
  ];

  const QUESTS = QT.map(([species, name, map, theme, desc, need, hpX, threshold, aura, adds, stone]) => ({
    id: 'q-' + species,
    species, name, map, theme, desc,
    need: { stages: need[0], caught: need[1] },
    // เควสท้าย ๆ ต้องลงทีมได้เกือบครบตั้งแต่แรก เพราะตัวในตำนานเดินผ่านรอบเดียว
    // ถ้าให้ทุนเท่าด่าน 1 จะลงได้ตัวเดียวแล้วยังไงก็กดเลือดไม่ทัน
    startMoney: 500 + Math.round(hpX * 26),
    hpX, threshold, aura, adds,
    reward: {
      money: 1200 + Math.round(hpX * 28),
      balls: 10 + Math.round(hpX / 12),
      stone
    }
  }));

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
      pool: byHabitatIn(stage.region, stage.habitats),
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
    byHabitat, byHabitatIn, REGIONS
  };
})(window.PTD = window.PTD || {});
