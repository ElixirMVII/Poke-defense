const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 1500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, 'gallery.html'));
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/shots/gallery.png', fullPage: true });
  console.log('errors:', errs.length, errs.slice(0,3));
  await b.close();
})();
