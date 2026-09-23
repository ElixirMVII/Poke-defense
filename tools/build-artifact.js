/* =====================================================================
 * build-artifact.js — รวมเกมเป็นหน้าเว็บที่พึ่งพาตัวเองได้ 100%
 *
 * ทำไมต้องมี: หน้าเว็บที่เผยแพร่มี CSP ที่บล็อกรูปและ fetch จากโฮสต์ภายนอก
 * ทั้งหมด สไปรท์ที่ปกติโหลดจาก CDN จึงใช้ไม่ได้ ต้องแนบไปกับหน้าเว็บเอง
 *
 * ผลลัพธ์ใน dist/
 *   index.html          CSS + JS ทั้งหมดรวมอยู่ในไฟล์เดียว
 *   sprites/<id>.png    ภาพนิ่ง 166 รูป (151 ตัว + 15 ร่างเมก้า)
 *   sprites/anim.b64.txt GIF เคลื่อนไหวทั้งหมดต่อกันแล้วเข้ารหัส base64
 *                       (ที่เผยแพร่รับเฉพาะชนิดไฟล์มาตรฐานของเว็บ .bin จึงใช้ไม่ได้)
 *   sprites/anim.json   ดัชนีบอกตำแหน่งของแต่ละตัวในไฟล์ข้างบน
 *
 *   node tools/build-artifact.js [โฟลเดอร์สไปรท์]
 * ===================================================================== */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SRC = process.argv[2] || '/tmp/claude-0/sprites';
const DIST = path.join(REPO, 'dist');
const ANIM_DIR = path.join(SRC, 'versions/generation-v/black-white/animated');

