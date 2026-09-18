/* =====================================================================
 * game.js — สถานะเกม, ลูปหลัก, การคิดดาเมจ และอินพุต
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const M = PTD.map;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  const START_MONEY = 500;
  const START_LIVES = 25;
  const ARMOR_K = 60;             // เกราะลดดาเมจแบบสัดส่วน: dmg * K/(K+armor)
  const MAX_TEAM = 12;            // ทีมเริ่มต้นมีได้กี่ตัว
  const EXTRA_SLOTS = 6;          // ซื้อเพิ่มได้อีกกี่ช่อง
  const SLOT_COST = (n) => Math.round(900 * Math.pow(1.7, n));
  const CANDY_COST = (lv) => Math.round(50 + 12 * Math.pow(lv, 1.7));
  const BREAK_TIME = 10;          // วินาทีพักระหว่างเวฟ
  const EARLY_BONUS_PER_SEC = 6;  // โบนัสเงินต่อวินาทีที่เหลือถ้ากดเรียกเวฟเอง

  const G = {
    /* ---------- สถานะ ---------- */
    time: 0,
    state: 'ready',      // ready | break | wave | won | lost
    speed: 1,
    paused: false,
    money: START_MONEY,
    lives: START_LIVES,
    waveIndex: 0,        // 0-based
    waveTime: 0,
    breakLeft: 0,
    spawnQueue: [],
    enemies: [],
    towers: [],
    projectiles: [],
    fx: [],
    placing: null,       // id ของโปเกม่อนที่กำลังจะวาง
    selected: null,      // ป้อมที่เลือกอยู่
    hover: { c: -1, r: -1 },
    stats: { kills: 0, damage: 0, earned: 0, leaked: 0 },
    banner: null,
    auraEnemies: [],
    terrain: null,
    canvas: null,
    ctx: null,

    /* ---------- ตัวคูณจากออร่าบอส ---------- */
    towerDmgMul(tower) {
      let m = 1;
      for (const e of this.auraEnemies) {
        if (e.def.aura !== 'drain') continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) < 170) m *= .6;
      }
      return m;
    },
    towerRateMul(tower) {
      let m = 1;
      for (const e of this.auraEnemies) {
        if (e.def.aura !== 'chill') continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) < 150) m *= .6;
      }
      return m;
    },

    /* ---------- คิดดาเมจ ---------- */
    damage(enemy, amount, moveType, tower, opts) {
      if (enemy.dead) return 0;
      opts = opts || {};
      const eff = PTD.effectiveness(moveType, enemy.def.types);
      let dmg = amount * eff;
      // เกราะลดดาเมจเป็นสัดส่วน ไม่ใช่ลบตรง ๆ — ป้อมยิงถี่จึงไม่กลายเป็นไร้ประโยชน์
      const ignoresArmor = tower && tower.def.ignoreArmor;
      if (!ignoresArmor && enemy.armor) dmg *= ARMOR_K / (ARMOR_K + enemy.armor);

      const before = enemy.hp;
      enemy.hp -= dmg;
      enemy.flash = 1;
      const real = Math.min(before, dmg);

      this.stats.damage += real;
      if (tower) {
        tower.damageDealt += real;
        tower.gainExp(real * .42);
      }

      // ตอนรุมบอสมีตัวเลขเด้งพร้อมกันเป็นสิบ ๆ — จำกัดไว้ให้ยังอ่านออก
      let floaters = 0;
      for (const f of this.fx) if (f instanceof PTD.FloatText) floaters++;
      if (!opts.silentText && floaters < 16) {
        let col = '#ffffff', size = 12;
        if (eff > 1) { col = '#ffd54a'; size = 14; }
        else if (eff < 1) { col = '#9aa4b8'; size = 11; }
        this.fx.push(new PTD.FloatText(
          enemy.x + (Math.random() - .5) * 14, enemy.y - 14,
          Math.round(real).toString() + (eff > 1 ? '!' : ''), col, size));
      }

      if (enemy.hp <= 0) this.killEnemy(enemy, tower);
      return real;
    },

    killEnemy(enemy, tower) {
      if (enemy.dead) return;
      enemy.dead = true;
      const gold = enemy.bounty != null ? enemy.bounty : enemy.def.bounty;
      this.money += gold;
      this.stats.earned += gold;
      this.stats.kills++;
      if (tower) { tower.kills++; tower.gainExp(gold * 2.2); }

      this.fx.push(new PTD.FloatText(enemy.x, enemy.y - 26, '+' + gold, '#ffd54a', 13));
      const col = PTD.TYPE_COLOR[enemy.def.types[0]] || '#fff';
      const n = enemy.def.boss ? 40 : 12;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = 50 + Math.random() * (enemy.def.boss ? 220 : 110);
        this.fx.push(new PTD.Particle(enemy.x, enemy.y, Math.cos(a) * s, Math.sin(a) * s,
          i % 3 ? col : '#ffffff', enemy.def.boss ? 5 : 3, .5 + Math.random() * .4, 150));
      }
      if (enemy.def.boss) { PTD.sfx.win(); this.setBanner(enemy.def.name + ' ถูกปราบแล้ว!', '#ffe37a'); }
      else PTD.sfx.hitFire();
    },

    explode(proj) {
      const col = proj.color;
      if (proj.splash > 0) {
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * TAU, s = 40 + Math.random() * 130;
          this.fx.push(new PTD.Particle(proj.x, proj.y, Math.cos(a) * s, Math.sin(a) * s, i % 2 ? col : '#fff', 4, .4, 120));
        }
        const R2 = proj.splash * proj.splash;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dd = (e.x - proj.x) ** 2 + (e.y - proj.y) ** 2;
          if (dd > R2) continue;
          const falloff = 1 - .45 * Math.sqrt(dd) / proj.splash;
          this.damage(e, proj.dmg * falloff, proj.moveType, proj.tower);
          if (proj.tower) proj.tower.applyEffect(e);
        }
        PTD.sfx.splash();
      } else {
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * TAU, s = 30 + Math.random() * 70;
          this.fx.push(new PTD.Particle(proj.x, proj.y, Math.cos(a) * s, Math.sin(a) * s, col, 3, .3, 100));
        }
        if (proj.target && !proj.target.dead) {
          this.damage(proj.target, proj.dmg, proj.moveType, proj.tower);
          if (proj.tower) proj.tower.applyEffect(proj.target);
        }
      }
    },

    /* ---------- การวาง / ขาย / วิวัฒนาการ ---------- */
    towerAt(c, r) { return this.towers.find(t => t.c === c && t.r === r) || null; },

    tryPlace(c, r) {
      const id = this.placing;
      if (!id) return false;
      const def = PTD.TOWERS[id];
      if (!M.buildable(c, r)) { PTD.sfx.deny(); this.setBanner('วางตรงนี้ไม่ได้', '#ff8a8a'); return false; }
      if (this.towerAt(c, r)) { PTD.sfx.deny(); this.setBanner('ช่องนี้มีโปเกม่อนอยู่แล้ว', '#ff8a8a'); return false; }
      if (this.towers.length >= this.teamCap) {
        PTD.sfx.deny();
        this.setBanner('ทีมเต็มแล้ว (' + this.teamCap + ' ตัว) — ขาย วิวัฒนาการ หรือซื้อช่องเพิ่ม', '#ff8a8a');
        return false;
      }
      if (this.money < def.cost) { PTD.sfx.deny(); this.setBanner('เงินไม่พอ', '#ff8a8a'); return false; }
      this.money -= def.cost;
      const t = new PTD.Tower(id, c, r, this);
      this.towers.push(t);
      this.selected = t;
      const p = M.centerOf(c, r);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU, s = 40 + Math.random() * 80;
        this.fx.push(new PTD.Particle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, '#fff6c0', 3, .45, 120));
      }
      PTD.sfx.place();
      if (!this.shiftHeld) this.placing = null;
      PTD.ui.refresh();
      return true;
    },

    sellSelected() {
      const t = this.selected;
      if (!t) return;
      this.money += t.sellValue;
      this.fx.push(new PTD.FloatText(t.x, t.y - 20, '+' + t.sellValue, '#ffd54a', 13));
      this.towers.splice(this.towers.indexOf(t), 1);
      this.selected = null;
      PTD.sfx.sell();
      PTD.ui.refresh();
    },

    /* ลูกอมพิเศษ: จ่ายเงินแลกเลเวล — เป็นทางระบายเงินช่วงท้ายเกม */
    candyCost(t) { return CANDY_COST(t.level); },
    buyCandy() {
      const t = this.selected;
      if (!t) return;
      if (t.level >= 20) { PTD.sfx.deny(); this.setBanner('เลเวลสูงสุดแล้ว', '#ff8a8a'); return; }
      const cost = CANDY_COST(t.level);
      if (this.money < cost) { PTD.sfx.deny(); this.setBanner('เงินไม่พอ', '#ff8a8a'); return; }
      this.money -= cost;
      t.invested += Math.round(cost * .5);
      t.exp = t.expNext;          // gainExp จะดันข้ามเลเวลให้เอง
      t.gainExp(1);
      PTD.ui.refresh();
    },

    slotCost() { return SLOT_COST(this.extraSlots); },
    buySlot() {
      if (this.extraSlots >= EXTRA_SLOTS) { PTD.sfx.deny(); this.setBanner('ขยายทีมได้สูงสุดแล้ว', '#ff8a8a'); return; }
      const cost = SLOT_COST(this.extraSlots);
      if (this.money < cost) { PTD.sfx.deny(); this.setBanner('เงินไม่พอ', '#ff8a8a'); return; }
      this.money -= cost;
      this.extraSlots++;
      PTD.sfx.levelUp();
      this.setBanner('ขยายทีมเป็น ' + this.teamCap + ' ตัว!', '#8be0ff');
      PTD.ui.refresh();
    },

    evolveSelected() {
      const t = this.selected;
      if (!t || !t.canEvolve) { PTD.sfx.deny(); return; }
      if (this.money < t.def.evolveCost) { PTD.sfx.deny(); this.setBanner('เงินไม่พอสำหรับวิวัฒนาการ', '#ff8a8a'); return; }
      this.money -= t.def.evolveCost;
      t.evolve();
      PTD.ui.refresh();
    },

    /* ---------- ระบบเวฟ ---------- */
    startWave() {
      if (this.state === 'wave' || this.state === 'won' || this.state === 'lost') return;
      if (this.state === 'break' && this.breakLeft > 0) {
        const bonus = Math.ceil(this.breakLeft * EARLY_BONUS_PER_SEC);
        this.money += bonus;
        this.stats.earned += bonus;
        this.setBanner('เรียกเวฟก่อนเวลา +' + bonus + '₽', '#8be0ff');
      }
      const w = PTD.WAVES[this.waveIndex];
      this.spawnQueue = [];
      for (const g of w.groups) {
        for (let i = 0; i < g.count; i++) {
          this.spawnQueue.push({ id: g.id, at: g.delay + i * g.gap });
        }
      }
      this.spawnQueue.sort((a, b) => a.at - b.at);
      this.waveTime = 0;
      this.state = 'wave';
      const hasBoss = w.groups.some(g => PTD.ENEMIES[g.id].boss);
      if (hasBoss) { PTD.sfx.boss(); this.setBanner('⚠ เวฟ ' + (this.waveIndex + 1) + ' — บอส!', '#ff7a7a'); }
      else { PTD.sfx.waveStart(); this.setBanner('เวฟ ' + (this.waveIndex + 1) + ' เริ่มแล้ว', '#a8ffb0'); }
      PTD.ui.refresh();
    },

    updateWave(dt) {
      if (this.state === 'break') {
        this.breakLeft -= dt;
        if (this.breakLeft <= 0) this.startWave();
        return;
      }
      if (this.state !== 'wave') return;

      this.waveTime += dt;
      const hpMul = PTD.WAVES[this.waveIndex].hpMul;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime) {
        const s = this.spawnQueue.shift();
        this.enemies.push(new PTD.Enemy(s.id, hpMul, this));
      }

      if (!this.spawnQueue.length && !this.enemies.length) {
        // เคลียร์เวฟ
        const reward = 80 + this.waveIndex * 22;
        this.money += reward;
        this.stats.earned += reward;
        this.waveIndex++;
        if (this.waveIndex >= PTD.WAVES.length) {
          this.state = 'won';
          PTD.sfx.win();
          PTD.ui.showEnd(true);
          return;
        }
        this.state = 'break';
        this.breakLeft = BREAK_TIME;
        this.setBanner('เคลียร์เวฟ! +' + reward + '₽', '#a8ffb0');
        PTD.ui.refresh();
      }
    },

    leak(enemy) {
      const cost = enemy.def.boss ? 5 : 1;
      this.lives -= cost;
      this.stats.leaked++;
      PTD.sfx.leak();
      this.shake = .35;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = 'lost';
        PTD.sfx.lose();
        PTD.ui.showEnd(false);
      }
      PTD.ui.refresh();
    },

    setBanner(text, color) { this.banner = { text, color, life: 2.2 }; },

    /* ---------- ลูปอัปเดต ---------- */
    update(dt) {
      this.time += dt;
      this.updateWave(dt);

      this.auraEnemies = this.enemies.filter(e => e.def.aura);

      for (const t of this.towers) t.update(dt, this);

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.update(dt, this);
        if (e.leaked) this.leak(e);
        if (e.dead) this.enemies.splice(i, 1);
      }
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.update(dt, this);
        if (p.dead) this.projectiles.splice(i, 1);
      }
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.update(dt);
        if (f.dead) this.fx.splice(i, 1);
      }
      if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
      if (this.shake > 0) this.shake -= dt;
    },

    /* ---------- วาดภาพ ---------- */
    draw() {
      const ctx = this.ctx;
      ctx.save();
      if (this.shake > 0) {
        ctx.translate((Math.random() - .5) * this.shake * 18, (Math.random() - .5) * this.shake * 18);
      }
      ctx.drawImage(this.terrain, 0, 0);

      // ไฮไลต์ช่องที่กำลังจะวาง
      if (this.placing) {
        const { c, r } = this.hover;
        const def = PTD.TOWERS[this.placing];
        if (c >= 0 && c < M.COLS && r >= 0 && r < M.ROWS) {
          const ok = M.buildable(c, r) && !this.towerAt(c, r) && this.money >= def.cost;
          const p = M.centerOf(c, r);
          ctx.save();
          ctx.fillStyle = ok ? 'rgba(90,220,120,.30)' : 'rgba(240,80,80,.30)';
          ctx.fillRect(c * M.TILE + 2, r * M.TILE + 2, M.TILE - 4, M.TILE - 4);
          ctx.strokeStyle = ok ? 'rgba(160,255,180,.9)' : 'rgba(255,140,140,.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(c * M.TILE + 2, r * M.TILE + 2, M.TILE - 4, M.TILE - 4);
          // วงระยะโจมตี
          ctx.globalAlpha = .5;
          ctx.setLineDash([7, 6]);
          ctx.strokeStyle = ok ? '#bfffd0' : '#ffb0b0';
          ctx.beginPath(); ctx.arc(p.x, p.y, def.range, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = .12;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x, p.y, def.range, 0, TAU); ctx.fill();
          ctx.restore();
          // ตัวอย่างโปเกม่อน
          ctx.save();
          ctx.globalAlpha = .75;
          PTD.drawCreature(ctx, def.sprite, p.x, p.y - 4, 40, this.time, {});
          ctx.restore();
        }
      }

      // เรียงตาม y เพื่อให้ตัวที่อยู่หน้าบังตัวที่อยู่หลัง
      const drawables = [];
      for (const t of this.towers) drawables.push({ y: t.y, kind: 't', o: t });
      for (const e of this.enemies) drawables.push({ y: e.y, kind: 'e', o: e });
      drawables.sort((a, b) => a.y - b.y);
      for (const d of drawables) {
        if (d.kind === 't') d.o.draw(ctx, this.time, d.o === this.selected);
        else d.o.draw(ctx, this.time);
      }

      for (const p of this.projectiles) p.draw(ctx, this.time);
      for (const f of this.fx) f.draw(ctx);

      // ป้ายข้อความกลางจอ
      if (this.banner) {
        const a = clamp(this.banner.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.65)';
        ctx.strokeText(this.banner.text, M.W / 2, 62);
        ctx.fillStyle = this.banner.color;
        ctx.fillText(this.banner.text, M.W / 2, 62);
        ctx.restore();
      }

      if (this.paused && this.state !== 'won' && this.state !== 'lost') {
        ctx.save();
        ctx.fillStyle = 'rgba(8,12,20,.5)';
        ctx.fillRect(0, 0, M.W, M.H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 34px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('พักเกม', M.W / 2, M.H / 2);
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText('กด Space เพื่อเล่นต่อ', M.W / 2, M.H / 2 + 28);
        ctx.restore();
      }
      ctx.restore();
    },

    /* ---------- เริ่มเกมใหม่ ---------- */
    reset() {
      this.time = 0; this.state = 'ready'; this.speed = 1; this.paused = false;
      this.money = START_MONEY; this.lives = START_LIVES;
      this.waveIndex = 0; this.waveTime = 0; this.breakLeft = 0;
      this.spawnQueue = []; this.enemies = []; this.towers = [];
      this.projectiles = []; this.fx = [];
      this.placing = null; this.selected = null;
      this.extraSlots = 0;
      this.stats = { kills: 0, damage: 0, earned: 0, leaked: 0 };
      this.banner = null; this.shake = 0;
      PTD.ui.hideEnd();
      PTD.ui.refresh();
    }
  };

  G.shake = 0;
  G.shiftHeld = false;
  G.MAX_TEAM = MAX_TEAM;
  G.EXTRA_SLOTS = EXTRA_SLOTS;
  G.extraSlots = 0;
  Object.defineProperty(G, 'teamCap', { get() { return MAX_TEAM + this.extraSlots; } });

  /* =================== บูตเกม =================== */
  function boot() {
    const canvas = document.getElementById('game');
    canvas.width = M.W; canvas.height = M.H;
    G.canvas = canvas;
    G.ctx = canvas.getContext('2d');
    G.terrain = M.renderTerrain();

    /* ---- อินพุตเมาส์ ---- */
    function toCanvas(ev) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
      return { x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy };
    }

    canvas.addEventListener('mousemove', (ev) => {
      const p = toCanvas(ev);
      G.hover = M.tileOf(p.x, p.y);
    });
    canvas.addEventListener('mouseleave', () => { G.hover = { c: -1, r: -1 }; });

    canvas.addEventListener('click', (ev) => {
      PTD.audio.unlock();
      const p = toCanvas(ev);
      const { c, r } = M.tileOf(p.x, p.y);
      if (G.placing) { G.tryPlace(c, r); return; }
      const t = G.towerAt(c, r);
      G.selected = t;
      PTD.ui.refresh();
    });

    canvas.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      G.placing = null; G.selected = null;
      PTD.ui.refresh();
    });

    /* ---- คีย์ลัด ---- */
    window.addEventListener('keydown', (ev) => {
      if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
      if (ev.key === 'Shift') G.shiftHeld = true;
      switch (ev.key) {
        case ' ':
          ev.preventDefault();
          G.paused = !G.paused; PTD.ui.refresh(); break;
        case 'Escape':
          G.placing = null; G.selected = null; PTD.ui.refresh(); break;
        case 'Enter':
          if (G.state === 'ready' || G.state === 'break') G.startWave();
          break;
        case 'e': case 'E': G.evolveSelected(); break;
        case 's': case 'S': G.sellSelected(); break;
        case 'c': case 'C': G.buyCandy(); break;
        case 'x': case 'X':
          G.speed = G.speed === 1 ? 2 : (G.speed === 2 ? 3 : 1);
          PTD.ui.refresh(); break;
      }
      if (/^[1-9]$/.test(ev.key)) {
        const id = PTD.SHOP_ORDER[parseInt(ev.key, 10) - 1];
        if (id) { G.placing = id; G.selected = null; PTD.ui.refresh(); }
      }
      if (ev.key === '0') {
        const id = PTD.SHOP_ORDER[9];
        if (id) { G.placing = id; G.selected = null; PTD.ui.refresh(); }
      }
    });
    window.addEventListener('keyup', (ev) => { if (ev.key === 'Shift') G.shiftHeld = false; });

    PTD.ui.init(G);
    PTD.ui.refresh();

    /* ---- ลูปหลัก ---- */
    let last = performance.now();
    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, .05);
      if (!G.paused && G.state !== 'won' && G.state !== 'lost') {
        const steps = G.speed;
        for (let i = 0; i < steps; i++) G.update(dt);
      } else {
        G.time += dt * .25;   // ให้แอนิเมชันยังขยับตอนพัก
      }
      G.draw();
      PTD.ui.tick();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  PTD.G = G;
  PTD.boot = boot;
  document.addEventListener('DOMContentLoaded', boot);
})(window.PTD = window.PTD || {});
