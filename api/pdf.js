// Vercel Serverless Function: 법원 서식 HTML → 글자 PDF (H-7, CF-Q1 결정)
// POST /api/pdf  { html, title }  → application/pdf
//
// - 미리보기와 같은 HTML을 헤드리스 크롬으로 인쇄해 글자 검색·추출이 되는 PDF를 만든다
//   (전자소송 규칙 제8조④: 직접 작성한 전자문서는 글자 검색 가능한 파일). 이전: html2canvas 그림 PDF.
// - 한글 글꼴(나눔명조·나눔고딕, OFL)은 이 배포의 /fonts에서 읽어 크롬에 넣는다.
// - 보안: 로그인 필수, 본문 3MB 제한, 자바스크립트 끔, 외부 요청 전부 차단(data: 와 우리 글꼴만), 본문은 저장·기록하지 않는다.

import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth } from './_lib/auth-middleware.js';

export const config = { maxDuration: 60 };

const MAX_HTML = 3 * 1024 * 1024;
const FONT_FILES = ['NanumMyeongjo-Regular.ttf', 'NanumMyeongjo-Bold.ttf', 'NanumGothic-Regular.ttf', 'NanumGothic-Bold.ttf'];

let browserPromise = null;
let fontsLoaded = false;

function siteOrigin(req) {
  if (process.env.PDF_FONT_ORIGIN) return process.env.PDF_FONT_ORIGIN.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'mykim.kr';
  return `https://${host}`;
}

async function getBrowser(origin) {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  if (!fontsLoaded) {
    for (const f of FONT_FILES) {
      try { await chromium.font(`${origin}/fonts/${f}`); } catch (e) { console.warn('[pdf] font load failed', f, e?.message); }
    }
    fontsLoaded = true;
  }
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123 },
      executablePath: await chromium.executablePath(),
      headless: true,
    }).catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

/** 서식 HTML 머리에 한글 글꼴을 우선으로 넣는다 (Batang·Malgun 등 서버에 없는 글꼴 대신) */
function withFonts(html) {
  const css = `<style>
    html, body { font-family: 'NanumMyeongjo', 'Nanum Myeongjo', 'Batang', serif; }
    @page { size: A4; margin: 0; }
    table { page-break-inside: auto; } tr { page-break-inside: avoid; } thead { display: table-header-group; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}<meta charset="utf-8">${css}`);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">${css}</head><body>${html}</body></html>`;
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let user = null;
  try { user = await verifyAuth(req); } catch (_) { user = null; }
  if (!user) return res.status(401).json({ ok: false, error: '로그인이 필요해요.' });

  const html = typeof req.body?.html === 'string' ? req.body.html : '';
  if (!html) return res.status(400).json({ ok: false, error: '서식 내용이 없어요.' });
  if (html.length > MAX_HTML) return res.status(413).json({ ok: false, error: '서식이 너무 커요. 문서를 나눠 만들어 주세요.' });
  const footer = req.body?.pageNumbers !== false;

  let page = null;
  try {
    const origin = siteOrigin(req);
    const browser = await getBrowser(origin);
    page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const url = r.url();
      if (url.startsWith('data:') || url === 'about:blank' || url.startsWith(`${origin}/fonts/`)) r.continue();
      else r.abort();
    });
    await page.setContent(withFonts(html), { waitUntil: 'load', timeout: 20000 });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: footer,
      headerTemplate: '<span></span>',
      footerTemplate: footer ? '<div style="width:100%;text-align:center;font-size:9px;color:#444;font-family:NanumGothic,sans-serif;">- <span class="pageNumber"></span> / <span class="totalPages"></span> -</div>' : '<span></span>',
      margin: footer ? { top: '0', bottom: '12mm', left: '0', right: '0' } : undefined,
      tagged: true,
      outline: true,
      timeout: 30000,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error('[pdf] render failed', e?.message);
    return res.status(500).json({ ok: false, error: 'PDF를 만들지 못했어요. 잠시 뒤 다시 시도하거나 인쇄 창에서 PDF로 저장해 주세요.' });
  } finally {
    if (page) { try { await page.close(); } catch (_) { /* 무시 */ } }
  }
}
