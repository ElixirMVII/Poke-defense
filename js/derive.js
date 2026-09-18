/* =====================================================================
 * derive.js — แปลงค่าสเตตัสจริงของโปเกม่อนเป็นค่าพลังในเกม
 *
 * แนวคิด: ไม่ตั้งค่าพลังมือทีละตัว (151 ตัวทำไม่ไหวและจะไม่สมดุล)
 * แต่ใช้สเตตัสจริงเป็นตัวกำหนด — Atk/SpA สูงก็แรง, Spe สูงก็ยิงถี่,
 * SpA มากกว่า Atk ก็เป็นสายยิงไกล, Def สูงก็เป็นศัตรูที่มีเกราะ
 *
 * ค่าคงที่ปรับสมดุลอยู่ในบล็อก TUNE ข้างล่างทั้งหมด
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TUNE = {
    DMG:        0.38,   // ตัวคูณดาเมจรวมของป้อม
    RATE_BASE:  0.50,   // ความเร็วโจมตีพื้นฐาน (ครั้ง/วิ)
    RATE_SPE:   170,    // Spe หารด้วยเท่านี้แล้วบวกเข้า RATE_BASE
    RANGE_MIN:  58,
    RANGE_SPAN: 205,    // ระยะ = RANGE_MIN + ratio^1.5 * RANGE_SPAN
    MELEE_MAX:  96,     // ระยะต่ำกว่านี้ถือว่าเป็นสายประชิด
    HP:         0.46,   // ตัวคูณพลังชีวิตศัตรู
    SPEED_BASE: 40,
    SPEED_SPE:  0.52,
    ARMOR_DEF:  0.21,
    BOSS_SLOW:  0.55,   // บอสเดินช้ากว่าปกติ ให้ป้อมได้ยิงนานพอจะสู้กับ HP ที่หนา
    BOUNTY:     22,
    COST_DIV:   900,
    LEGEND_X:   1.9
  };

  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const S = { HP: 0, ATK: 1, DEF: 2, SPA: 3, SPD: 4, SPE: 5 };

  /* ---------- เลือกธาตุของท่าโจมตี ----------
   * ตัวที่มีสองธาตุ ให้ใช้ธาตุที่ตีได้เปรียบคนอื่นมากกว่า
   * (Pidgeot ธรรมดา/บิน -> ใช้บิน เพราะธรรมดาไม่แพ้ทางใครเลย) */
  const OFFENSE_SCORE = {};
  for (const t in PTD.TYPE_CHART) {
    let n = 0;
    for (const k in PTD.TYPE_CHART[t]) if (PTD.TYPE_CHART[t][k] === 2) n++;
    OFFENSE_SCORE[t] = n;
  }
  function moveTypeOf(types) {
    let best = types[0];
    for (const t of types) if (OFFENSE_SCORE[t] > OFFENSE_SCORE[best]) best = t;
    return best;
  }

  /* ---------- ท่าประจำธาตุ (ใช้เป็นชื่อท่าโชว์ใน UI) ---------- */
  const SIGNATURE = {
    Normal: 'Body Slam', Fire: 'Flamethrower', Water: 'Hydro Pump', Electric: 'Thunderbolt',
    Grass: 'Razor Leaf', Ice: 'Ice Beam', Fighting: 'Close Combat', Poison: 'Sludge Bomb',
    Ground: 'Earthquake', Flying: 'Aerial Ace', Psychic: 'Psychic', Bug: 'Bug Buzz',
    Rock: 'Rock Slide', Ghost: 'Shadow Ball', Dragon: 'Dragon Pulse', Dark: 'Crunch',
    Steel: 'Flash Cannon', Fairy: 'Dazzling Gleam'
  };

  /* ---------- รูปแบบการโจมตีตามธาตุ ---------- */
  // แต่ละธาตุมีบุคลิกของตัวเอง ทำให้ 151 ตัวไม่รู้สึกเหมือนกันหมด
  const STYLE = {
    Electric: { kind: 'chain',  chains: 3, chainFalloff: .78, fx: { kind: 'stun', chance: .14, dur: .5 } },
    Psychic:  { kind: 'beam',   pierce: 2, fx: { kind: 'slow', chance: .4, dur: 1.3, power: .28 } },
    Ghost:    { kind: 'bolt',   ignoreArmor: true, fx: { kind: 'poison', chance: .55, dur: 3 } },
    Dark:     { kind: 'bolt',   ignoreArmor: true },
    Rock:     { kind: 'splash', splash: 46, heavy: true, fx: { kind: 'stun', chance: .18, dur: .55 } },
    Ground:   { kind: 'splash', splash: 50, heavy: true, fx: { kind: 'stun', chance: .16, dur: .5 } },
    Steel:    { kind: 'splash', splash: 40, heavy: true },
    Ice:      { kind: 'splash', splash: 42, fx: { kind: 'slow', chance: .75, dur: 1.8, power: .38 } },
    Water:    { kind: 'splash', splash: 38, fx: { kind: 'slow', chance: .35, dur: 1.2, power: .25 } },
    Fire:     { kind: 'bolt',   fx: { kind: 'burn', chance: .45, dur: 2.8 } },
    Grass:    { kind: 'bolt',   fx: { kind: 'slowpoison', chance: .8, dur: 2.2, power: .3 } },
    Poison:   { kind: 'bolt',   fx: { kind: 'poison', chance: .8, dur: 3.2 } },
    Bug:      { kind: 'bolt',   fx: { kind: 'poison', chance: .5, dur: 2.5 } },
    Fighting: { kind: 'melee',  targets: 2 },
    Normal:   { kind: 'bolt' },
    Flying:   { kind: 'bolt',   fast: true },
    Dragon:   { kind: 'splash', splash: 44, fx: { kind: 'burn', chance: .4, dur: 2.5 } },
    Fairy:    { kind: 'beam',   fx: { kind: 'slow', chance: .5, dur: 1.5, power: .3 } }
  };

  /* ---------- คำอธิบายสั้น ๆ ---------- */
  const STYLE_TH = {
    bolt: 'ยิงใส่เป้าหมายเดียว', splash: 'ระเบิดโดนหลายตัวในรัศมี',
    chain: 'กระโดดต่อไปยังเป้าถัดไป', beam: 'ลำแสงทะลุเป็นแนว',
    melee: 'ตีประชิดรัวเร็ว', aura: 'แผ่พลังรอบตัวตลอดเวลา'
  };

  const cache = new Map();
  const megaCache = new Map();

  /* ================= ป้อม ================= */
  // แกนกลางของการแปลงสเตตัส -> ค่าในเกม ใช้ได้ทั้งร่างปกติและร่างเมก้า
  function buildTower(spec) {
    const st = spec.stats;
    const atk = st[S.ATK], spa = st[S.SPA], spe = st[S.SPE];
    const power = Math.max(atk, spa);
    const ratio = spa / (atk + spa);

    const moveType = moveTypeOf(spec.types);
    const style = STYLE[moveType] || STYLE.Normal;

    let range = TUNE.RANGE_MIN + Math.pow(ratio, 1.5) * TUNE.RANGE_SPAN;
    let attack = style.kind;
    if (range < TUNE.MELEE_MAX && attack !== 'beam') attack = 'melee';
    if (attack === 'melee') range = clamp(range, 62, 96);
    if (style.fast) range *= 1.12;

    let rate = TUNE.RATE_BASE + spe / TUNE.RATE_SPE;
    let dmg = power * (0.75 + spec.bst / 1200) * TUNE.DMG;

    if (attack === 'melee') rate *= 1.9;
    if (style.heavy) { rate *= .72; dmg *= 1.55; }
    if (attack === 'chain') dmg *= .85;

    const t = {
      dexId: spec.dexId,
      speciesId: spec.speciesId != null ? spec.speciesId : spec.dexId,
      name: spec.name, jp: spec.jp || '',
      types: spec.types, moveType,
      legendary: !!spec.legendary,
      isMega: !!spec.isMega,
      bst: spec.bst, stats: st,
      cost: spec.cost || 0,
      dmg: Math.round(dmg * 10) / 10,
      range: Math.round(range),
      rate: Math.round(rate * 100) / 100,
      attack,
      splash: style.splash || 0,
      chains: style.chains || 0,
      chainFalloff: style.chainFalloff || .78,
      pierce: style.pierce || 0,
      targets: style.targets || 1,
      ignoreArmor: !!style.ignoreArmor,
      projSpeed: style.fast ? 460 : (style.heavy ? 250 : 340),
      effect: style.fx ? Object.assign({}, style.fx) : null,
      move: SIGNATURE[moveType] || 'Tackle',
      desc: STYLE_TH[attack] || '',
      evolveTo: spec.evolveTo || [],
      evolveLv: spec.evolveLv || 5,
      evoNote: spec.evoNote || '',
      evolveCost: spec.evolveCost || 0
    };
    if (t.effect) {
      if (t.effect.dps == null) t.effect.dps = Math.round(t.dmg * .45);
      if (t.effect.power == null) t.effect.power = .3;
    }
    return t;
  }

  function tower(id) {
    if (cache.has(id)) return cache.get(id);
    const d = PTD.dex(id);
    if (!d) return null;

    const evolveTo = d.to.slice();
    let evolveLv = 5, evoNote = '';
    if (evolveTo.length) {
      const next = PTD.dex(evolveTo[0]);
      const e = next && next.evo;
      if (e && e.lv) { evolveLv = clamp(Math.round(e.lv / 3.6), 3, 13); evoNote = 'เลเวล ' + e.lv; }
      else if (e && e.t === 'trade') { evolveLv = 8; evoNote = 'แลกเปลี่ยน'; }
      else if (e && e.t === 'use-item') { evolveLv = 6; evoNote = 'ใช้หินวิวัฒนาการ'; }
      else { evolveLv = 6; evoNote = 'ความสนิทสนม'; }
    }

    const t = buildTower({
      dexId: id, name: d.name || d.n, jp: d.jp, types: d.t, stats: d.s,
      bst: d.bst, legendary: !!d.lg, cost: costOf(d),
      evolveTo, evolveLv, evoNote,
      evolveCost: evolveTo.length ? Math.round(costOf(PTD.dex(evolveTo[0])) * .85 / 5) * 5 : 0
    });
    cache.set(id, t);
    return t;
  }

  /* ร่างเมก้า — สร้างจากสเตตัสจริงของร่างนั้น ไม่ใช่บวกเปอร์เซ็นต์มั่ว ๆ */
  function megaTower(formId) {
    if (megaCache.has(formId)) return megaCache.get(formId);
    const m = PTD.MEGA.find(x => x.form === formId);
    if (!m) return null;
    const base = PTD.dex(m.of);
    const t = buildTower({
      dexId: m.form, speciesId: m.of,
      name: m.n, jp: base ? base.jp : '',
      types: m.t, stats: m.s, bst: m.bst,
      legendary: !!(base && base.lg), isMega: true, cost: 0
    });
    t.stone = m.stone;
    t.variant = m.v;
    megaCache.set(formId, t);
    return t;
  }

  function costOf(d) {
    let c = 30 + (d.bst * d.bst) / TUNE.COST_DIV;
    if (d.lg) c *= TUNE.LEGEND_X;
    return Math.round(c / 5) * 5;
  }

  /* ================= ศัตรู ================= */
  // hpMul มาจากเวฟ, boss ทำให้ตัวใหญ่ขึ้นและอึดขึ้นมาก
  function enemy(id, opts) {
    opts = opts || {};
    const d = PTD.dex(id);
    if (!d) return null;
    const st = d.s;
    // ถ่วงให้ HP ไม่ครอบงำจนตัวอย่าง Chansey (HP 250) อึดกว่าชาวบ้านเป็นเท่าตัว
    const bulk = st[S.HP] * 1.6 + st[S.DEF] * 0.7 + st[S.SPD] * 0.7;
    return {
      id, dexId: id,
      name: d.name || d.n, jp: d.jp,
      types: d.t,
      legendary: !!d.lg,
      hp: Math.round(bulk * TUNE.HP * (opts.boss ? (opts.bossX || 12) : 1)),
      speed: Math.round((TUNE.SPEED_BASE + st[S.SPE] * TUNE.SPEED_SPE) * (opts.boss ? TUNE.BOSS_SLOW : 1)),
      armor: Math.round(st[S.DEF] * TUNE.ARMOR_DEF),
      bounty: Math.round(4 + d.bst / TUNE.BOUNTY) * (opts.boss ? 8 : 1),
      boss: !!opts.boss,
      scale: opts.boss ? 1.5 : 1,
      glow: opts.boss ? bossGlow(d.t[0]) : null,
      regen: opts.boss ? Math.round(bulk * .02) : 0,
      aura: opts.aura || null
    };
  }

  // ความน่ากลัวที่ผู้เล่นรู้สึกจริง = อึดแค่ไหนหลังคิดเกราะ บวกความเร็วนิดหน่อย
  // ใช้จัดระดับเวฟ แทนการใช้ BST ซึ่งไม่ตรงกับความอึดจริง
  function threatOf(id) {
    const e = enemy(id, {});
    if (!e) return 0;
    return e.hp * (1 + e.armor / 60) * (1 + e.speed / 400);
  }

  function bossGlow(type) {
    const c = PTD.TYPE_COLOR[type] || '#ffffff';
    return c + 'aa';
  }

  /* ================= รายการที่ซื้อได้ ================= */
  // ซื้อได้เฉพาะร่างเริ่มต้นของสาย — ร่างหลัง ๆ ต้องวิวัฒนาการเอาเท่านั้น
  function shopList() {
    return PTD.BASE_FORMS.slice().sort((a, b) => {
      const A = PTD.dex(a), B = PTD.dex(b);
      return A.bst - B.bst || a - b;
    });
  }

  PTD.MAX_LEVEL = 30;
  PTD.tower = tower;
  PTD.megaTower = megaTower;
  PTD.buildTower = buildTower;
  PTD.enemy = enemy;
  PTD.threatOf = threatOf;
  PTD.shopList = shopList;
  PTD.moveTypeOf = moveTypeOf;
  PTD.TUNE = TUNE;
})(window.PTD = window.PTD || {});
