/* =====================================================================
 * gen-pokedex.js — สร้าง js/gen1.js จากข้อมูลจริงของ PokeAPI (ไฟล์ CSV)
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

/* ---------- เก็บเฉพาะ Gen 1 (species id 1-151) ---------- */
const gen1 = species.filter(s => Number(s.id) <= 151 && s.generation_id === '1');

// id ของ pokemon (ฟอร์มหลัก) ตรงกับ species id สำหรับ Gen 1
const defaultPokemon = new Map();
for (const p of pokemon) {
  if (p.is_default === '1' && Number(p.species_id) <= 151) defaultPokemon.set(p.species_id, p);
}

const statsBy = new Map();
for (const r of pStats) {
  const key = r.pokemon_id;
  if (Number(key) > 151) continue;
  const slot = STAT[r.stat_id];
  if (!slot) continue;
  if (!statsBy.has(key)) statsBy.set(key, {});
  statsBy.get(key)[slot] = Number(r.base_stat);
}

const typesBy = new Map();
for (const r of pTypes) {
  if (Number(r.pokemon_id) > 151) continue;
  if (!typesBy.has(r.pokemon_id)) typesBy.set(r.pokemon_id, []);
  typesBy.get(r.pokemon_id)[Number(r.slot) - 1] = typeName.get(r.type_id);
}

// ชื่อญี่ปุ่นแบบโรมาจิ (local_language_id = 2)
const roomaji = new Map();
for (const r of names) if (r.local_language_id === '2') roomaji.set(r.pokemon_species_id, r.name);

// เงื่อนไขวิวัฒนาการ — เอาแถวแรกของแต่ละร่างที่วิวัฒน์ไป
const evoBy = new Map();
for (const r of evolution) {
  if (Number(r.evolved_species_id) > 151) continue;
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
  // ร่างก่อนหน้าที่อยู่นอก Gen 1 (เช่น Pichu -> Pikachu) ไม่นับ
  // ไม่งั้น Pikachu, Jigglypuff, Snorlax ฯลฯ จะซื้อไม่ได้เลย
  const fromRaw = num(s.evolves_from_species_id);
  const from = (fromRaw && fromRaw <= 151) ? fromRaw : null;
  const st = statsBy.get(id);
  const ty = (typesBy.get(id) || []).filter(Boolean);
  if (!st || !ty.length) { console.warn('ข้ามตัวที่ข้อมูลไม่ครบ:', s.identifier); continue; }
  const bst = st.hp + st.atk + st.def + st.spa + st.spd + st.spe;
  dex.push({
    id: Number(id),
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
         `bst:${d.bst},from:${d.from || 0},to:[${d.to.join(',')}],lg:${d.legendary ? 1 : 0},evo:${evoStr}}`;
});

const out = `/* =====================================================================
 * gen1.js — โปเกม่อน Gen 1 ครบ 151 ตัว (สร้างอัตโนมัติ ห้ามแก้มือ)
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

  const BY_ID = new Map(DEX.map(d => [d.id, d]));

  PTD.DEX = DEX;
  PTD.dex = (id) => BY_ID.get(id);
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

fs.writeFileSync(path.join(__dirname, '..', 'js', 'gen1.js'), out);

/* ---------- รายงาน ---------- */
console.log('เขียน js/gen1.js แล้ว:', dex.length, 'ตัว');
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
