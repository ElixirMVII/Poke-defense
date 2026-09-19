/* =====================================================================
 * entities.js — ศัตรู / ป้อม / กระสุน / เอฟเฟกต์
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const M = PTD.map;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  /* =================== เอฟเฟกต์ภาพ =================== */
  class FloatText {
    constructor(x, y, text, color, size) {
      this.x = x; this.y = y; this.text = text;
      this.color = color || '#fff'; this.size = size || 13;
      this.life = 0.9; this.vy = -34; this.dead = false;
    }
    update(dt) { this.y += this.vy * dt; this.vy *= .94; this.life -= dt; if (this.life <= 0) this.dead = true; }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = clamp(this.life * 1.8, 0, 1);
      ctx.font = `bold ${this.size}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.strokeText(this.text, this.x, this.y);
      ctx.fillStyle = this.color;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, vx, vy, color, size, life, grav) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.color = color; this.size = size; this.life = life; this.max = life;
      this.grav = grav || 0; this.dead = false;
    }
    update(dt) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vy += this.grav * dt; this.vx *= .98;
      this.life -= dt; if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      const k = this.life / this.max;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size * k, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ลำแสง/สายฟ้าที่วาดค้างไว้แป๊บนึง
  class Beam {
    constructor(pts, color, width, life, jagged) {
      this.pts = pts; this.color = color; this.width = width || 3;
      this.life = life || .16; this.max = this.life; this.jagged = jagged; this.dead = false;
    }
    update(dt) { this.life -= dt; if (this.life <= 0) this.dead = true; }
    draw(ctx) {
      const k = this.life / this.max;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.width * (0.5 + k * 0.5);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = this.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < this.pts.length - 1; i++) {
        const a = this.pts[i], b = this.pts[i + 1];
        ctx.moveTo(a.x, a.y);
        if (this.jagged) {
          const steps = 4;
          for (let s = 1; s <= steps; s++) {
            const k2 = s / steps;
            const jx = s === steps ? 0 : (Math.random() - .5) * 9;
            const jy = s === steps ? 0 : (Math.random() - .5) * 9;
            ctx.lineTo(a.x + (b.x - a.x) * k2 + jx, a.y + (b.y - a.y) * k2 + jy);
          }
        } else ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* =================== ศัตรู =================== */
  class Enemy {
    // spec มาจากตารางเวฟ: { id, boss, aura }
    constructor(spec, hpMul, G) {
      const def = PTD.enemy(spec.id, { boss: spec.boss, aura: spec.aura, bossX: spec.bossX });
      this.def = def;
      // ลักษณะพิเศษประจำเวฟ (ฝูงเร็ว/เกราะหนา/ฝูงใหญ่/ฟื้นเลือด) — บอสไม่รับผล
      const mod = spec.boss ? null : (spec.mod || null);
      this.mod = mod;
      this.maxHp = Math.max(1, Math.round(def.hp * hpMul * (mod ? mod.hp : 1)));
      this.hp = this.maxHp;
      // สุ่มความเร็วรายตัวนิดหน่อย แถวจะได้กระจายแทนที่จะเดินซ้อนกันเป็นก้อนเดียว
      this.baseSpeed = def.speed * (mod ? mod.speed : 1) * (spec.boss ? 1 : (0.92 + Math.random() * 0.16));
      this.armor = (def.armor || 0) * (mod ? mod.armor : 1);
      this.regen = mod && mod.regen ? mod.regen : 0;
      // เวฟหลัง ๆ ศัตรูอึดขึ้น ค่าหัวก็ต้องขึ้นตาม ไม่งั้นเศรษฐกิจตามไม่ทัน
      this.bounty = Math.round(def.bounty * (0.65 + 0.35 * Math.min(hpMul, 8)));
      this.dist = 0;
      this.x = M.WAYPOINTS[0].x; this.y = M.WAYPOINTS[0].y;
      this.facing = 1;
      this.flash = 0;
      this.dead = false; this.leaked = false;
      this.slows = [];     // {until, power}
      this.dots = [];      // {until, dps, type, tick}
      this.stunUntil = 0;
      this.size = 54 * (def.scale || 1);
      this.G = G;
      this.spawnAnim = .35;
    }

    get speedMul() {
      if (this.G.time < this.stunUntil) return 0;
      let worst = 0;
      for (const s of this.slows) if (s.until > this.G.time && s.power > worst) worst = s.power;
      return 1 - worst;
    }

    addSlow(dur, power) { this.slows.push({ until: this.G.time + dur, power }); if (this.slows.length > 6) this.slows.shift(); }
    addStun(dur) { this.stunUntil = Math.max(this.stunUntil, this.G.time + dur); }
    addDot(dur, dps, type) {
      const ex = this.dots.find(d => d.type === type);
      if (ex) { ex.until = Math.max(ex.until, this.G.time + dur); ex.dps = Math.max(ex.dps, dps); }
      else this.dots.push({ until: this.G.time + dur, dps, type });
    }

    update(dt, G) {
      if (this.spawnAnim > 0) this.spawnAnim -= dt;

      // เวฟฟื้นเลือด: ยิงไม่ขาดก็ค่อย ๆ กลับมาเต็ม บีบให้ต้องรวมดาเมจให้พอ
      if (this.regen && this.hp > 0 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * dt);
      }

      // พิษ/ไฟ ทำดาเมจต่อเนื่อง (ไม่คิดธาตุซ้ำ ไม่ติดเกราะ)
      for (let i = this.dots.length - 1; i >= 0; i--) {
        const d = this.dots[i];
        if (d.until <= G.time) { this.dots.splice(i, 1); continue; }
        this.hp -= d.dps * dt;
      }
      if (this.hp <= 0 && !this.dead) { G.killEnemy(this, null); return; }

      // ฟื้นพลัง (เฉพาะบอสบางตัว)
      if (this.def.regen) this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt);

      const prevX = this.x;
      this.dist += this.baseSpeed * this.speedMul * dt;
      const p = M.pointAt(this.dist);
      this.x = p.x; this.y = p.y;
      if (this.x !== prevX) this.facing = this.x > prevX ? 1 : -1;
      if (this.flash > 0) this.flash -= dt * 4;

      if (this.dist >= M.PATH_LEN) { this.leaked = true; this.dead = true; }
    }

    draw(ctx, t) {
      const slowed = this.speedMul < 1;
      const stunned = this.G.time < this.stunUntil;
      let alpha = 1;
      if (this.spawnAnim > 0) alpha = clamp(1 - this.spawnAnim / .35, .15, 1);

      PTD.sprites.draw(ctx, this.def.dexId, this.x, this.y, this.size, t, {
        flash: this.flash, alpha,
        glow: this.def.glow || null,
        phase: (this.def.dexId * 137) % 900,
        tint: PTD.TYPE_COLOR[this.def.types[0]]
      });

      // ไอคอนสถานะ
      const burning = this.dots.some(d => d.type === 'burn');
      const poisoned = this.dots.some(d => d.type === 'poison');
      if (burning) this.statusPuff(ctx, t, '#ff8a2e', -1);
      if (poisoned) this.statusPuff(ctx, t, '#b45ad8', 1);
      if (slowed && !stunned) {
        ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = '#7fd8ff';
        ctx.beginPath(); ctx.arc(this.x, this.y + this.size * .42, this.size * .3, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (stunned) {
        ctx.save();
        ctx.globalAlpha = .9; ctx.strokeStyle = '#f8d030'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + i * TAU / 3;
          ctx.beginPath();
          ctx.arc(this.x + Math.cos(a) * this.size * .5, this.y - this.size * .55 + Math.sin(a) * 4, 2.5, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      }

      // แถบเลือด — วางเหนือหัวจริงของสไปรท์ (แต่ละตัวสูงไม่เท่ากัน)
      const m = PTD.sprites.metrics(this.def.dexId, this.size, 1);
      const topY = this.y + this.size * .40 - m.h;
      if (this.hp < this.maxHp) {
        const w = Math.max(26, m.w * .9), h = this.def.boss ? 6 : 4;
        const x = this.x - w / 2, y = topY - 7;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        const k = clamp(this.hp / this.maxHp, 0, 1);
        ctx.fillStyle = k > .55 ? '#4ade80' : (k > .25 ? '#fbbf24' : '#f87171');
        ctx.fillRect(x, y, w * k, h);
        ctx.restore();
      }
      if (this.def.boss) {
        ctx.save();
        ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe37a'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        ctx.strokeText(this.def.name, this.x, topY - 14);
        ctx.fillText(this.def.name, this.x, topY - 14);
        ctx.restore();
      }
    }

    statusPuff(ctx, t, color, side) {
      ctx.save();
      ctx.globalAlpha = .6;
      for (let i = 0; i < 2; i++) {
        const ph = (t * 2 + i * .5) % 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x + side * this.size * .26, this.y - ph * 16, 3 * (1 - ph) + 1, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* =================== กระสุน =================== */
  class Projectile {
    constructor(o) {
      Object.assign(this, o);       // x,y,target,speed,dmg,moveType,splash,color,tower,effect,ignoreArmor
      this.dead = false;
      this.trail = [];
    }
    update(dt, G) {
      const tx = this.target && !this.target.dead ? this.target.x : this.lastX;
      const ty = this.target && !this.target.dead ? this.target.y : this.lastY;
      if (tx == null) { this.dead = true; return; }
      this.lastX = tx; this.lastY = ty;
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();
      if (d <= step || d < 4) {
        this.x = tx; this.y = ty;
        G.explode(this);
        this.dead = true;
        return;
      }
      this.x += dx / d * step; this.y += dy / d * step;
      this.angle = Math.atan2(dy, dx);
    }
    draw(ctx, t) {
      ctx.save();
      // หางกระสุน
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i], k = (i + 1) / this.trail.length;
        ctx.globalAlpha = k * .4;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, this.r * k * .8, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = this.color; ctx.shadowBlur = 8;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(this.x - this.r * .25, this.y - this.r * .25, this.r * .38, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* =================== ป้อม =================== */
  const EXP_BASE = 55;
  function expNeeded(level) { return Math.round(EXP_BASE * Math.pow(level, 1.45)); }

  class Tower {
    // mon = ข้อมูลตัวที่จับมาได้จากกล่อง (uid/เลเวล/exp) — ไม่ใส่ก็ถือว่าเป็นตัวใหม่
    constructor(defId, c, r, G, mon) {
      this.def = PTD.tower(defId);
      this.baseDef = this.def;        // ร่างก่อนเมก้า ไว้คืนร่างตอนจบด่าน
      this.megaActive = false;
      this.uid = mon ? mon.uid : 0;
      this.c = c; this.r = r;
      const p = M.centerOf(c, r);
      this.x = p.x; this.y = p.y;
      this.level = mon ? (mon.lv || 1) : 1;
      this.startLevel = this.level;
      this.expLevels = 0;        // นับเฉพาะเลเวลที่ได้จากการฆ่าในด่านนี้
      this.lastHitAt = -1;       // เวลาที่ทำดาเมจครั้งล่าสุด (-1 = ยังไม่เคย)
      this.placedAt = G.time;
      this.exp = mon ? (mon.exp || 0) : 0;
      this.cd = 0;
      this.kills = 0; this.damageDealt = 0;
      this.invested = this.def.cost;
      this.targetMode = 'first';
      this.facing = 1;
      this.recoil = 0;
      this.G = G;
      this.placedAt = G.time;
      this.auraPulse = 0;
    }

    /* ค่าจริงหลังคูณเลเวลและออร่าบอส */
    get dmg() { return this.def.dmg * (1 + .10 * (this.level - 1)) * this.G.towerDmgMul(this); }
    get range() { return this.def.range * (1 + .018 * (this.level - 1)); }
    get rate() { return this.def.rate * (1 + .022 * (this.level - 1)) * this.G.towerRateMul(this); }
    get dps() { return this.dmg * this.rate * (this.def.targets || 1); }
    get expNext() { return expNeeded(this.level); }
    get sellValue() { return Math.floor(this.invested * .7); }
    get canEvolve() { return this.def.evolveTo.length > 0 && this.level >= this.def.evolveLv; }

    /* การฆ่าดันเลเวลได้จำกัดจำนวนต่อหนึ่งด่าน ส่วนลูกอม (ซื้อด้วยเงิน) ไม่ติดเพดาน
     * เดิมเลเวลชนเพดานจาก EXP อย่างเดียว เงินในสนามเลยไม่มีที่ใช้เลย
     * นับ "เลเวลที่ได้จาก EXP" แยกจากเลเวลรวม ลูกอมจะได้ไม่ไปกินโควตาของ EXP */
    get expLevelBudget() {
      const lim = this.G.expLevelCap != null ? this.G.expLevelCap : 3;
      return Math.max(0, lim - this.expLevels);
    }

    // ขึ้นเลเวลโดยไม่ผ่านโควตา EXP — ใช้กับลูกอมและของที่ซื้อด้วยเงิน
    levelUpPaid() {
      if (this.level >= PTD.MAX_LEVEL) return false;
      this.level++;
      this.exp = 0;
      this.showLevelUp();
      return true;
    }

    showLevelUp() {
      this.G.fx.push(new FloatText(this.x, this.y - 22, 'Lv.' + this.level, '#8be0ff', 14));
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU;
        this.G.fx.push(new Particle(this.x, this.y, Math.cos(a) * 60, Math.sin(a) * 60 - 20, '#8be0ff', 3, .5, 80));
      }
      PTD.sfx.levelUp();
    }

    gainExp(amount) {
      if (this.expLevelBudget <= 0) return;      // โควตาเลเวลจากการฆ่าหมดแล้วสำหรับด่านนี้
      this.exp += amount;
      let leveled = false;
      while (this.exp >= this.expNext && this.level < PTD.MAX_LEVEL && this.expLevelBudget > 0) {
        this.exp -= this.expNext; this.level++; this.expLevels++; leveled = true;
      }
      if (this.expLevelBudget <= 0) this.exp = Math.min(this.exp, this.expNext - 1);
      if (leveled) this.showLevelUp();
    }

    // choice = index ของร่างที่เลือก (Eevee มีสามทาง)
    /* ---------- เมก้าอีโวลูชัน ---------- */
    // ไม่ใช่การบวกเปอร์เซ็นต์ แต่สลับไปใช้สเตตัสจริงของร่างเมก้าทั้งชุด
    megaEvolve(formId) {
      const m = PTD.megaTower(formId);
      if (!m) return false;
      this.baseDef = this.def;
      this.def = m;
      this.megaActive = true;
      const G = this.G;
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * TAU, sp = 90 + Math.random() * 140;
        G.fx.push(new Particle(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp,
          i % 2 ? '#b98aff' : '#fff6c0', 4, .8, 30));
      }
      G.fx.push(new FloatText(this.x, this.y - 34, m.name + '!', '#c9a0ff', 16));
      PTD.sfx.evolve();
      return true;
    }

    megaRevert() {
      if (!this.megaActive) return;
      this.def = this.baseDef;
      this.megaActive = false;
    }

    evolve(choice) {
      const nextId = this.def.evolveTo[choice || 0];
      const next = PTD.tower(nextId);
      this.invested += this.def.evolveCost;
      this.def = next;
      this.exp = 0;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * TAU, s = 70 + Math.random() * 90;
        this.G.fx.push(new Particle(this.x, this.y, Math.cos(a) * s, Math.sin(a) * s, '#fff6c0', 4, .7, 40));
      }
      this.G.fx.push(new FloatText(this.x, this.y - 30, next.name + '!', '#ffe37a', 15));
      PTD.sfx.evolve();
    }

    pickTarget(enemies) {
      const R = this.range, R2 = R * R;
      let best = null, bestScore = -Infinity;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        if (dx * dx + dy * dy > R2) continue;
        let score;
        switch (this.targetMode) {
          case 'last':   score = -e.dist; break;
          case 'strong': score = e.hp; break;
          case 'close':  score = -(dx * dx + dy * dy); break;
          default:       score = e.dist;
        }
        if (score > bestScore) { bestScore = score; best = e; }
      }
      return best;
    }

    update(dt, G) {
      if (this.recoil > 0) this.recoil -= dt * 6;
      this.cd -= dt;

      // ออร่ารอบตัว (Venusaur)
      if (this.def.attack === 'aura') {
        this.auraPulse += dt;
        if (this.cd <= 0) {
          const R = this.range, R2 = R * R;
          let hit = 0;
          for (const e of G.enemies) {
            const dx = e.x - this.x, dy = e.y - this.y;
            if (dx * dx + dy * dy > R2 || e.dead) continue;
            hit++;
            G.damage(e, this.dmg, this.def.moveType, this, { silentText: hit > 3 });
            this.applyEffect(e);
          }
          if (hit) PTD.sfx.splash();
          this.cd = 1 / this.rate;
          this.auraPulse = 0;
        }
        return;
      }

      const target = this.pickTarget(G.enemies);
      if (!target) return;
      this.facing = target.x >= this.x ? 1 : -1;
      if (this.cd > 0) return;
      this.cd = 1 / this.rate;
      this.recoil = 1;
      this.fire(target, G);
    }

    applyEffect(e) {
      const ef = this.def.effect;
      if (!ef) return;
      if (Math.random() > (ef.chance == null ? 1 : ef.chance)) return;
      switch (ef.kind) {
        case 'burn':  e.addDot(ef.dur, ef.dps, 'burn'); break;
        case 'poison': e.addDot(ef.dur, ef.dps, 'poison'); break;
        case 'slow':  e.addSlow(ef.dur, ef.power); break;
        case 'stun':  e.addStun(ef.dur); break;
        case 'slowpoison': e.addSlow(ef.dur, ef.power); e.addDot(ef.dur, ef.dps, 'poison'); break;
      }
    }

    fire(target, G) {
      const d = this.def;
      const color = PTD.TYPE_COLOR[d.moveType];

      switch (d.attack) {
        case 'melee': {
          const targets = [target];
          if (d.targets > 1) {
            for (const e of G.enemies) {
              if (targets.length >= d.targets) break;
              if (e === target || e.dead) continue;
              if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range) targets.push(e);
            }
          }
          for (const e of targets) {
            G.damage(e, this.dmg, d.moveType, this);
            this.applyEffect(e);
            for (let i = 0; i < 5; i++) {
              const a = Math.random() * TAU;
              G.fx.push(new Particle(e.x, e.y, Math.cos(a) * 70, Math.sin(a) * 70, color, 3, .3, 120));
            }
          }
          G.fx.push(new Beam([{ x: this.x, y: this.y }, { x: target.x, y: target.y }], '#ffffff', 4, .1));
          PTD.sfx.thud();
          break;
        }
        case 'beam': {
          const pts = [{ x: this.x, y: this.y }];
          const hits = [target];
          if (d.pierce > 1) {
            // หาศัตรูที่อยู่ในแนวเดียวกัน
            const ang = Math.atan2(target.y - this.y, target.x - this.x);
            for (const e of G.enemies) {
              if (hits.length >= d.pierce) break;
              if (e === target || e.dead) continue;
              const ea = Math.atan2(e.y - this.y, e.x - this.x);
              let diff = Math.abs(((ea - ang + Math.PI * 3) % TAU) - Math.PI);
              if (diff < .28 && Math.hypot(e.x - this.x, e.y - this.y) <= this.range * 1.1) hits.push(e);
            }
          }
          let far = target;
          for (const e of hits) {
            G.damage(e, this.dmg, d.moveType, this);
            this.applyEffect(e);
            if (Math.hypot(e.x - this.x, e.y - this.y) > Math.hypot(far.x - this.x, far.y - this.y)) far = e;
          }
          const ang2 = Math.atan2(far.y - this.y, far.x - this.x);
          const reach = Math.hypot(far.x - this.x, far.y - this.y) + 16;
          pts.push({ x: this.x + Math.cos(ang2) * reach, y: this.y + Math.sin(ang2) * reach });
          G.fx.push(new Beam(pts, color, 6, .18));
          PTD.sfx.zap();
          break;
        }
        case 'chain': {
          const chainN = d.chains || 3;
          const pts = [{ x: this.x, y: this.y }];
          let cur = target, dmg = this.dmg;
          const hit = new Set();
          for (let i = 0; i < chainN && cur; i++) {
            hit.add(cur);
            pts.push({ x: cur.x, y: cur.y });
            G.damage(cur, dmg, d.moveType, this);
            this.applyEffect(cur);
            dmg *= (d.chainFalloff || .7);
            // หาเป้าถัดไปที่ใกล้ที่สุดซึ่งยังไม่โดน
            let next = null, nd = 120 * 120;
            for (const e of G.enemies) {
              if (e.dead || hit.has(e)) continue;
              const dd = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
              if (dd < nd) { nd = dd; next = e; }
            }
            cur = next;
          }
          G.fx.push(new Beam(pts, color, 3.5, .2, true));
          PTD.sfx.zap();
          break;
        }
        default: { // bolt / splash
          G.projectiles.push(new Projectile({
            x: this.x, y: this.y - 6, target,
            speed: d.projSpeed || 320,
            dmg: this.dmg, moveType: d.moveType,
            splash: d.attack === 'splash' ? d.splash : 0,
            ignoreArmor: !!d.ignoreArmor,
            color, r: d.attack === 'splash' ? 7 : 5,
            tower: this
          }));
          PTD.sfx.shoot();
        }
      }
    }

    draw(ctx, t, selected) {
      const d = this.def;
      // ฐานวางป้อม
      ctx.save();
      ctx.globalAlpha = .28;
      ctx.fillStyle = '#1e2a16';
      ctx.beginPath(); ctx.ellipse(this.x, this.y + 15, 19, 8, 0, 0, TAU); ctx.fill();
      ctx.restore();

      // ออร่า (Venusaur)
      if (d.attack === 'aura') {
        const k = clamp(1 - this.auraPulse * this.rate, 0, 1);
        ctx.save();
        ctx.globalAlpha = .18 * k + .06;
        ctx.strokeStyle = PTD.TYPE_COLOR[d.moveType];
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.range * (1 - k * .85), 0, TAU); ctx.stroke();
        ctx.restore();
      }

      if (this.megaActive) {
        ctx.save();
        ctx.globalAlpha = .55 + .25 * Math.sin(t * 4);
        ctx.strokeStyle = '#c9a0ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y + 2, 24, 0, TAU); ctx.stroke();
        ctx.globalAlpha = .9;
        ctx.fillStyle = '#c9a0ff';
        ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('MEGA', this.x, this.y - 30);
        ctx.restore();
      }
      const kick = this.recoil > 0 ? this.recoil * 3 : 0;
      PTD.sprites.draw(ctx, d.dexId, this.x - this.facing * kick, this.y - 3, 54, t, {
        phase: (d.dexId * 211) % 900,
        tint: PTD.TYPE_COLOR[d.types[0]]
      });

      // ดาวบอกเลเวล
      if (this.level > 1) {
        ctx.save();
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.beginPath(); ctx.roundRect(this.x - 13, this.y + 12, 26, 12, 6); ctx.fill();
        ctx.fillStyle = '#ffe37a';
        ctx.fillText('Lv' + this.level, this.x, this.y + 21);
        ctx.restore();
      }
      if (this.canEvolve) {
        ctx.save();
        const pulse = .5 + .5 * Math.sin(t * 5);
        ctx.globalAlpha = .5 + pulse * .5;
        ctx.fillStyle = '#ffe37a';
        ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('▲', this.x, this.y - 26 - pulse * 2);
        ctx.restore();
      }
      if (selected) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }

  PTD.Enemy = Enemy;
  PTD.Tower = Tower;
  PTD.Projectile = Projectile;
  PTD.FloatText = FloatText;
  PTD.Particle = Particle;
  PTD.Beam = Beam;
  PTD.expNeeded = expNeeded;
})(window.PTD = window.PTD || {});
