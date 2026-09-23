/* =====================================================================
 * gen-pokedex.js — สร้าง js/dex.js จากข้อมูลจริงของ PokeAPI (ไฟล์ CSV)
 *
 *   node tools/gen-pokedex.js /path/to/csvdir
 *
 * ผลลัพธ์คือค่าสเตตัสจริง ชนิดธาตุจริง และสายวิวัฒนาการจริงของ Gen 1
 * ตัวเกมจะเอาค่าพวกนี้ไปแปลงเป็นค่าพลังในเกมอีกที (ดู js/derive.js)
 * ===================================================================== */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || '/tmp/claude-0/csv';

/* ---------- ตัวอ่าน CSV แบบรองรับ quote ---------- */
function readCSV(file) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length)
             .map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === '' || v == null) ? null : Number(v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- โหลดตาราง ---------- */
const species   = readCSV('pokemon_species.csv');
const pokemon   = readCSV('pokemon.csv');
const pStats    = readCSV('pokemon_stats.csv');
const pTypes    = readCSV('pokemon_types.csv');
const types     = readCSV('types.csv');
const evolution = readCSV('pokemon_evolution.csv');
const names     = readCSV('pokemon_species_names.csv');
const triggers  = readCSV('evolution_triggers.csv');

const typeName = new Map(types.map(t => [t.id, cap(t.identifier)]));
const trigName = new Map(triggers.map(t => [t.id, t.identifier]));

const STAT = { '1': 'hp', '2': 'atk', '3': 'def', '4': 'spa', '5': 'spd', '6': 'spe' };

// ขอบเขตของเกม: Gen 1-3 (Kanto 1-151, Johto 152-251, Hoenn 252-386)
const MAX_ID = 386;

/* ร่างเมก้า/ไพรมัลทางการของ Gen 1-3 รวม 43 ร่าง — ระบุ id ตรง ๆ เพราะ
 * PokeAPI มีร่างที่แฟนทำปนมาด้วยตั้งแต่ id 10278 ขึ้นไป
 * (Clefable, Victreebel, Starmie, Dragonite, Meganium, Feraligatr, Skarmory)
 * ซึ่งไม่ใช่ของ Game Freak จึงต้องกรองด้วยรายการที่กำหนดไว้ชัดเจน */
const OFFICIAL_MEGA = new Set([
  // Gen 1 — 15 ร่าง
  '10033', '10034', '10035', '10036', '10037', '10038', '10039',
  '10040', '10041', '10042', '10043', '10044', '10071', '10073', '10090',
  // Gen 2 — 6 ร่าง
  '10045', '10046', '10047', '10048', '10049', '10072',
  // Gen 3 — 22 ร่าง (รวมไพรมัลของ Kyogre กับ Groudon)
  '10050', '10051', '10052', '10053', '10054', '10055', '10056', '10057',
  '10062', '10063', '10064', '10065', '10066', '10067', '10070', '10074',
  '10076', '10077', '10078', '10079', '10087', '10089'
]);
// ชื่อหินเมก้าประจำแต่ละสายพันธุ์
const STONE = {
  // Kanto
  3: 'Venusaurite', 6: 'Charizardite', 9: 'Blastoisinite', 15: 'Beedrillite',
  18: 'Pidgeotite', 65: 'Alakazite', 80: 'Slowbronite', 94: 'Gengarite',
  115: 'Kangaskhanite', 127: 'Pinsirite', 130: 'Gyaradosite',
  142: 'Aerodactylite', 150: 'Mewtwonite',
  // Johto
  181: 'Ampharosite', 208: 'Steelixite', 212: 'Scizorite',
  214: 'Heracronite', 229: 'Houndoominite', 248: 'Tyranitarite',
  // Hoenn
  254: 'Sceptilite', 257: 'Blazikenite', 260: 'Swampertite',
  282: 'Gardevoirite', 302: 'Sablenite', 303: 'Mawilite', 306: 'Aggronite',
  308: 'Medichamite', 310: 'Manectite', 319: 'Sharpedonite',
  323: 'Cameruptite', 334: 'Altarianite', 354: 'Banettite', 359: 'Absolite',
  362: 'Glalitite', 373: 'Salamencite', 376: 'Metagrossite',
  380: 'Latiasite', 381: 'Latiosite', 384: 'Rayquazite',
  // ไพรมัลไม่ได้ใช้หินเมก้า แต่ใช้กลไกเดียวกันในเกมนี้
  382: 'Blue Orb', 383: 'Red Orb'
};

/* ---------- เก็บ Gen 1-3 (species id 1-386) ---------- */
const gen1 = species.filter(s => Number(s.id) <= MAX_ID);

// id ของ pokemon (ฟอร์มหลัก) ตรงกับ species id สำหรับ Gen 1
const defaultPokemon = new Map();
for (const p of pokemon) {
  if (p.is_default === '1' && Number(p.species_id) <= MAX_ID) defaultPokemon.set(p.species_id, p);
}

const statsBy = new Map();
for (const r of pStats) {
  const key = r.pokemon_id;
  if (Number(key) > MAX_ID && !OFFICIAL_MEGA.has(key)) continue;
  const slot = STAT[r.stat_id];
  if (!slot) continue;
  if (!statsBy.has(key)) statsBy.set(key, {});
  statsBy.get(key)[slot] = Number(r.base_stat);
}

const typesBy = new Map();
for (const r of pTypes) {
  if (Number(r.pokemon_id) > MAX_ID && !OFFICIAL_MEGA.has(r.pokemon_id)) continue;
  if (!typesBy.has(r.pokemon_id)) typesBy.set(r.pokemon_id, []);
  typesBy.get(r.pokemon_id)[Number(r.slot) - 1] = typeName.get(r.type_id);
}

// ชื่อญี่ปุ่นแบบโรมาจิ (local_language_id = 2)
const roomaji = new Map();
for (const r of names) if (r.local_language_id === '2') roomaji.set(r.pokemon_species_id, r.name);

// เงื่อนไขวิวัฒนาการ — เอาแถวแรกของแต่ละร่างที่วิวัฒน์ไป
const evoBy = new Map();
for (const r of evolution) {
  if (Number(r.evolved_species_id) > MAX_ID) continue;
  if (evoBy.has(r.evolved_species_id)) continue;
  evoBy.set(r.evolved_species_id, {
    trigger: trigName.get(r.evolution_trigger_id) || 'level-up',
    minLevel: num(r.minimum_level),
    item: !!r.trigger_item_id
  });
}

/* ---------- ประกอบผลลัพธ์ ---------- */
const dex = [];
for (const s of gen1) {
  const id = s.id;
  // ร่างก่อนหน้าที่อยู่นอกขอบเขต ไม่นับ — ตัวนั้นจะกลายเป็นร่างเริ่มต้นที่ซื้อได้
  const fromRaw = num(s.evolves_from_species_id);
  const from = (fromRaw && fromRaw <= MAX_ID) ? fromRaw : null;
  const st = statsBy.get(id);
  const ty = (typesBy.get(id) || []).filter(Boolean);
  if (!st || !ty.length) { console.warn('ข้ามตัวที่ข้อมูลไม่ครบ:', s.identifier); continue; }
  const bst = st.hp + st.atk + st.def + st.spa + st.spd + st.spe;
  dex.push({
    id: Number(id),
    capture: Number(s.capture_rate),
    habitat: Number(s.habitat_id || 0),
    name: cap(s.identifier).replace(/-m$/, '♂').replace(/-f$/, '♀'),
    jp: roomaji.get(id) || '',
    types: ty,
    stats: st,
    bst,
    from,
    legendary: s.is_legendary === '1' || s.is_mythical === '1',
    evo: evoBy.get(id) || null
  });
}
dex.sort((a, b) => a.id - b.id);

// ต่อสายวิวัฒนาการขาไป
const byId = new Map(dex.map(d => [d.id, d]));
for (const d of dex) d.to = [];
for (const d of dex) if (d.from && byId.has(d.from)) byId.get(d.from).to.push(d.id);

/* ---------- เขียนไฟล์ ---------- */
const lines = dex.map(d => {
  const e = d.evo;
  const evoStr = e ? `{t:'${e.trigger}'${e.minLevel ? ',lv:' + e.minLevel : ''}}` : 'null';
  return `  {id:${d.id},n:'${d.name}',jp:'${d.jp}',t:[${d.types.map(x => `'${x}'`).join(',')}],` +
         `s:[${d.stats.hp},${d.stats.atk},${d.stats.def},${d.stats.spa},${d.stats.spd},${d.stats.spe}],` +
         `bst:${d.bst},from:${d.from || 0},to:[${d.to.join(',')}],lg:${d.legendary ? 1 : 0},` +
         `cr:${d.capture},hb:${d.habitat},evo:${evoStr}}`;
});

/* ---------- ร่างเมก้า ---------- */
const megas = [];
for (const p of pokemon) {
  if (!OFFICIAL_MEGA.has(p.id)) continue;
  const st = statsBy.get(p.id);
  const ty = (typesBy.get(p.id) || []).filter(Boolean);
  if (!st || !ty.length) { console.warn('ร่างเมก้าข้อมูลไม่ครบ:', p.identifier); continue; }
  const sp = Number(p.species_id);
  // charizard-mega-x -> 'X', mewtwo-mega-y -> 'Y', venusaur-mega -> ''
  const m = p.identifier.match(/-mega(?:-([xy]))?$/);
  const variant = m && m[1] ? m[1].toUpperCase() : '';
  const base = byId.get(sp);
  megas.push({
    form: Number(p.id),
    of: sp,
    name: 'Mega ' + (base ? base.name : cap(p.identifier)) + (variant ? ' ' + variant : ''),
    variant,
    types: ty,
    stats: st,
    bst: st.hp + st.atk + st.def + st.spa + st.spd + st.spe,
    stone: STONE[sp] || 'Mega Stone'
  });
}
megas.sort((a, b) => a.of - b.of || a.variant.localeCompare(b.variant));

const megaLines = megas.map(m =>
  `  {form:${m.form},of:${m.of},n:'${m.name}',v:'${m.variant}',` +
  `t:[${m.types.map(x => `'${x}'`).join(',')}],` +
  `s:[${m.stats.hp},${m.stats.atk},${m.stats.def},${m.stats.spa},${m.stats.spd},${m.stats.spe}],` +
  `bst:${m.bst},stone:'${m.stone}'}`);

const out = `/* =====================================================================
 * dex.js — โปเกม่อน Gen 1-3 ครบ 386 ตัว (สร้างอัตโนมัติ ห้ามแก้มือ)
 *   Kanto 1-151 · Johto 152-251 · Hoenn 252-386
 *
 * สร้างโดย tools/gen-pokedex.js จากไฟล์ CSV ของโปรเจกต์ PokeAPI
 * https://github.com/PokeAPI/pokeapi (data/v2/csv)
 *
 * ฟิลด์: n=ชื่อ jp=โรมาจิ t=ธาตุ s=[HP,Atk,Def,SpA,SpD,Spe]
 *        bst=ผลรวมสเตตัส from=ร่างก่อนหน้า to=ร่างถัดไป lg=ในตำนาน
 *        evo={t:เงื่อนไข, lv:เลเวลขั้นต่ำ}
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const DEX = [
${lines.join(',\n')}
  ];

  /* ร่างเมก้า: form=id ของสไปรท์, of=สายพันธุ์เจ้าของ, v=รุ่น X/Y, stone=ชื่อหิน */
  const MEGA = [
${megaLines.join(',\n')}
  ];

  const BY_ID = new Map(DEX.map(d => [d.id, d]));
  const MEGA_BY_SPECIES = new Map();
  for (const m of MEGA) {
    if (!MEGA_BY_SPECIES.has(m.of)) MEGA_BY_SPECIES.set(m.of, []);
    MEGA_BY_SPECIES.get(m.of).push(m);
  }

  PTD.DEX = DEX;
  PTD.MEGA = MEGA;
  PTD.dex = (id) => BY_ID.get(id);
  // คืนรายชื่อร่างเมก้าของสายพันธุ์นั้น (Charizard กับ Mewtwo มีสองร่าง)
  PTD.megasOf = (speciesId) => MEGA_BY_SPECIES.get(speciesId) || [];
  PTD.hasMega = (speciesId) => MEGA_BY_SPECIES.has(speciesId);
  PTD.MEGA_SPECIES = [...MEGA_BY_SPECIES.keys()];
  // ร่างเริ่มต้นของสาย = ตัวที่ไม่มีร่างก่อนหน้า
  PTD.BASE_FORMS = DEX.filter(d => !d.from).map(d => d.id);
  // ไล่สายวิวัฒนาการจาก id ที่ให้มาไปจนสุด (เลือกกิ่งแรกเสมอ)
  PTD.line = function (id) {
    const out = [];
    let cur = BY_ID.get(id);
    while (cur) { out.push(cur.id); cur = cur.to.length ? BY_ID.get(cur.to[0]) : null; }
    return out;
  };
})(window.PTD = window.PTD || {});
`;

fs.writeFileSync(path.join(__dirname, '..', 'js', 'dex.js'), out);

/* ---------- รายงาน ---------- */
console.log('เขียน js/dex.js แล้ว:', dex.length, 'ตัว +', megas.length, 'ร่างเมก้า');
console.log('เมก้า:', megas.map(m => m.name).join(', '));
const habCount = {};
for (const d of dex) habCount[d.habitat] = (habCount[d.habitat] || 0) + 1;
console.log('จำนวนตามถิ่นอาศัย:', JSON.stringify(habCount));
console.log('ร่างเริ่มต้น (ซื้อได้):', dex.filter(d => !d.from).length);
console.log('ในตำนาน:', dex.filter(d => d.legendary).map(d => d.name).join(', '));
console.log('สายที่แตกกิ่ง:', dex.filter(d => d.to.length > 1)
  .map(d => d.name + ' -> ' + d.to.map(i => byId.get(i).name).join('/')).join('  |  '));
const trig = {};
for (const d of dex) if (d.evo) trig[d.evo.trigger] = (trig[d.evo.trigger] || 0) + 1;
console.log('เงื่อนไขวิวัฒนาการ:', JSON.stringify(trig));
console.log('BST ต่ำสุด/สูงสุด:',
  dex.reduce((a, b) => a.bst < b.bst ? a : b).name, Math.min(...dex.map(d => d.bst)), '/',
  dex.reduce((a, b) => a.bst > b.bst ? a : b).name, Math.max(...dex.map(d => d.bst)));
