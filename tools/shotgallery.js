const { chromium } = require('playwright');
const path = require('path');
const { serve } = require('./server');
const PORT = 8904;
(async () => {
  const server = await serve([['/sprites', '/tmp/claude-0/sprites'],
                              ['/', path.resolve(__dirname, '..')]], PORT);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 1400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.PTD_SPRITE_BASE = '/sprites'; });
  await p.goto(`http://127.0.0.1:${PORT}/tools/gallery.html`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/claude-0/shots/gallery.png', fullPage: true });
  console.log('errors:', errs.length, errs.slice(0, 3));
  await b.close(); server.close();
})();