// อ่าน id ร่างเมก้าจากข้อมูลที่สร้างไว้ จะได้ไม่ต้องตามแก้เวลาเพิ่มเจน
const DEX_SRC = fs.readFileSync(path.join(REPO, 'js/dex.js'), 'utf8');
const MEGA_IDS = [...DEX_SRC.matchAll(/form:(\d+)/g)].map(m => Number(m[1]));
const SPECIES_MAX = Math.max(...[...DEX_SRC.matchAll(/^  \{id:(\d+),/gm)].map(m => Number(m[1])));

/* ---------- เตรียมโฟลเดอร์ ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'sprites'), { recursive: true });

/* ---------- 1. รวม CSS กับ JS เข้าไปในหน้าเดียว ---------- */
let html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');

// ฟอนต์โฮสต์เอง: ย้าย url(../fonts/x.woff2) ให้ชี้ที่ fonts/ ข้าง ๆ index.html
const fontCss = fs.readFileSync(path.join(REPO, 'css/fonts.css'), 'utf8')
  .replace(/url\(\.\.\/fonts\//g, 'url(fonts/');
const css = fontCss + '\n' + fs.readFileSync(path.join(REPO, 'css/style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/fonts.css">', '');
html = html.replace('<link rel="stylesheet" href="css/style.css">',
  '<style>\n' + css + '\n</style>');

// เก็บลำดับสคริปต์ตามที่ index.html กำหนดไว้ ลำดับสำคัญมาก
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
if (scripts.length < 10) throw new Error('หาสคริปต์ไม่ครบ เจอแค่ ' + scripts.length);

// ตั้งค่าให้ชี้ไปสไปรท์ที่แนบมา ต้องมาก่อน sprites.js
const bootstrap = `<script>
// สไปรท์ถูกแนบมากับหน้านี้ทั้งหมด ไม่ต้องพึ่งอินเทอร์เน็ตภายนอก
window.PTD_SPRITE_BASE = 'sprites';
window.PTD_ANIM_PACK  = { idx: 'sprites/anim.json' };
window.PTD_STILL_PACK = { idx: 'sprites/still.json' };
</script>`;

const bundle = scripts.map(f =>
  `<!-- ===== ${f} ===== -->\n<script>\n${fs.readFileSync(path.join(REPO, f), 'utf8')}\n</script>`
).join('\n');

html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');
html = html.replace('</body>', bootstrap + '\n' + bundle + '\n</body>');

/* ---------- 2. ตัดโครง html/head/body ออก (หน้าเว็บที่เผยแพร่ใส่ให้เอง) ---------- */
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Poke Defense';
html = html
  .replace(/<!DOCTYPE[^>]*>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<head>[\s\S]*?<\/head>/i, '')      // เอา head เดิมออกทั้งก้อน
  .replace(/<body[^>]*>\s*/i, '')
  .replace(/<\/body>/i, '')
  .trim();

// ใส่ title กับ style กลับเข้าไปที่หัวไฟล์ตามที่หน้าเว็บที่เผยแพร่ต้องการ
html = `<title>${title}</title>\n<style>\n${css}\n</style>\n\n` + html;

/* ---------- ตัวช่วยแพ็กสไปรท์ ----------
 * ต่อไฟล์ทั้งหมดเข้าด้วยกันแล้วทำดัชนีบอกตำแหน่ง จากนั้นเข้ารหัส base64
 * แล้ว **หั่นเป็นชิ้น ๆ** เพราะที่เผยแพร่จำกัดขนาดไฟล์ละ 16 MB
 * ส่วน GIF ของ 386 ตัวรวมกัน 14 MB ซึ่ง base64 แล้วจะเป็น ~19 MB */
const CHUNK_BYTES = 6 * 1024 * 1024;     // base64 ต่อชิ้น เผื่อไว้จากขีดจำกัด 16 MB มาก ๆ

function packSprites(ids, srcOf, label) {
  const bufs = [];
  const index = {};
  let offset = 0, count = 0, missing = 0;
  for (const id of ids) {
    const src = srcOf(id);
    if (!fs.existsSync(src)) { missing++; continue; }
    const buf = fs.readFileSync(src);
    bufs.push(buf);
    index[id] = [offset, buf.length];
    offset += buf.length;
    count++;
  }
  if (missing) console.warn(`ไม่มี${label} ${missing} ไฟล์`);
  return { data: Buffer.concat(bufs), index, count, bytes: offset };
}

function writePack(name, pack) {
  const b64 = pack.data.toString('base64');
  const parts = [];
  for (let i = 0; i < b64.length; i += CHUNK_BYTES) {
    const file = `${name}.b64.${parts.length}.txt`;
    fs.writeFileSync(path.join(DIST, 'sprites', file), b64.slice(i, i + CHUNK_BYTES));
    parts.push('sprites/' + file);
  }
  fs.writeFileSync(path.join(DIST, 'sprites', `${name}.json`),
    JSON.stringify({ parts, index: pack.index }));
  pack.parts = parts;
  return pack;
}

/* ---------- 3. คัดลอกไฟล์ฟอนต์ ---------- */
fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
let fontFiles = 0;
for (const f of fs.readdirSync(path.join(REPO, 'fonts'))) {
  if (!f.endsWith('.woff2')) continue;
  fs.copyFileSync(path.join(REPO, 'fonts', f), path.join(DIST, 'fonts', f));
  fontFiles++;
}

/* ---------- 4. คัดลอกภาพนิ่ง ---------- */
let stills = 0;
/* ภาพนิ่งมี 386 ตัว + 43 ร่างเมก้า = 429 ไฟล์ เกินขีดจำกัด 255 ไฟล์ต่อหนึ่งชุด
 * แต่รวมกันแล้วแค่ ~340 KB จึงยัดเป็น data: URL ไว้ในไฟล์เดียวไปเลย
 * ข้อดีคือ stillURL() ยังคืนค่าแบบทันที ไม่ต้องแก้ทุกที่ที่เอาไปใส่ <img src>  */
const stillIds = [...Array(SPECIES_MAX).keys()].map(i => i + 1).concat(MEGA_IDS);
const stillMap = {};
let stillBytes = 0;
for (const id of stillIds) {
  const src = path.join(SRC, `${id}.png`);
  if (!fs.existsSync(src)) continue;
  const buf = fs.readFileSync(src);
  stillBytes += buf.length;
  stillMap[id] = 'data:image/png;base64,' + buf.toString('base64');
  stills++;
}
fs.writeFileSync(path.join(DIST, 'sprites', 'still.json'), JSON.stringify(stillMap));

/* ---------- 5. แพ็ก GIF เคลื่อนไหว ---------- */
const animPack = packSprites(
  [...Array(SPECIES_MAX).keys()].map(i => i + 1),
  (id) => path.join(ANIM_DIR, `${id}.gif`), 'GIF');
const anims = animPack.count;
const offset = animPack.bytes;
writePack('anim', animPack);

fs.writeFileSync(path.join(DIST, 'index.html'), html);

/* ---------- รายงาน ---------- */
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
let spriteBytes = 0;
for (const f of fs.readdirSync(path.join(DIST, 'sprites')))
  spriteBytes += fs.statSync(path.join(DIST, 'sprites', f)).size;

console.log('สร้าง dist/ เรียบร้อย');
console.log('  index.html      ', kb(Buffer.byteLength(html)),
  `(รวม ${scripts.length} สคริปต์ + CSS + ประกาศฟอนต์)`);
console.log('  ฟอนต์            ', fontFiles, 'ไฟล์');
console.log('  ภาพนิ่ง (data URL)', stills, 'ตัว,', mb(stillBytes),
  '-> still.json', mb(fs.statSync(path.join(DIST, 'sprites', 'still.json')).size));
console.log('  GIF ในแพ็ก      ', anims, 'ตัว,', mb(offset),
  `-> ${animPack.parts.length} ชิ้น`);
console.log('  รวมโฟลเดอร์รูป  ', mb(spriteBytes));
const fileCount = fs.readdirSync(path.join(DIST, 'sprites')).length + fontFiles + 1;
console.log('  จำนวนไฟล์ทั้งหมด', fileCount, '(ขีดจำกัด 255)');
const biggest = Math.max(...fs.readdirSync(path.join(DIST, 'sprites'))
  .map(f => fs.statSync(path.join(DIST, 'sprites', f)).size));
console.log('  ไฟล์ใหญ่สุด      ', mb(biggest), '(ขีดจำกัด 16 MB)');
