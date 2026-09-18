/* =====================================================================
 * ui.js — ส่วนติดต่อผู้ใช้
 *   ร้านค้า (ค้นหา/กรองธาตุ/เรียงลำดับ) · แผงข้อมูลป้อม · HUD · จอจบเกม
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let G = null;
  let shopIds = [];          // id ที่ซื้อได้ทั้งหมด
  let visible = [];          // id ที่ผ่านตัวกรองตอนนี้
  const filter = { text: '', type: '', sort: 'cost' };

  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const dexNo = (id) => '#' + String(id).padStart(3, '0');

  function typeBadge(t) {
    const s = document.createElement('span');
    s.className = 'tbadge';
    s.style.background = PTD.TYPE_COLOR[t];
    s.textContent = PTD.TYPE_TH[t] || t;
    return s;
  }

  function spriteImg(id, px, cls) {
    const im = document.createElement('img');
    im.src = PTD.sprites.stillURL(id);
    im.alt = '';
    im.loading = 'lazy';
    im.width = im.height = px;
    im.className = cls || 'psprite';
    return im;
  }

  /* ---------------- ทูลทิป ---------------- */
  let tip = null;
  function showTip(html, ev) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); }
    tip.innerHTML = html;
    tip.style.display = 'block';
    const pad = 14;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    const rc = tip.getBoundingClientRect();
    if (x + rc.width > innerWidth - 8) x = ev.clientX - rc.width - pad;
    if (y + rc.height > innerHeight - 8) y = Math.max(8, innerHeight - rc.height - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

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

  function towerTip(def) {
    const line = (k, v) => `<div class="tl"><span>${k}</span><b>${v}</b></div>`;
    const st = def.stats;
    const lineIds = PTD.line(def.dexId);
    const ef = effText(def.effect);
    return `
      <div class="tip-h">${def.name} <em>${dexNo(def.dexId)} · ${def.jp}</em></div>
      <div class="tip-types">${def.types.map(t =>
        `<span class="tbadge" style="background:${PTD.TYPE_COLOR[t]}">${PTD.TYPE_TH[t]}</span>`).join('')}</div>
      <div class="tip-move">${def.move}
        <span class="mt" style="color:${PTD.TYPE_COLOR[def.moveType]}">(${PTD.TYPE_TH[def.moveType]})</span>
        — ${def.desc}</div>
      ${line('พลังโจมตี', fmt(def.dmg))}
      ${line('ระยะ', fmt(def.range))}
      ${line('ความเร็ว', def.rate.toFixed(2) + '/วิ')}
      ${line('DPS โดยประมาณ', fmt(def.dmg * def.rate * (def.targets || 1)))}
      ${def.splash ? line('รัศมีระเบิด', def.splash) : ''}
      ${def.chains ? line('กระโดดต่อ', def.chains + ' ตัว') : ''}
      ${def.pierce ? line('ทะลุ', def.pierce + ' ตัว') : ''}
      ${def.targets > 1 ? line('ตีพร้อมกัน', def.targets + ' เป้า') : ''}
      ${def.ignoreArmor ? line('พิเศษ', 'ทะลุเกราะ') : ''}
      ${ef ? line('ผลข้างเคียง', ef) : ''}
      <div class="tip-base">สเตตัสจริง · HP ${st[0]} · Atk ${st[1]} · Def ${st[2]}
        · SpA ${st[3]} · SpD ${st[4]} · Spe ${st[5]} · <b>BST ${def.bst}</b></div>
      ${lineIds.length > 1 ? `<div class="tip-evo">สาย: ${lineIds.map(i => PTD.dex(i).n).join(' → ')}</div>` : ''}
    `;
  }

  /* ---------------- ร้านค้า ---------------- */
  function buildShopChrome() {
    const box = $('shopWrap');
    box.innerHTML = `
      <div class="side-h">เลือกโปเกม่อน <small id="shopCount"></small></div>
      <div class="shopbar">
        <input id="fText" type="search" placeholder="ค้นหาชื่อ / เลขโปเกเด็กซ์" autocomplete="off">
        <select id="fType"></select>
        <select id="fSort">
          <option value="cost">เรียงตามราคา</option>
          <option value="dex">เรียงตามเลขเด็กซ์</option>
          <option value="bst">เรียงตามพลังรวม</option>
          <option value="dps">เรียงตาม DPS</option>
        </select>
      </div>
      <div id="shop"></div>
      <button id="btnSlot" class="slotbtn"></button>`;

    const sel = $('fType');
    sel.innerHTML = '<option value="">ทุกธาตุ</option>' +
      Object.keys(PTD.TYPE_TH).map(t => `<option value="${t}">${PTD.TYPE_TH[t]}</option>`).join('');

    $('fText').addEventListener('input', (e) => { filter.text = e.target.value.trim().toLowerCase(); renderShop(); });
    sel.addEventListener('change', (e) => { filter.type = e.target.value; renderShop(); });
    $('fSort').addEventListener('change', (e) => { filter.sort = e.target.value; renderShop(); });
    $('btnSlot').onclick = () => G.buySlot();
  }

  function renderShop() {
    const shop = $('shop');
    let list = shopIds.filter(id => {
      const d = PTD.tower(id);
      if (filter.type && !d.types.includes(filter.type)) return false;
      if (filter.text) {
        const q = filter.text;
        if (!d.name.toLowerCase().includes(q) && !String(d.dexId).includes(q)
            && !(d.jp || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const key = {
      cost: (a, b) => PTD.tower(a).cost - PTD.tower(b).cost || a - b,
      dex:  (a, b) => a - b,
      bst:  (a, b) => PTD.tower(b).bst - PTD.tower(a).bst,
      dps:  (a, b) => PTD.tower(b).dmg * PTD.tower(b).rate - PTD.tower(a).dmg * PTD.tower(a).rate
    }[filter.sort];
    list.sort(key);
    visible = list;
    PTD.ui.visibleIds = list;

    $('shopCount').textContent = list.length + '/' + shopIds.length + ' ตัว';
    shop.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach((id, i) => {
      const def = PTD.tower(id);
      const el = document.createElement('button');
      el.className = 'card';
      el.dataset.id = id;

      const ic = document.createElement('div');
      ic.className = 'card-icon';
      ic.appendChild(spriteImg(id, 46));
      if (i < 10) {
        const k = document.createElement('span');
        k.className = 'hotkey';
        k.textContent = (i + 1) % 10;
        ic.appendChild(k);
      }
      const nm = document.createElement('div');
      nm.className = 'card-name';
      nm.textContent = def.name;
      const ty = document.createElement('div');
      ty.className = 'card-types';
      def.types.forEach(t => ty.appendChild(typeBadge(t)));
      const co = document.createElement('div');
      co.className = 'card-cost';
      co.textContent = '₽' + def.cost;

      el.append(ic, nm, ty, co);
      el.addEventListener('click', () => {
        PTD.audio.unlock();
        G.placing = (G.placing === id) ? null : id;
        G.selected = null;
        refresh();
      });
      el.addEventListener('mousemove', (ev) => showTip(towerTip(def), ev));
      el.addEventListener('mouseleave', hideTip);
      frag.appendChild(el);
    });
    shop.appendChild(frag);
    markAffordable();
  }

  function markAffordable() {
    const full = G.towers.length >= G.teamCap;
    for (const el of $('shop').children) {
      const id = Number(el.dataset.id);
      el.classList.toggle('sel', G.placing === id);
      el.classList.toggle('poor', G.money < PTD.tower(id).cost || full);
    }
  }

  function updateSlotBtn() {
    const b = $('btnSlot');
    if (!b) return;
    if (G.extraSlots >= G.EXTRA_SLOTS) {
      b.innerHTML = 'ขยายทีมเต็มที่แล้ว <small>' + G.teamCap + ' ตัว</small>';
      b.disabled = true;
    } else {
      const c = G.slotCost();
      b.innerHTML = `➕ ขยายทีมเป็น ${G.teamCap + 1} ตัว <small>₽${fmt(c)}</small>`;
      b.disabled = G.money < c;
    }
  }

  /* ---------------- แผงข้อมูลป้อมที่เลือก ---------------- */
  function buildDetail(t) {
    const d = $('detail');
    const def = t.def;
    const st = def.stats;
    const modes = [['first', 'หน้าสุด'], ['last', 'ท้ายสุด'], ['strong', 'เลือดเยอะสุด'], ['close', 'ใกล้สุด']];
    const ef = effText(def.effect);

    d.innerHTML = `
      <div class="dt-head">
        <div class="dt-icon"></div>
        <div class="dt-id">
          <div class="dt-name">${def.name} <span class="dt-lv">Lv.${t.level}</span></div>
          <div class="dt-th">${dexNo(def.dexId)} · ${def.jp}</div>
          <div class="dt-types"></div>
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

    d.querySelector('.dt-icon').appendChild(spriteImg(def.dexId, 64, 'psprite big'));
    const tw = d.querySelector('.dt-types');
    def.types.forEach(x => tw.appendChild(typeBadge(x)));
    d.querySelector('.dt-close').onclick = () => { G.selected = null; refresh(); };
    d.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
      t.targetMode = b.dataset.mode; refresh();
    }));

    /* ---- ปุ่มวิวัฒนาการ (รองรับสายที่แตกกิ่ง เช่น Eevee) ---- */
    const acts = $('dtActions');
    if (def.evolveTo.length) {
      const ready = t.level >= def.evolveLv;
      for (let i = 0; i < def.evolveTo.length; i++) {
        const nx = PTD.dex(def.evolveTo[i]);
        const b = document.createElement('button');
        b.className = 'big evolve' + (ready ? '' : ' locked');
        b.innerHTML = ready
          ? `<img class="psprite mini" src="${PTD.sprites.stillURL(nx.id)}" alt="">` +
            `วิวัฒนาการ → ${nx.n}<small>₽${def.evolveCost}${def.evolveTo.length === 1 ? ' · กด E' : ''}</small>`
          : `ต้องถึง Lv.${def.evolveLv}<small>ตอนนี้ Lv.${t.level} · ของจริงคือ${def.evoNote}</small>`;
        b.disabled = !ready || G.money < def.evolveCost;
        b.onclick = () => G.evolveSelected(i);
        acts.appendChild(b);
        if (!ready) break;      // ยังไม่ถึงเลเวล แสดงปุ่มเดียวพอ
      }
    } else {
      const b = document.createElement('button');
      b.className = 'big evolve locked';
      b.innerHTML = 'ร่างสุดท้ายแล้ว<small>วิวัฒนาการครบสาย</small>';
      b.disabled = true;
      acts.appendChild(b);
    }

    const cd = document.createElement('button');
    cd.className = 'big candy';
    cd.id = 'btnCandy';
    if (t.level >= PTD.MAX_LEVEL) { cd.innerHTML = `เลเวลสูงสุดแล้ว<small>Lv.${PTD.MAX_LEVEL}</small>`; cd.disabled = true; cd.classList.add('locked'); }
    else {
      const c = G.candyCost(t);
      cd.innerHTML = `🍬 ลูกอมพิเศษ → Lv.${t.level + 1}<small>₽${fmt(c)} · กด C</small>`;
      cd.disabled = G.money < c;
    }
    cd.onclick = () => G.buyCandy();
    acts.appendChild(cd);

    const sl = document.createElement('button');
    sl.className = 'big sell';
    sl.innerHTML = `ขาย +₽${fmt(t.sellValue)}<small>กด S</small>`;
    sl.onclick = () => G.sellSelected();
    acts.appendChild(sl);

    updateEff(t);
  }

  // ตารางว่าท่าของป้อมตัวนี้ได้เปรียบศัตรูในสนาม/เวฟถัดไปแค่ไหน
  function updateEff(t) {
    const box = $('dtEff');
    if (!box) return;
    const seen = new Map();
    const src = G.enemies.length ? G.enemies.map(e => e.def) : nextWaveDefs();
    for (const def of src) if (!seen.has(def.dexId)) seen.set(def.dexId, def);
    if (!seen.size) { box.innerHTML = ''; return; }

    const rows = [...seen.values()].map(def => {
      const mult = PTD.effectiveness(t.def.moveType, def.types);
      return { def, mult, lab: PTD.effLabel(mult) };
    }).sort((a, b) => b.mult - a.mult).slice(0, 6);

    box.innerHTML = `<div class="dt-label">ธาตุได้เปรียบ (${G.enemies.length ? 'ในสนาม' : 'เวฟถัดไป'})</div>` +
      rows.map(r => `<div class="effrow ${r.lab.cls}">
        <img class="psprite tiny" src="${PTD.sprites.stillURL(r.def.dexId)}" alt="">
        <span>${r.def.name}</span>
        <em>${r.def.types.map(x => PTD.TYPE_TH[x]).join('/')}</em>
        <b>${r.mult}x</b></div>`).join('');
  }

  function nextWaveDefs() {
    const w = PTD.WAVES[Math.min(G.waveIndex, PTD.WAVES.length - 1)];
    return w ? w.groups.map(g => PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX })) : [];
  }

  /* ---------------- ตัวอย่างเวฟถัดไป ---------------- */
  function buildPreview() {
    const box = $('preview');
    if (G.state === 'wave') {
      const left = G.spawnQueue.length + G.enemies.length;
      box.innerHTML = `<div class="pv-head">กำลังสู้ — เวฟ ${G.waveIndex + 1}</div>
        <div class="pv-left">เหลือศัตรู <b>${left}</b> ตัว</div>`;
      return;
    }
    if (G.waveIndex >= PTD.WAVES.length) { box.innerHTML = ''; return; }
    const w = PTD.WAVES[G.waveIndex];
    box.innerHTML = `<div class="pv-head">เวฟถัดไป: ${G.waveIndex + 1}/${PTD.WAVES.length}</div>` +
      w.groups.map(g => {
        const def = PTD.enemy(g.id, { boss: g.boss, bossX: g.bossX });
        return `<div class="pv-row${g.boss ? ' boss' : ''}">
          <img class="psprite tiny" src="${PTD.sprites.stillURL(g.id)}" alt="">
          <span class="pv-name">${def.name}${g.boss ? ' 👑' : ''}</span>
          <span class="pv-types">${def.types.map(t =>
            `<i class="tdot" style="background:${PTD.TYPE_COLOR[t]}" title="${PTD.TYPE_TH[t]}"></i>`).join('')}</span>
          <b>x${g.count}</b></div>`;
      }).join('');
  }

  /* ---------------- HUD ---------------- */
  function refresh() {
    const detail = $('detail'), shopWrap = $('shopWrap');
    if (G.selected && G.towers.includes(G.selected)) {
      detail.hidden = false; shopWrap.hidden = true;
      buildDetail(G.selected);
    } else {
      G.selected = null;
      detail.hidden = true; shopWrap.hidden = false;
      markAffordable();
      updateSlotBtn();
    }
    buildPreview();
    $('team').textContent = G.towers.length + '/' + G.teamCap;

    const b = $('btnWave');
    if (G.state === 'wave') { b.disabled = true; b.textContent = 'กำลังสู้…'; }
    else if (G.state === 'won' || G.state === 'lost') { b.disabled = true; b.textContent = 'จบเกม'; }
    else b.disabled = false;
    $('btnSpeed').textContent = G.speed + 'x';
    $('btnPause').textContent = G.paused ? '▶' : '⏸';
    $('btnSound').textContent = PTD.audio.enabled ? '🔊' : '🔇';
  }

  let lastMoney = -1, lastLives = -1, lastWave = -1, lastState = '', lastEffAt = 0, lastTeam = -1;
  function tick() {
    if (G.money !== lastMoney) {
      lastMoney = G.money;
      $('money').textContent = fmt(G.money);
      if (!$('detail').hidden) {
        const t = G.selected;
        const cd = $('btnCandy');
        if (cd && t && t.level < PTD.MAX_LEVEL) cd.disabled = G.money < G.candyCost(t);
        if (t && t.def.evolveTo.length && t.level >= t.def.evolveLv) {
          for (const b of $('dtActions').querySelectorAll('.evolve'))
            b.disabled = G.money < t.def.evolveCost;
        }
      } else { markAffordable(); updateSlotBtn(); }
    }
    if (G.lives !== lastLives) {
      lastLives = G.lives;
      const el = $('lives');
      el.textContent = G.lives;
      el.classList.toggle('danger', G.lives <= 5);
    }
    if (G.towers.length !== lastTeam) {
      lastTeam = G.towers.length;
      const el = $('team');
      el.textContent = lastTeam + '/' + G.teamCap;
      el.parentElement.classList.toggle('full', lastTeam >= G.teamCap);
      if ($('detail').hidden) markAffordable();
    }
    if (G.waveIndex !== lastWave) {
      lastWave = G.waveIndex;
      $('wave').textContent = Math.min(G.waveIndex + 1, PTD.WAVES.length) + '/' + PTD.WAVES.length;
    }
    if (G.state !== lastState) { lastState = G.state; buildPreview(); }

    const b = $('btnWave');
    if (G.state === 'break') {
      b.textContent = `เรียกเวฟ ${G.waveIndex + 1} เลย (+₽${Math.ceil(G.breakLeft * 6)}) · ${G.breakLeft.toFixed(1)}วิ`;
    } else if (G.state === 'ready') b.textContent = 'เริ่มเวฟ 1 ▶';

    if (G.state === 'wave') {
      const el = $('preview').querySelector('.pv-left');
      if (el) el.innerHTML = `เหลือศัตรู <b>${G.spawnQueue.length + G.enemies.length}</b> ตัว`;
    }

    if (G.selected) {
      const t = G.selected, f = $('expfill'), tx = $('exptext');
      if (f) {
        f.style.width = (Math.min(1, t.exp / t.expNext) * 100).toFixed(1) + '%';
        tx.textContent = t.level >= PTD.MAX_LEVEL ? 'MAX' : `EXP ${Math.floor(t.exp)}/${t.expNext}`;
      }
      if (G.time - lastEffAt > 0.8) { lastEffAt = G.time; updateEff(t); }
    }
  }

  /* ---------------- จอจบเกม ---------------- */
  function showEnd(won) {
    const o = $('endscreen');
    o.hidden = false;
    o.className = won ? 'win' : 'lose';
    const caught = new Set(G.towers.map(t => t.def.dexId)).size;
    o.innerHTML = `
      <div class="end-box">
        <h2>${won ? '🏆 คุณคือแชมป์เปี้ยน!' : '💀 ป้อมแตก!'}</h2>
        <p>${won ? 'ผ่านครบทั้ง ' + PTD.WAVES.length + ' เวฟ รวมถึง Mewtwo'
                 : 'ไปได้ถึงเวฟ ' + (G.waveIndex + 1) + ' จาก ' + PTD.WAVES.length}</p>
        <div class="end-stats">
          <div><span>ศัตรูที่ปราบ</span><b>${fmt(G.stats.kills)}</b></div>
          <div><span>ดาเมจรวม</span><b>${fmt(G.stats.damage)}</b></div>
          <div><span>เงินที่หาได้</span><b>₽${fmt(G.stats.earned)}</b></div>
          <div><span>หลุดเข้าฐาน</span><b>${G.stats.leaked}</b></div>
          <div><span>ทีมสุดท้าย</span><b>${caught} ตัว</b></div>
          <div><span>หัวใจที่เหลือ</span><b>${G.lives}</b></div>
        </div>
        <div class="end-team">${G.towers.map(t =>
          `<img class="psprite" src="${PTD.sprites.stillURL(t.def.dexId)}" title="${t.def.name} Lv.${t.level}" alt="">`).join('')}</div>
        <button id="btnAgain">เล่นอีกครั้ง</button>
      </div>`;
    $('btnAgain').onclick = () => G.reset();
  }
  function hideEnd() { $('endscreen').hidden = true; }

  /* ---------------- init ---------------- */
  function init(game) {
    G = game;
    shopIds = PTD.shopList();
    buildShopChrome();
    renderShop();

    $('btnWave').onclick = () => { PTD.audio.unlock(); G.startWave(); };
    $('btnSpeed').onclick = () => { G.speed = G.speed === 1 ? 2 : (G.speed === 2 ? 3 : 1); refresh(); };
    $('btnPause').onclick = () => { G.paused = !G.paused; refresh(); };
    $('btnSound').onclick = () => { PTD.audio.toggle(); refresh(); };
    $('btnRestart').onclick = () => { if (confirm('เริ่มเกมใหม่ทั้งหมด?')) G.reset(); };
    $('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
    $('help').addEventListener('click', (e) => { if (e.target.id === 'help') $('help').hidden = true; });

    // โหลดสไปรท์ของเวฟแรก ๆ ไว้ล่วงหน้า จะได้ไม่เห็นลูกบอลตอนเริ่มเล่น
    const warm = new Set();
    for (let i = 0; i < 3 && i < PTD.WAVES.length; i++)
      for (const g of PTD.WAVES[i].groups) warm.add(g.id);
    PTD.sprites.preload([...warm]);
  }

  PTD.ui = { init, refresh, tick, showEnd, hideEnd, renderShop, visibleIds: [] };
})(window.PTD = window.PTD || {});
