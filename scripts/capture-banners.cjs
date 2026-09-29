const puppeteer = require('puppeteer');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'assets', 'banners', 'rehabilitation-consultation');

const banners = [
  { file: 'banner-01-gradient.html', output: 'gradient-1200x600.png' },
  { file: 'banner-02-clean-white.html', output: 'clean-white-1200x600.png' },
  { file: 'banner-03-bold-split.html', output: 'bold-split-1200x600.png' }
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  for (const banner of banners) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: 2 });
    
    const filePath = path.join(baseDir, banner.file);
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    
    try {
      await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
    } catch (e) {
      // If load times out, try without waiting
      console.log(`  ⚠ Load timeout for ${banner.file}, proceeding anyway...`);
    }
    
    // Wait a bit for rendering
    await new Promise(r => setTimeout(r, 3000));
    
    const bannerEl = await page.$('.banner');
    if (bannerEl) {
      await bannerEl.screenshot({
        path: path.join(baseDir, banner.output),
        type: 'png'
      });
      console.log(`✅ Exported: ${banner.output}`);
    } else {
      console.log(`❌ Banner element not found: ${banner.output}`);
    }
    await page.close();
  }

  await browser.close();
  console.log('\n🎉 Done!');
})();
