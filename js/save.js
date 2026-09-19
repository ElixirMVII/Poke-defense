/* =====================================================================
 * save.js — ความคืบหน้าของผู้เล่น เก็บลง localStorage
 *
 * เก็บอะไรบ้าง: โปเกม่อนที่จับได้ (กล่อง), ทีมที่เลือกไว้สูงสุด 6 ตัว,
 * เงิน, ลูกบอลซาฟารี, หินเมก้า, ด่านที่ผ่านแล้ว, สถานะเควสในตำนาน
 * ===================================================================== */
(function (PTD) {
  'use strict';

  /* เซฟแยกตามผู้ใช้ — auth.js เรียก useSlot() ตอนล็อกอิน
   * ค่าเริ่มต้นเป็นคีย์เดิม เซฟเก่าที่มีอยู่ก่อนมีระบบบัญชีจะได้ไม่หาย */
  const DEFAULT_KEY = 'pokedefense.save.v1';
  let KEY = DEFAULT_KEY;
  let PARTY_MAX = 6;

  function blank() {
    return {
      v: 1,
      started: false,
      money: 0,
      balls: 30,
      box: [],            // [{uid, id, lv, exp, mega}]
      party: [],          // [uid, ...] สูงสุด 6
      stones: [],         // [speciesId ที่มีหินเมก้าแล้ว]
      cleared: [],        // [stageId]
      quests: {},         // { speciesId: 'locked' | 'open' | 'done' }
      seen: [],           // เคยเจอ
      caught: [],         // เคยจับได้
      nextUid: 1,
      stats: { catches: 0, throws: 0, battles: 0, megas: 0 }
    };
  }

  let data = blank();
  let dirty = false;

  // สลับไปใช้เซฟของผู้ใช้อีกคน (ย้ายเซฟเดิมที่ไม่มีเจ้าของมาให้คนแรกที่ล็อกอิน)
  function useSlot(key) {
    KEY = key || DEFAULT_KEY;
    if (KEY !== DEFAULT_KEY && !PTD.store.getSync(KEY)) {
      const legacy = PTD.store.getSync(DEFAULT_KEY);
      if (legacy && legacy.v === 1) {
        PTD.store.setSync(KEY, legacy);
        PTD.store.delSync(DEFAULT_KEY);
      }
    }
    return load();
  }
  function slot() { return KEY; }

  function load() {
    const parsed = PTD.store.getSync(KEY);
    if (parsed && parsed.v === 1) data = Object.assign(blank(), parsed);
    else data = blank();
    return data;
  }

  function persist() {
    dirty = false;
    PTD.store.setSync(KEY, data);
  }

  // รวบการเขียนหลาย ๆ ครั้งให้เหลือครั้งเดียวต่อเฟรม
  function touch() {
    if (dirty) return;
    dirty = true;
    setTimeout(persist, 0);
  }

  /* ---------- กล่องโปเกม่อน ---------- */
  function addMon(speciesId, lv) {
    const mon = { uid: data.nextUid++, id: speciesId, lv: lv || 5, exp: 0, mega: null };
    data.box.push(mon);
    if (!data.caught.includes(speciesId)) data.caught.push(speciesId);
    if (!data.seen.includes(speciesId)) data.seen.push(speciesId);
    data.stats.catches++;
    // ทีมยังไม่เต็มก็ใส่ให้เลย จะได้ไม่ต้องมาจัดทีมเองตั้งแต่ตัวแรก ๆ
    if (data.party.length < PARTY_MAX) data.party.push(mon.uid);
    touch();
    return mon;
  }

  function releaseMon(uid) {
    const i = data.box.findIndex(m => m.uid === uid);
    if (i < 0) return false;
    data.box.splice(i, 1);
    const j = data.party.indexOf(uid);
    if (j >= 0) data.party.splice(j, 1);
    touch();
    return true;
  }

  const mon = (uid) => data.box.find(m => m.uid === uid) || null;

  /* ---------- ทีม ---------- */
  function partyMons() {
    return data.party.map(mon).filter(Boolean);
  }

  function toggleParty(uid) {
    const i = data.party.indexOf(uid);
    if (i >= 0) { data.party.splice(i, 1); touch(); return 'removed'; }
    if (data.party.length >= PARTY_MAX) return 'full';
    data.party.push(uid);
    touch();
    return 'added';
  }

  function setParty(uids) {
    data.party = uids.slice(0, PARTY_MAX).filter(u => mon(u));
    touch();
  }

  /* ---------- ของใช้ ---------- */
  function addMoney(n) { data.money = Math.max(0, data.money + n); touch(); }
  function addBalls(n) { data.balls = Math.max(0, data.balls + n); touch(); }
  function useBall() {
    if (data.balls <= 0) return false;
    data.balls--; data.stats.throws++; touch();
    return true;
  }
  function addStone(speciesId) {
    if (!data.stones.includes(speciesId)) { data.stones.push(speciesId); touch(); }
  }
  const hasStone = (speciesId) => data.stones.includes(speciesId);

  /* ---------- ความคืบหน้า ---------- */
  function clearStage(id) {
    if (!data.cleared.includes(id)) { data.cleared.push(id); touch(); }
  }
  const isCleared = (id) => data.cleared.includes(id);

  function questState(speciesId) { return data.quests[speciesId] || 'locked'; }
  function setQuest(speciesId, state) { data.quests[speciesId] = state; touch(); }

  function markSeen(speciesId) {
    if (!data.seen.includes(speciesId)) { data.seen.push(speciesId); touch(); }
  }

  /* ---------- เลเวลของโปเกม่อนในทีม ---------- */
  // เรียกหลังจบด่าน เพื่อเก็บเลเวล/EXP ที่ได้ระหว่างสู้กลับเข้ากล่อง
  function syncFromTowers(towers) {
    for (const t of towers) {
      if (!t.uid) continue;
      const m = mon(t.uid);
      if (!m) continue;
      m.lv = Math.max(m.lv, t.level);
      m.exp = Math.max(m.exp, Math.floor(t.exp));
      // ถ้าวิวัฒนาการระหว่างสู้ ให้จำร่างใหม่ไว้
      if (t.def.dexId !== m.id && !t.megaActive) m.id = t.def.dexId;
    }
    touch();
  }

  /* ---------- ร้านค้า ---------- */
  const PRICES = {
    balls: 250,          // ต่อ 10 ลูก
    stone: 5000,         // หินเมก้าหนึ่งก้อน
    candy: (lv) => Math.round(60 + 14 * Math.pow(lv, 1.75))
  };

  function buyBalls() {
    if (data.money < PRICES.balls) return false;
    data.money -= PRICES.balls;
    data.balls += 10;
    touch();
    return true;
  }

  // ซื้อหินเมก้าได้เฉพาะสายพันธุ์ที่มีตัวนั้นอยู่ในกล่องแล้ว
  function stoneOptions() {
    const owned = new Set(data.box.map(m => m.id));
    return PTD.MEGA_SPECIES.filter(id => owned.has(id) && !data.stones.includes(id));
  }
  function buyStone(speciesId) {
    if (!stoneOptions().includes(speciesId)) return false;
    if (data.money < PRICES.stone) return false;
    data.money -= PRICES.stone;
    data.stones.push(speciesId);
    touch();
    return true;
  }

  function candyPrice(uid) {
    const m = mon(uid);
    return m ? PRICES.candy(m.lv) : Infinity;
  }
  function buyCandyFor(uid) {
    const m = mon(uid);
    if (!m || m.lv >= PTD.MAX_LEVEL) return false;
    const cost = PRICES.candy(m.lv);
    if (data.money < cost) return false;
    data.money -= cost;
    m.lv++;
    m.exp = 0;
    touch();
    return true;
  }

  PTD.save = {
    PRICES, buyBalls, buyStone, stoneOptions, candyPrice, buyCandyFor,
    get PARTY_MAX() { return PARTY_MAX; },
    setPartyMax(n) { PARTY_MAX = Math.max(1, Math.round(n)); },
    get data() { return data; },
    get money() { return data.money; },
    get balls() { return data.balls; },
    load, persist, touch, useSlot, slot,
    reset() { data = blank(); persist(); return data; },
    addMon, releaseMon, mon, partyMons, toggleParty, setParty,
    addMoney, addBalls, useBall, addStone, hasStone,
    clearStage, isCleared, questState, setQuest, markSeen, syncFromTowers,
    get dexSeen() { return data.seen.length; },
    get dexCaught() { return data.caught.length; }
  };
})(window.PTD = window.PTD || {});
