/* เซิร์ฟเวอร์ไฟล์นิ่งเล็ก ๆ สำหรับทดสอบ — เสิร์ฟตัวเกม และ /sprites ชี้ไปโฟลเดอร์รูปในเครื่อง */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve(roots, port) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    let file = null;
    for (const [prefix, dir] of roots) {
      if (url.startsWith(prefix)) {
        const rel = url.slice(prefix.length).replace(/^\/+/, '');
        const cand = path.join(dir, rel);
        if (cand.startsWith(dir) && fs.existsSync(cand) && fs.statSync(cand).isFile()) { file = cand; break; }
      }
    }
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'access-control-allow-origin': '*'
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

module.exports = { serve };
