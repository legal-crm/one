const puppeteer = require('puppeteer');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'assets', 'banners', 'rehabilitation-consultation');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: 2 });

  const filePath = path.join(baseDir, 'banner-01-gradient.html');
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

  try {
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    console.log('⚠ Load timeout, proceeding...');
  }

  await new Promise(r => setTimeout(r, 3000));

  const bannerEl = await page.$('.banner');
  if (bannerEl) {
    await bannerEl.screenshot({
      path: path.join(baseDir, 'gradient-1200x600.png'),
      type: 'png'
    });
    console.log('✅ Exported: gradient-1200x600.png');
  }

  await browser.close();
})();
