/* =====================================================================
 * pokedex.js — ข้อมูลโปเกม่อนทั้งหมด
 *   TOWERS  : ตัวที่เราวางได้ (มีสายวิวัฒนาการ)
 *   ENEMIES : ตัวที่เดินมาตามเส้นทาง
 *
 * หน่วย: range = พิกเซล, rate = จำนวนครั้งต่อวินาที, speed = พิกเซล/วินาที
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const S = (o) => o; // ตัวช่วยอ่านง่าย ๆ เฉย ๆ

  /* =================== ป้อม (โปเกม่อนของผู้เล่น) =================== */
  const TOWERS = {
    /* ----- สายไฟ : ดาเมจเดี่ยวแรง + ติดไฟ ----- */
    charmander: {
      name: 'Charmander', th: 'ฮิโตคาเงะ', types: ['Fire'], moveType: 'Fire',
      cost: 180, dmg: 16, range: 108, rate: 1.15, attack: 'bolt', projSpeed: 340,
      effect: { kind: 'burn', chance: .35, dur: 2.5, dps: 6 },
      move: 'Ember', desc: 'ยิงลูกไฟใส่เป้าเดียว มีโอกาสทำให้ไหม้',
      evolveTo: 'charmeleon', evolveLv: 4, evolveCost: 260,
      sprite: S({ body: 'round', pal: ['#f0803a', '#c85018', '#ffd9a0', '#ff9a2e'], ears: 'pointy',
        tail: 'flame', back: 'none', eyes: 'normal', mouth: 'fang', arms: 2, legs: 1, extra: 'none', phase: 0 })
    },
    charmeleon: {
      name: 'Charmeleon', th: 'ลิซาร์โด', types: ['Fire'], moveType: 'Fire',
      cost: 0, dmg: 34, range: 124, rate: 1.3, attack: 'bolt', projSpeed: 380,
      effect: { kind: 'burn', chance: .5, dur: 3, dps: 14 },
      move: 'Flamethrower', desc: 'ลูกไฟแรงขึ้น โอกาสไหม้สูงขึ้น',
      evolveTo: 'charizard', evolveLv: 9, evolveCost: 520,
      sprite: S({ body: 'tall', pal: ['#e05a2a', '#a83c14', '#ffcf94', '#ff9a2e'], ears: 'pointy',
        tail: 'flame', back: 'none', eyes: 'angry', mouth: 'fang', arms: 2, legs: 1, extra: 'horn', phase: 1 })
    },
    charizard: {
      name: 'Charizard', th: 'ลิซาร์ดอน', types: ['Fire', 'Flying'], moveType: 'Fire',
      cost: 0, dmg: 62, range: 150, rate: 1.5, attack: 'splash', splash: 44, projSpeed: 430,
      effect: { kind: 'burn', chance: .7, dur: 3.5, dps: 30 },
      move: 'Fire Blast', desc: 'ลูกไฟระเบิดเป็นวงกว้าง เผาทุกตัวที่โดน',
      evolveTo: null,
      sprite: S({ body: 'bulky', pal: ['#f0742e', '#b04a16', '#ffe0a8', '#e8963c'], ears: 'pointy',
        tail: 'flame', back: 'bigwings', wingCol: '#3f8fa0', eyes: 'angry', mouth: 'fang', arms: 2, legs: 1, extra: 'horn', scale: 1.14, phase: 2 })
    },

    /* ----- สายน้ำ : ยิงกระจาย ----- */
    squirtle: {
      name: 'Squirtle', th: 'เซนิงาเมะ', types: ['Water'], moveType: 'Water',
      cost: 170, dmg: 13, range: 116, rate: 1.1, attack: 'splash', splash: 30, projSpeed: 300,
      move: 'Water Gun', desc: 'พ่นน้ำ โดนหลายตัวในวงเล็ก ๆ',
      evolveTo: 'wartortle', evolveLv: 4, evolveCost: 250,
      sprite: S({ body: 'round', pal: ['#6fb8e8', '#3a7ab8', '#ffeec4', '#b0742e'], ears: 'none',
        tail: 'curl', back: 'shell', eyes: 'normal', mouth: 'smile', arms: 2, legs: 1, extra: 'none', phase: .5 })
    },
    wartortle: {
      name: 'Wartortle', th: 'คาเมล', types: ['Water'], moveType: 'Water',
      cost: 0, dmg: 27, range: 132, rate: 1.25, attack: 'splash', splash: 40, projSpeed: 340,
      effect: { kind: 'slow', chance: .3, dur: 1.4, power: .3 },
      move: 'Bubble Beam', desc: 'ฟองน้ำแรงดันสูง มีโอกาสทำให้ช้าลง',
      evolveTo: 'blastoise', evolveLv: 9, evolveCost: 500,
      sprite: S({ body: 'tall', pal: ['#5aa8e0', '#2f6aa8', '#ffeec4', '#a8682a'], ears: 'none',
        tail: 'fan', back: 'shell', eyes: 'normal', mouth: 'smile', arms: 2, legs: 1, extra: 'none', phase: 1.5 })
    },
    blastoise: {
      name: 'Blastoise', th: 'คาเม็กซ์', types: ['Water'], moveType: 'Water',
      cost: 0, dmg: 52, range: 156, rate: 1.35, attack: 'splash', splash: 58, projSpeed: 420,
      effect: { kind: 'slow', chance: .55, dur: 1.8, power: .4 },
      move: 'Hydro Pump', desc: 'ปืนใหญ่น้ำ ระเบิดวงใหญ่และหน่วงศัตรู',
      evolveTo: null,
      sprite: S({ body: 'bulky', pal: ['#4a94d8', '#27598f', '#ffeec4', '#9a5f24'], ears: 'none',
        tail: 'fan', back: 'shell', eyes: 'angry', mouth: 'flat', arms: 4, legs: 1, extra: 'none', scale: 1.12, phase: 2.5 })
    },

    /* ----- สายหญ้า : ชะลอ + พิษ ----- */
    bulbasaur: {
      name: 'Bulbasaur', th: 'ฟุชิงิดาเนะ', types: ['Grass', 'Poison'], moveType: 'Grass',
      cost: 160, dmg: 11, range: 120, rate: 1.0, attack: 'bolt', projSpeed: 300,
      effect: { kind: 'slow', chance: .8, dur: 1.6, power: .28 },
      move: 'Vine Whip', desc: 'เถาวัลย์รัดเป้าหมายให้เดินช้าลง',
      evolveTo: 'ivysaur', evolveLv: 4, evolveCost: 240,
      sprite: S({ body: 'blob', pal: ['#7fd1a8', '#3f8a68', '#e8ffd8', '#4e9a4e'], ears: 'none',
        tail: 'none', back: 'bulb', eyes: 'normal', mouth: 'smile', arms: 0, legs: 1, extra: 'none', phase: .8 })
    },
    ivysaur: {
      name: 'Ivysaur', th: 'ฟุชิงิโซว', types: ['Grass', 'Poison'], moveType: 'Grass',
      cost: 0, dmg: 22, range: 138, rate: 1.1, attack: 'bolt', projSpeed: 330,
      effect: { kind: 'slow', chance: 1, dur: 2, power: .38 },
      move: 'Razor Leaf', desc: 'ใบมีดหมุน หน่วงศัตรูทุกครั้งที่โดน',
      evolveTo: 'venusaur', evolveLv: 9, evolveCost: 480,
      sprite: S({ body: 'blob', pal: ['#6ec498', '#347a58', '#e8ffd8', '#e06a9a'], ears: 'none',
        tail: 'none', back: 'leaves', eyes: 'normal', mouth: 'smile', arms: 0, legs: 1, extra: 'none', scale: 1.06, phase: 1.8 })
    },
    venusaur: {
      name: 'Venusaur', th: 'ฟุชิงิบานะ', types: ['Grass', 'Poison'], moveType: 'Grass',
      cost: 0, dmg: 30, range: 160, rate: 1.4, attack: 'aura', splash: 160,
      effect: { kind: 'slowpoison', chance: 1, dur: 2.4, power: .45, dps: 26 },
      move: 'Petal Blizzard', desc: 'พายุกลีบดอกรอบตัว — หน่วง + ติดพิษทุกตัวในรัศมี',
      evolveTo: null,
      sprite: S({ body: 'bulky', pal: ['#5eb489', '#2d6b4c', '#e8ffd8', '#e8609a'], ears: 'none',
        tail: 'none', back: 'flower', eyes: 'angry', mouth: 'fang', arms: 0, legs: 1, extra: 'none', scale: 1.15, phase: 2.8 })
    },

    /* ----- สายไฟฟ้า : ฟ้าผ่าต่อเนื่อง ----- */
    pikachu: {
      name: 'Pikachu', th: 'ปิกาจู', types: ['Electric'], moveType: 'Electric',
      cost: 240, dmg: 14, range: 130, rate: 1.6, attack: 'chain', chains: 3, chainFalloff: .7,
      effect: { kind: 'stun', chance: .12, dur: .5 },
      move: 'Thunderbolt', desc: 'สายฟ้ากระโดดต่อได้ 3 ตัว มีโอกาสทำให้เป็นอัมพาต',
      evolveTo: 'raichu', evolveLv: 6, evolveCost: 520,
      sprite: S({ body: 'round', pal: ['#f8d84a', '#c9a520', '#fff3b8', '#f8d030'], ears: 'long',
        earTip: '#2a2320', tail: 'bolt', back: 'none', eyes: 'normal', mouth: 'smile',
        arms: 2, legs: 1, extra: 'cheek', phase: .2 })
    },
    raichu: {
      name: 'Raichu', th: 'ไรจู', types: ['Electric'], moveType: 'Electric',
      cost: 0, dmg: 33, range: 152, rate: 1.9, attack: 'chain', chains: 6, chainFalloff: .82,
      effect: { kind: 'stun', chance: .22, dur: .8 },
      move: 'Thunder', desc: 'สายฟ้าแตกแขนงได้ถึง 6 ตัว',
      evolveTo: null,
      sprite: S({ body: 'tall', pal: ['#f0a030', '#b86f14', '#fff0c8', '#f8d030'], ears: 'long',
        earTip: '#2a2320', tail: 'bolt', back: 'none', eyes: 'angry', mouth: 'fang',
        arms: 2, legs: 1, extra: 'cheek', scale: 1.08, phase: 1.2 })
    },

    /* ----- สายหิน : ตีช้าแต่หนักมาก + สะเทือน ----- */
    geodude: {
      name: 'Geodude', th: 'อิชิทสึบุเตะ', types: ['Rock', 'Ground'], moveType: 'Rock',
      cost: 150, dmg: 30, range: 96, rate: .55, attack: 'splash', splash: 34, projSpeed: 230,
      move: 'Rock Throw', desc: 'ขว้างหินก้อนโต ยิงช้าแต่เจ็บ',
      evolveTo: 'graveler', evolveLv: 4, evolveCost: 230,
      sprite: S({ body: 'rock', pal: ['#a89878', '#6f6250', '#c9bda4', '#8a7a5c'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'angry', mouth: 'flat', arms: 2, legs: 0, extra: 'none', phase: .4 })
    },
    graveler: {
      name: 'Graveler', th: 'โกโลนยะ', types: ['Rock', 'Ground'], moveType: 'Rock',
      cost: 0, dmg: 60, range: 108, rate: .62, attack: 'splash', splash: 48, projSpeed: 250,
      effect: { kind: 'stun', chance: .18, dur: .6 },
      move: 'Rock Slide', desc: 'หินถล่ม โอกาสทำให้ศัตรูหยุดชะงัก',
      evolveTo: 'golem', evolveLv: 9, evolveCost: 450,
      sprite: S({ body: 'rock', pal: ['#98876a', '#635744', '#bdb096', '#7a6b50'], ears: 'none',
        tail: 'none', back: 'spikes', eyes: 'angry', mouth: 'fang', arms: 4, legs: 0, extra: 'none', scale: 1.1, phase: 1.4 })
    },
    golem: {
      name: 'Golem', th: 'โกโลนยะ (ร่างสุดท้าย)', types: ['Rock', 'Ground'], moveType: 'Rock',
      cost: 0, dmg: 120, range: 124, rate: .68, attack: 'splash', splash: 68, projSpeed: 280,
      effect: { kind: 'stun', chance: .32, dur: .9 },
      move: 'Earthquake', desc: 'แผ่นดินไหว ดาเมจมหาศาลเป็นวงกว้าง',
      evolveTo: null,
      sprite: S({ body: 'rock', pal: ['#8a7a5e', '#55492f', '#c2a882', '#6b5c40'], ears: 'none',
        tail: 'none', back: 'spikes', eyes: 'angry', mouth: 'grin', arms: 4, legs: 1, extra: 'none', scale: 1.2, phase: 2.4 })
    },

    /* ----- สายพลังจิต : ระยะไกลมาก ----- */
    abra: {
      name: 'Abra', th: 'เคซี่', types: ['Psychic'], moveType: 'Psychic',
      cost: 210, dmg: 20, range: 186, rate: .8, attack: 'beam',
      move: 'Confusion', desc: 'ลำแสงจิตพุ่งทันที ระยะไกลมาก',
      evolveTo: 'kadabra', evolveLv: 4, evolveCost: 300,
      sprite: S({ body: 'round', pal: ['#e8c46a', '#a8893a', '#8a6a3a', '#f0e6d2'], ears: 'pointy',
        earTip: '#8a6a3a', tail: 'plain', back: 'none', eyes: 'closed', mouth: 'flat',
        arms: 2, legs: 1, extra: 'none', phase: .9 })
    },
    kadabra: {
      name: 'Kadabra', th: 'ยุงเกลอร์', types: ['Psychic'], moveType: 'Psychic',
      cost: 0, dmg: 42, range: 210, rate: .95, attack: 'beam',
      effect: { kind: 'slow', chance: .35, dur: 1.2, power: .25 },
      move: 'Psybeam', desc: 'ลำแสงจิตทะลุทะลวง ระยะไกลสุดในเกม',
      evolveTo: 'alakazam', evolveLv: 9, evolveCost: 580,
      sprite: S({ body: 'tall', pal: ['#e0b85a', '#a07c2e', '#7a5c30', '#f0e6d2'], ears: 'pointy',
        earTip: '#7a5c30', tail: 'plain', back: 'none', eyes: 'angry', mouth: 'flat',
        arms: 2, legs: 1, extra: 'moustache', phase: 1.9 })
    },
    alakazam: {
      name: 'Alakazam', th: 'ฟูดิน', types: ['Psychic'], moveType: 'Psychic',
      cost: 0, dmg: 88, range: 240, rate: 1.1, attack: 'beam', pierce: 3,
      effect: { kind: 'slow', chance: .6, dur: 1.6, power: .35 },
      move: 'Psychic', desc: 'ลำแสงทะลุศัตรูได้ถึง 3 ตัวในแนวเดียวกัน',
      evolveTo: null,
      sprite: S({ body: 'tall', pal: ['#d8ae4e', '#96721f', '#6f5228', '#f0e6d2'], ears: 'pointy',
        earTip: '#6f5228', tail: 'plain', back: 'none', eyes: 'glow', eyeGlow: '#ffe37a', mouth: 'flat',
        arms: 4, legs: 1, extra: 'moustache', scale: 1.1, phase: 2.9 })
    },

    /* ----- สายต่อสู้ : ระยะสั้นแต่ DPS โหด ----- */
    machop: {
      name: 'Machop', th: 'วันริกี้', types: ['Fighting'], moveType: 'Fighting',
      cost: 190, dmg: 18, range: 76, rate: 2.0, attack: 'melee',
      move: 'Karate Chop', desc: 'ตีประชิดรัวเร็ว ระยะสั้นมาก',
      evolveTo: 'machoke', evolveLv: 5, evolveCost: 280,
      sprite: S({ body: 'tall', pal: ['#98b8a8', '#5f8271', '#e0d0b8', '#c85a4a'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'angry', mouth: 'flat', arms: 2, legs: 1, extra: 'none', phase: .6 })
    },
    machoke: {
      name: 'Machoke', th: 'โกริกี้', types: ['Fighting'], moveType: 'Fighting',
      cost: 0, dmg: 38, range: 86, rate: 2.3, attack: 'melee',
      move: 'Cross Chop', desc: 'หมัดไขว้ ความเร็วสูงขึ้น',
      evolveTo: 'machamp', evolveLv: 10, evolveCost: 540,
      sprite: S({ body: 'bulky', pal: ['#88ae9c', '#4f7461', '#e0d0b8', '#c85a4a'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'angry', mouth: 'fang', arms: 2, legs: 1, extra: 'collar', scale: 1.08, phase: 1.6 })
    },
    machamp: {
      name: 'Machamp', th: 'ไครีคี้', types: ['Fighting'], moveType: 'Fighting',
      cost: 0, dmg: 74, range: 100, rate: 2.9, attack: 'melee', targets: 2,
      move: 'Dynamic Punch', desc: 'สี่แขนต่อยพร้อมกัน 2 เป้าหมาย DPS สูงสุดในเกม',
      evolveTo: null,
      sprite: S({ body: 'bulky', pal: ['#7aa490', '#436653', '#e0d0b8', '#c85a4a'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'angry', mouth: 'grin', arms: 4, legs: 1, extra: 'collar', scale: 1.18, phase: 2.6 })
    },

    /* ----- สายผี : ทะลุเกราะ โจมตีหลายเป้า ----- */
    gastly: {
      name: 'Gastly', th: 'โกส', types: ['Ghost', 'Poison'], moveType: 'Ghost',
      cost: 200, dmg: 15, range: 122, rate: 1.2, attack: 'bolt', projSpeed: 260, ignoreArmor: true,
      effect: { kind: 'poison', chance: .5, dur: 3, dps: 8 },
      move: 'Lick', desc: 'ทะลุเกราะทุกชนิด และวางยาพิษ',
      evolveTo: 'haunter', evolveLv: 5, evolveCost: 290,
      sprite: S({ body: 'ghost', pal: ['#8a6ab8', '#4f3a78', '#c9b8e8', '#b89ae0'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'glow', eyeGlow: '#ff6ba6', mouth: 'grin',
        arms: 0, legs: 0, extra: 'none', phase: 1.1 })
    },
    haunter: {
      name: 'Haunter', th: 'โกสต์', types: ['Ghost', 'Poison'], moveType: 'Ghost',
      cost: 0, dmg: 30, range: 140, rate: 1.4, attack: 'chain', chains: 3, chainFalloff: .85, ignoreArmor: true,
      effect: { kind: 'poison', chance: .7, dur: 3.5, dps: 18 },
      move: 'Shadow Punch', desc: 'หมัดเงากระโดดหาเหยื่อต่อเนื่อง',
      evolveTo: 'gengar', evolveLv: 10, evolveCost: 560,
      sprite: S({ body: 'ghost', pal: ['#7a5aa8', '#422f66', '#c0ace0', '#a88ad8'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'glow', eyeGlow: '#ff4d8d', mouth: 'grin',
        arms: 2, legs: 0, extra: 'none', scale: 1.06, phase: 2.1 })
    },
    gengar: {
      name: 'Gengar', th: 'เกนการ์', types: ['Ghost', 'Poison'], moveType: 'Ghost',
      cost: 0, dmg: 56, range: 158, rate: 1.7, attack: 'chain', chains: 5, chainFalloff: .9, ignoreArmor: true,
      effect: { kind: 'poison', chance: 1, dur: 4, dps: 40 },
      move: 'Shadow Ball', desc: 'ลูกบอลเงากระจายตัว วางยาพิษรุนแรงเสมอ',
      evolveTo: null,
      sprite: S({ body: 'blob', pal: ['#6a4a98', '#3a2758', '#b89ad8', '#e8609a'], ears: 'pointy',
        earTip: '#3a2758', tail: 'none', back: 'spikes', eyes: 'glow', eyeGlow: '#ff3d7f', mouth: 'grin',
        arms: 2, legs: 1, extra: 'none', scale: 1.1, phase: 3.1 })
    },

    /* ----- สายเหล็ก : ยิงถี่ ดาเมจน้อย ----- */
    magnemite: {
      name: 'Magnemite', th: 'โคอิล', types: ['Electric', 'Steel'], moveType: 'Electric',
      cost: 175, dmg: 8, range: 112, rate: 3.0, attack: 'bolt', projSpeed: 420,
      move: 'Thunder Shock', desc: 'ยิงถี่มาก เหมาะกับศัตรูฝูงใหญ่',
      evolveTo: 'magneton', evolveLv: 6, evolveCost: 380,
      sprite: S({ body: 'orb', pal: ['#c8d0dc', '#8a93a4', '#eef2f8', '#9aa4b8'], ears: 'none',
        tail: 'none', back: 'magnet', eyes: 'normal', mouth: 'none',
        arms: 0, legs: 0, extra: 'none', belly: false, phase: .3 })
    },
    magneton: {
      name: 'Magneton', th: 'เรียคอยล์', types: ['Electric', 'Steel'], moveType: 'Steel',
      cost: 0, dmg: 20, range: 130, rate: 3.6, attack: 'chain', chains: 3, chainFalloff: .75,
      move: 'Tri Attack', desc: 'สามหัวยิงพร้อมกัน สายฟ้าเหล็กกระโดดต่อ',
      evolveTo: null,
      sprite: S({ body: 'orb', pal: ['#b8c2d2', '#79839a', '#e6ecf5', '#9aa4b8'], ears: 'antenna',
        tail: 'none', back: 'magnet', eyes: 'angry', mouth: 'none',
        arms: 0, legs: 0, extra: 'none', belly: false, scale: 1.14, phase: 1.3 })
    },

    /* ----- สายมังกร : แพงสุด แต่แรงสุดท้ายเกม ----- */
    dratini: {
      name: 'Dratini', th: 'มินิริว', types: ['Dragon'], moveType: 'Dragon',
      cost: 420, dmg: 26, range: 134, rate: 1.0, attack: 'bolt', projSpeed: 360,
      move: 'Dragon Rage', desc: 'พลังมังกรบริสุทธิ์ แพงแต่คุ้มระยะยาว',
      evolveTo: 'dragonair', evolveLv: 6, evolveCost: 640,
      sprite: S({ body: 'serpent', pal: ['#8ec8e8', '#4e8ab0', '#eef6fb', '#f0e6d2'], ears: 'fin',
        tail: 'orb', back: 'none', eyes: 'normal', mouth: 'smile', arms: 0, legs: 0, extra: 'none', phase: 1.7 })
    },
    dragonair: {
      name: 'Dragonair', th: 'ฮาคุริว', types: ['Dragon'], moveType: 'Dragon',
      cost: 0, dmg: 58, range: 156, rate: 1.15, attack: 'bolt', projSpeed: 400,
      effect: { kind: 'slow', chance: .4, dur: 1.5, power: .3 },
      move: 'Dragon Pulse', desc: 'คลื่นมังกรพร้อมแรงกดดันที่ทำให้ศัตรูช้าลง',
      evolveTo: 'dragonite', evolveLv: 12, evolveCost: 880,
      sprite: S({ body: 'serpent', pal: ['#7ec0e4', '#3f7ea8', '#eef6fb', '#f0e6d2'], ears: 'fin',
        tail: 'orb', back: 'none', eyes: 'normal', mouth: 'smile', arms: 0, legs: 0,
        extra: 'gem', scale: 1.1, phase: 2.7 })
    },
    dragonite: {
      name: 'Dragonite', th: 'ไครริว', types: ['Dragon', 'Flying'], moveType: 'Dragon',
      cost: 0, dmg: 130, range: 176, rate: 1.3, attack: 'splash', splash: 54, projSpeed: 460,
      effect: { kind: 'burn', chance: .6, dur: 3, dps: 45 },
      move: 'Outrage', desc: 'อาละวาดมังกร ระเบิดใส่ทุกอย่างในรัศมี',
      evolveTo: null,
      sprite: S({ body: 'bulky', pal: ['#f0c85a', '#b8912a', '#ffeec4', '#e8a33d'], ears: 'antenna',
        tail: 'plain', back: 'bigwings', wingCol: '#f2e2bc', eyes: 'normal', mouth: 'fang',
        arms: 2, legs: 1, extra: 'none', scale: 1.2, phase: 3.3 })
    }
  };

  // รายการที่ซื้อได้จากร้าน (ร่างแรกของแต่ละสาย)
  const SHOP_ORDER = [
    'geodude', 'bulbasaur', 'squirtle', 'magnemite', 'charmander',
    'machop', 'gastly', 'abra', 'pikachu', 'dratini'
  ];

  /* =================== ศัตรู =================== */
  const ENEMIES = {
    rattata:  { name: 'Rattata',  types: ['Normal'], hp: 46, speed: 62, bounty: 8,
      sprite: { body: 'small', pal: ['#9a6ab0', '#6a4480', '#e8d8c0', '#f0e6d2'], ears: 'round',
        tail: 'plain', back: 'none', eyes: 'angry', mouth: 'fang', arms: 0, legs: 1, extra: 'none' } },
    pidgey:   { name: 'Pidgey',   types: ['Normal', 'Flying'], hp: 40, speed: 86, bounty: 9, flying: true,
      sprite: { body: 'round', pal: ['#c8a870', '#96794a', '#f0e0c0', '#e8a33d'], ears: 'none',
        tail: 'fan', back: 'wings', wingCol: '#8a6a3a', eyes: 'normal', mouth: 'beak', arms: 0, legs: 1, extra: 'crest' } },
    caterpie: { name: 'Caterpie', types: ['Bug'], hp: 58, speed: 50, bounty: 8,
      sprite: { body: 'blob', pal: ['#8ec848', '#5e8f28', '#e8ffd8', '#f8d030'], ears: 'antenna',
        tail: 'none', back: 'none', eyes: 'normal', mouth: 'smile', arms: 0, legs: 0, extra: 'none' } },
    weedle:   { name: 'Weedle',   types: ['Bug', 'Poison'], hp: 52, speed: 66, bounty: 9,
      sprite: { body: 'blob', pal: ['#e0c860', '#a89230', '#fff0c8', '#c85a4a'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'normal', mouth: 'flat', arms: 0, legs: 0, extra: 'horn' } },
    zubat:    { name: 'Zubat',    types: ['Poison', 'Flying'], hp: 62, speed: 100, bounty: 11, flying: true,
      sprite: { body: 'round', pal: ['#7ab0d8', '#4a7aa8', '#c090c8', '#9a6ab0' ], ears: 'pointy',
        earTip: '#6a4480', tail: 'none', back: 'wings', wingCol: '#6a4480', eyes: 'closed', mouth: 'fang',
        arms: 0, legs: 0, extra: 'none' } },
    ekans:    { name: 'Ekans',    types: ['Poison'], hp: 96, speed: 70, bounty: 13,
      sprite: { body: 'serpent', pal: ['#a060b8', '#6e3a86', '#f0d860', '#f0e6d2'], ears: 'none',
        tail: 'curl', back: 'none', eyes: 'angry', mouth: 'fang', arms: 0, legs: 0, extra: 'none' } },
    sandshrew:{ name: 'Sandshrew',types: ['Ground'], hp: 150, speed: 54, bounty: 16, armor: 4,
      sprite: { body: 'round', pal: ['#e8d088', '#b09a4a', '#fff0c8', '#c8a860'], ears: 'round',
        tail: 'plain', back: 'spikes', eyes: 'sleepy', mouth: 'flat', arms: 2, legs: 1, extra: 'none' } },
    psyduck:  { name: 'Psyduck',  types: ['Water'], hp: 130, speed: 64, bounty: 15,
      sprite: { body: 'tall', pal: ['#f8e070', '#c0a830', '#fff6d0', '#e8a33d'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'sleepy', mouth: 'beak', arms: 2, legs: 1, extra: 'none' } },
    growlithe:{ name: 'Growlithe',types: ['Fire'], hp: 168, speed: 92, bounty: 19,
      sprite: { body: 'round', pal: ['#f08030', '#b85818', '#f8e8c0', '#3a3230'], ears: 'pointy',
        earTip: '#3a3230', tail: 'fan', back: 'none', eyes: 'angry', mouth: 'fang',
        arms: 0, legs: 1, extra: 'none' } },
    poliwag:  { name: 'Poliwag',  types: ['Water'], hp: 190, speed: 74, bounty: 20,
      sprite: { body: 'round', pal: ['#68a8e0', '#3a72a8', '#f0f6ff', '#3a3230'], ears: 'none',
        tail: 'plain', back: 'none', eyes: 'normal', mouth: 'flat', arms: 0, legs: 1, extra: 'swirl' } },
    tentacool:{ name: 'Tentacool',types: ['Water', 'Poison'], hp: 230, speed: 68, bounty: 23,
      sprite: { body: 'round', pal: ['#64b8d8', '#3a80a0', '#d8f0ff', '#e04a6a'], ears: 'none',
        tail: 'none', back: 'tentacles', eyes: 'angry', mouth: 'none', arms: 0, legs: 0, extra: 'gem' } },
    voltorb:  { name: 'Voltorb',  types: ['Electric'], hp: 260, speed: 118, bounty: 25,
      sprite: { body: 'orb', pal: ['#e04a4a', '#a02828', '#eef2f8', '#ffffff'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'angry', mouth: 'none', arms: 0, legs: 0,
        extra: 'none', belly: false } },
    ponyta:   { name: 'Ponyta',   types: ['Fire'], hp: 300, speed: 126, bounty: 28,
      sprite: { body: 'tall', pal: ['#f8f0e0', '#c0b49c', '#fff8ec', '#ff9a2e'], ears: 'pointy',
        earTip: '#ff9a2e', tail: 'flame', back: 'spikes', eyes: 'angry', mouth: 'flat',
        arms: 0, legs: 1, extra: 'crest' } },
    machopE:  { name: 'Machop',   types: ['Fighting'], hp: 420, speed: 72, bounty: 32, armor: 8,
      sprite: { body: 'bulky', pal: ['#98b8a8', '#5f8271', '#e0d0b8', '#c85a4a'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'angry', mouth: 'flat', arms: 2, legs: 1, extra: 'none' } },
    haunterE: { name: 'Haunter',  types: ['Ghost', 'Poison'], hp: 380, speed: 96, bounty: 34, flying: true,
      sprite: { body: 'ghost', pal: ['#7a5aa8', '#422f66', '#c0ace0', '#a88ad8'], ears: 'none',
        tail: 'none', back: 'none', eyes: 'glow', eyeGlow: '#ff4d8d', mouth: 'grin',
        arms: 2, legs: 0, extra: 'none' } },
    onix:     { name: 'Onix',     types: ['Rock', 'Ground'], hp: 900, speed: 48, bounty: 55, armor: 18, scale: 1.3,
      sprite: { body: 'serpent', pal: ['#9aa0b0', '#666c80', '#b4bac8', '#7a8090'], ears: 'none',
        tail: 'none', back: 'spikes', eyes: 'angry', mouth: 'fang', arms: 0, legs: 0,
        extra: 'horn', scale: 1.25 } },
    magmar:   { name: 'Magmar',   types: ['Fire'], hp: 780, speed: 84, bounty: 48,
      sprite: { body: 'tall', pal: ['#e85a30', '#a83414', '#f8d030', '#ffd050'], ears: 'none',
        tail: 'flame', back: 'none', eyes: 'angry', mouth: 'beak', arms: 2, legs: 1, extra: 'crest' } },
    lapras:   { name: 'Lapras',   types: ['Water', 'Ice'], hp: 1400, speed: 56, bounty: 75, armor: 12, scale: 1.2,
      sprite: { body: 'bulky', pal: ['#68a8d8', '#3a729a', '#f0e8d0', '#a8c8e0'], ears: 'none',
        tail: 'none', back: 'shell', eyes: 'normal', mouth: 'smile', arms: 0, legs: 0,
        extra: 'horn', scale: 1.15 } },

    /* ---------- บอส ---------- */
    gyarados: { name: 'Gyarados', types: ['Water', 'Flying'], hp: 2600, speed: 74, bounty: 260,
      boss: true, armor: 20, scale: 1.5, glow: 'rgba(80,160,240,.55)',
      sprite: { body: 'serpent', pal: ['#4a8ad8', '#2a5a9a', '#f8e8b0', '#e0e8f0'], ears: 'fin',
        tail: 'fan', back: 'spikes', eyes: 'angry', mouth: 'grin', arms: 0, legs: 0,
        extra: 'crest', scale: 1.4 } },
    snorlax:  { name: 'Snorlax',  types: ['Normal'], hp: 7000, speed: 40, bounty: 340,
      boss: true, armor: 34, scale: 1.55, glow: 'rgba(120,150,180,.4)', regen: 18,
      sprite: { body: 'bulky', pal: ['#4e6a86', '#31465c', '#f0e0c0', '#2a3a4a'], ears: 'round',
        tail: 'none', back: 'none', eyes: 'closed', mouth: 'flat', arms: 2, legs: 1,
        extra: 'none', scale: 1.45 } },
    arcanine: { name: 'Arcanine', types: ['Fire'], hp: 6000, speed: 132, bounty: 320,
      boss: true, armor: 16, scale: 1.4, glow: 'rgba(240,120,40,.55)',
      sprite: { body: 'bulky', pal: ['#f08030', '#b05818', '#f8e8c8', '#3a3230'], ears: 'pointy',
        earTip: '#3a3230', tail: 'fan', back: 'none', eyes: 'angry', mouth: 'fang',
        arms: 0, legs: 1, extra: 'crest', scale: 1.35 } },
    articuno: { name: 'Articuno', types: ['Ice', 'Flying'], hp: 11000, speed: 92, bounty: 480,
      boss: true, armor: 26, scale: 1.5, flying: true, glow: 'rgba(120,220,240,.6)', aura: 'chill',
      sprite: { body: 'round', pal: ['#8fd8f0', '#4e9ec0', '#f0fbff', '#2a6ab0'], ears: 'none',
        tail: 'fan', back: 'bigwings', wingCol: '#3f86c8', eyes: 'angry', mouth: 'beak', arms: 0, legs: 1,
        extra: 'crest', scale: 1.4 } },
    zapdos:   { name: 'Zapdos',   types: ['Electric', 'Flying'], hp: 14000, speed: 120, bounty: 520,
      boss: true, armor: 22, scale: 1.5, flying: true, glow: 'rgba(250,215,60,.6)',
      sprite: { body: 'round', pal: ['#f8d84a', '#c0a020', '#fff3b8', '#3a3230'], ears: 'none',
        tail: 'bolt', back: 'bigwings', wingCol: '#3a3230', eyes: 'angry', mouth: 'beak', arms: 0, legs: 1,
        extra: 'crest', scale: 1.4 } },
    moltres:  { name: 'Moltres',  types: ['Fire', 'Flying'], hp: 16000, speed: 108, bounty: 560,
      boss: true, armor: 24, scale: 1.5, flying: true, glow: 'rgba(250,130,40,.65)',
      sprite: { body: 'round', pal: ['#f8a030', '#c06810', '#ffe0a0', '#ff5a2e'], ears: 'none',
        tail: 'flame', back: 'bigwings', wingCol: '#e04a2a', eyes: 'angry', mouth: 'beak', arms: 0, legs: 1,
        extra: 'crest', scale: 1.4 } },
    dragonite:{ name: 'Dragonite',types: ['Dragon', 'Flying'], hp: 12000, speed: 96, bounty: 700,
      boss: true, armor: 32, scale: 1.5, flying: true, glow: 'rgba(240,200,90,.6)', regen: 60,
      sprite: { body: 'bulky', pal: ['#f0c85a', '#b8912a', '#ffeec4', '#e8a33d'], ears: 'antenna',
        tail: 'plain', back: 'bigwings', wingCol: '#f2e2bc', eyes: 'angry', mouth: 'fang', arms: 2, legs: 1,
        extra: 'none', scale: 1.4 } },
    mewtwo:   { name: 'Mewtwo',   types: ['Psychic'], hp: 30000, speed: 88, bounty: 2000,
      boss: true, armor: 45, scale: 1.6, glow: 'rgba(230,120,200,.65)', regen: 140, aura: 'drain',
      sprite: { body: 'bulky', pal: ['#e0d8e8', '#a89ab8', '#c088c8', '#7a4a9a'], ears: 'none',
        tail: 'plain', back: 'none', eyes: 'glow', eyeGlow: '#b84ae0', mouth: 'flat',
        arms: 2, legs: 1, extra: 'horn', scale: 1.5 } }
  };

  // เติม id เข้าไปในตัวข้อมูลเองเพื่อความสะดวก
  for (const k in TOWERS) { TOWERS[k].id = k; TOWERS[k].sprite.phase = TOWERS[k].sprite.phase || 0; }
  for (const k in ENEMIES) { ENEMIES[k].id = k; }

  PTD.TOWERS = TOWERS;
  PTD.ENEMIES = ENEMIES;
  PTD.SHOP_ORDER = SHOP_ORDER;

  // สายวิวัฒนาการของแต่ละร่างแรก (ใช้แสดงในการ์ด)
  PTD.evoLine = function (id) {
    const line = [];
    let cur = id;
    while (cur && TOWERS[cur]) { line.push(cur); cur = TOWERS[cur].evolveTo; }
    return line;
  };
})(window.PTD = window.PTD || {});
