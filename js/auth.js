/* =====================================================================
 * auth.js — บัญชีผู้เล่น
 *
 * หลายคนเล่นในเบราว์เซอร์เดียวกันได้ แยกเซฟคนละชุด
 * คนแรกที่สมัครจะเป็น admin อัตโนมัติ (เจ้าของเครื่อง)
 *
 * ข้อจำกัดที่ต้องรู้: นี่เป็นระบบฝั่งเบราว์เซอร์ล้วน ๆ
 *   - รหัสผ่านเก็บเป็นแฮช (SHA-256 + เกลือรายคน) ไม่ได้เก็บตัวจริง
 *     แต่คนที่เปิด devtools ได้ ก็แก้ข้อมูลในเครื่องตัวเองได้อยู่ดี
 *   - ใช้กันคนในบ้านสลับเซฟกันเฉย ๆ ไม่ใช่ระบบความปลอดภัยจริง
 *   - เซฟไม่ข้ามเครื่อง จนกว่าจะต่อ PTD.store.remote(...) เข้ากับเซิร์ฟเวอร์
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const UKEY = 'pokedefense.users.v1';
  const SAVE_PREFIX = 'pokedefense.save.v1';

  let db = null;      // { v, users: [], currentId }

  function blankDb() { return { v: 1, users: [], currentId: null }; }

  function loadDb() {
    const raw = PTD.store.getSync(UKEY);
    db = (raw && raw.v === 1 && Array.isArray(raw.users)) ? raw : blankDb();
    return db;
  }
  function saveDb() { PTD.store.setSync(UKEY, db); }

  function ensure() { if (!db) loadDb(); return db; }

  /* ---------- แฮชรหัสผ่าน ----------
   * ใช้ WebCrypto ถ้ามี (ต้องเป็น https หรือ localhost)
   * เปิดไฟล์ตรง ๆ ด้วย file:// จะไม่มี crypto.subtle จึงถอยไปใช้ตัวสำรอง
   * ซึ่งอ่อนกว่ามาก แต่ยังดีกว่าเก็บรหัสเป็นตัวอักษรเปล่า ๆ */
  const hasSubtle = typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest;

  function randSalt() {
    const a = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  function weakHash(str) {
    // FNV-1a 32 บิต วนหลายรอบ — ไม่ใช่ของแข็ง แค่ไม่ให้เห็นรหัสตรง ๆ
    let out = '';
    for (let round = 0; round < 4; round++) {
      let h = 0x811c9dc5 ^ round;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      out += h.toString(16).padStart(8, '0');
    }
    return out;
  }

  async function hashPass(pass, salt) {
    const msg = salt + '|' + pass + '|pokedefense';
    if (!hasSubtle) return { algo: 'weak', value: weakHash(msg) };
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    const value = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    return { algo: 'sha256', value };
  }

  async function verify(user, pass) {
    if (!user.pass) return true;                 // บัญชีที่ไม่ตั้งรหัส
    const h = await hashPass(pass, user.pass.salt);
    // บัญชีเก่าที่แฮชด้วยวิธีสำรองไว้ ยังต้องเข้าได้แม้ตอนนี้มี WebCrypto แล้ว
    if (h.algo !== user.pass.algo) {
      const alt = user.pass.algo === 'weak'
        ? { value: weakHash(user.pass.salt + '|' + pass + '|pokedefense') }
        : h;
      return alt.value === user.pass.hash;
    }
    return h.value === user.pass.hash;
  }

  /* ---------- ข้อมูลผู้ใช้ ---------- */
  const saveKeyFor = (id) => SAVE_PREFIX + ':' + id;
  const norm = (n) => String(n || '').trim();
  const sameName = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();

  function list() { return ensure().users.slice(); }
  function byId(id) { return ensure().users.find(u => u.id === id) || null; }
  function byName(n) { return ensure().users.find(u => sameName(u.name, n)) || null; }
  function current() { return byId(ensure().currentId); }
  function isAdmin() { const u = current(); return !!(u && u.role === 'admin'); }

  function nextId() {
    return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  async function register(name, pass, opts) {
    const n = norm(name);
    if (n.length < 2) throw new Error('ชื่อต้องยาวอย่างน้อย 2 ตัวอักษร');
    if (n.length > 20) throw new Error('ชื่อยาวเกินไป (ไม่เกิน 20 ตัวอักษร)');
    if (byName(n)) throw new Error('มีชื่อนี้อยู่แล้ว');
    ensure();
    const salt = randSalt();
    const h = pass ? await hashPass(pass, salt) : null;
    const u = {
      id: nextId(),
      name: n,
      // คนแรกที่สมัคร = เจ้าของเครื่อง ได้สิทธิ์ admin
      role: (opts && opts.role) || (db.users.length === 0 ? 'admin' : 'player'),
      pass: h ? { algo: h.algo, salt, hash: h.value } : null,
      created: Date.now(),
      lastSeen: Date.now()
    };
    db.users.push(u);
    saveDb();
    return u;
  }

  async function login(nameOrId, pass) {
    const u = byId(nameOrId) || byName(nameOrId);
    if (!u) throw new Error('ไม่พบผู้ใช้นี้');
    if (u.pass && !(await verify(u, pass || ''))) throw new Error('รหัสผ่านไม่ถูกต้อง');
    ensure().currentId = u.id;
    u.lastSeen = Date.now();
    saveDb();
    PTD.save.useSlot(saveKeyFor(u.id));
    return u;
  }

  function logout() {
    ensure().currentId = null;
    saveDb();
  }

  async function setPassword(id, pass) {
    const u = byId(id);
    if (!u) throw new Error('ไม่พบผู้ใช้นี้');
    if (!pass) { u.pass = null; saveDb(); return u; }
    const salt = randSalt();
    const h = await hashPass(pass, salt);
    u.pass = { algo: h.algo, salt, hash: h.value };
    saveDb();
    return u;
  }

  function rename(id, name) {
    const u = byId(id);
    if (!u) throw new Error('ไม่พบผู้ใช้นี้');
    const n = norm(name);
    if (n.length < 2) throw new Error('ชื่อสั้นเกินไป');
    const other = byName(n);
    if (other && other.id !== id) throw new Error('มีชื่อนี้อยู่แล้ว');
    u.name = n;
    saveDb();
    return u;
  }

  function setRole(id, role) {
    const u = byId(id);
    if (!u) throw new Error('ไม่พบผู้ใช้นี้');
    if (u.role === 'admin' && role !== 'admin' && adminCount() <= 1)
      throw new Error('ต้องเหลือ admin อย่างน้อยหนึ่งคน');
    u.role = role === 'admin' ? 'admin' : 'player';
    saveDb();
    return u;
  }

  function adminCount() { return ensure().users.filter(u => u.role === 'admin').length; }

  function remove(id) {
    ensure();
    const u = byId(id);
    if (!u) throw new Error('ไม่พบผู้ใช้นี้');
    if (u.role === 'admin' && adminCount() <= 1) throw new Error('ลบ admin คนสุดท้ายไม่ได้');
    db.users = db.users.filter(x => x.id !== id);
    if (db.currentId === id) db.currentId = null;
    PTD.store.delSync(saveKeyFor(id));
    saveDb();
    return true;
  }

  // อ่าน/เขียนเซฟของผู้ใช้คนอื่น (หน้า admin ใช้)
  function saveOf(id) { return PTD.store.getSync(saveKeyFor(id)); }
  function writeSaveOf(id, data) {
    PTD.store.setSync(saveKeyFor(id), data);
    // ถ้าเป็นคนที่กำลังเล่นอยู่ ต้องโหลดกลับเข้าเกมด้วย ไม่งั้นเขียนทับกลับ
    if (ensure().currentId === id) PTD.save.load();
    return true;
  }

  PTD.auth = {
    SAVE_PREFIX,
    load: loadDb,
    list, byId, byName, current, isAdmin, adminCount,
    register, login, logout, setPassword, rename, setRole, remove,
    saveKeyFor, saveOf, writeSaveOf,
    get secure() { return hasSubtle; },
    get count() { return ensure().users.length; }
  };
})(window.PTD = window.PTD || {});
