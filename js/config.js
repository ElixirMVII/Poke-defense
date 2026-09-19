/* =====================================================================
 * config.js — ค่าปรับแต่งเกมที่แก้ได้จากหน้า admin
 *
 * ค่าตั้งต้นทั้งหมดอยู่ในโมดูลของมันเอง (TUNE ใน derive.js, HP_TARGET ใน
 * campaign.js, PRICES ใน save.js ฯลฯ) ที่นี่เก็บเฉพาะ "ส่วนที่ถูกแก้"
 * แล้วทาทับตอนบูต จะได้กดคืนค่าเดิมได้เสมอและอัปเดตเกมไม่ทับค่าที่แก้ไว้
 *
 * ต้องโหลดหลังโมดูลที่มันแก้ แต่ก่อนที่เกมจะเริ่มใช้ค่าพวกนั้น
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const KEY = 'pokedefense.config.v1';

  /* รายการค่าที่เปิดให้แก้ — แต่ละอันบอกวิธีอ่าน/เขียนกลับเข้าโมดูลจริง
   * group  ใช้จัดกลุ่มในหน้า admin
   * min/max/step ไว้กันกรอกค่าที่ทำให้เกมพัง */
  const FIELDS = [
    // ---- เศรษฐกิจ ----
    { key: 'startMoneyBase', group: 'เศรษฐกิจ', label: 'เงินตั้งต้นด่าน 1', min: 0, max: 5000, step: 20,
      get: () => PTD.campaign.STAGES[0].startMoney,
      set: (v) => PTD.campaign.STAGES.forEach((s, i) => { s.startMoney = Math.round(v + i * PTD.config.get('startMoneyStep')); }) },
    { key: 'startMoneyStep', group: 'เศรษฐกิจ', label: 'เงินตั้งต้นเพิ่มต่อด่าน', min: 0, max: 500, step: 10,
      get: () => 40,
      set: () => { /* ใช้ร่วมกับ startMoneyBase ด้านบน */ } },
    { key: 'costDiv', group: 'เศรษฐกิจ', label: 'ตัวหารราคาลงสนาม (ยิ่งน้อยยิ่งแพง)', min: 200, max: 4000, step: 50,
      get: () => PTD.TUNE.COST_DIV, set: (v) => { PTD.TUNE.COST_DIV = v; PTD.rebuildTowers(); } },
    { key: 'bounty', group: 'เศรษฐกิจ', label: 'ตัวหารค่าหัวศัตรู (ยิ่งน้อยยิ่งได้เงินเยอะ)', min: 4, max: 120, step: 1,
      get: () => PTD.TUNE.BOUNTY, set: (v) => { PTD.TUNE.BOUNTY = v; PTD.rebuildTowers(); } },
    { key: 'recallRefund', group: 'เศรษฐกิจ', label: 'คืนเงินตอนเก็บกลับ (%)', min: 0, max: 100, step: 5,
      get: () => Math.round(PTD.battle.RECALL_REFUND * 100),
      set: (v) => { PTD.battle.RECALL_REFUND = v / 100; } },

    // ---- ความยาก ----
    { key: 'hpScale', group: 'ความยาก', label: 'ตัวคูณเลือดศัตรูทั้งเกม (%)', min: 20, max: 400, step: 5,
      get: () => 100, set: (v) => PTD.campaign.setHpScale(v / 100) },
    { key: 'dmgMul', group: 'ความยาก', label: 'ตัวคูณดาเมจป้อม (%)', min: 20, max: 400, step: 5,
      get: () => Math.round(PTD.TUNE.DMG / 0.38 * 100),
      set: (v) => { PTD.TUNE.DMG = 0.38 * v / 100; PTD.rebuildTowers(); } },
    { key: 'enemySpeed', group: 'ความยาก', label: 'ความเร็วศัตรู (%)', min: 30, max: 300, step: 5,
      get: () => 100,
      set: (v) => { PTD.TUNE.SPEED_BASE = 40 * v / 100; PTD.TUNE.SPEED_SPE = 0.52 * v / 100; PTD.rebuildTowers(); } },
    { key: 'breakTime', group: 'ความยาก', label: 'เวลาพักระหว่างเวฟ (วินาที)', min: 0, max: 60, step: 1,
      get: () => PTD.battle.BREAK_TIME, set: (v) => { PTD.battle.BREAK_TIME = v; } },
    { key: 'expLevels', group: 'ความยาก', label: 'เลเวลฟรีจากการฆ่าต่อด่าน', min: 0, max: 30, step: 1,
      get: () => PTD.battle.EXP_LEVELS_PER_STAGE, set: (v) => { PTD.battle.EXP_LEVELS_PER_STAGE = v; } },
    { key: 'maxLevel', group: 'ความยาก', label: 'เลเวลสูงสุด', min: 5, max: 100, step: 1,
      get: () => PTD.MAX_LEVEL, set: (v) => { PTD.MAX_LEVEL = v; } },

    // ---- แผนที่และทีม ----
    { key: 'pads', group: 'แผนที่และทีม', label: 'จำนวนแท่นวางต่อแผนที่', min: 4, max: 40, step: 1,
      get: () => PTD.map.padCount, set: (v) => PTD.setPadCount(v) },
    { key: 'partyMax', group: 'แผนที่และทีม', label: 'พกลงด่านได้กี่ตัว', min: 1, max: 12, step: 1,
      get: () => PTD.save.PARTY_MAX, set: (v) => PTD.save.setPartyMax(v) },

    // ---- ซาฟารี ----
    { key: 'encounter', group: 'ซาฟารี', label: 'โอกาสเจอตัวป่าต่อก้าว (%)', min: 1, max: 100, step: 1,
      get: () => Math.round(PTD.safari.encounterChance * 100),
      set: (v) => { PTD.safari.encounterChance = v / 100; } },
    { key: 'catchMul', group: 'ซาฟารี', label: 'ตัวคูณโอกาสจับ (%)', min: 10, max: 500, step: 5,
      get: () => Math.round(PTD.safari.catchMul * 100),
      set: (v) => { PTD.safari.catchMul = v / 100; } },
    { key: 'ballPrice', group: 'ซาฟารี', label: 'ราคาลูกบอล 10 ลูก', min: 0, max: 5000, step: 10,
      get: () => PTD.save.PRICES.balls, set: (v) => { PTD.save.PRICES.balls = v; } },
    { key: 'stonePrice', group: 'ซาฟารี', label: 'ราคาหินเมก้า', min: 0, max: 99999, step: 100,
      get: () => PTD.save.PRICES.stone, set: (v) => { PTD.save.PRICES.stone = v; } }
  ];

  const byKey = {};
  for (const f of FIELDS) byKey[f.key] = f;

  let over = {};          // เฉพาะค่าที่ถูกแก้
  let defaults = null;    // ค่าตั้งต้นที่อ่านไว้ตอนบูต (ก่อนทาทับ)

  function load() {
    const raw = PTD.store.getSync(KEY);
    over = (raw && raw.v === 1 && raw.values) ? raw.values : {};
    return over;
  }
  function persist() { PTD.store.setSync(KEY, { v: 1, values: over }); }

  function snapshotDefaults() {
    if (defaults) return defaults;
    defaults = {};
    for (const f of FIELDS) {
      try { defaults[f.key] = f.get(); } catch (e) { defaults[f.key] = null; }
    }
    return defaults;
  }

  function get(key) {
    if (key in over) return over[key];
    snapshotDefaults();
    return defaults[key];
  }
  function defaultOf(key) { snapshotDefaults(); return defaults[key]; }
  function isChanged(key) { return key in over; }

  function clamp(f, v) {
    v = Number(v);
    if (!isFinite(v)) return defaultOf(f.key);
    if (f.min != null) v = Math.max(f.min, v);
    if (f.max != null) v = Math.min(f.max, v);
    return v;
  }

  // ทาค่าที่แก้ไว้ทั้งหมดลงโมดูลจริง
  function apply() {
    snapshotDefaults();
    // startMoney ต้องทาคู่กัน เพราะฐานกับสเต็ปคุมค่าเดียวกัน
    for (const f of FIELDS) {
      const v = get(f.key);
      if (v == null) continue;
      try { f.set(v); } catch (e) { console.warn('ตั้งค่า', f.key, 'ไม่ได้:', e.message); }
    }
  }

  function set(key, value) {
    const f = byKey[key];
    if (!f) throw new Error('ไม่รู้จักค่า ' + key);
    over[key] = clamp(f, value);
    persist();
    apply();
    return over[key];
  }

  function resetKey(key) { delete over[key]; persist(); reapplyAll(); }
  function resetAll() { over = {}; persist(); reapplyAll(); }

  // คืนค่าเดิมต้องตั้งกลับทีละตัวจาก snapshot แล้วค่อยทาของที่ยังเหลือ
  function reapplyAll() {
    snapshotDefaults();
    for (const f of FIELDS) {
      try { f.set(defaults[f.key]); } catch (e) { /* ข้าม */ }
    }
    apply();
  }

  PTD.config = {
    FIELDS, KEY,
    load, apply, get, set, defaultOf, isChanged, resetKey, resetAll,
    get values() { return Object.assign({}, over); },
    groups() {
      const g = [];
      for (const f of FIELDS) {
        let row = g.find(x => x.name === f.group);
        if (!row) { row = { name: f.group, fields: [] }; g.push(row); }
        row.fields.push(f);
      }
      return g;
    }
  };
})(window.PTD = window.PTD || {});
