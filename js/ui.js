/* =====================================================================
 * ui.js — ส่วนติดต่อผู้ใช้ทุกหน้าจอ
 *   starter · world · party · dex · safari (แถบข้าง+มินิเกมจับ) · battle
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let app = null;

  // iOS ยิง mousemove ปลอมตอนแตะ แล้วไม่มี mouseleave ตามมา
  // ทูลทิปแบบ hover เลยค้างบนจอ — บนอุปกรณ์สัมผัสจึงใช้วิธีอื่นแทน
  const TOUCH = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const dexNo = (id) => '#' + String(id).padStart(3, '0');
  const sprite = (id, cls) =>
    `<img class="psprite ${cls || ''}" src="${PTD.sprites.stillURL(id)}" alt="" loading="lazy">`;
  const badge = (t) =>
    `<span class="tbadge" style="background:${PTD.TYPE_COLOR[t]}">${PTD.TYPE_TH[t]}</span>`;
  // ฟอนต์พิกเซลวาด % หนาจนอ่านเป็นเลข 2 — แยกหน่วยออกมาใช้ฟอนต์ปกติ
  const pct = (n) => `${Math.round(n)}<i class="u">%</i>`;
  const ball = (cls) => `<span class="pokeball ${cls || ''}"></span>`;
  // ป้ายโปเกบอลบนตัวที่จับได้แล้ว เหมือนไอคอนในเด็กซ์ของเกมจริง
  const caughtMark = (id) =>
    PTD.save.data.caught.includes(id) ? '<span class="pokeball sm caught-mark"></span>' : '';

  /* ---------------- ทูลทิป ---------------- */
  let tip = null;
  function showTip(html, ev) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); }
    tip.innerHTML = html;
    tip.style.display = 'block';
    const rc = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + rc.width > innerWidth - 8) x = ev.clientX - rc.width - 14;
    if (y + rc.height > innerHeight - 8) y = Math.max(8, innerHeight - rc.height - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  function bindTips(root) {
    if (TOUCH) {
      // การ์ดที่ไม่มีการกระทำอื่น (เช่นในเด็กซ์) ให้แตะแล้วเปิดข้อมูลเต็ม
      root.querySelectorAll('[data-tip-mon]').forEach(el => {
        if (el.tagName === 'BUTTON' || el.closest('button')) return;
        el.addEventListener('click', () => infoModal(Number(el.dataset.tipMon)));
      });
      return;
    }
    root.querySelectorAll('[data-tip-mon]').forEach(el => {
      el.addEventListener('mousemove', (ev) => showTip(monTip(Number(el.dataset.tipMon)), ev));
      el.addEventListener('mouseleave', hideTip);
    });
  }

  // หน้าต่างข้อมูลสำหรับจอสัมผัส (แทนทูลทิปที่ใช้ไม่ได้)
  function infoModal(speciesId) {
    const m = $('modal');
    m.hidden = false;
    m.innerHTML = `<div class="enc-box info">
        <div class="info-body">${monTip(speciesId)}</div>
        <button class="ghost" id="infoClose">ปิด</button>
      </div>`;
    $('infoClose').onclick = closeModal;
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
  }

  function effText(ef) {
    if (!ef) return null;
    const pc = Math.round((ef.chance == null ? 1 : ef.chance) * 100);
    switch (ef.kind) {
      case 'burn':   return `ไหม้ ${ef.dps}/วิ นาน ${ef.dur}วิ (${pc}%)`;
      case 'poison': return `พิษ ${ef.dps}/วิ นาน ${ef.dur}วิ (${pc}%)`;
      case 'slow':   return `ช้าลง ${Math.round(ef.power * 100)}% นาน ${ef.dur}วิ (${pc}%)`;
      case 'stun':   return `หยุดชะงัก ${ef.dur}วิ (${pc}%)`;
      case 'slowpoison': return `ช้าลง ${Math.round(ef.power * 100)}% + พิษ ${ef.dps}/วิ (${pc}%)`;
    }
    return null;
  }

  function monTip(speciesId, lv) {
    const def = PTD.tower(speciesId);
    if (!def) return '';
    const d = PTD.dex(speciesId);
    const st = def.stats;
    const ef = effText(def.effect);
    const line = (k, v) => `<div class="tl"><span>${k}</span><b>${v}</b></div>`;
    const megas = PTD.megasOf(speciesId);
    return `
      <div class="tip-h">${def.name} <em>${dexNo(speciesId)} · ${def.jp}</em></div>
      <div class="tip-types">${def.types.map(badge).join('')}</div>
      <div class="tip-move">${def.move}
        <span class="mt" style="color:${PTD.TYPE_COLOR[def.moveType]}">(${PTD.TYPE_TH[def.moveType]})</span>
        — ${def.desc}</div>
      ${line('พลังโจมตี', fmt(def.dmg))}
      ${line('ระยะ', fmt(def.range))}
      ${line('ความเร็ว', def.rate.toFixed(2) + '/วิ')}
      ${def.splash ? line('รัศมีระเบิด', def.splash) : ''}
      ${def.chains ? line('กระโดดต่อ', def.chains + ' ตัว') : ''}
      ${def.targets > 1 ? line('ตีพร้อมกัน', def.targets + ' เป้า') : ''}
      ${def.ignoreArmor ? line('พิเศษ', 'ทะลุเกราะ') : ''}
      ${ef ? line('ผลข้างเคียง', ef) : ''}
      <div class="tip-base">HP ${st[0]} · Atk ${st[1]} · Def ${st[2]} · SpA ${st[3]}
        · SpD ${st[4]} · Spe ${st[5]} · <b>BST ${def.bst}</b> · อัตราจับ ${d.cr}</div>
      ${megas.length ? `<div class="tip-mega">⚡ เมก้าได้: ${megas.map(m => m.n).join(' / ')}
        — ต้องมีหิน ${megas[0].stone}</div>` : ''}`;
  }

  /* ---------------- โครงหน้าจอ ---------------- */
  function showDom(html) {
    hideTip();
    $('canvasView').hidden = true;
    const d = $('domScreen');
    d.hidden = false;
    d.innerHTML = html;
    return d;
  }

  function showCanvas(kind) {
    hideTip();
    $('domScreen').hidden = true;
    $('canvasView').hidden = false;
    $('endscreen').hidden = true;
    if (kind === 'safari') buildSafariSide();
    else buildBattleSide();
  }

  /* ---------------- แถบบน ---------------- */
  function syncHud() {
    const s = PTD.save;
    const sc = app.screen;
    const stats = [];
    if (sc !== 'starter' && sc !== 'login') {
      stats.push(`<div class="stat money"><span class="ico">₽</span><b id="money">${fmt(
        sc === 'battle' ? PTD.battle.money : s.money)}</b></div>`);
      stats.push(`<div class="stat"><span class="pokeball sm"></span><b id="balls">${s.balls}</b></div>`);
      if (sc === 'battle') {
        stats.push(`<div class="stat heart"><span class="ico">❤</span><b id="lives">${PTD.battle.lives}</b></div>`);
        stats.push(`<div class="stat"><span class="lbl">เวฟ</span><b id="wave">–</b></div>`);
      } else {
        stats.push(`<div class="stat"><span class="lbl">เด็กซ์</span><b>${s.dexCaught}/${PTD.DEX.length}</b></div>`);
        stats.push(`<div class="stat"><span class="lbl">ทีม</span><b>${s.data.party.length}/6</b></div>`);
      }
    }
    $('hudStats').innerHTML = stats.join('');

    const acts = [];
    if (sc === 'battle') {
      acts.push('<button id="btnWave" class="primary">เริ่มเวฟ ▶</button>');
      acts.push('<button id="btnSpeed" class="icon" title="ความเร็ว (X)">1x</button>');
      acts.push('<button id="btnPause" class="icon" title="พัก (Space)">⏸</button>');
      acts.push('<button id="btnQuit" class="icon" title="ออกจากด่าน">✕</button>');
    } else if (sc === 'safari') {
      acts.push('<button id="btnQuit" class="primary">กลับแผนที่โลก</button>');
    } else if (sc !== 'starter' && sc !== 'login') {
      acts.push('<button data-go="world" class="nav">แผนที่โลก</button>');
      acts.push('<button data-go="party" class="nav">จัดทีม</button>');
      acts.push('<button data-go="dex" class="nav">โปเกเด็กซ์</button>');
      if (PTD.auth.isAdmin()) acts.push('<button data-go="admin" class="nav adm">ผู้ดูแล</button>');
    }
    const me = PTD.auth.current();
    if (me && sc !== 'login') {
      acts.push(`<button id="btnWho" class="icon who" title="ออกจากระบบ">${
        me.name.slice(0, 1).toUpperCase()}</button>`);
    }
    acts.push('<button id="btnSound" class="icon" title="เสียง">🔊</button>');
    acts.push('<button id="btnHelp" class="icon" title="วิธีเล่น">?</button>');
    $('hudActions').innerHTML = acts.join('');

    $('hudActions').querySelectorAll('[data-go]').forEach(b =>
      b.addEventListener('click', () => app.go(b.dataset.go)));
    const q = $('btnQuit');
    if (q) q.onclick = () => {
      if (app.screen === 'battle' && PTD.battle.state !== 'won' && PTD.battle.state !== 'lost') {
        if (!confirm('ออกจากด่านตอนนี้? ความคืบหน้าในด่านจะหาย')) return;
      }
      app.go('world');
    };
    const who = $('btnWho');
    if (who) who.onclick = () => {
      const u = PTD.auth.current();
      if (confirm(`กำลังเล่นเป็น ${u.name}\nออกจากระบบแล้วสลับผู้เล่น?`)) app.logout();
    };
    const snd = $('btnSound');
    if (snd) {
      snd.textContent = PTD.audio.enabled ? '🔊' : '🔇';
      snd.onclick = () => { PTD.audio.toggle(); syncHud(); };
    }
    const hlp = $('btnHelp');
    if (hlp) hlp.onclick = () => { $('help').hidden = !$('help').hidden; };

    if (sc === 'battle') {
      $('btnWave').onclick = () => { PTD.audio.unlock(); PTD.battle.startWave(); };
      $('btnSpeed').onclick = () => {
        const B = PTD.battle;
        B.speed = B.speed === 1 ? 2 : (B.speed === 2 ? 3 : 1);
        $('btnSpeed').textContent = B.speed + 'x';
      };
      $('btnPause').onclick = () => {
        PTD.battle.paused = !PTD.battle.paused;
        $('btnPause').textContent = PTD.battle.paused ? '▶' : '⏸';
      };
    }
  }

  /* ---------------- หน้าเลือกตัวเริ่มต้น ---------------- */
  /* ---------------- หน้าเข้าสู่ระบบ ---------------- */
  let loginMode = 'pick';       // 'pick' = เลือกจากรายชื่อ, 'new' = สมัครใหม่

  function showLogin() {
    const users = PTD.auth.list();
    const first = users.length === 0;
    if (first) loginMode = 'new';

    const body = loginMode === 'new' ? `
      <div class="auth-form">
        <label for="auName">ชื่อผู้เล่น</label>
        <input type="text" id="auName" maxlength="20" placeholder="ตั้งชื่อของคุณ" autocomplete="username">
        <label for="auPass">รหัสผ่าน <small>เว้นว่างได้ถ้าไม่อยากตั้ง</small></label>
        <input type="password" id="auPass" placeholder="ตั้งรหัสผ่าน (ไม่บังคับ)" autocomplete="new-password">
        <button id="auCreate" class="primary big">${first ? 'เริ่มเล่น' : 'สมัคร'}</button>
        ${first ? '<p class="auth-note">คนแรกที่สมัครในเครื่องนี้จะได้สิทธิ์ผู้ดูแล</p>' : ''}
        ${users.length ? '<button id="auBack" class="nav">กลับไปเลือกจากรายชื่อ</button>' : ''}
      </div>` : `
      <div class="auth-list">
        ${users.map(u => `<button class="auth-user" data-uid="${u.id}">
            <span class="au-face">${u.name.slice(0, 1).toUpperCase()}</span>
            <span class="au-info">
              <b>${u.name.replace(/[&<>"]/g, '')}</b>
              <em>${u.role === 'admin' ? 'ผู้ดูแล' : 'ผู้เล่น'}${u.pass ? ' · มีรหัส' : ''}</em>
            </span>
          </button>`).join('')}
      </div>
      <div class="auth-form" id="auPassBox" hidden>
        <label for="auPass2">รหัสผ่านของ <b id="auWho"></b></label>
        <input type="password" id="auPass2" placeholder="กรอกรหัสผ่าน" autocomplete="current-password">
        <button id="auGo" class="primary big">เข้าสู่ระบบ</button>
      </div>
      <button id="auNew" class="nav">สมัครผู้เล่นใหม่</button>`;

    const d = showDom(`
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-logo"><span class="ball"></span></div>
          <h2 class="big-title">Poke Defense</h2>
          <p class="lead">${first ? 'ยินดีต้อนรับ — ตั้งชื่อผู้เล่นเพื่อเริ่ม'
                                  : 'เลือกผู้เล่นเพื่อเข้าเกม'}</p>
          ${body}
          <p class="auth-warn">เซฟเก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น
            รหัสผ่านใช้กันคนในบ้านสลับเซฟกัน ไม่ใช่ระบบความปลอดภัยจริง</p>
        </div>
      </div>`);

    const doLogin = async (id, pass) => {
      try {
        await PTD.auth.login(id, pass);
        app.afterLogin();
      } catch (e) { toast(e.message); }
    };

    const cr = $('auCreate');
    if (cr) cr.onclick = async () => {
      try {
        const u = await PTD.auth.register($('auName').value, $('auPass').value);
        await PTD.auth.login(u.id, $('auPass').value);
        app.afterLogin();
      } catch (e) { toast(e.message); }
    };
    const nb = $('auNew');
    if (nb) nb.onclick = () => { loginMode = 'new'; showLogin(); };
    const bk = $('auBack');
    if (bk) bk.onclick = () => { loginMode = 'pick'; showLogin(); };

    let picked = null;
    d.querySelectorAll('[data-uid]').forEach(b => b.addEventListener('click', () => {
      const u = PTD.auth.byId(b.dataset.uid);
      if (!u.pass) { doLogin(u.id, ''); return; }
      picked = u.id;
      d.querySelectorAll('.auth-user').forEach(x => x.classList.toggle('on', x === b));
      $('auPassBox').hidden = false;
      $('auWho').textContent = u.name;
      $('auPass2').focus();
    }));
    const go = $('auGo');
    if (go) go.onclick = () => doLogin(picked, $('auPass2').value);
    const pw = $('auPass2');
    if (pw) pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(picked, pw.value); });
    const pw1 = $('auPass');
    if (pw1) pw1.addEventListener('keydown', (e) => { if (e.key === 'Enter') cr.click(); });
  }

  function showStarter() {
    const picks = [1, 4, 7, 25];
    const d = showDom(`
      <div class="wide">
        <h1 class="big-title">เริ่มการผจญภัย</h1>
        <p class="lead">เลือกโปเกม่อนตัวแรกของคุณ — ที่เหลืออีก 150 ตัวต้องออกไปจับเอง</p>
        <div class="starter-row">${picks.map(id => {
          const t = PTD.tower(id);
          return `<button class="starter-card" data-id="${id}" data-tip-mon="${id}">
            ${sprite(id, 'huge')}
            <div class="sc-name">${t.name}</div>
            <div class="sc-jp">${dexNo(id)} · ${t.jp}</div>
            <div class="sc-types">${t.types.map(badge).join('')}</div>
            <div class="sc-note">${t.desc}</div>
          </button>`;
        }).join('')}</div>
      </div>`);
    bindTips(d);
    d.querySelectorAll('.starter-card').forEach(b => b.addEventListener('click', () => {
      const id = Number(b.dataset.id);
      PTD.save.addMon(id, 5);
      PTD.save.data.started = true;
      PTD.save.persist();
      PTD.sfx.evolve();
      app.go('world');
    }));
  }

  /* ---------------- แผนที่โลก ---------------- */
  function showWorld() {
    const C = PTD.campaign, s = PTD.save;

    const stages = C.STAGES.map(st => {
      const open = C.stageUnlocked(st), done = s.isCleared(st.id);
      return `<button class="loc ${open ? '' : 'locked'} ${done ? 'done' : ''}"
                data-stage="${st.id}" ${open ? '' : 'disabled'}>
        <div class="loc-no">ด่าน ${st.no}</div>
        <div class="loc-name">${st.name}${done ? ' ✓' : ''}</div>
        <div class="loc-desc">${open ? st.desc : 'ต้องผ่านด่านก่อนหน้าก่อน'}</div>
        <div class="loc-meta">${st.waves} เวฟ · ${st.lives} หัวใจ · แผนที่${PTD.MAP_LAYOUTS[st.map].name}</div>
        ${open ? `<div class="loc-reward">รางวัล ₽${fmt(st.reward.money)} · บอล ${st.reward.balls}${
          st.reward.stone ? ` · หิน ${PTD.megasOf(st.reward.stone)[0].stone}` : ''}</div>` : ''}
      </button>`;
    }).join('');

    const zones = PTD.safari.unlockedZones().map(({ zone, unlocked }) => {
      // นับเฉพาะตัวที่เจอได้จริงในโซน ไม่ใช่ทุกตัวที่ถิ่นอาศัยตรงกัน
      const pool = PTD.safari.reachableIn(zone);
      const caught = pool.filter(id => s.data.caught.includes(id)).length;
      return `<button class="loc zone ${unlocked ? '' : 'locked'}"
                data-zone="${zone.id}" ${unlocked ? '' : 'disabled'}>
        <div class="loc-name">${zone.name}</div>
        <div class="loc-desc">${unlocked ? `เจอได้ ${pool.length} สายพันธุ์ · เลเวล ${zone.lv[0]}–${zone.lv[1]}`
                                         : `ต้องผ่านด่านที่ ${zone.need} ก่อน`}</div>
        ${unlocked ? `<div class="loc-meta">จับแล้ว ${caught}/${pool.length}</div>
          <div class="zone-strip">${pool.slice(0, 8).map(id => {
            const got = s.data.caught.includes(id);
            return `<span class="zs ${got ? 'got' : ''}">
              <img class="psprite tiny ${got ? '' : 'unknown'}"
                   src="${PTD.sprites.stillURL(id)}" alt="">
              ${got ? '<span class="pokeball zs-ball"></span>' : ''}</span>`;
          }).join('')}</div>` : ''}
      </button>`;
    }).join('');

    const quests = C.QUESTS.map(q => {
      const open = C.questUnlocked(q);
      const done = s.questState(q.species) === 'done';
      const p = C.questProgress(q);
      return `<button class="loc quest ${open ? '' : 'locked'} ${done ? 'done' : ''}"
                data-quest="${q.id}" ${open && !done ? '' : 'disabled'}>
        <div class="q-head">${sprite(q.species, done ? '' : 'unknown')}
          <div>
            <div class="loc-name">${done ? PTD.dex(q.species).n : '???'}${done ? ' ✓' : ''}</div>
            <div class="loc-no">${q.name}</div>
          </div></div>
        <div class="loc-desc">${done ? 'จับได้แล้ว' : q.desc}</div>
        ${done ? '' : `<div class="q-need">
          <span class="${p.stages[0] >= p.stages[1] ? 'ok' : ''}">ผ่านด่าน ${p.stages[0]}/${p.stages[1]}</span>
          <span class="${p.caught[0] >= p.caught[1] ? 'ok' : ''}">จับได้ ${p.caught[0]}/${p.caught[1]} สายพันธุ์</span>
        </div>`}
      </button>`;
    }).join('');

    const party = s.partyMons();
    const d = showDom(`
      <div class="wide">
        <div class="world-top">
          <div>
            <h1 class="big-title">แผนที่โลก</h1>
            <p class="lead">ออกไปจับโปเกม่อน จัดทีม 6 ตัว แล้วลงด่านป้องกัน</p>
          </div>
          <div class="party-mini">
            <div class="pm-head">
              <span class="pm-label">ทีมตอนนี้ (${party.length}/6)</span>
              <button class="nav sm" data-go="party">จัดทีม</button>
            </div>
            <div class="pm-row">${party.length ? party.map(m =>
              `<div class="pm-slot" data-tip-mon="${m.id}">${sprite(m.id)}<span>Lv${m.lv}</span></div>`).join('')
              : '<div class="pm-empty">ยังไม่มีใครในทีม</div>'}</div>
          </div>
        </div>

        <h2 class="sec">ด่านแคมเปญ</h2>
        <div class="loc-grid">${stages}</div>

        <h2 class="sec">โซนซาฟารี — ออกไปจับโปเกม่อน</h2>
        <div class="loc-grid">${zones}</div>

        <h2 class="sec">เควสโปเกม่อนในตำนาน</h2>
        <div class="loc-grid quests">${quests}</div>

        <h2 class="sec">ร้านค้า</h2>
        <div class="shop-row">
          <button class="shopitem" data-buy="balls">
            <div class="si-icon">${ball('lg')}</div>
            <div class="si-name">ลูกบอลซาฟารี ×10</div>
            <div class="si-desc">ไว้จับโปเกม่อนในโซนซาฟารี</div>
            <div class="si-price">₽${fmt(PTD.save.PRICES.balls)}</div>
          </button>
          <button class="shopitem" data-buy="candy">
            <div class="si-icon">🍬</div>
            <div class="si-name">ลูกอมพิเศษ</div>
            <div class="si-desc">เพิ่มเลเวลถาวรให้ตัวที่เลือก</div>
            <div class="si-price">ราคาตามเลเวล</div>
          </button>
          <button class="shopitem" data-buy="stone" ${PTD.save.stoneOptions().length ? '' : 'disabled'}>
            <div class="si-icon">⚡</div>
            <div class="si-name">หินเมก้า</div>
            <div class="si-desc">${PTD.save.stoneOptions().length
              ? 'ปลดล็อกเมก้าอีโวลูชันให้สายพันธุ์ที่มีอยู่'
              : 'ยังไม่มีตัวที่เมก้าได้ในกล่อง'}</div>
            <div class="si-price">₽${fmt(PTD.save.PRICES.stone)}</div>
          </button>
        </div>
      </div>`);

    bindTips(d);
    d.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => app.go(b.dataset.go)));
    d.querySelectorAll('[data-stage]').forEach(b =>
      b.addEventListener('click', () => app.startStage(b.dataset.stage)));
    d.querySelectorAll('[data-zone]').forEach(b =>
      b.addEventListener('click', () => app.go('safari', b.dataset.zone)));
    d.querySelectorAll('[data-quest]').forEach(b =>
      b.addEventListener('click', () => app.startQuest(b.dataset.quest)));
    d.querySelectorAll('[data-buy]').forEach(b =>
      b.addEventListener('click', () => shopBuy(b.dataset.buy)));
  }

  /* ---------------- ร้านค้า ---------------- */
  function shopBuy(kind) {
    const s = PTD.save;
    if (kind === 'balls') {
      if (!s.buyBalls()) { toast('เงินไม่พอ'); PTD.sfx.deny(); return; }
      PTD.sfx.place();
      toast('ได้ลูกบอลมา 10 ลูก');
      showWorld(); syncHud();
      return;
    }
    if (kind === 'candy') {
      const mons = s.data.box.filter(m => m.lv < PTD.MAX_LEVEL)
        .sort((a, b) => (s.data.party.includes(b.uid) - s.data.party.includes(a.uid)) || b.lv - a.lv);
      if (!mons.length) { toast('ทุกตัวเลเวลสูงสุดแล้ว'); return; }
      pickerModal('เลือกตัวที่จะป้อนลูกอม', mons.map(m => ({
        id: m.id, uid: m.uid,
        label: `${PTD.tower(m.id).name} Lv.${m.lv} → ${m.lv + 1}`,
        price: s.candyPrice(m.uid),
        can: s.money >= s.candyPrice(m.uid),
        tag: s.data.party.includes(m.uid) ? 'อยู่ในทีม' : ''
      })), (opt) => {
        if (!s.buyCandyFor(opt.uid)) { toast('เงินไม่พอ'); PTD.sfx.deny(); return false; }
        PTD.sfx.levelUp();
        toast(`${PTD.tower(opt.id).name} ขึ้นเป็น Lv.${s.mon(opt.uid).lv}`);
        return true;
      });
      return;
    }
    if (kind === 'stone') {
      const opts = s.stoneOptions();
      if (!opts.length) { toast('ยังไม่มีตัวที่เมก้าได้ในกล่อง'); return; }
      pickerModal('เลือกหินเมก้าที่จะซื้อ', opts.map(id => {
        const m = PTD.megasOf(id)[0];
        return { id, label: m.stone, sub: PTD.megasOf(id).map(x => x.n).join(' / '),
                 price: s.PRICES.stone, can: s.money >= s.PRICES.stone, tag: '' };
      }), (opt) => {
        if (!s.buyStone(opt.id)) { toast('เงินไม่พอ'); PTD.sfx.deny(); return false; }
        PTD.sfx.evolve();
        toast('ได้หิน ' + opt.label + ' แล้ว');
        return true;
      });
    }
  }

  function pickerModal(title, options, onPick) {
    const m = $('modal');
    m.hidden = false;
    hideTip();
    m.innerHTML = `
      <div class="enc-box picker">
        <h3 class="pick-title">${title}</h3>
        <div class="pick-list">${options.map((o, i) => `
          <button class="pick" data-i="${i}" ${o.can ? '' : 'disabled'}>
            ${sprite(o.id, 'big')}
            <div class="pick-info">
              <div class="pick-label">${o.label}</div>
              ${o.sub ? `<div class="pick-sub">${o.sub}</div>` : ''}
              ${o.tag ? `<div class="pick-tag">${o.tag}</div>` : ''}
            </div>
            <div class="pick-price">₽${fmt(o.price)}</div>
          </button>`).join('')}</div>
        <button class="ghost" id="pickClose">ปิด</button>
      </div>`;
    m.querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => {
      const ok = onPick(options[Number(b.dataset.i)]);
      if (ok) { closeModal(); showWorld(); syncHud(); }
    }));
    $('pickClose').onclick = closeModal;
  }

  /* ---------------- จัดทีม ---------------- */
  function showParty() {
    const s = PTD.save;
    const box = s.data.box;
    const inParty = (uid) => s.data.party.includes(uid);

    const card = (m) => {
      const t = PTD.tower(m.id);
      const mega = PTD.hasMega(m.id);
      const stone = mega && s.hasStone(m.id);
      return `<button class="mon ${inParty(m.uid) ? 'in' : ''}" data-uid="${m.uid}" data-tip-mon="${m.id}">
        ${sprite(m.id)}
        <div class="mon-name">${t.name}</div>
        <div class="mon-lv">Lv.${m.lv}</div>
        <div class="mon-types">${t.types.map(badge).join('')}</div>
        ${stone ? '<div class="mon-mega">⚡ เมก้าพร้อม</div>'
                : (mega ? '<div class="mon-mega dim">เมก้าได้ ถ้ามีหิน</div>' : '')}
        ${inParty(m.uid) ? '<div class="mon-in">อยู่ในทีม</div>' : ''}
      </button>`;
    };

    const party = s.partyMons();
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const m = party[i];
      slots.push(m
        ? `<div class="slot filled" data-tip-mon="${m.id}">${sprite(m.id)}
             <div class="slot-name">${PTD.tower(m.id).name}</div>
             <div class="slot-lv">Lv.${m.lv}</div>
             <button class="slot-x" data-drop="${m.uid}">✕</button></div>`
        : `<div class="slot"><span>ว่าง</span></div>`);
    }

    const d = showDom(`
      <div class="wide">
        <h1 class="big-title">จัดทีม</h1>
        <p class="lead">พกลงด่านได้สูงสุด <b>6 ตัว</b> เหมือนกฎจริงของโปเกม่อน —
          คลิกตัวในกล่องเพื่อเพิ่ม/เอาออก</p>
        <div class="slots">${slots.join('')}</div>
        <h2 class="sec">กล่องโปเกม่อน (${box.length} ตัว)</h2>
        ${box.length ? `<div class="mon-grid">${box.slice().sort((a, b) =>
            (inParty(b.uid) - inParty(a.uid)) || b.lv - a.lv || a.id - b.id).map(card).join('')}</div>`
          : '<p class="empty">ยังไม่มีโปเกม่อนในกล่อง — ไปโซนซาฟารีเพื่อจับมาก่อน</p>'}
      </div>`);

    bindTips(d);
    d.querySelectorAll('[data-uid]').forEach(b => b.addEventListener('click', () => {
      const r = s.toggleParty(Number(b.dataset.uid));
      if (r === 'full') { toast('ทีมเต็มแล้ว (6 ตัว) — เอาตัวอื่นออกก่อน'); return; }
      PTD.sfx.place();
      showParty(); syncHud();
    }));
    d.querySelectorAll('[data-drop]').forEach(b => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      s.toggleParty(Number(b.dataset.drop));
      PTD.sfx.sell();
      showParty(); syncHud();
    }));
  }

  /* ---------------- โปเกเด็กซ์ ---------------- */
  function showDex() {
    const s = PTD.save;
    const cells = PTD.DEX.map(d => {
      const caught = s.data.caught.includes(d.id);
      const seen = caught || s.data.seen.includes(d.id);
      return `<div class="dex-cell ${caught ? 'caught' : seen ? 'seen' : 'unknown'}"
                ${seen ? `data-tip-mon="${d.id}"` : ''}>
        ${caughtMark(d.id)}
        ${sprite(d.id, seen ? '' : 'unknown')}
        <div class="dex-no">${dexNo(d.id)}</div>
        <div class="dex-name">${seen ? d.n : '???'}</div>
      </div>`;
    }).join('');
    const d = showDom(`
      <div class="wide">
        <h1 class="big-title">โปเกเด็กซ์</h1>
        <p class="lead">เจอแล้ว <b>${s.dexSeen}</b> · จับได้ <b>${s.dexCaught}</b> จาก ${PTD.DEX.length} ตัว</p>
        <div class="dex-grid">${cells}</div>
      </div>`);
    bindTips(d);
  }

  /* ---------------- แถบข้างตอนอยู่ในซาฟารี ---------------- */
  function buildSafariSide() {
    const S = PTD.safari.state;
    const zone = S.zone;
    const pool = PTD.safari.reachableIn(zone);
    const s = PTD.save;
    $('side').innerHTML = `
      <div class="panel">
        <h3 class="side-h">${zone.name}</h3>
        <p class="side-note">${TOUCH
          ? 'แตะช่องที่อยากไป ตัวละครจะเดินไปเอง — เดินบนหญ้าสูงเพื่อหาโปเกม่อน'
          : 'เดินบนหญ้าสูงเพื่อหาโปเกม่อน ใช้ลูกศร/WASD หรือคลิกช่องที่อยากไป'}</p>
        <div class="kv"><span>ลูกบอลที่เหลือ</span><b id="ballsLeft">${s.balls}</b></div>
        <div class="kv"><span>เลเวลที่เจอได้</span><b>${zone.lv[0]}–${zone.lv[1]}</b></div>
        <div class="kv"><span>จับครบแล้ว</span><b>${pool.filter(i => s.data.caught.includes(i)).length}/${pool.length}</b></div>
      </div>
      <div class="panel">
        <h3 class="side-h">พบได้ในโซนนี้ <small>${pool.length} สายพันธุ์</small></h3>
        ${(() => {
          const all = PTD.safari.poolOf(zone).length;
          return all > pool.length
            ? `<p class="side-note">อีก ${all - pool.length} สายพันธุ์ในถิ่นนี้เป็นร่างวิวัฒนาการ
                 — ไม่โผล่จากหญ้า ต้องจับร่างแรกไปเลี้ยงเอง</p>` : '';
        })()}
        <div class="zone-list">${pool.map(id =>
          `<div class="zl ${s.data.caught.includes(id) ? 'got' : ''}" data-tip-mon="${id}">
            <img class="psprite tiny ${s.data.caught.includes(id) ? '' : 'unknown'}"
                 src="${PTD.sprites.stillURL(id)}" alt="">
            <span>${s.data.seen.includes(id) ? PTD.dex(id).n : '???'}</span>
            ${s.data.caught.includes(id) ? ball('sm') : ''}
          </div>`).join('')}</div>
      </div>`;
    bindTips($('side'));
  }

  /* ---------------- มินิเกมจับ ---------------- */
  let encLog = [];
  function showEncounter(enc) {
    hideTip();
    encLog = [];
    renderEncounter(enc, `โปเกม่อนป่าโผล่ออกมา!`);
  }

  function renderEncounter(enc, text) {
    if (text) { encLog.unshift(text); encLog = encLog.slice(0, 3); }
    const d = PTD.dex(enc.id);
    const t = PTD.tower(enc.id);
    const chance = Math.round(PTD.safari.catchChance(enc) * 100);
    const flee = Math.round(PTD.safari.fleeChance(enc) * 100);
    const balls = PTD.save.balls;
    const mood = enc.angry ? `โกรธ ×${enc.angry}` : enc.eating ? `กำลังกิน ×${enc.eating}` : 'ปกติ';

    const m = $('modal');
    m.hidden = false;
    m.innerHTML = `
      <div class="enc-box">
        <div class="enc-top">
          <img class="psprite enc-sprite" src="${PTD.sprites.stillURL(enc.id)}" alt="">
          <div>
            <div class="enc-name">${d.n} <span class="enc-lv">Lv.${enc.lv}</span></div>
            <div class="enc-no">${dexNo(d.id)} · ${d.jp}
              ${PTD.save.data.caught.includes(d.id)
                ? `${ball('sm')} <span class="enc-owned">จับได้แล้ว</span>` : ''}</div>
            <div class="enc-types">${t.types.map(badge).join('')}</div>
            <div class="enc-mood">อารมณ์: <b>${mood}</b></div>
          </div>
        </div>
        <div class="enc-odds">
          <div class="odd good"><span>โอกาสจับ</span><b>${pct(chance)}</b></div>
          <div class="odd bad"><span>โอกาสหนี</span><b>${pct(flee)}</b></div>
          <div class="odd"><span>ลูกบอล</span><b>${balls}</b></div>
        </div>
        <div class="enc-log">${encLog.map(l => `<div>${l}</div>`).join('')}</div>
        <div class="enc-acts">
          <button data-act="ball" class="throw" ${balls <= 0 ? 'disabled' : ''}>
            ${ball()} ขว้างบอล</button>
          <button data-act="bait">🍎 โยนเหยื่อ<small>หนียาก แต่จับยาก</small></button>
          <button data-act="rock">🪨 ขว้างก้อนหิน<small>จับง่าย แต่หนีง่าย</small></button>
          <button data-act="run" class="ghost">หนี</button>
        </div>
      </div>`;
    m.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const res = PTD.safari.act(b.dataset.act);
      if (!res) return;
      if (res.result === 'caught') {
        closeModal();
        PTD.safari.say(res.text);
        toast(`จับ ${PTD.dex(res.id).n} ได้แล้ว! (Lv.${res.lv})`);
        buildSafariSide(); syncHud();
      } else if (res.result === 'fled' || res.result === 'run') {
        closeModal();
        PTD.safari.say(res.text);
        syncHud();
      } else if (res.result === 'noball') {
        toast('ลูกบอลหมดแล้ว — ผ่านด่านเพื่อรับเพิ่ม');
      } else {
        renderEncounter(PTD.safari.encounter, res.text);
        syncHud();
        const bl = $('ballsLeft');
        if (bl) bl.textContent = PTD.save.balls;
      }
    }));
  }

  const modalOpen = () => !$('modal').hidden;
  function closeModal() { hideTip(); $('modal').hidden = true; $('modal').innerHTML = ''; }

  /* ---------------- แถบข้างตอนสู้ ---------------- */
  function buildBattleSide() {
    $('side').innerHTML = `<div id="rosterPanel" class="panel"></div>
      <div id="detail" class="panel" hidden></div>
      <div id="preview" class="panel"></div>
      <div class="side-foot">${TOUCH
        ? 'แตะตัวในทีมแล้วแตะบนสนามเพื่อวาง · แตะตัวที่วางแล้วเพื่อดูข้อมูล ย้ายตำแหน่ง วิวัฒนาการ หรือเมก้า'
        : `<kbd>1-6</kbd> เลือกตัวในทีม · <kbd>Esc</kbd> ยกเลิก · <kbd>Space</kbd> พัก ·
           <kbd>X</kbd> เร่ง · <kbd>E</kbd> วิวัฒนาการ · <kbd>M</kbd> เมก้า ·
           <kbd>C</kbd> ลูกอม · <kbd>V</kbd> ย้าย · <kbd>R</kbd> เก็บกลับ`}
      </div>`;
    refresh();
  }

  function renderRoster() {
    const B = PTD.battle;
    const box = $('rosterPanel');
    if (!box) return;
    box.innerHTML = `<h3 class="side-h">ทีมของคุณ <small>${
      B.roster.filter(s => s.placed).length}/${B.roster.length} ลงสนามแล้ว</small></h3>
      ${B.placing ? `<button id="btnCancelPlace" class="cancelplace">
        แตะบนสนามเพื่อวาง · ยกเลิก ✕</button>` : ''}
      <div class="roster">${B.roster.map((s, i) => {
        const t = PTD.tower(s.mon.id);
        const placed = s.placed;
        const cost = B.deployCost(s.mon);
        const poor = !placed && !B.canAfford(s.mon);
        return `<button class="rmon ${placed ? 'placed' : ''} ${poor ? 'poor' : ''} ${B.placing === s.mon.uid ? 'sel' : ''}"
                  data-uid="${s.mon.uid}" data-tip-mon="${s.mon.id}">
          <span class="hotkey">${i + 1}</span>
          ${sprite(s.mon.id)}
          <div class="rmon-name">${t.name}</div>
          <div class="rmon-lv">Lv.${placed && s.tower ? s.tower.level : s.mon.lv}</div>
          ${placed ? '<div class="rmon-tag">ลงสนามแล้ว</div>'
                   : `<div class="rmon-cost ${poor ? 'no' : ''}">₽${cost}</div>`}
        </button>`;
      }).join('')}</div>`;
    const cp = $('btnCancelPlace');
    if (cp) cp.onclick = () => { B.placing = null; refresh(); };
    box.querySelectorAll('[data-uid]').forEach(b => b.addEventListener('click', () => {
      const uid = Number(b.dataset.uid);
      const slot = B.slotOf(uid);
      if (slot && slot.placed) { B.selected = slot.tower; B.placing = null; }
      else { B.placing = B.placing === uid ? null : uid; B.selected = null; }
      refresh();
    }));
    bindTips(box);
  }

  function buildDetail(t) {
    const B = PTD.battle;
    const d = $('detail');
    const def = t.def;
    const st = def.stats;
    const modes = [['first', 'หน้าสุด'], ['last', 'ท้ายสุด'], ['strong', 'เลือดเยอะสุด'], ['close', 'ใกล้สุด']];
    const ef = effText(def.effect);

    d.innerHTML = `
      <div class="dt-head">
        <div class="dt-icon">${sprite(def.dexId, 'big')}</div>
        <div class="dt-id">
          <div class="dt-name">${def.name} <span class="dt-lv">Lv.${t.level}</span></div>
          <div class="dt-th">${def.isMega ? 'ร่างเมก้า' : dexNo(def.dexId) + ' · ' + def.jp}</div>
          <div class="dt-types">${def.types.map(badge).join('')}</div>
        </div>
        <button class="dt-close" title="ปิด (Esc)">✕</button>
      </div>
      <div class="expbar"><div class="expfill" id="expfill"></div><span id="exptext"></span></div>
      <div class="dt-move">${def.move}
        <span class="mt" style="color:${PTD.TYPE_COLOR[def.moveType]}">(${PTD.TYPE_TH[def.moveType]})</span></div>
      <div class="dt-desc">${def.desc}${ef ? ' · ' + ef : ''}</div>
      <div class="dt-stats">
        <div><span>โจมตี</span><b>${fmt(t.dmg)}</b></div>
        <div><span>ระยะ</span><b>${fmt(t.range)}</b></div>
        <div><span>ความเร็ว</span><b>${t.rate.toFixed(2)}/วิ</b></div>
        <div><span>DPS</span><b>${fmt(t.dps)}</b></div>
        <div><span>สังหาร</span><b>${t.kills}</b></div>
        <div><span>ดาเมจรวม</span><b>${fmt(t.damageDealt)}</b></div>
      </div>
      <div class="dt-base">HP ${st[0]} · Atk ${st[1]} · Def ${st[2]} · SpA ${st[3]} · SpD ${st[4]} · Spe ${st[5]}</div>
      <div class="dt-label">เป้าหมาย</div>
      <div class="dt-modes">${modes.map(([m, l]) =>
        `<button class="mode ${t.targetMode === m ? 'on' : ''}" data-mode="${m}">${l}</button>`).join('')}</div>
      <div class="dt-eff" id="dtEff"></div>
      <div class="dt-actions" id="dtActions"></div>`;

    d.querySelector('.dt-close').onclick = () => { B.selected = null; refresh(); };
    d.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
      t.targetMode = b.dataset.mode; refresh();
    }));

    const acts = $('dtActions');

    /* เมก้า */
    const megas = B.megaOptions(t);
    if (megas.length && !t.megaActive) {
      const hasStone = PTD.save.hasStone(t.def.dexId);
      for (const m of megas) {
        const b = document.createElement('button');
        b.className = 'big mega' + ((!hasStone || B.megaUsed) ? ' locked' : '');
        b.innerHTML = hasStone
          ? (B.megaUsed
              ? `ใช้เมก้าไปแล้วในด่านนี้<small>ได้ครั้งเดียวต่อด่าน</small>`
              : `<img class="psprite mini" src="${PTD.sprites.stillURL(m.form)}" alt="">` +
                `⚡ ${m.n}<small>BST ${m.bst} · ${m.t.map(x => PTD.TYPE_TH[x]).join('/')}${
                  megas.length === 1 ? ' · กด M' : ''}</small>`)
          : `🔒 ${m.n}<small>ต้องมีหิน ${m.stone}</small>`;
        b.disabled = !hasStone || B.megaUsed;
        b.onclick = () => B.doMega(m.form);
        acts.appendChild(b);
      }
    } else if (t.megaActive) {
      const b = document.createElement('button');
      b.className = 'big mega on';
      b.innerHTML = 'อยู่ในร่างเมก้า<small>จบด่านจะกลับร่างเดิม</small>';
      b.disabled = true;
      acts.appendChild(b);
    }

    /* วิวัฒนาการ */
    if (def.evolveTo.length && !t.megaActive) {
      const ready = t.level >= def.evolveLv;
      for (let i = 0; i < def.evolveTo.length; i++) {
        const nx = PTD.dex(def.evolveTo[i]);
        const b = document.createElement('button');
        b.className = 'big evolve' + (ready ? '' : ' locked');
        b.innerHTML = ready
          ? `<img class="psprite mini" src="${PTD.sprites.stillURL(nx.id)}" alt="">` +
            `วิวัฒนาการ → ${nx.n}<small>₽${def.evolveCost}${def.evolveTo.length === 1 ? ' · กด E' : ''}</small>`
          : `ต้องถึง Lv.${def.evolveLv}<small>ตอนนี้ Lv.${t.level} · ของจริงคือ${def.evoNote}</small>`;
        b.disabled = !ready || B.money < def.evolveCost;
        b.onclick = () => B.evolveSelected(i);
        acts.appendChild(b);
        if (!ready) break;
      }
    }

    /* ลูกอม */
    const cd = document.createElement('button');
    cd.className = 'big candy'; cd.id = 'btnCandy';
    if (t.level >= PTD.MAX_LEVEL) {
      cd.innerHTML = `เลเวลสูงสุดแล้ว<small>Lv.${PTD.MAX_LEVEL}</small>`;
      cd.disabled = true; cd.classList.add('locked');
    } else {
      const c = B.candyCost(t);
      cd.innerHTML = `🍬 ลูกอมพิเศษ → Lv.${t.level + 1}<small>₽${fmt(c)} · กด C</small>`;
      cd.disabled = B.money < c;
    }
    cd.onclick = () => B.buyCandy();
    acts.appendChild(cd);

    /* ย้ายตำแหน่ง */
    const mv = document.createElement('button');
    mv.className = 'big move' + (B.movingTower === t ? ' on' : '');
    mv.innerHTML = B.movingTower === t
      ? 'กำลังย้าย — แตะช่องใหม่<small>แตะปุ่มนี้อีกครั้งเพื่อยกเลิก</small>'
      : '✥ ย้ายตำแหน่ง<small>แล้วแตะช่องที่ต้องการ · กด V</small>';
    mv.onclick = () => (B.movingTower === t ? B.cancelMove() : B.startMove(t));
    acts.appendChild(mv);

    /* เก็บกลับ */
    const rc = document.createElement('button');
    rc.className = 'big sell';
    rc.innerHTML = 'เก็บกลับเข้าทีม<small>วางใหม่ได้ฟรี · กด R</small>';
    rc.onclick = () => B.recall(t);
    acts.appendChild(rc);

    updateEff(t);
  }

  function updateEff(t) {
    const B = PTD.battle;
    const box = $('dtEff');
    if (!box) return;
    const seen = new Map();
    const src = B.enemies.length ? B.enemies.map(e => e.def) : nextWaveDefs();
    for (const def of src) if (!seen.has(def.dexId)) seen.set(def.dexId, def);
    if (!seen.size) { box.innerHTML = ''; return; }
    const rows = [...seen.values()].map(def => {
      const mult = PTD.effectiveness(t.def.moveType, def.types);
      return { def, mult, lab: PTD.effLabel(mult) };
    }).sort((a, b) => b.mult - a.mult).slice(0, 6);
    box.innerHTML = `<div class="dt-label">ธาตุได้เปรียบ (${B.enemies.length ? 'ในสนาม' : 'เวฟถัดไป'})</div>` +
      rows.map(r => `<div class="effrow ${r.lab.cls}">
        ${sprite(r.def.dexId, 'tiny')}
        <span>${r.def.name}</span>
        <em>${r.def.types.map(x => PTD.TYPE_TH[x]).join('/')}</em>
        <b>${r.mult}x</b></div>`).join('');
  }

  function nextWaveDefs() {
    const B = PTD.battle;
    const w = B.waves[Math.min(B.waveIndex, B.waves.length - 1)];
    return w ? w.groups.map(g => PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX })) : [];
  }

  function buildPreview() {
    const B = PTD.battle;
    const box = $('preview');
    if (!box) return;
    const modTag = (w) => w && w.modInfo
      ? `<div class="pv-mod" style="--mc:${w.modInfo.color}">
           <b>${w.modInfo.icon} ${w.modInfo.name}</b><span>${w.modInfo.th}</span></div>`
      : '';
    if (B.state === 'wave') {
      const idle = B.idleCount();
      box.innerHTML = `<div class="pv-head">กำลังสู้ — เวฟ ${B.waveIndex + 1}</div>
        ${modTag(B.waves[B.waveIndex])}
        <div class="pv-left">เหลือศัตรู <b>${B.spawnQueue.length + B.enemies.length}</b> ตัว</div>
        ${idle ? `<div class="pv-idle">⚠ มี <b>${idle}</b> ตัวยิงไม่โดนใครเลย
          — ลองย้ายไปแท่นที่ติดทางเดินกว่านี้</div>` : ''}`;
      return;
    }
    if (B.waveIndex >= B.waves.length) { box.innerHTML = ''; return; }
    const w = B.waves[B.waveIndex];
    box.innerHTML = `<div class="pv-head">เวฟถัดไป: ${B.waveIndex + 1}/${B.waves.length}</div>` +
      modTag(w) +
      w.groups.map(g => {
        const def = PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX });
        return `<div class="pv-row${g.boss ? ' boss' : ''}" data-tip-mon="${g.id}">
          ${sprite(g.id, 'tiny')}
          <span class="pv-name">${def.name}${g.boss ? ' 👑' : ''}${
            PTD.save.data.caught.includes(g.id) ? ' ' + ball('sm') : ''}</span>
          <span class="pv-types">${def.types.map(t =>
            `<i class="tdot" style="background:${PTD.TYPE_COLOR[t]}" title="${PTD.TYPE_TH[t]}"></i>`).join('')}</span>
          <b>x${g.count}</b></div>`;
      }).join('');
    bindTips(box);
  }

  function refresh() {
    if (app.screen !== 'battle') return;
    const B = PTD.battle;
    renderRoster();
    const detail = $('detail');
    if (B.selected && B.towers.includes(B.selected)) {
      detail.hidden = false;
      buildDetail(B.selected);
    } else { B.selected = null; detail.hidden = true; }
    buildPreview();

    const b = $('btnWave');
    if (b) {
      if (B.state === 'wave') { b.disabled = true; b.textContent = 'กำลังสู้…'; }
      else if (B.state === 'won' || B.state === 'lost') { b.disabled = true; b.textContent = 'จบด่าน'; }
      else { b.disabled = false; b.textContent = B.state === 'break' ? 'เรียกเวฟถัดไป' : 'เริ่มเวฟ 1 ▶'; }
    }
    const sp = $('btnSpeed'); if (sp) sp.textContent = B.speed + 'x';
  }

  let lastMoney = -1, lastLives = -1, lastWave = -1, lastState = '', lastEffAt = 0, lastPlaced = -1;
  function tick() {
    const B = PTD.battle;
    if (B.money !== lastMoney) {
      lastMoney = B.money;
      const el = $('money'); if (el) el.textContent = fmt(B.money);
      if (!$('detail').hidden && B.selected) {
        const t = B.selected, cd = $('btnCandy');
        if (cd && t.level < PTD.MAX_LEVEL) cd.disabled = B.money < B.candyCost(t);
        for (const x of $('dtActions').querySelectorAll('.evolve'))
          if (!x.classList.contains('locked')) x.disabled = B.money < t.def.evolveCost;
      }
    }
    if (B.lives !== lastLives) {
      lastLives = B.lives;
      const el = $('lives');
      if (el) { el.textContent = B.lives; el.classList.toggle('danger', B.lives <= 5); }
    }
    if (B.waveIndex !== lastWave) {
      lastWave = B.waveIndex;
      const el = $('wave');
      if (el) el.textContent = Math.min(B.waveIndex + 1, B.waves.length) + '/' + B.waves.length;
    }
    if (B.state !== lastState) { lastState = B.state; buildPreview(); refresh(); }
    const placed = B.towers.length;
    if (placed !== lastPlaced) { lastPlaced = placed; renderRoster(); }

    const bw = $('btnWave');
    if (bw && B.state === 'break') {
      bw.textContent = `เรียกเวฟ ${B.waveIndex + 1} (+₽${Math.ceil(B.breakLeft * 6)}) · ${B.breakLeft.toFixed(1)}วิ`;
    }
    if (B.state === 'wave') {
      const el = $('preview').querySelector('.pv-left');
      if (el) el.innerHTML = `เหลือศัตรู <b>${B.spawnQueue.length + B.enemies.length}</b> ตัว`;
    }
    if (B.selected) {
      const t = B.selected, f = $('expfill'), tx = $('exptext');
      if (f) {
        f.style.width = (Math.min(1, t.exp / t.expNext) * 100).toFixed(1) + '%';
        tx.textContent = t.level >= PTD.MAX_LEVEL ? 'MAX' : `EXP ${Math.floor(t.exp)}/${t.expNext}`;
      }
      if (B.time - lastEffAt > .8) { lastEffAt = B.time; updateEff(t); }
    }
  }

  /* ---------------- จอจบด่าน ---------------- */
  function showEnd(result) {
    const B = PTD.battle;
    const o = $('endscreen');
    o.hidden = false;
    o.className = result.won ? 'win' : 'lose';
    const title = result.won
      ? (result.mode === 'quest' ? '✨ จับได้แล้ว!' : '🏆 ผ่านด่าน!')
      : (result.mode === 'quest' ? '💨 มันหนีไปแล้ว' : '💀 ป้อมแตก!');
    const sub = result.won
      ? (result.mode === 'quest'
          ? `${PTD.dex(result.caught).n} เข้าร่วมทีมของคุณแล้ว (Lv.40)`
          : `${B.stage.name} — เคลียร์ครบ ${B.waves.length} เวฟ`)
      : (result.mode === 'quest'
          ? `กดเลือดได้ต่ำสุด ${Math.round(B.questBest * 100)}% — ต้องต่ำกว่า ${Math.round(B.quest.threshold * 100)}%`
          : `ไปได้ถึงเวฟ ${B.waveIndex + 1} จาก ${B.waves.length}`);

    o.innerHTML = `
      <div class="end-box">
        <h2>${title}</h2>
        <p>${sub}</p>
        ${result.caught ? `<div class="end-catch">${sprite(result.caught, 'huge')}</div>` : ''}
        <div class="end-stats">
          <div><span>ศัตรูที่ปราบ</span><b>${fmt(B.stats.kills)}</b></div>
          <div><span>ดาเมจรวม</span><b>${fmt(B.stats.damage)}</b></div>
          <div><span>เงินที่ได้รับ</span><b>₽${fmt(result.money)}</b></div>
          <div><span>ลูกบอลที่ได้</span><b>${result.balls}</b></div>
          <div><span>หลุดเข้าฐาน</span><b>${B.stats.leaked}</b></div>
          <div><span>หัวใจที่เหลือ</span><b>${B.lives}</b></div>
        </div>
        ${result.stone ? `<div class="end-stone">⚡ ได้หิน ${PTD.megasOf(result.stone)[0].stone} —
          ใช้เมก้าอีโวลูชัน ${PTD.dex(result.stone).n} ได้แล้ว</div>` : ''}
        <div class="end-team">${B.towers.map(t =>
          `<div class="et"><img class="psprite" src="${PTD.sprites.stillURL(t.def.dexId)}" alt="">
            <span>Lv.${t.level}</span></div>`).join('')}</div>
        <div class="end-acts">
          <button id="btnBackWorld" class="primary">กลับแผนที่โลก</button>
          <button id="btnRetry">เล่นด่านนี้อีกครั้ง</button>
        </div>
      </div>`;
    $('btnBackWorld').onclick = () => app.go('world');
    $('btnRetry').onclick = () => app.go('battle',
      B.mode === 'quest' ? { quest: B.quest } : { stage: B.stage });
  }

  /* ---------------- toast ---------------- */
  let toastT = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), 2600);
  }

  /* ---------------- init ---------------- */
  function init(a) {
    app = a;
    $('help').addEventListener('click', (e) => { if (e.target.id === 'help') $('help').hidden = true; });
    const close = $('helpClose');
    if (close) close.onclick = () => { $('help').hidden = true; };
  }

  PTD.ui = {
    TOUCH, infoModal, init, syncHud, showWorld, showParty, showDex, showStarter, showCanvas,
    showLogin, showDom,
    refresh, tick, showEnd, showEncounter, closeModal, modalOpen, toast,
    buildSafariSide
  };
})(window.PTD = window.PTD || {});
