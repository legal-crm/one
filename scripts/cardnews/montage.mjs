// 검수용 몽타주: node scripts/cardnews/montage.mjs 1 2 3 → assets/cardnews/_review/montage_001.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', 'assets', 'cardnews');
const REVIEW = path.join(OUT, '_review');
fs.mkdirSync(REVIEW, { recursive: true });
const ids = process.argv.slice(2).map(Number);
const cols = 4;
const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
for (const id of ids) {
  const pre = String(id).padStart(3, '0');
  const dir = fs.readdirSync(OUT).find((d) => d.startsWith(pre + '_'));
  const imgs = fs.readdirSync(path.join(OUT, dir)).filter((f) => f.endsWith('.png')).sort();
  const html = `<html><body style="margin:0;background:#94A3B8;display:grid;grid-template-columns:repeat(${cols},540px);gap:8px;padding:8px;width:${cols * 548 + 8}px">${imgs.map((f) => `<img src="${pathToFileURL(path.join(OUT, dir, f)).href}" style="width:540px;display:block">`).join('')}</body></html>`;
  const tmp = path.join(REVIEW, `_m_${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  await page.setViewport({ width: cols * 548 + 8, height: 800 });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(REVIEW, `montage_${pre}.png`), fullPage: true });
  fs.unlinkSync(tmp);
}
await browser.close();
console.log('ok');
