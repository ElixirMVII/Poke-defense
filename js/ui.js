/* =====================================================================
 * ui.js — ส่วนติดต่อผู้ใช้ (ร้านค้า / แผงข้อมูล / HUD / จอจบเกม)
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let G = null;
  const cards = {};

  function typeBadge(t) {
    const s = document.createElement('span');
    s.className = 'tbadge';
    s.style.background = PTD.TYPE_COLOR[t];
    s.textContent = PTD.TYPE_TH[t] || t;
    return s;
  }

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

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
    if (y + rc.height > innerHeight - 8) y = innerHeight - rc.height - 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  function towerTipHTML(def) {
    const ef = def.effect;
    const efText = ef ? ({
      burn: `ไหม้ ${ef.dps}/วิ นาน ${ef.dur}วิ (${Math.round(ef.chance * 100)}%)`,
      poison: `พิษ ${ef.dps}/วิ นาน ${ef.dur}วิ (${Math.round(ef.chance * 100)}%)`,
      slow: `ช้าลง ${Math.round(ef.power * 100)}% นาน ${ef.dur}วิ (${Math.round(ef.chance * 100)}%)`,
      stun: `หยุดชะงัก ${ef.dur}วิ (${Math.round(ef.chance * 100)}%)`,
      slowpoison: `ช้าลง ${Math.round(ef.power * 100)}% + พิษ ${ef.dps}/วิ`
    })[ef.kind] : null;
    const line = (k, v) => `<div class="tl"><span>${k}</span><b>${v}</b></div>`;
    const evo = PTD.evoLine(def.id);
    return `
      <div class="tip-h">${def.name} <em>${def.th}</em></div>
      <div class="tip-types">${def.types.map(t =>
        `<span class="tbadge" style="background:${PTD.TYPE_COLOR[t]}">${PTD.TYPE_TH[t]}</span>`).join('')}</div>
      <div class="tip-move">ท่า: <b>${def.move}</b> <span class="mt" style="color:${PTD.TYPE_COLOR[def.moveType]}">(${PTD.TYPE_TH[def.moveType]})</span></div>
      <div class="tip-desc">${def.desc}</div>
      ${line('พลังโจมตี', fmt(def.dmg))}
      ${line('ระยะ', fmt(def.range) + ' px')}
      ${line('ความเร็ว', def.rate.toFixed(2) + ' ครั้ง/วิ')}
      ${line('DPS โดยประมาณ', fmt(def.dmg * def.rate * (def.targets || 1)))}
      ${def.splash ? line('รัศมีระเบิด', fmt(def.splash) + ' px') : ''}
      ${def.chains ? line('ฟ้าผ่าต่อเนื่อง', def.chains + ' ตัว') : ''}
      ${def.pierce ? line('ทะลุ', def.pierce + ' ตัว') : ''}
      ${def.ignoreArmor ? line('พิเศษ', 'ทะลุเกราะ') : ''}
      ${efText ? line('ผลข้างเคียง', efText) : ''}
      ${evo.length > 1 ? `<div class="tip-evo">สายวิวัฒนาการ: ${evo.map(i => PTD.TOWERS[i].name).join(' → ')}</div>` : ''}
    `;
  }

  /* ---------------- ร้านค้า ---------------- */
  function buildShop() {
    const shop = $('shop');
    shop.innerHTML = '';
    PTD.SHOP_ORDER.forEach((id, i) => {
      const def = PTD.TOWERS[id];
      const el = document.createElement('button');
      el.className = 'card';
      el.dataset.id = id;

      const icon = document.createElement('div');
      icon.className = 'card-icon';
      icon.appendChild(PTD.spriteToCanvas(def.sprite, 40));
      const key = document.createElement('span');
      key.className = 'hotkey';
      key.textContent = (i + 1) % 10;
      icon.appendChild(key);

      const info = document.createElement('div');
      info.className = 'card-info';
      const nm = document.createElement('div');
      nm.className = 'card-name';
      nm.textContent = def.name;
      const th = document.createElement('div');
      th.className = 'card-th';
      th.textContent = def.th;
      const types = document.createElement('div');
      types.className = 'card-types';
      def.types.forEach(t => types.appendChild(typeBadge(t)));
      info.append(nm, types);

      const cost = document.createElement('div');
      cost.className = 'card-cost';
      cost.textContent = '₽' + def.cost;

      el.append(icon, info, cost);
      el.addEventListener('click', () => {
        PTD.audio.unlock();
        G.placing = (G.placing === id) ? null : id;
        G.selected = null;
        refresh();
      });
      el.addEventListener('mousemove', (ev) => showTip(towerTipHTML(def), ev));
      el.addEventListener('mouseleave', hideTip);
      shop.appendChild(el);
      cards[id] = el;
    });

    const slot = document.createElement('button');
    slot.id = 'btnSlot';
    slot.className = 'slotbtn';
    slot.onclick = () => G.buySlot();
    shop.appendChild(slot);
    updateSlotBtn();
  }

  function updateSlotBtn() {
    const b = $('btnSlot');
    if (!b || !G) return;
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
    const modes = [['first', 'หน้าสุด'], ['last', 'ท้ายสุด'], ['strong', 'เลือดเยอะสุด'], ['close', 'ใกล้สุด']];

    d.innerHTML = `
      <div class="dt-head">
        <div class="dt-icon"></div>
        <div>
          <div class="dt-name">${def.name} <span class="dt-lv">Lv.${t.level}</span></div>
          <div class="dt-th">${def.th}</div>
          <div class="dt-types"></div>
        </div>
      </div>
      <div class="expbar"><div class="expfill" id="expfill"></div><span id="exptext"></span></div>
      <div class="dt-move">${def.move}
        <span class="mt" style="color:${PTD.TYPE_COLOR[def.moveType]}">(${PTD.TYPE_TH[def.moveType]})</span></div>
      <div class="dt-desc">${def.desc}</div>
      <div class="dt-stats">
        <div><span>โจมตี</span><b>${fmt(t.dmg)}</b></div>
        <div><span>ระยะ</span><b>${fmt(t.range)}</b></div>
        <div><span>ความเร็ว</span><b>${t.rate.toFixed(2)}/วิ</b></div>
        <div><span>DPS</span><b>${fmt(t.dps)}</b></div>
        <div><span>สังหาร</span><b>${t.kills}</b></div>
        <div><span>ดาเมจรวม</span><b>${fmt(t.damageDealt)}</b></div>
      </div>
      <div class="dt-label">เป้าหมาย</div>
      <div class="dt-modes">${modes.map(([m, label]) =>
        `<button class="mode ${t.targetMode === m ? 'on' : ''}" data-mode="${m}">${label}</button>`).join('')}</div>
      <div class="dt-eff" id="dtEff"></div>
      <div class="dt-actions">
        <button id="btnEvolve" class="big evolve"></button>
        <button id="btnCandy" class="big candy"></button>
        <button id="btnSell" class="big sell">ขาย +₽${t.sellValue} <kbd>S</kbd></button>
      </div>`;

    d.querySelector('.dt-icon').appendChild(PTD.spriteToCanvas(def.sprite, 64));
    const tw = d.querySelector('.dt-types');
    def.types.forEach(x => tw.appendChild(typeBadge(x)));

    d.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
      t.targetMode = b.dataset.mode; refresh();
    }));

    const ev = $('btnEvolve');
    if (def.evolveTo) {
      const next = PTD.TOWERS[def.evolveTo];
      const ready = t.level >= def.evolveLv;
      ev.innerHTML = ready
        ? `วิวัฒนาการ → ${next.name}<small>₽${def.evolveCost}</small> <kbd>E</kbd>`
        : `ต้องถึง Lv.${def.evolveLv}<small>ตอนนี้ Lv.${t.level}</small>`;
      ev.disabled = !ready || G.money < def.evolveCost;
      ev.classList.toggle('locked', !ready);
      ev.onclick = () => G.evolveSelected();
    } else {
      ev.innerHTML = 'ร่างสุดท้ายแล้ว<small>วิวัฒนาการครบ</small>';
      ev.disabled = true;
      ev.classList.add('locked');
    }
    const cd = $('btnCandy');
    if (t.level >= 20) {
      cd.innerHTML = 'เลเวลสูงสุดแล้ว<small>Lv.20</small>';
      cd.disabled = true; cd.classList.add('locked');
    } else {
      const cost = G.candyCost(t);
      cd.innerHTML = `🍬 ลูกอมพิเศษ → Lv.${t.level + 1}<small>₽${cost} <kbd>C</kbd></small>`;
      cd.disabled = G.money < cost;
    }
    cd.onclick = () => G.buyCandy();

    $('btnSell').onclick = () => G.sellSelected();

    updateEff(t);
  }

  // ตารางความได้เปรียบเทียบกับศัตรูที่อยู่บนสนามตอนนี้ / เวฟถัดไป
  function updateEff(t) {
    const box = $('dtEff');
    if (!box) return;
    const seen = new Map();
    const src = G.enemies.length ? G.enemies.map(e => e.def) : nextWaveDefs();
    for (const def of src) if (!seen.has(def.id)) seen.set(def.id, def);
    if (!seen.size) { box.innerHTML = ''; return; }

    const rows = [...seen.values()].map(def => {
      const mult = PTD.effectiveness(t.def.moveType, def.types);
      const lab = PTD.effLabel(mult);
      return { def, mult, lab };
    }).sort((a, b) => b.mult - a.mult).slice(0, 6);

    box.innerHTML = `<div class="dt-label">ธาตุได้เปรียบ (${G.enemies.length ? 'ในสนาม' : 'เวฟถัดไป'})</div>` +
      rows.map(r => `<div class="effrow ${r.lab.cls}">
        <span>${r.def.name}</span>
        <em>${r.def.types.map(x => PTD.TYPE_TH[x]).join('/')}</em>
        <b>${r.mult}x</b></div>`).join('');
  }

  function nextWaveDefs() {
    const w = PTD.WAVES[Math.min(G.waveIndex, PTD.WAVES.length - 1)];
    return w ? w.groups.map(g => PTD.ENEMIES[g.id]) : [];
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
    const items = w.groups.map(g => {
      const def = PTD.ENEMIES[g.id];
      return `<div class="pv-row" data-id="${g.id}">
          <span class="pv-name">${def.name}${def.boss ? ' 👑' : ''}</span>
          <span class="pv-types">${def.types.map(t =>
            `<i class="tdot" style="background:${PTD.TYPE_COLOR[t]}" title="${PTD.TYPE_TH[t]}"></i>`).join('')}</span>
          <b>x${g.count}</b>
        </div>`;
    }).join('');
    box.innerHTML = `<div class="pv-head">เวฟถัดไป: ${G.waveIndex + 1}/${PTD.WAVES.length}</div>${items}`;
  }

  /* ---------------- HUD ---------------- */
  function refresh() {
    // ร้านค้า: ไฮไลต์ตัวที่เลือก + เงินไม่พอ
    for (const id in cards) {
      const def = PTD.TOWERS[id];
      cards[id].classList.toggle('sel', G.placing === id);
      cards[id].classList.toggle('poor', G.money < def.cost || G.towers.length >= G.teamCap);
    }
    updateSlotBtn();
    $('team').textContent = G.towers.length + '/' + G.teamCap;
    const detail = $('detail'), shopWrap = $('shopWrap');
    if (G.selected && G.towers.includes(G.selected)) {
      detail.hidden = false; shopWrap.hidden = true;
      buildDetail(G.selected);
    } else {
      G.selected = null;
      detail.hidden = true; shopWrap.hidden = false;
    }
    buildPreview();

    const b = $('btnWave');
    if (G.state === 'wave') { b.disabled = true; b.textContent = 'กำลังสู้…'; }
    else if (G.state === 'won' || G.state === 'lost') { b.disabled = true; b.textContent = 'จบเกม'; }
    else { b.disabled = false; }
    $('btnSpeed').textContent = G.speed + 'x';
    $('btnPause').textContent = G.paused ? '▶' : '⏸';
    $('btnSound').textContent = PTD.audio.enabled ? '🔊' : '🔇';
  }

  // อัปเดตค่าที่เปลี่ยนตลอดเวลา (เรียกทุกเฟรม แต่แตะ DOM เท่าที่จำเป็น)
  let lastMoney = -1, lastLives = -1, lastWave = -1, lastState = '', lastEffAt = 0, lastTeam = -1;
  function tick() {
    if (G.money !== lastMoney) {
      lastMoney = G.money;
      $('money').textContent = fmt(G.money);
      for (const id in cards) cards[id].classList.toggle('poor',
        G.money < PTD.TOWERS[id].cost || G.towers.length >= G.teamCap);
      updateSlotBtn();
      const cd = $('btnCandy');
      if (cd && G.selected && G.selected.level < 20) cd.disabled = G.money < G.candyCost(G.selected);
      const ev = $('btnEvolve');
      if (ev && G.selected && G.selected.def.evolveTo) {
        const t = G.selected;
        ev.disabled = !(t.level >= t.def.evolveLv) || G.money < t.def.evolveCost;
      }
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
      for (const id in cards) cards[id].classList.toggle('poor',
        G.money < PTD.TOWERS[id].cost || lastTeam >= G.teamCap);
    }
    if (G.waveIndex !== lastWave) {
      lastWave = G.waveIndex;
      $('wave').textContent = Math.min(G.waveIndex + 1, PTD.WAVES.length) + '/' + PTD.WAVES.length;
    }
    if (G.state !== lastState) { lastState = G.state; buildPreview(); }

    const b = $('btnWave');
    if (G.state === 'break') {
      b.textContent = `เรียกเวฟ ${G.waveIndex + 1} เลย (+₽${Math.ceil(G.breakLeft * 6)}) · ${G.breakLeft.toFixed(1)}วิ`;
    } else if (G.state === 'ready') {
      b.textContent = 'เริ่มเวฟ 1 ▶';
    }

    if (G.state === 'wave') {
      const left = G.spawnQueue.length + G.enemies.length;
      const el = $('preview').querySelector('.pv-left');
      if (el) el.innerHTML = `เหลือศัตรู <b>${left}</b> ตัว`;
    }

    // แถบ EXP ของป้อมที่เลือก
    if (G.selected) {
      const t = G.selected;
      const f = $('expfill'), tx = $('exptext');
      if (f) {
        const k = Math.min(1, t.exp / t.expNext);
        f.style.width = (k * 100).toFixed(1) + '%';
        tx.textContent = t.level >= 20 ? 'MAX' : `EXP ${Math.floor(t.exp)}/${t.expNext}`;
      }
      if (G.time - lastEffAt > 0.8) { lastEffAt = G.time; updateEff(t); }
    }
  }

  /* ---------------- จอจบเกม ---------------- */
  function showEnd(won) {
    const o = $('endscreen');
    o.hidden = false;
    o.className = won ? 'win' : 'lose';
    o.innerHTML = `
      <div class="end-box">
        <h2>${won ? '🏆 คุณคือแชมป์เปี้ยน!' : '💀 ป้อมแตก!'}</h2>
        <p>${won ? 'ผ่านครบทั้ง ' + PTD.WAVES.length + ' เวฟ รวมถึง Mewtwo' :
                   'ไปได้ถึงเวฟ ' + (G.waveIndex + 1) + ' จาก ' + PTD.WAVES.length}</p>
        <div class="end-stats">
          <div><span>ศัตรูที่ปราบ</span><b>${fmt(G.stats.kills)}</b></div>
          <div><span>ดาเมจรวม</span><b>${fmt(G.stats.damage)}</b></div>
          <div><span>เงินที่หาได้</span><b>₽${fmt(G.stats.earned)}</b></div>
          <div><span>หลุดเข้าฐาน</span><b>${G.stats.leaked}</b></div>
          <div><span>โปเกม่อนที่วาง</span><b>${G.towers.length}</b></div>
          <div><span>หัวใจที่เหลือ</span><b>${G.lives}</b></div>
        </div>
        <button id="btnAgain">เล่นอีกครั้ง</button>
      </div>`;
    $('btnAgain').onclick = () => G.reset();
  }
  function hideEnd() { $('endscreen').hidden = true; }

  /* ---------------- init ---------------- */
  function init(game) {
    G = game;
    buildShop();

    $('btnWave').onclick = () => { PTD.audio.unlock(); G.startWave(); };
    $('btnSpeed').onclick = () => { G.speed = G.speed === 1 ? 2 : (G.speed === 2 ? 3 : 1); refresh(); };
    $('btnPause').onclick = () => { G.paused = !G.paused; refresh(); };
    $('btnSound').onclick = () => { PTD.audio.toggle(); refresh(); };
    $('btnRestart').onclick = () => { if (confirm('เริ่มเกมใหม่ทั้งหมด?')) G.reset(); };
    $('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
    $('help').addEventListener('click', (e) => { if (e.target.id === 'help') $('help').hidden = true; });
  }

  PTD.ui = { init, refresh, tick, showEnd, hideEnd };
})(window.PTD = window.PTD || {});
