/* =====================================================================
 * app.js — ตัวจัดการหน้าจอและลูปกลางของเกม
 *
 * หน้าจอ: starter (เลือกตัวเริ่มต้น) · world (แผนที่โลก) · party (จัดทีม)
 *         dex (โปเกเด็กซ์) · safari (ออกไปจับ) · battle (ป้องกันฐาน)
 * แคนวาสตัวเดียวใช้ร่วมกันระหว่าง safari กับ battle
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const A = {
    screen: 'world',
    canvas: null,
    ctx: null,
    time: 0,
    lastResult: null,

    /* ---------- เปลี่ยนหน้าจอ ---------- */
    go(name, arg) {
      // ออกจากหน้าเดิม
      if (this.screen === 'safari') PTD.safari.clearKeys();

      this.screen = name;
      switch (name) {
        case 'world':   PTD.ui.showWorld(); break;
        case 'party':   PTD.ui.showParty(); break;
        case 'dex':     PTD.ui.showDex(); break;
        case 'starter': PTD.ui.showStarter(); break;
        case 'login':   PTD.ui.showLogin(); break;
        case 'admin':   PTD.admin.show(); break;
        case 'safari':
          if (!PTD.safari.enter(arg)) { this.go('world'); return; }
          PTD.ui.showCanvas('safari');
          break;
        case 'battle':
          PTD.battle.enter(arg);
          PTD.ui.showCanvas('battle');
          PTD.ui.refresh();
          break;
      }
      PTD.ui.syncHud();
    },

    /* ---------- เริ่มด่าน/เควส ---------- */
    startStage(stageId) {
      const st = PTD.campaign.stageById(stageId);
      if (!st) return;
      if (!PTD.campaign.stageUnlocked(st)) return;
      if (!PTD.save.partyMons().length) { PTD.ui.toast('ยังไม่มีโปเกม่อนในทีม — ไปจับมาก่อน'); return; }
      this.go('battle', { stage: st });
    },

    startQuest(questId) {
      const q = PTD.campaign.questById(questId);
      if (!q) return;
      if (!PTD.campaign.questUnlocked(q)) return;
      if (!PTD.save.partyMons().length) { PTD.ui.toast('ยังไม่มีโปเกม่อนในทีม — ไปจับมาก่อน'); return; }
      this.go('battle', { quest: q });
    },

    /* ---------- หลังเข้าสู่ระบบ ---------- */
    afterLogin() {
      const me = PTD.auth.current();
      if (!me) { this.go('login'); return; }
      PTD.save.useSlot(PTD.auth.saveKeyFor(me.id));
      if (!PTD.save.data.started) this.go('starter');
      else this.go('world');
    },

    logout() {
      PTD.save.persist();
      PTD.auth.logout();
      this.go('login');
    },

    /* ---------- บูต ---------- */
    boot() {
      const canvas = document.getElementById('game');
      canvas.width = PTD.map.W; canvas.height = PTD.map.H;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      // บัญชีผู้ใช้ต้องมาก่อนเซฟ เพราะเซฟแยกตามผู้ใช้
      PTD.auth.load();
      const me = PTD.auth.current();
      if (me) PTD.save.useSlot(PTD.auth.saveKeyFor(me.id));
      else PTD.save.load();

      // ค่าที่หน้า admin แก้ไว้ ต้องทาทับก่อนเกมเริ่มใช้
      PTD.config.load();
      PTD.config.apply();
      const hp = PTD.store.getSync('pokedefense.hptargets.v1');
      if (Array.isArray(hp) && hp.length) PTD.campaign.setHpTargets(hp);

      PTD.useMap('meadow');

      PTD.battle.onFinish = (result) => {
        this.lastResult = result;
        PTD.ui.showEnd(result);
      };
      PTD.safari.onEncounter = (enc) => PTD.ui.showEncounter(enc);

      PTD.ui.init(this);

      /* ---- อินพุตบนแคนวาส ---- */
      const toCanvas = (ev) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (ev.clientX - rect.left) * (canvas.width / rect.width),
          y: (ev.clientY - rect.top) * (canvas.height / rect.height)
        };
      };
      canvas.addEventListener('mousemove', (ev) => {
        if (this.screen !== 'battle') return;
        const p = toCanvas(ev);
        PTD.battle.move(p.x, p.y);
      });
      // ปุ่มทิศทางในซาฟารีต้องกดค้างได้ ใช้ pointer event ครอบคลุมทั้งเมาส์และนิ้ว
      canvas.addEventListener('pointerdown', (ev) => {
        if (this.screen !== 'safari') return;
        const p = toCanvas(ev);
        if (PTD.safari.press(p.x, p.y)) { ev.preventDefault(); canvas.setPointerCapture(ev.pointerId); }
      });
      const stopPad = () => { if (this.screen === 'safari') PTD.safari.release(); };
      canvas.addEventListener('pointerup', stopPad);
      canvas.addEventListener('pointercancel', stopPad);
      canvas.addEventListener('pointerleave', stopPad);
      canvas.addEventListener('mouseleave', () => { PTD.battle.hover = { c: -1, r: -1 }; });
      canvas.addEventListener('click', (ev) => {
        PTD.audio.unlock();
        const p = toCanvas(ev);
        if (this.screen === 'battle') PTD.battle.click(p.x, p.y);
        else if (this.screen === 'safari') PTD.safari.click(p.x, p.y);
      });
      canvas.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (this.screen === 'battle') {
          PTD.battle.placing = null; PTD.battle.selected = null; PTD.ui.refresh();
        }
      });

      /* ---- คีย์บอร์ด ---- */
      window.addEventListener('keydown', (ev) => {
        if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
        if (PTD.ui.modalOpen()) {
          if (ev.key === 'Escape') PTD.ui.closeModal();
          return;
        }
        if (this.screen === 'battle') {
          if (ev.key === ' ') ev.preventDefault();
          if (PTD.battle.key(ev.key)) return;
        } else if (this.screen === 'safari') {
          if (ev.key === 'Escape') { this.go('world'); return; }
          if (/^Arrow|^[wasdWASD]$/.test(ev.key)) ev.preventDefault();
          PTD.safari.keyDown(ev.key);
        } else if (ev.key === 'Escape' && this.screen !== 'world' && this.screen !== 'starter') {
          this.go('world');
        }
      });
      window.addEventListener('keyup', (ev) => {
        if (this.screen === 'safari') PTD.safari.keyUp(ev.key);
      });

      /* ---- หน้าจอแรก ---- */
      PTD.admin.init(this);
      // ภาพนิ่งที่แนบมากับหน้าเว็บต้องพร้อมก่อนวาดหน้าแรก ไม่งั้นรูปจะว่างหมด
      PTD.sprites.loadStills().then(() => {
        if (!PTD.auth.current()) this.go('login');
        else this.afterLogin();
      });

      /* ---- ลูปหลัก ---- */
      let last = performance.now();
      const frame = (now) => {
        let dt = Math.min((now - last) / 1000, .05);
        last = now;
        this.time += dt;

        if (this.screen === 'battle') {
          const B = PTD.battle;
          if (!B.paused && B.state !== 'won' && B.state !== 'lost') {
            for (let i = 0; i < B.speed; i++) B.update(dt);
          } else B.time += dt * .25;
          B.draw(this.ctx);
          PTD.ui.tick();
        } else if (this.screen === 'safari') {
          if (!PTD.ui.modalOpen()) PTD.safari.update(dt);
          PTD.safari.draw(this.ctx, this.time);
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  };

  PTD.app = A;
  document.addEventListener('DOMContentLoaded', () => A.boot());
})(window.PTD = window.PTD || {});
