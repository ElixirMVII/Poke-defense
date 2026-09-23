/* =====================================================================
 * admin.js — หน้าผู้ดูแล
 *
 * สองส่วน:
 *   1. ค่าเกม   — ปรับตัวเลขที่คุมความยาก/เศรษฐกิจ/ซาฟารี มีผลทันที
 *   2. ผู้ใช้   — ดูและแก้ข้อมูลของทุกคน: เงิน ลูกบอล หิน ด่านที่ผ่าน
 *                 กล่องโปเกม่อน ทีม เลเวล และสิทธิ์
 *
 * เข้าได้เฉพาะบัญชีที่ role เป็น admin (คนแรกที่สมัครในเครื่องนี้)
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');

  let tab = 'config';      // 'config' | 'users'
  let editing = null;      // id ผู้ใช้ที่กำลังแก้อยู่
  let app = null;

  function init(a) { app = a; }

  /* ---------------- โครงหน้า ---------------- */
  function show() {
    if (!PTD.auth.isAdmin()) { PTD.ui.toast('ต้องเป็น admin ถึงเข้าหน้านี้ได้'); app.go('world'); return; }
    const html = `
      <h2 class="big-title">หน้าผู้ดูแล</h2>
      <p class="lead">แก้ค่าเกมและข้อมูลผู้เล่นได้ทุกอย่าง — มีผลทันที และเก็บไว้ในเครื่องนี้</p>
      <div class="adm-tabs">
        <button class="adm-tab ${tab === 'config' ? 'on' : ''}" data-tab="config">ค่าเกม</button>
        <button class="adm-tab ${tab === 'users' ? 'on' : ''}" data-tab="users">ผู้ใช้ (${PTD.auth.count})</button>
      </div>
      <div id="admBody">${tab === 'config' ? configHtml() : usersHtml()}</div>`;
    const d = PTD.ui.showDom(html);
    d.querySelectorAll('[data-tab]').forEach(b =>
      b.addEventListener('click', () => { tab = b.dataset.tab; editing = null; show(); }));
    if (tab === 'config') bindConfig(d); else bindUsers(d);
  }

  /* ---------------- แท็บค่าเกม ---------------- */
  function configHtml() {
    const changed = Object.keys(PTD.config.values).length;
    return `
      <div class="adm-bar">
        <span>${changed ? `แก้ไว้ ${changed} ค่า` : 'ยังเป็นค่าตั้งต้นทั้งหมด'}</span>
        <button id="admResetAll" class="sell" ${changed ? '' : 'disabled'}>คืนค่าเดิมทั้งหมด</button>
      </div>
      ${PTD.config.groups().map(g => `
        <h3 class="sec">${esc(g.name)}</h3>
        <div class="adm-grid">${g.fields.map(f => {
          const v = PTD.config.get(f.key), d = PTD.config.defaultOf(f.key);
          const dirty = PTD.config.isChanged(f.key);
          return `<div class="adm-field ${dirty ? 'dirty' : ''}">
            <label for="cf-${f.key}">${esc(f.label)}</label>
            <div class="adm-row">
              <input type="range" id="rg-${f.key}" data-key="${f.key}"
                     min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
              <input type="number" id="cf-${f.key}" data-key="${f.key}"
                     min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
            </div>
            <div class="adm-hint">ค่าเดิม ${d}${dirty ? ` · <a href="#" data-reset="${f.key}">คืนค่าเดิม</a>` : ''}</div>
          </div>`;
        }).join('')}</div>`).join('')}

      <h3 class="sec">เลือดรวมเป้าหมายรายด่าน</h3>
      <p class="side-note">ตัวเลขนี้คือเลือดรวมทั้งด่านที่ระบบจะปรับเวฟให้ได้พอดี
        ยิ่งมากยิ่งยาก (หน่วยพันหน่วย)</p>
      <div class="adm-grid tight">${PTD.campaign.hpTargets.map((t, i) => `
        <div class="adm-field">
          <label for="hp-${i}">ด่าน ${i + 1} · ${esc(PTD.campaign.STAGES[i].name)}</label>
          <input type="number" id="hp-${i}" data-hp="${i}" min="1" max="9999" step="1"
                 value="${Math.round(t / 1000)}">
        </div>`).join('')}</div>
      <div class="adm-bar"><button id="admHpSave" class="primary">บันทึกตารางเลือด</button></div>`;
  }

  function bindConfig(d) {
    // แถบเลื่อนกับช่องตัวเลขคุมค่าเดียวกัน ต้องตามกันทั้งสองทาง
    d.querySelectorAll('input[data-key]').forEach(inp => {
      inp.addEventListener('change', () => {
        const key = inp.dataset.key;
        const v = PTD.config.set(key, inp.value);
        PTD.ui.toast('ตั้ง ' + key + ' = ' + v);
        show();
      });
      inp.addEventListener('input', () => {
        const other = d.querySelector(
          (inp.type === 'range' ? '#cf-' : '#rg-') + CSS.escape(inp.dataset.key));
        if (other) other.value = inp.value;
      });
    });
    d.querySelectorAll('[data-reset]').forEach(a =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        PTD.config.resetKey(a.dataset.reset);
        show();
      }));
    const ra = $('admResetAll');
    if (ra) ra.onclick = () => {
      if (!confirm('คืนค่าเกมทั้งหมดกลับเป็นค่าตั้งต้น?')) return;
      PTD.config.resetAll();
      PTD.ui.toast('คืนค่าเดิมแล้ว');
      show();
    };
    const hs = $('admHpSave');
    if (hs) hs.onclick = () => {
      const arr = [];
      d.querySelectorAll('[data-hp]').forEach(i => arr.push(Math.max(1, Number(i.value) || 1) * 1000));
      PTD.campaign.setHpTargets(arr);
      PTD.store.setSync('pokedefense.hptargets.v1', arr);
      PTD.ui.toast('บันทึกตารางเลือดแล้ว');
    };
  }

  /* ---------------- แท็บผู้ใช้ ---------------- */
  function usersHtml() {
    const me = PTD.auth.current();
    const rows = PTD.auth.list().map(u => {
      const sv = PTD.auth.saveOf(u.id) || {};
      const box = (sv.box || []).length, cleared = (sv.cleared || []).length;
      return `<tr class="${editing === u.id ? 'on' : ''}">
        <td><b>${esc(u.name)}</b>${u.id === me.id ? ' <em>(คุณ)</em>' : ''}
            ${u.pass ? '' : ' <em class="warn">ไม่มีรหัส</em>'}</td>
        <td><span class="role ${u.role}">${u.role === 'admin' ? 'ผู้ดูแล' : 'ผู้เล่น'}</span></td>
        <td>₽${fmt(sv.money)}</td>
        <td>${sv.balls || 0}</td>
        <td>${box}</td>
        <td>${cleared}/10</td>
        <td><button class="mini" data-edit="${u.id}">${editing === u.id ? 'ปิด' : 'แก้'}</button></td>
      </tr>`;
    }).join('');

    return `
      <table class="adm-table">
        <thead><tr><th>ชื่อ</th><th>สิทธิ์</th><th>เงิน</th><th>บอล</th>
          <th>กล่อง</th><th>ด่าน</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${editing ? editorHtml(editing) : ''}
      <h3 class="sec">เพิ่มผู้ใช้</h3>
      <div class="adm-row wrap">
        <input type="text" id="newName" placeholder="ชื่อผู้ใช้" maxlength="20">
        <input type="password" id="newPass" placeholder="รหัสผ่าน (เว้นว่างได้)">
        <select id="newRole"><option value="player">ผู้เล่น</option><option value="admin">ผู้ดูแล</option></select>
        <button id="admAdd" class="primary">เพิ่ม</button>
      </div>`;
  }

  function editorHtml(id) {
    const u = PTD.auth.byId(id);
    if (!u) return '';
    const sv = PTD.auth.saveOf(id) || { money: 0, balls: 0, stones: [], box: [], party: [], cleared: [], caught: [] };
    const box = sv.box || [];
    return `
      <div class="panel adm-editor">
        <h3 class="side-h">แก้ข้อมูล: ${esc(u.name)}</h3>
        <div class="adm-grid">
          <div class="adm-field"><label>ชื่อ</label>
            <input type="text" id="edName" value="${esc(u.name)}" maxlength="20"></div>
          <div class="adm-field"><label>สิทธิ์</label>
            <select id="edRole">
              <option value="player" ${u.role === 'player' ? 'selected' : ''}>ผู้เล่น</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแล</option>
            </select></div>
          <div class="adm-field"><label>ตั้งรหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)</label>
            <input type="password" id="edPass" placeholder="เว้นว่าง = ไม่เปลี่ยน"></div>
          <div class="adm-field"><label>เงิน</label>
            <input type="number" id="edMoney" value="${Math.round(sv.money || 0)}" min="0" step="100"></div>
          <div class="adm-field"><label>ลูกบอล</label>
            <input type="number" id="edBalls" value="${sv.balls || 0}" min="0" step="5"></div>
          <div class="adm-field"><label>ด่านที่ผ่าน (1-10 คั่นด้วยจุลภาค)</label>
            <input type="text" id="edCleared" value="${(sv.cleared || []).map(c => String(c).replace('s', '')).join(',')}"></div>
        </div>

        <h4 class="adm-sub">กล่องโปเกม่อน (${box.length} ตัว)</h4>
        <div class="adm-box">${box.length ? box.map(m => `
          <div class="adm-mon">
            <img class="psprite tiny" src="${PTD.sprites.stillURL(m.id)}" alt="">
            <span>${esc((PTD.dex(m.id) || {}).n || m.id)}</span>
            <input type="number" data-lv="${m.uid}" value="${m.lv}" min="1" max="${PTD.MAX_LEVEL}">
            <button class="mini danger" data-del="${m.uid}">✕</button>
          </div>`).join('') : '<p class="empty">ยังไม่มีโปเกม่อน</p>'}</div>

        <h4 class="adm-sub">เพิ่มโปเกม่อน</h4>
        <div class="adm-row wrap">
          <input type="number" id="giveId" placeholder="เลขเด็กซ์ 1-${PTD.DEX.length}" min="1" max="${PTD.DEX.length}">
          <input type="number" id="giveLv" placeholder="เลเวล" value="20" min="1" max="${PTD.MAX_LEVEL}">
          <button id="admGive">เพิ่มเข้ากล่อง</button>
          <button id="admGiveAll" class="mega">ให้ครบ ${PTD.DEX.length} ตัว</button>
        </div>

        <div class="adm-bar">
          <button id="admSaveUser" class="primary">บันทึก</button>
          <button id="admWipe" class="sell">ล้างเซฟคนนี้</button>
          <button id="admDelUser" class="sell">ลบผู้ใช้</button>
        </div>
      </div>`;
  }

  function bindUsers(d) {
    d.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => {
        editing = editing === b.dataset.edit ? null : b.dataset.edit;
        show();
      }));

    const add = $('admAdd');
    if (add) add.onclick = async () => {
      try {
        await PTD.auth.register($('newName').value, $('newPass').value,
          { role: $('newRole').value });
        PTD.ui.toast('เพิ่มผู้ใช้แล้ว');
        show();
      } catch (e) { PTD.ui.toast(e.message); }
    };

    if (!editing) return;
    const id = editing;
    const sv = () => PTD.auth.saveOf(id) || {};

    const give = $('admGive');
    if (give) give.onclick = () => {
      const dexId = Number($('giveId').value), lv = Number($('giveLv').value) || 1;
      if (!(dexId >= 1 && dexId <= PTD.DEX.length)) { PTD.ui.toast('เลขเด็กซ์ต้องอยู่ระหว่าง 1-' + PTD.DEX.length); return; }
      const data = sv();
      data.box = data.box || [];
      data.box.push({ uid: Date.now() + Math.floor(Math.random() * 1000), id: dexId, lv, exp: 0 });
      if (!(data.caught || []).includes(dexId)) data.caught = (data.caught || []).concat(dexId);
      if (!(data.seen || []).includes(dexId)) data.seen = (data.seen || []).concat(dexId);
      PTD.auth.writeSaveOf(id, data);
      PTD.ui.toast('เพิ่ม ' + (PTD.dex(dexId) || {}).n + ' แล้ว');
      show();
    };

    const giveAll = $('admGiveAll');
    if (giveAll) giveAll.onclick = () => {
      if (!confirm('ใส่โปเกม่อนครบ ' + PTD.DEX.length + ' ตัวเข้ากล่องคนนี้?')) return;
      const data = sv();
      data.box = data.box || [];
      const lv = Number($('giveLv').value) || 20;
      let uid = Date.now();
      for (let i = 1; i <= PTD.DEX.length; i++) data.box.push({ uid: uid++, id: i, lv, exp: 0 });
      data.caught = Array.from({ length: PTD.DEX.length }, (_, i) => i + 1);
      data.seen = data.caught.slice();
      PTD.auth.writeSaveOf(id, data);
      PTD.ui.toast('ให้ครบ ' + PTD.DEX.length + ' ตัวแล้ว');
      show();
    };

    d.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => {
        const uid = Number(b.dataset.del);
        const data = sv();
        data.box = (data.box || []).filter(m => m.uid !== uid);
        data.party = (data.party || []).filter(u => u !== uid);
        PTD.auth.writeSaveOf(id, data);
        show();
      }));

    const saveBtn = $('admSaveUser');
    if (saveBtn) saveBtn.onclick = async () => {
      try {
        const u = PTD.auth.byId(id);
        if ($('edName').value.trim() !== u.name) PTD.auth.rename(id, $('edName').value);
        if ($('edRole').value !== u.role) PTD.auth.setRole(id, $('edRole').value);
        if ($('edPass').value) await PTD.auth.setPassword(id, $('edPass').value);

        const data = sv();
        data.money = Math.max(0, Number($('edMoney').value) || 0);
        data.balls = Math.max(0, Number($('edBalls').value) || 0);
        data.cleared = String($('edCleared').value).split(',')
          .map(x => x.trim()).filter(Boolean)
          .map(x => /^\d+$/.test(x) ? 's' + x : x);
        // เลเวลในกล่อง
        d.querySelectorAll('[data-lv]').forEach(i => {
          const uid = Number(i.dataset.lv);
          const m = (data.box || []).find(x => x.uid === uid);
          if (m) m.lv = Math.max(1, Math.min(PTD.MAX_LEVEL, Number(i.value) || 1));
        });
        PTD.auth.writeSaveOf(id, data);
        PTD.ui.toast('บันทึกแล้ว');
        show();
      } catch (e) { PTD.ui.toast(e.message); }
    };

    const wipe = $('admWipe');
    if (wipe) wipe.onclick = () => {
      const u = PTD.auth.byId(id);
      if (!confirm(`ล้างเซฟของ ${u.name} ทั้งหมด? กู้คืนไม่ได้`)) return;
      PTD.store.delSync(PTD.auth.saveKeyFor(id));
      if (PTD.auth.current().id === id) PTD.save.load();
      PTD.ui.toast('ล้างเซฟแล้ว');
      show();
    };

    const del = $('admDelUser');
    if (del) del.onclick = () => {
      const u = PTD.auth.byId(id);
      if (!confirm(`ลบผู้ใช้ ${u.name} พร้อมเซฟทั้งหมด? กู้คืนไม่ได้`)) return;
      try {
        const wasMe = PTD.auth.current().id === id;
        PTD.auth.remove(id);
        editing = null;
        if (wasMe) { app.go('login'); return; }
        PTD.ui.toast('ลบแล้ว');
        show();
      } catch (e) { PTD.ui.toast(e.message); }
    };
  }

  PTD.admin = { init, show };
})(window.PTD = window.PTD || {});
