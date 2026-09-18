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

const MEGA_IDS = [10033, 10034, 10035, 10036, 10037, 10038, 10039,
                  10040, 10041, 10042, 10043, 10044, 10071, 10073, 10090];

/* ---------- เตรียมโฟลเดอร์ ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'sprites'), { recursive: true });

/* ---------- 1. รวม CSS กับ JS เข้าไปในหน้าเดียว ---------- */
let html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');

const css = fs.readFileSync(path.join(REPO, 'css/style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">',
  '<style>\n' + css + '\n</style>');

// เก็บลำดับสคริปต์ตามที่ index.html กำหนดไว้ ลำดับสำคัญมาก
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
if (scripts.length < 10) throw new Error('หาสคริปต์ไม่ครบ เจอแค่ ' + scripts.length);

// ตั้งค่าให้ชี้ไปสไปรท์ที่แนบมา ต้องมาก่อน sprites.js
const bootstrap = `<script>
// สไปรท์ถูกแนบมากับหน้านี้ทั้งหมด ไม่ต้องพึ่งอินเทอร์เน็ตภายนอก
window.PTD_SPRITE_BASE = 'sprites';
window.PTD_ANIM_PACK = { b64: 'sprites/anim.b64.txt', idx: 'sprites/anim.json' };
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

/* ---------- 3. คัดลอกภาพนิ่ง ---------- */
let stills = 0;
for (const id of [...Array(151).keys()].map(i => i + 1).concat(MEGA_IDS)) {
  const src = path.join(SRC, `${id}.png`);
  if (!fs.existsSync(src)) { console.warn('ไม่มีภาพนิ่ง:', id); continue; }
  fs.copyFileSync(src, path.join(DIST, 'sprites', `${id}.png`));
  stills++;
}

/* ---------- 4. แพ็ก GIF เคลื่อนไหวเป็นไฟล์เดียว ---------- */
// แนบไฟล์ได้จำกัดจำนวน จะแนบ GIF ทีละไฟล์ไม่ได้ เลยต่อกันแล้วทำดัชนีไว้
const chunks = [];
const index = {};
let offset = 0, anims = 0;
for (let id = 1; id <= 151; id++) {
  const src = path.join(ANIM_DIR, `${id}.gif`);
  if (!fs.existsSync(src)) { console.warn('ไม่มี GIF:', id); continue; }
  const buf = fs.readFileSync(src);
  chunks.push(buf);
  index[id] = [offset, buf.length];
  offset += buf.length;
  anims++;
}
const packed = Buffer.concat(chunks);
fs.writeFileSync(path.join(DIST, 'sprites', 'anim.b64.txt'), packed.toString('base64'));
fs.writeFileSync(path.join(DIST, 'sprites', 'anim.json'), JSON.stringify(index));

fs.writeFileSync(path.join(DIST, 'index.html'), html);

/* ---------- รายงาน ---------- */
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
let spriteBytes = 0;
for (const f of fs.readdirSync(path.join(DIST, 'sprites')))
  spriteBytes += fs.statSync(path.join(DIST, 'sprites', f)).size;

console.log('สร้าง dist/ เรียบร้อย');
console.log('  index.html      ', kb(Buffer.byteLength(html)), `(รวม ${scripts.length} สคริปต์ + CSS)`);
console.log('  ภาพนิ่ง          ', stills, 'ไฟล์');
console.log('  GIF ในแพ็ก      ', anims, 'ตัว,', mb(offset), '-> base64', mb(Math.ceil(offset * 4 / 3)));
console.log('  รวมโฟลเดอร์รูป  ', mb(spriteBytes));
console.log('  จำนวนไฟล์ทั้งหมด', 1 + stills + 2, '(ขีดจำกัด 255)');
