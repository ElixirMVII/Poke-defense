/* =====================================================================
 * store.js — ที่เก็บข้อมูล (storage adapter)
 *
 * ตอนนี้เก็บลง localStorage ของเบราว์เซอร์ล้วน ๆ ไม่ต้องมีเซิร์ฟเวอร์
 * แต่แยกเป็นชั้นเดียวไว้ เพื่อให้ต่อเซิร์ฟเวอร์จริงทีหลังได้โดยไม่ต้อง
 * แก้โค้ดเกมเลยสักบรรทัด — เปลี่ยนแค่ PTD.store.use(...) ตอนบูต
 *
 * ทุกเมธอดคืน Promise เพื่อให้หน้าตาเหมือนกันทั้งแบบในเครื่องและแบบต่อเน็ต
 * ส่วนเกมที่ต้องอ่าน/เขียนถี่ ๆ ระหว่างเล่น (save.js) ยังใช้แบบ sync ผ่าน
 * getSync/setSync ได้ เพราะ localStorage ทำงานทันที
 * ===================================================================== */
(function (PTD) {
  'use strict';

  /* ---------- แบบเก็บในเครื่อง ---------- */
  const LocalStore = {
    kind: 'local',
    name: 'เก็บในเครื่องนี้',

    getSync(key) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      catch (e) { console.warn('อ่าน', key, 'ไม่ได้:', e.message); return null; }
    },
    setSync(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { console.warn('เขียน', key, 'ไม่ได้:', e.message); return false; }
    },
    delSync(key) {
      try { localStorage.removeItem(key); return true; } catch (e) { return false; }
    },
    keysSync(prefix) {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!prefix || (k && k.startsWith(prefix))) out.push(k);
        }
      } catch (e) { /* โหมดส่วนตัวบางเบราว์เซอร์อ่าน length ไม่ได้ */ }
      return out;
    },

    async get(key) { return this.getSync(key); },
    async set(key, val) { return this.setSync(key, val); },
    async del(key) { return this.delSync(key); },
    async keys(prefix) { return this.keysSync(prefix); }
  };

  /* ---------- โครงสำหรับต่อเซิร์ฟเวอร์ทีหลัง ----------
   * ใช้ localStorage เป็นแคชเพื่อให้เกมยังเล่นได้ตอนเน็ตหลุด
   * แล้วค่อยส่งขึ้นเซิร์ฟเวอร์เบื้องหลัง
   *
   * ฝั่งเซิร์ฟเวอร์ต้องมีสามเส้นทางนี้:
   *   GET    <base>/kv/:key        -> { value }
   *   PUT    <base>/kv/:key        <- { value }
   *   DELETE <base>/kv/:key
   * แนบโทเคนมากับหัวข้อ Authorization ถ้ามี
   *
   * เปิดใช้ด้วย  PTD.store.use(PTD.store.remote('https://api.example.com', token))  */
  function RemoteStore(base, token) {
    const head = Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {});
    const url = (k) => base.replace(/\/$/, '') + '/kv/' + encodeURIComponent(k);
    return {
      kind: 'remote',
      name: 'ซิงก์กับเซิร์ฟเวอร์',
      base, token,
      // อ่าน/เขียนแบบทันทีใช้แคชในเครื่อง เกมจะได้ไม่ต้องรอเน็ต
      getSync: (k) => LocalStore.getSync(k),
      setSync(k, v) { LocalStore.setSync(k, v); this.push(k, v); return true; },
      delSync(k) { LocalStore.delSync(k); fetch(url(k), { method: 'DELETE', headers: head }).catch(() => {}); return true; },
      keysSync: (p) => LocalStore.keysSync(p),

      async get(k) {
        try {
          const r = await fetch(url(k), { headers: head });
          if (r.ok) { const j = await r.json(); LocalStore.setSync(k, j.value); return j.value; }
        } catch (e) { /* เน็ตหลุดก็ใช้ของในเครื่องไปก่อน */ }
        return LocalStore.getSync(k);
      },
      async set(k, v) { LocalStore.setSync(k, v); return this.push(k, v); },
      async del(k) { return this.delSync(k); },
      async keys(p) { return LocalStore.keysSync(p); },

      push(k, v) {
        return fetch(url(k), { method: 'PUT', headers: head, body: JSON.stringify({ value: v }) })
          .then(r => r.ok)
          .catch(() => false);
      }
    };
  }

  let active = LocalStore;

  PTD.store = {
    get kind() { return active.kind; },
    get name() { return active.name; },
    use(s) { active = s || LocalStore; return active; },
    local: LocalStore,
    remote: RemoteStore,

    getSync: (k) => active.getSync(k),
    setSync: (k, v) => active.setSync(k, v),
    delSync: (k) => active.delSync(k),
    keysSync: (p) => active.keysSync(p),
    get: (k) => active.get(k),
    set: (k, v) => active.set(k, v),
    del: (k) => active.del(k),
    keys: (p) => active.keys(p)
  };
})(window.PTD = window.PTD || {});
