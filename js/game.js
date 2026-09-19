/* =====================================================================
 * game.js — หน้าจอต่อสู้ (ป้องกันฐาน)
 *
 * ต่างจากเวอร์ชันก่อนตรงที่ไม่ได้ซื้อป้อมด้วยเงินแล้ว
 * เราวางได้เฉพาะโปเกม่อนใน "ทีม" ที่จับมาเองสูงสุด 6 ตัว ตัวละหนึ่งครั้ง
 * เลเวลที่ได้ระหว่างสู้จะติดตัวไปด่านถัดไป
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const M = PTD.map;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  const BREAK_TIME = 6;              // เดิม 12 วิ ทำให้ 35% ของด่านคือการนั่งดูนาฬิกา
  const EARLY_BONUS_PER_SEC = 6;
  const RECALL_REFUND = 0.6;         // เก็บกลับได้เงินคืนบางส่วน ย้ายตำแหน่งเลยมีต้นทุน
  const EXP_LEVELS_PER_STAGE = 3;    // เลเวลที่ได้ฟรีจากการฆ่าต่อหนึ่งด่าน เกินนี้ต้องซื้อลูกอม
  const ARMOR_K = 60;
  const CANDY_COST = (lv) => Math.round(50 + 12 * Math.pow(lv, 1.7));

  const G = {
    /* ---------- สถานะ ---------- */
    mode: 'stage',       // stage | quest
    stage: null, quest: null,
    time: 0,
    state: 'ready',      // ready | break | wave | won | lost
    speed: 1,
    paused: false,
    money: 0,
    lives: 20,
    waveIndex: 0,
    waves: [],
    waveTime: 0,
    breakLeft: 0,
    spawnQueue: [],
    enemies: [],
    towers: [],
    projectiles: [],
    fx: [],
    roster: [],          // [{mon, def, placed:boolean}]
    placing: null,       // uid ของตัวที่กำลังจะวาง
    selected: null,
    hover: { c: -1, r: -1 },
    megaUsed: false,     // เมก้าได้ครั้งเดียวต่อด่าน
    stats: { kills: 0, damage: 0, earned: 0, leaked: 0 },
    banner: null,
    auraEnemies: [],
    shake: 0,
    questTarget: null,   // ตัวในตำนานที่ต้องกดเลือด
    questBest: 1,        // สัดส่วนเลือดต่ำสุดที่ทำได้
    onFinish: null,

    /* ---------- ตัวคูณจากออร่าบอส ---------- */
    towerDmgMul(tower) {
      let m = 1;
      for (const e of this.auraEnemies) {
        if (e.def.aura !== 'drain') continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) < 150) m *= .78;
      }
      return m;
    },
    towerRateMul(tower) {
      let m = 1;
      for (const e of this.auraEnemies) {
        if (e.def.aura !== 'chill') continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) < 140) m *= .78;
      }
      return m;
    },

    /* ---------- คิดดาเมจ ---------- */
    damage(enemy, amount, moveType, tower, opts) {
      if (enemy.dead) return 0;
      opts = opts || {};
      const eff = PTD.effectiveness(moveType, enemy.def.types);
      let dmg = amount * eff;
      const ignoresArmor = tower && tower.def.ignoreArmor;
      if (!ignoresArmor && enemy.armor) dmg *= ARMOR_K / (ARMOR_K + enemy.armor);

      const before = enemy.hp;
      enemy.hp -= dmg;
      enemy.flash = 1;
      const real = Math.min(before, dmg);

      this.stats.damage += real;
      if (tower) { tower.damageDealt += real; tower.gainExp(real * .42); }

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

      // โหมดเควส: เช็คว่ากดเลือดตัวในตำนานถึงเกณฑ์หรือยัง
      if (this.mode === 'quest' && enemy === this.questTarget) {
        const frac = Math.max(0, enemy.hp / enemy.maxHp);
        if (frac < this.questBest) this.questBest = frac;
        if (frac <= this.quest.threshold) { this.finish(true); return real; }
      }

      if (enemy.hp <= 0) this.killEnemy(enemy, tower);
      return real;
    },

    killEnemy(enemy, tower) {
      if (enemy.dead) return;
      // ในเควส ตัวเป้าหมายไม่ตาย — แค่ต้องกดเลือดให้ถึงเกณฑ์
      if (this.mode === 'quest' && enemy === this.questTarget) {
        enemy.hp = 1;
        this.finish(true);
        return;
      }
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

    /* ---------- ทีมและการวาง ---------- */
    towerAt(c, r) { return this.towers.find(t => t.c === c && t.r === r) || null; },
    slotOf(uid) { return this.roster.find(s => s.mon.uid === uid) || null; },

    tryPlace(c, r) {
      const uid = this.placing;
      if (!uid) return false;
      const slot = this.slotOf(uid);
      if (!slot || slot.placed) { PTD.sfx.deny(); return false; }
      if (!M.buildable(c, r)) { PTD.sfx.deny(); this.setBanner('วางตรงนี้ไม่ได้', '#ff8a8a'); return false; }
      if (this.towerAt(c, r)) { PTD.sfx.deny(); this.setBanner('ช่องนี้มีตัวอื่นอยู่แล้ว', '#ff8a8a'); return false; }

      const cost = this.deployCost(slot.mon);
      if (this.money < cost) {
        PTD.sfx.deny();
        this.setBanner('เงินไม่พอ — ' + PTD.dex(slot.mon.id).n + ' ใช้ ' + cost + '₽', '#ff8a8a');
        return false;
      }
      this.money -= cost;

      const t = new PTD.Tower(slot.mon.id, c, r, this, slot.mon);
      this.towers.push(t);
      slot.placed = true;
      slot.tower = t;
      this.selected = t;
      this.placing = null;

      const p = M.centerOf(c, r);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU, s = 40 + Math.random() * 80;
        this.fx.push(new PTD.Particle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, '#fff6c0', 3, .45, 120));
      }
      PTD.sfx.place();
      PTD.ui.refresh();
      return true;
    },

    // ย้ายตัวที่วางแล้วไปช่องอื่น — เลือกแล้วแตะช่องว่างได้เลย
    startMove(tower) {
      const t = tower || this.selected;
      if (!t) return;
      this.movingTower = t;
      this.placing = null;
      this.setBanner('เลือกช่องใหม่ที่จะย้ายไป', '#8be0ff');
      PTD.ui.refresh();
    },
    cancelMove() { this.movingTower = null; PTD.ui.refresh(); },
    moveTo(c, r) {
      const t = this.movingTower;
      if (!t) return false;
      if (!M.buildable(c, r)) { PTD.sfx.deny(); this.setBanner('วางตรงนี้ไม่ได้', '#ff8a8a'); return false; }
      const other = this.towerAt(c, r);
      if (other && other !== t) { PTD.sfx.deny(); this.setBanner('ช่องนี้มีตัวอื่นอยู่', '#ff8a8a'); return false; }
      t.c = c; t.r = r;
      const p = M.centerOf(c, r);
      t.x = p.x; t.y = p.y;
      this.movingTower = null;
      PTD.sfx.place();
      PTD.ui.refresh();
      return true;
    },

    // เก็บกลับมาวางใหม่ได้ฟรี เพราะมีแค่ 6 ตัว ตำแหน่งต้องแก้ได้
    recall(tower) {
      const t = tower || this.selected;
      if (!t) return;
      const slot = this.roster.find(s => s.tower === t);
      if (slot) { slot.placed = false; slot.tower = null; slot.mon.lv = t.level; slot.mon.exp = t.exp; }
      const i = this.towers.indexOf(t);
      if (i >= 0) this.towers.splice(i, 1);
      if (this.selected === t) this.selected = null;
      const back = Math.floor(t.invested * RECALL_REFUND);
      this.money += back;
      this.setBanner('เก็บกลับ คืน ' + back + '₽ (' + Math.round(RECALL_REFUND * 100) + '%)', '#8be0ff');
      PTD.sfx.sell();
      PTD.ui.refresh();
    },

    /* ---------- ลูกอมพิเศษ ---------- */
    deployCost(mon) {
      const d = PTD.tower(mon.id);
      if (!d) return 0;
      // ตัวเลเวลสูงแพงกว่านิดหน่อย จะได้ไม่ใช่ว่าเลี้ยงมาแล้วลงฟรี
      return Math.round((d.cost * (1 + .02 * ((mon.lv || 1) - 1))) / 5) * 5;
    },
    canAfford(mon) { return this.money >= this.deployCost(mon); },
    candyCost(t) { return CANDY_COST(t.level); },
    buyCandy() {
      const t = this.selected;
      if (!t) return;
      if (t.level >= PTD.MAX_LEVEL) { PTD.sfx.deny(); this.setBanner('เลเวลสูงสุดแล้ว', '#ff8a8a'); return; }
      const cost = CANDY_COST(t.level);
      if (this.money < cost) { PTD.sfx.deny(); this.setBanner('เงินไม่พอ', '#ff8a8a'); return; }
      this.money -= cost;
      t.invested += cost;
      t.levelUpPaid();
      PTD.ui.refresh();
    },

    evolveSelected(choice) {
      const t = this.selected;
      if (!t || !t.canEvolve) { PTD.sfx.deny(); return; }
      if (t.megaActive) { PTD.sfx.deny(); this.setBanner('ร่างเมก้าวิวัฒนาการต่อไม่ได้', '#ff8a8a'); return; }
      if (this.money < t.def.evolveCost) { PTD.sfx.deny(); this.setBanner('เงินไม่พอสำหรับวิวัฒนาการ', '#ff8a8a'); return; }
      this.money -= t.def.evolveCost;
      t.evolve(choice || 0);
      PTD.ui.refresh();
    },

    /* ---------- เมก้าอีโวลูชัน ---------- */
    canMega(t) {
      if (!t || this.megaUsed || t.megaActive) return false;
      return PTD.hasMega(t.def.dexId) && PTD.save.hasStone(t.def.dexId);
    },
    megaOptions(t) {
      if (!t) return [];
      return PTD.megasOf(t.def.dexId);
    },
    doMega(formId) {
      const t = this.selected;
      if (!this.canMega(t)) { PTD.sfx.deny(); return; }
      const opts = this.megaOptions(t);
      const form = formId || (opts[0] && opts[0].form);
      if (!form) return;
      t.megaEvolve(form);
      this.megaUsed = true;
      PTD.save.data.stats.megas++;
      PTD.save.touch();
      this.setBanner('เมก้าอีโวลูชัน!', '#c9a0ff');
      PTD.ui.refresh();
    },

    /* ---------- ระบบเวฟ ---------- */
    startWave() {
      if (this.state === 'wave' || this.state === 'won' || this.state === 'lost') return;
      if (!this.towers.length) {
        PTD.sfx.deny();
        this.setBanner('ต้องวางโปเกม่อนอย่างน้อยหนึ่งตัวก่อน', '#ff8a8a');
        return;
      }
      if (this.state === 'break' && this.breakLeft > 0) {
        const bonus = Math.ceil(this.breakLeft * EARLY_BONUS_PER_SEC);
        this.money += bonus;
        this.stats.earned += bonus;
        this.setBanner('เรียกเวฟก่อนเวลา +' + bonus + '₽', '#8be0ff');
      }
      const w = this.waves[this.waveIndex];
      this.spawnQueue = [];
      for (const g of w.groups) {
        for (let i = 0; i < g.count; i++) {
          this.spawnQueue.push({
            id: g.id, boss: !!g.boss, aura: g.aura || null, bossX: g.bossX || 0,
            mod: w.modInfo || null,
            at: g.delay + i * g.gap
          });
        }
      }
      this.spawnQueue.sort((a, b) => a.at - b.at);
      this.waveTime = 0;
      this.state = 'wave';
      if (w.hasBoss) { PTD.sfx.boss(); this.setBanner('⚠ เวฟ ' + (this.waveIndex + 1) + ' — บอส!', '#ff7a7a'); }
      else if (w.modInfo) {
        PTD.sfx.waveStart();
        this.setBanner('เวฟ ' + (this.waveIndex + 1) + ' — ' + w.modInfo.name + ' · ' + w.modInfo.th, w.modInfo.color);
      }
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
      const hpMul = this.waves[this.waveIndex].hpMul;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime) {
        const s = this.spawnQueue.shift();
        const e = new PTD.Enemy(s, hpMul, this);
        this.enemies.push(e);
        if (this.mode === 'quest' && s.id === this.quest.species) this.questTarget = e;
      }

      if (!this.spawnQueue.length && !this.enemies.length) {
        if (this.mode === 'quest') { this.finish(false); return; }
        const reward = 70 + this.waveIndex * 20;
        this.money += reward;
        this.stats.earned += reward;
        this.waveIndex++;
        if (this.waveIndex >= this.waves.length) { this.finish(true); return; }
        this.state = 'break';
        this.breakLeft = BREAK_TIME;
        this.setBanner('เคลียร์เวฟ! +' + reward + '₽', '#a8ffb0');
        PTD.ui.refresh();
      }
    },

    leak(enemy) {
      // ในเควส ถ้าตัวเป้าหมายเดินพ้นสนามคือหลุดมือ
      if (this.mode === 'quest' && enemy === this.questTarget) { this.finish(false); return; }
      const cost = enemy.def.boss ? 5 : 1;
      this.lives -= cost;
      this.stats.leaked++;
      PTD.sfx.leak();
      this.shake = .35;
      if (this.lives <= 0) { this.lives = 0; this.finish(false); }
      PTD.ui.refresh();
    },

    setBanner(text, color) { this.banner = { text, color, life: 2.2 }; },

    /* ---------- จบด่าน ---------- */
    finish(won) {
      if (this.state === 'won' || this.state === 'lost') return;
      this.state = won ? 'won' : 'lost';

      // คืนร่างเมก้าก่อนเก็บเลเวลกลับกล่อง ไม่งั้นจะเซฟร่างเมก้าเป็นร่างถาวร
      for (const t of this.towers) t.megaRevert();
      PTD.save.syncFromTowers(this.towers);
      // ตัวที่ยังไม่ได้วางก็ต้องเก็บค่ากลับด้วย (เผื่อเคยวางแล้วเก็บกลับ)
      for (const s of this.roster) {
        const m = PTD.save.mon(s.mon.uid);
        if (m) { m.lv = Math.max(m.lv, s.mon.lv); m.exp = Math.max(m.exp, s.mon.exp); }
      }

      const result = { won, mode: this.mode, money: 0, balls: 0, stone: 0, caught: 0 };
      if (won) {
        PTD.sfx.win();
        if (this.mode === 'stage') {
          PTD.save.clearStage(this.stage.id);
          const r = this.stage.reward;
          // ไม่คืนเงินที่เหลือในสนามแล้ว เดิมคืน 50% ซึ่งกลายเป็นรางวัลของการไม่ใช้เงิน
          result.money = r.money;
          result.balls = r.balls;
          result.stone = r.stone || 0;
          if (r.stone) PTD.save.addStone(r.stone);
        } else {
          PTD.save.setQuest(this.quest.species, 'done');
          PTD.save.addMon(this.quest.species, 40);
          const r = this.quest.reward;
          result.money = r.money;
          result.balls = r.balls;
          result.stone = r.stone || 0;
          result.caught = this.quest.species;
          if (r.stone) PTD.save.addStone(r.stone);
        }
        PTD.save.addMoney(result.money);
        PTD.save.addBalls(result.balls);
      } else {
        PTD.sfx.lose();
        // แพ้ก็ยังได้เงินครึ่งหนึ่งที่หามาได้ จะได้ไม่เสียเที่ยวเปล่า
        result.money = Math.floor(this.money * .35);
        PTD.save.addMoney(result.money);
      }
      PTD.save.data.stats.battles++;
      PTD.save.persist();
      this.result = result;
      if (this.onFinish) this.onFinish(result);
    },

    /* ---------- ลูปอัปเดต ---------- */
    update(dt) {
      this.time += dt;
      if (this.state === 'won' || this.state === 'lost') return;
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
    // แท่นวางต้องเห็นชัดว่ามีกี่แท่นและเหลือว่างตรงไหน ไม่งั้นระบบจำกัดช่องก็ไม่มีความหมาย
    drawPads(ctx) {
      const pads = M.pads || [];
      const picking = !!this.placing || !!this.movingTower;
      for (const p of pads) {
        if (this.towerAt(p.c, p.r)) continue;
        const x = p.c * M.TILE, y = p.r * M.TILE, s = M.TILE;
        ctx.save();
        ctx.globalAlpha = picking ? .85 : .42;
        // แท่นหินสี่เหลี่ยมมุมมน ให้ดูเป็นที่ยืนจริง ๆ ไม่ใช่แค่กรอบ
        ctx.fillStyle = '#6b6357';
        ctx.beginPath(); ctx.roundRect(x + 5, y + 5, s - 10, s - 10, 6); ctx.fill();
        ctx.fillStyle = '#8d8375';
        ctx.beginPath(); ctx.roundRect(x + 7, y + 7, s - 14, s - 16, 5); ctx.fill();
        ctx.strokeStyle = picking ? 'rgba(255,225,150,.95)' : 'rgba(255,255,255,.35)';
        ctx.lineWidth = picking ? 2 : 1.5;
        ctx.beginPath(); ctx.roundRect(x + 5, y + 5, s - 10, s - 10, 6); ctx.stroke();
        if (picking) {
          ctx.globalAlpha = .5 + .3 * Math.sin(this.time * 5 + p.c + p.r);
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, 4, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    },

    draw(ctx) {
      ctx.save();
      if (this.shake > 0) {
        ctx.translate((Math.random() - .5) * this.shake * 18, (Math.random() - .5) * this.shake * 18);
      }
      ctx.drawImage(M.terrain, 0, 0);
      this.drawPads(ctx);

      if (this.movingTower) {
        const t = this.movingTower;
        ctx.save();
        ctx.globalAlpha = .45 + .2 * Math.sin(this.time * 6);
        ctx.strokeStyle = '#8be0ff'; ctx.lineWidth = 3;
        ctx.strokeRect(t.c * M.TILE + 3, t.r * M.TILE + 3, M.TILE - 6, M.TILE - 6);
        ctx.restore();
      }
      if (this.placing) {
        const { c, r } = this.hover;
        const slot = this.slotOf(this.placing);
        if (slot && c >= 0 && c < M.COLS && r >= 0 && r < M.ROWS) {
          const def = PTD.tower(slot.mon.id);
          const ok = M.buildable(c, r) && !this.towerAt(c, r);
          const p = M.centerOf(c, r);
          ctx.save();
          ctx.fillStyle = ok ? 'rgba(90,220,120,.30)' : 'rgba(240,80,80,.30)';
          ctx.fillRect(c * M.TILE + 2, r * M.TILE + 2, M.TILE - 4, M.TILE - 4);
          ctx.strokeStyle = ok ? 'rgba(160,255,180,.9)' : 'rgba(255,140,140,.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(c * M.TILE + 2, r * M.TILE + 2, M.TILE - 4, M.TILE - 4);
          ctx.globalAlpha = .5;
          ctx.setLineDash([7, 6]);
          ctx.strokeStyle = ok ? '#bfffd0' : '#ffb0b0';
          const rng = def.range * (1 + .018 * (slot.mon.lv - 1));
          ctx.beginPath(); ctx.arc(p.x, p.y, rng, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = .12;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(p.x, p.y, rng, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = .75;
          PTD.sprites.draw(ctx, def.dexId, p.x, p.y - 3, 54, this.time,
            { tint: PTD.TYPE_COLOR[def.types[0]] });
          ctx.restore();
        }
      }

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

      // แถบเป้าหมายของเควส
      if (this.mode === 'quest' && this.questTarget && !this.questTarget.dead) {
        const e = this.questTarget;
        const frac = clamp(e.hp / e.maxHp, 0, 1);
        const thr = this.quest.threshold;
        ctx.save();
        ctx.fillStyle = 'rgba(10,14,22,.82)';
        ctx.fillRect(M.W / 2 - 200, 12, 400, 34);
        ctx.fillStyle = '#2a3346';
        ctx.fillRect(M.W / 2 - 190, 30, 380, 10);
        ctx.fillStyle = frac <= thr ? '#5ddc7f' : '#e0556b';
        ctx.fillRect(M.W / 2 - 190, 30, 380 * frac, 10);
        ctx.fillStyle = '#ffe37a';
        ctx.fillRect(M.W / 2 - 190 + 380 * thr - 1, 27, 2, 16);
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#e8edf7'; ctx.textAlign = 'center';
        ctx.fillText(`${e.def.name} — กดเลือดให้ต่ำกว่าขีดเหลือง (${Math.round(frac * 100)}%)`, M.W / 2, 24);
        ctx.restore();
      }

      if (this.banner) {
        const a = clamp(this.banner.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.65)';
        ctx.strokeText(this.banner.text, M.W / 2, 72);
        ctx.fillStyle = this.banner.color;
        ctx.fillText(this.banner.text, M.W / 2, 72);
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

    /* ---------- เริ่มด่าน ---------- */
    enter(cfg) {
      this.mode = cfg.quest ? 'quest' : 'stage';
      this.stage = cfg.stage || null;
      this.quest = cfg.quest || null;

      const src = this.stage || this.quest;
      PTD.useMap(src.map, src.theme);

      this.waves = this.stage ? PTD.campaign.stageWaves(this.stage)
                              : PTD.campaign.questWaves(this.quest);
      this.time = 0; this.state = 'ready'; this.speed = 1; this.paused = false;
      // เงินตั้งต้นพอลงสนามได้ราว 1-2 ตัวเท่านั้น ที่เหลือต้องหาจากการฆ่า
      this.money = src.startMoney != null ? src.startMoney : 420;
      this.lives = this.stage ? this.stage.lives : 10;
      this.waveIndex = 0; this.waveTime = 0; this.breakLeft = 0;
      this.spawnQueue = []; this.enemies = []; this.towers = [];
      this.projectiles = []; this.fx = [];
      this.placing = null; this.selected = null; this.movingTower = null;
      this.megaUsed = false;
      this.questTarget = null; this.questBest = 1;
      this.result = null;
      this.expLevelCap = EXP_LEVELS_PER_STAGE;
      this.stats = { kills: 0, damage: 0, earned: 0, leaked: 0 };
      this.banner = null; this.shake = 0;

      // สำเนาข้อมูลทีมมาใช้ระหว่างด่าน ไม่แตะของจริงจนกว่าจะจบ
      this.roster = PTD.save.partyMons().map(m => ({
        mon: { uid: m.uid, id: m.id, lv: m.lv, exp: m.exp },
        placed: false, tower: null
      }));

      // โหลดสไปรท์ของทีมและศัตรูเวฟแรก ๆ ไว้ก่อน
      const warm = new Set(this.roster.map(s => s.mon.id));
      for (let i = 0; i < 3 && i < this.waves.length; i++)
        for (const g of this.waves[i].groups) warm.add(g.id);
      PTD.sprites.preload([...warm]);
    },

    /* ---------- อินพุต ---------- */
    click(x, y) {
      const { c, r } = M.tileOf(x, y);
      if (this.movingTower) { this.moveTo(c, r); return; }
      if (this.placing) { this.tryPlace(c, r); return; }
      this.selected = this.towerAt(c, r);
      PTD.ui.refresh();
    },
    move(x, y) { this.hover = M.tileOf(x, y); },

    key(k) {
      switch (k) {
        case ' ': this.paused = !this.paused; PTD.ui.refresh(); return true;
        case 'Escape':
          this.placing = null; this.movingTower = null; this.selected = null;
          PTD.ui.refresh(); return true;
        case 'v': case 'V': this.startMove(); return true;
        case 'Enter': if (this.state === 'ready' || this.state === 'break') this.startWave(); return true;
        case 'e': case 'E': this.evolveSelected(0); return true;
        case 'c': case 'C': this.buyCandy(); return true;
        case 'r': case 'R': this.recall(); return true;
        case 'm': case 'M': {
          const o = this.megaOptions(this.selected);
          if (o.length) this.doMega(o[0].form);
          return true;
        }
        case 'x': case 'X':
          this.speed = this.speed === 1 ? 2 : (this.speed === 2 ? 3 : 1);
          PTD.ui.refresh(); return true;
      }
      if (/^[1-6]$/.test(k)) {
        const slot = this.roster[parseInt(k, 10) - 1];
        if (slot && !slot.placed) { this.placing = slot.mon.uid; this.selected = null; PTD.ui.refresh(); }
        return true;
      }
      return false;
    }
  };

  PTD.battle = G;
  PTD.G = G;    // ชื่อเดิม เผื่อเครื่องมือทดสอบยังเรียกอยู่
})(window.PTD = window.PTD || {});
