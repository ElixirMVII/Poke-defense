/* =====================================================================
 * sprites.js — เครื่องวาดตัวโปเกม่อนแบบพารามิเตอร์
 *
 * ทุกตัวถูกประกอบจากชิ้นส่วน (ลำตัว/หัว/หู/หาง/ปีก/ตา/ปาก/แขน/ขา)
 * วาดในพิกัดท้องถิ่นขนาด 32x32 หน่วย จุดกำเนิดอยู่กลางตัว เท้าอยู่ราว y=+14
 * แล้วค่อย scale ออกไปตามขนาดที่ต้องการ
 * ===================================================================== */
(function (PTD) {
  'use strict';

  const TAU = Math.PI * 2;

  /* ---------- ตัวช่วยวาดพื้นฐาน ---------- */
  function ell(ctx, x, y, rx, ry, fill, stroke, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  // ทำสีให้เข้ม/สว่างขึ้น (รับ #rrggbb)
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  PTD.shade = shade;

  /* ---------- ข้อมูลรูปทรงลำตัว ---------- */
  // คืนค่า { bodyPath(), head:{x,y,r}, cx, cy } เพื่อให้ชิ้นอื่นวางตำแหน่งได้ถูก
  function bodyGeom(kind) {
    switch (kind) {
      case 'round':   return { rx: 8.5, ry: 8.5, cy: 3,  head: { x: 0, y: -7, r: 7 } };
      case 'blob':    return { rx: 10,  ry: 7.5, cy: 5,  head: { x: 0, y: -4, r: 7.5 } };
      case 'tall':    return { rx: 7,   ry: 10,  cy: 2,  head: { x: 0, y: -8, r: 6.5 } };
      case 'bulky':   return { rx: 10.5,ry: 9,   cy: 3,  head: { x: 0, y: -8, r: 7 } };
      case 'serpent': return { rx: 6,   ry: 9,   cy: 4,  head: { x: 0, y: -8, r: 6 } };
      case 'ghost':   return { rx: 9,   ry: 9,   cy: 2,  head: { x: 0, y: -1, r: 9 } };
      case 'rock':    return { rx: 9.5, ry: 8,   cy: 4,  head: { x: 0, y: 1,  r: 8.5 } };
      case 'orb':     return { rx: 7.5, ry: 7.5, cy: 0,  head: { x: 0, y: 0,  r: 7.5 } };
      case 'small':   return { rx: 6.5, ry: 6,   cy: 6,  head: { x: 0, y: -2, r: 5.5 } };
      default:        return { rx: 8.5, ry: 8.5, cy: 3,  head: { x: 0, y: -7, r: 7 } };
    }
  }

  /* ---------- ชิ้นส่วน: ขา (วาดก่อนลำตัว) ---------- */
  function drawLegs(ctx, s, g, ink) {
    if (!s.legs) return;
    const y = g.cy + g.ry - 1;
    const c = s.pal[1];
    for (const dx of [-4.2, 4.2]) {
      ell(ctx, dx, y + 2.2, 3.1, 2.4, c, ink);
    }
  }

  /* ---------- ชิ้นส่วน: ของหลัง (วาดก่อนลำตัว) ---------- */
  function drawBack(ctx, s, g, ink, t) {
    const [main, dark, light, accent] = s.pal;
    // ถ้ามีหัวแยก ให้ยึดขอบบนของหัวเป็นหลัก ไม่งั้นของบนหลังจะโดนหัวบังมิด
    const hasHead = s.head !== 'none' && s.body !== 'ghost' && s.body !== 'rock' && s.body !== 'orb';
    const topY = hasHead ? Math.min(g.cy - g.ry, g.head.y - g.head.r * .94) : (g.cy - g.ry);
    switch (s.back) {
      case 'shell': {
        ell(ctx, 0, g.cy + 0.5, g.rx + 1.6, g.ry + 0.8, s.pal[3] || '#b06a34', ink);
        ctx.save(); ctx.globalAlpha = .35;
        ell(ctx, 0, g.cy + 0.5, g.rx * .6, g.ry * .55, shade(s.pal[3] || '#b06a34', -.3));
        ctx.restore();
        break;
      }
      case 'bulb': {
        ell(ctx, 0, topY - 2.2, 5.6, 5.0, accent || '#4e9a4e', ink);
        ell(ctx, -1.8, topY - 4, 1.8, 1.4, shade(accent || '#4e9a4e', .3));
        break;
      }
      case 'flower': {
        const petal = accent || '#e06a9a';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t * .3;
          ell(ctx, Math.cos(a) * 5.2, topY - 3.4 + Math.sin(a) * 2.8, 3.4, 2.3, petal, ink, a);
        }
        ell(ctx, 0, topY - 3.4, 2.6, 1.9, '#f5d76e', ink);
        break;
      }
      case 'leaves': {
        const lf = accent || '#4e9a4e';
        ell(ctx, -5.2, topY - 2, 4.6, 2.3, lf, ink, -0.7);
        ell(ctx, 5.2, topY - 2, 4.6, 2.3, lf, ink, 0.7);
        ell(ctx, 0, topY - 4.2, 2.4, 4.6, lf, ink);
        break;
      }
      case 'wings': {
        const w = s.wingCol || accent || shade(main, .25);
        const flap = Math.sin(t * 9) * 2.2;
        for (const sgn of [-1, 1]) {
          poly(ctx, [
            [sgn * 3, g.cy - 3],
            [sgn * 12, g.cy - 8 - flap],
            [sgn * 13.5, g.cy - 1 - flap * .4],
            [sgn * 6, g.cy + 2]
          ], w, ink);
        }
        break;
      }
      case 'bigwings': {
        const w = s.wingCol || accent || shade(main, .2);
        const flap = Math.sin(t * 7) * 3;
        for (const sgn of [-1, 1]) {
          poly(ctx, [
            [sgn * 3, g.cy - 5],
            [sgn * 10, g.cy - 14 - flap],
            [sgn * 16, g.cy - 9 - flap],
            [sgn * 15, g.cy - 1 - flap * .5],
            [sgn * 7, g.cy + 3]
          ], w, ink);
          ctx.save(); ctx.globalAlpha = .3;
          poly(ctx, [[sgn * 4, g.cy - 4], [sgn * 11, g.cy - 10 - flap], [sgn * 12, g.cy - 3]], shade(w, -.35));
          ctx.restore();
        }
        break;
      }
      case 'spikes': {
        for (let i = -1; i <= 1; i++) {
          poly(ctx, [
            [i * 5.4 - 2.2, topY + 1.5],
            [i * 5.4, topY - 4.6],
            [i * 5.4 + 2.2, topY + 1.5]
          ], accent || shade(main, -.25), ink);
        }
        break;
      }
      case 'magnet': {
        for (const sgn of [-1, 1]) {
          ctx.save();
          ctx.translate(sgn * (g.rx + 2.5), g.cy);
          ctx.rotate(sgn * .25);
          poly(ctx, [[-1.6, -4], [1.6, -4], [1.6, 4], [-1.6, 4]], '#9aa4b8', ink);
          poly(ctx, [[-1.6, -4], [1.6, -4], [1.6, -1], [-1.6, -1]], '#e04a4a');
          poly(ctx, [[-1.6, 1], [1.6, 1], [1.6, 4], [-1.6, 4]], '#4a7ae0');
          ctx.restore();
        }
        break;
      }
      case 'tentacles': {
        for (let i = 0; i < 4; i++) {
          const dx = -5 + i * 3.4;
          ctx.beginPath();
          ctx.moveTo(dx, g.cy + g.ry - 2);
          ctx.quadraticCurveTo(dx + Math.sin(t * 4 + i) * 2.4, g.cy + g.ry + 3,
                               dx + Math.sin(t * 4 + i) * 4, g.cy + g.ry + 7);
          ctx.strokeStyle = light; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.stroke();
          ctx.lineWidth = 1;
        }
        break;
      }
    }
  }

  /* ---------- ชิ้นส่วน: หาง (วาดก่อนลำตัว) ---------- */
  function drawTail(ctx, s, g, ink, t) {
    const [main, dark, light, accent] = s.pal;
    const bx = -g.rx + 1, by = g.cy + 2;
    const wag = Math.sin(t * 3.2) * 1.6;
    switch (s.tail) {
      case 'flame': {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - 7, by + 1, bx - 8.5, by - 5 + wag);
        ctx.strokeStyle = main; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
        ctx.lineWidth = 1;
        const fx = bx - 8.8, fy = by - 7.5 + wag;
        const flick = 1 + Math.sin(t * 13) * .16;
        poly(ctx, [[fx - 2.6 * flick, fy + 1.6], [fx, fy - 5 * flick], [fx + 2.6 * flick, fy + 1.6], [fx, fy + 3]], '#ff9a2e');
        poly(ctx, [[fx - 1.4 * flick, fy + 1], [fx, fy - 3 * flick], [fx + 1.4 * flick, fy + 1], [fx, fy + 2]], '#ffe14d');
        break;
      }
      case 'bolt': {
        poly(ctx, [
          [bx, by - 1], [bx - 5, by - 3], [bx - 3.4, by - 6.5], [bx - 9, by - 11],
          [bx - 6.5, by - 6], [bx - 8.5, by - 4.5], [bx - 3, by - 1]
        ], accent || '#f8d030', ink);
        break;
      }
      case 'curl': {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - 8, by - 2, bx - 6, by - 8 + wag);
        ctx.strokeStyle = light; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case 'plain': {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - 7, by + 1, bx - 9, by - 3 + wag);
        ctx.strokeStyle = main; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case 'leaf': {
        ell(ctx, bx - 6, by - 4 + wag, 4, 2.2, accent || '#4e9a4e', ink, -0.6);
        break;
      }
      case 'fan': {
        for (let i = 0; i < 3; i++) {
          ell(ctx, bx - 5 - i, by - 2 - i * 2.6 + wag, 3.6, 1.7, i % 2 ? light : main, ink, -0.5 - i * .2);
        }
        break;
      }
      case 'orb': {
        ell(ctx, bx - 7, by - 3 + wag, 2.6, 2.6, accent || light, ink);
        break;
      }
    }
  }

  /* ---------- ชิ้นส่วน: แขน ---------- */
  function drawArms(ctx, s, g, ink, t) {
    if (!s.arms) return;
    const c = s.pal[0], y = g.cy - 1;
    const sw = Math.sin(t * 4) * 1.2;
    const pairs = s.arms >= 4 ? [[y - 3, 1], [y + 3, -1]] : [[y, 1]];
    for (const [ay, dir] of pairs) {
      for (const sgn of [-1, 1]) {
        ell(ctx, sgn * (g.rx + 1.2), ay + sgn * sw * dir, 2.6, 2.1, c, ink);
      }
    }
  }

  /* ---------- ชิ้นส่วน: หู ---------- */
  function drawEars(ctx, s, h, ink) {
    const [main, dark, light, accent] = s.pal;
    switch (s.ears) {
      case 'pointy':
        for (const sgn of [-1, 1]) {
          poly(ctx, [
            [sgn * h.r * .45, h.y - h.r * .75],
            [sgn * h.r * .95, h.y - h.r * 1.9],
            [sgn * h.r * 1.05, h.y - h.r * .45]
          ], main, ink);
          poly(ctx, [
            [sgn * h.r * .6, h.y - h.r * .8],
            [sgn * h.r * .88, h.y - h.r * 1.55],
            [sgn * h.r * .92, h.y - h.r * .62]
          ], s.earTip || shade(main, -.35));
        }
        break;
      case 'long':
        for (const sgn of [-1, 1]) {
          ell(ctx, sgn * h.r * .6, h.y - h.r * 1.5, 1.7, 4.2, main, ink, sgn * .28);
          ell(ctx, sgn * h.r * .62, h.y - h.r * 2.1, .9, 1.6, s.earTip || shade(main, -.4), null, sgn * .28);
        }
        break;
      case 'round':
        for (const sgn of [-1, 1]) {
          ell(ctx, sgn * h.r * .82, h.y - h.r * .78, 2.5, 2.5, main, ink);
          ell(ctx, sgn * h.r * .82, h.y - h.r * .78, 1.3, 1.3, light);
        }
        break;
      case 'fin':
        poly(ctx, [[-2.5, h.y - h.r], [0, h.y - h.r - 4.5], [2.5, h.y - h.r]], accent || light, ink);
        break;
      case 'antenna':
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sgn * 1.5, h.y - h.r * .8);
          ctx.lineTo(sgn * 3.5, h.y - h.r - 4);
          ctx.strokeStyle = ink; ctx.lineWidth = .9; ctx.stroke(); ctx.lineWidth = 1;
          ell(ctx, sgn * 3.5, h.y - h.r - 4.6, 1.2, 1.2, accent || light, ink);
        }
        break;
    }
  }

  /* ---------- ชิ้นส่วน: ตา ---------- */
  function drawEyes(ctx, s, h, ink) {
    const ex = h.r * .42, ey = h.y - h.r * .08, er = Math.max(1.5, h.r * .26);
    const white = '#ffffff';
    switch (s.eyes) {
      case 'angry':
        for (const sgn of [-1, 1]) {
          ell(ctx, sgn * ex, ey, er, er * 1.05, white, ink);
          ell(ctx, sgn * ex + sgn * .3, ey + .4, er * .52, er * .62, '#1a1a24');
          ctx.beginPath();
          ctx.moveTo(sgn * (ex - er * 1.2), ey - er * 1.5);
          ctx.lineTo(sgn * (ex + er * 1.1), ey - er * .5);
          ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 1;
        }
        break;
      case 'glow':
        for (const sgn of [-1, 1]) {
          ctx.save();
          ctx.shadowColor = s.eyeGlow || '#ff4d6d'; ctx.shadowBlur = 3;
          ell(ctx, sgn * ex, ey, er * .72, er * .82, s.eyeGlow || '#ff4d6d');
          ctx.shadowBlur = 0;
          ell(ctx, sgn * ex - er * .18, ey - er * .25, er * .26, er * .26, '#ffffff');
          ctx.restore();
        }
        break;
      case 'sleepy':
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(sgn * ex, ey, er, Math.PI * .08, Math.PI * .92);
          ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.stroke(); ctx.lineWidth = 1;
        }
        break;
      case 'closed':
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(sgn * ex, ey + er * .4, er, Math.PI * 1.1, Math.PI * 1.9);
          ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.stroke(); ctx.lineWidth = 1;
        }
        break;
      default: // normal
        for (const sgn of [-1, 1]) {
          ell(ctx, sgn * ex, ey, er, er * 1.15, white, ink);
          ell(ctx, sgn * ex, ey + .3, er * .5, er * .68, '#1a1a24');
          ell(ctx, sgn * ex + .5, ey - er * .45, er * .24, er * .24, white);
        }
    }
  }

  /* ---------- ชิ้นส่วน: ปาก ---------- */
  function drawMouth(ctx, s, h, ink) {
    const my = h.y + h.r * .55;
    switch (s.mouth) {
      case 'smile':
        ctx.beginPath();
        ctx.arc(0, my - 1.4, h.r * .34, Math.PI * .18, Math.PI * .82);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 1;
        break;
      case 'fang':
        ctx.beginPath();
        ctx.moveTo(-h.r * .38, my - 1); ctx.lineTo(h.r * .38, my - 1);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;
        poly(ctx, [[-h.r * .3, my - 1], [-h.r * .12, my - 1], [-h.r * .21, my + 1.8]], '#ffffff');
        poly(ctx, [[h.r * .12, my - 1], [h.r * .3, my - 1], [h.r * .21, my + 1.8]], '#ffffff');
        break;
      case 'grin':
        ctx.beginPath();
        ctx.ellipse(0, my - .6, h.r * .55, h.r * .3, 0, 0, Math.PI);
        ctx.fillStyle = '#5a1030'; ctx.fill();
        ctx.strokeStyle = ink; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-h.r * .55, my - .6); ctx.lineTo(h.r * .55, my - .6);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.lineWidth = 1;
        break;
      case 'beak':
        poly(ctx, [[-2, my - 1.6], [2, my - 1.6], [0, my + 2.2]], '#e8a33d', ink);
        break;
      case 'open':
        ell(ctx, 0, my, h.r * .3, h.r * .26, '#7a2540', ink);
        break;
      case 'flat':
        ctx.beginPath();
        ctx.moveTo(-h.r * .26, my - 1); ctx.lineTo(h.r * .26, my - 1);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.stroke(); ctx.lineWidth = 1;
        break;
    }
  }

  /* ---------- ชิ้นส่วน: ของแถมบนหัว/หน้า ---------- */
  function drawExtra(ctx, s, g, h, ink, t) {
    const [main, dark, light, accent] = s.pal;
    switch (s.extra) {
      case 'cheek':
        for (const sgn of [-1, 1]) ell(ctx, sgn * h.r * .95, h.y + h.r * .32, 1.9, 1.7, '#e8483c');
        break;
      case 'horn':
        poly(ctx, [[-1.6, h.y - h.r * .95], [0, h.y - h.r - 5], [1.6, h.y - h.r * .95]], accent || '#f0e6d2', ink);
        break;
      case 'gem':
        poly(ctx, [[0, h.y - h.r - 2.2], [2, h.y - h.r + .4], [0, h.y - h.r + 2.6], [-2, h.y - h.r + .4]],
             accent || '#8be0ff', ink);
        break;
      case 'swirl': {
        ctx.beginPath();
        for (let a = 0; a < TAU * 1.7; a += .2) {
          const r = .6 + a * .85;
          const px = Math.cos(a + t) * r, py = g.cy + Math.sin(a + t) * r * .8;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = ink; ctx.lineWidth = .9; ctx.stroke(); ctx.lineWidth = 1;
        break;
      }
      case 'moustache':
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sgn * 1.5, h.y + h.r * .5);
          ctx.quadraticCurveTo(sgn * 6, h.y + h.r * .3, sgn * 7.5, h.y + h.r * .9);
          ctx.strokeStyle = accent || '#e8c35a'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;
        }
        break;
      case 'crest':
        poly(ctx, [[-4, h.y - h.r * .85], [-1, h.y - h.r - 5.5], [1.5, h.y - h.r - 2],
                   [4, h.y - h.r - 6.5], [5, h.y - h.r * .6]], accent || '#f5d76e', ink);
        break;
      case 'collar':
        // วางที่โคนคอ ใต้หัวพอดี ไม่ใช่พาดหน้า
        ell(ctx, 0, h.y + h.r * .92, g.rx * .72, 2.1, accent || light, ink);
        break;
    }
  }

  /* ---------- วาดตัวเต็ม ---------- */
  // opts: { alpha, flash, facing(-1|1), glow }
  function draw(ctx, spec, x, y, size, t, opts) {
    opts = opts || {};
    const s = spec;
    const g = bodyGeom(s.body);
    const ink = s.ink || 'rgba(30,26,40,.85)';
    const [main, dark, light] = s.pal;
    const scale = (size / 32) * (s.scale || 1);

    ctx.save();
    ctx.translate(x, y);

    // เงาใต้ตัว (ไม่หมุนตามการพลิกซ้ายขวา)
    ctx.save();
    ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * .28;
    ell(ctx, 0, size * .46, size * .30, size * .11, '#000000');
    ctx.restore();

    if (opts.glow) {
      ctx.save();
      const gr = ctx.createRadialGradient(0, 0, size * .1, 0, 0, size * .9);
      gr.addColorStop(0, opts.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = .45; ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(0, 0, size * .9, 0, TAU); ctx.fill();
      ctx.restore();
    }

    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;

    const bob = Math.sin(t * 3.4 + (s.phase || 0)) * (size * .022);
    ctx.translate(0, bob - size * .06);
    ctx.scale(scale * (opts.facing === -1 ? -1 : 1), scale);
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    drawLegs(ctx, s, g, ink);
    drawBack(ctx, s, g, ink, t);
    drawTail(ctx, s, g, ink, t);

    // ลำตัว
    if (s.body === 'ghost') {
      ctx.beginPath();
      ctx.moveTo(-g.rx, g.cy + 2);
      ctx.arc(0, g.cy, g.rx, Math.PI, 0);
      ctx.lineTo(g.rx, g.cy + 3);
      for (let i = 0; i < 4; i++) {
        const x0 = g.rx - (i * 2 + 1) * (g.rx / 4);
        ctx.quadraticCurveTo(x0 + g.rx / 8, g.cy + 8 + Math.sin(t * 5 + i) * 1.2, x0 - g.rx / 4, g.cy + 3);
      }
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * .92;
      ctx.fillStyle = main; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = ink; ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.arc(0, g.cy, g.rx, Math.PI, 0); ctx.clip();
      ctx.globalAlpha = .2;
      ell(ctx, -g.rx * .3, g.cy - g.ry * .45, g.rx * .5, g.ry * .32, '#ffffff');
      ctx.restore();
    } else if (s.body === 'rock') {
      poly(ctx, [
        [-g.rx, g.cy + 1], [-g.rx * .65, g.cy - g.ry], [g.rx * .2, g.cy - g.ry * 1.1],
        [g.rx, g.cy - g.ry * .3], [g.rx * .8, g.cy + g.ry], [-g.rx * .55, g.cy + g.ry]
      ], main, ink);
      ctx.save(); ctx.globalAlpha = .25;
      poly(ctx, [[-g.rx * .6, g.cy - g.ry * .8], [g.rx * .1, g.cy - g.ry * .95], [-g.rx * .2, g.cy - g.ry * .2]], '#ffffff');
      ctx.restore();
    } else if (s.body === 'serpent') {
      // ลำตัวเป็นข้อกลม ๆ ไล่ขนาดลงไปหาหาง สะบัดตามเวลา
      const SEG = 8, top = g.cy - g.ry, span = g.ry * 2 + 5;
      const seg = [];
      for (let i = 0; i <= SEG; i++) {
        const k = i / SEG;
        seg.push({
          x: Math.sin(k * 3.4 + t * 2.2) * (1.8 + k * 4.2),
          y: top + k * span,
          r: 5.0 * (1 - k * .68)
        });
      }
      ctx.fillStyle = ink;
      for (let i = seg.length - 1; i >= 0; i--) {
        const q = seg[i];
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r + .85, 0, TAU); ctx.fill();
      }
      for (let i = seg.length - 1; i >= 0; i--) {
        const q = seg[i];
        ctx.fillStyle = main;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
        if (s.belly !== false && i < SEG - 1) {
          ctx.fillStyle = light;
          ctx.beginPath(); ctx.ellipse(q.x, q.y + q.r * .28, q.r * .55, q.r * .42, 0, 0, TAU); ctx.fill();
        }
      }
    } else {
      ell(ctx, 0, g.cy, g.rx, g.ry, main, ink);
    }

    // ไฮไลต์ด้านบน + เงาด้านล่างให้ดูมีมิติ (ข้ามสำหรับทรงที่วาดเองแล้ว)
    if (s.body === 'serpent' || s.body === 'ghost' || s.body === 'rock') { /* วาดมิติในตัวแล้ว */ }
    else {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, g.cy, g.rx, g.ry, 0, 0, TAU); ctx.clip();
    ctx.globalAlpha = .22;
    ell(ctx, -g.rx * .3, g.cy - g.ry * .5, g.rx * .55, g.ry * .4, '#ffffff');
    ctx.globalAlpha = .18;
    ell(ctx, 0, g.cy + g.ry * .75, g.rx, g.ry * .55, '#000000');
    ctx.restore();
    }

    // ท้อง
    if (s.belly !== false && s.body !== 'ghost' && s.body !== 'rock' && s.body !== 'serpent') {
      ell(ctx, 0, g.cy + g.ry * .28, g.rx * .58, g.ry * .52, light);
    }

    drawArms(ctx, s, g, ink, t);

    const h = g.head;
    // หัวแยก (ถ้ามี)
    if (s.head !== 'none' && s.body !== 'ghost' && s.body !== 'rock' && s.body !== 'orb') {
      drawEars(ctx, s, h, ink);
      ell(ctx, h.x, h.y, h.r, h.r * .94, main, ink);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * .94, 0, 0, TAU); ctx.clip();
      ctx.globalAlpha = .2; ell(ctx, -h.r * .35, h.y - h.r * .4, h.r * .5, h.r * .35, '#ffffff');
      ctx.restore();
    } else {
      drawEars(ctx, s, h, ink);
    }

    drawExtra(ctx, s, g, h, ink, t);
    drawEyes(ctx, s, h, ink);
    drawMouth(ctx, s, h, ink);

    ctx.restore();

    // แฟลชสีขาวตอนโดนตี
    if (opts.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(.75, opts.flash);
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.arc(0, 0, size * .42, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  PTD.drawCreature = draw;

  // วาดลงแคนวาสเล็ก ๆ สำหรับการ์ดใน UI
  PTD.spriteToCanvas = function (spec, px) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    draw(ctx, spec, px / 2, px / 2 + px * .04, px * .78, 0.35, {});
    return c;
  };
})(window.PTD = window.PTD || {});
