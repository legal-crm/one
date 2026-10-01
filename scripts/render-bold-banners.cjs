const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const bgImagePath = 'C:/Users/JSH/.gemini/antigravity/brain/e8836a3e-c369-4413-86ab-448384028c09/legal_shield_landscape_1790826582930.jpg';
const bgBase64 = fs.readFileSync(bgImagePath).toString('base64');
const bgDataUri = `data:image/jpeg;base64,${bgBase64}`;

// 1. 가로형 배너 (1200x628) - 큰 텍스트 몇 개만 임팩트 있게!
const landscapeHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    width: 1200px;
    height: 628px;
    background-image: url('${bgDataUri}');
    background-size: cover;
    background-position: right center;
    background-repeat: no-repeat;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    align-items: center;
    padding: 0 72px;
    position: relative;
    overflow: hidden;
  }

  /* 좌측 텍스트 가독성을 위한 그라데이션 오버레이 */
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(8, 14, 30, 0.95) 0%, rgba(8, 14, 30, 0.85) 42%, rgba(8, 14, 30, 0.2) 70%, transparent 100%);
    z-index: 1;
  }

  .content {
    position: relative;
    z-index: 2;
    max-width: 620px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(124, 58, 237, 0.25);
    border: 1.5px solid rgba(167, 139, 250, 0.5);
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 16px;
    font-weight: 800;
    color: #c4b5fd;
    margin-bottom: 24px;
    align-self: flex-start;
    letter-spacing: -0.01em;
  }
  .badge .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #a855f7;
    box-shadow: 0 0 12px #c084fc;
  }

  .headline-1 {
    font-size: 56px;
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -0.04em;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .headline-2 {
    font-size: 56px;
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 30px;
  }

  .sub-tag-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sub-tag {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(12px);
    padding: 12px 22px;
    border-radius: 16px;
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
    align-self: flex-start;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }
  .sub-tag.accent {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(14, 165, 233, 0.2) 100%);
    border: 1px solid rgba(129, 140, 248, 0.4);
    color: #ffffff;
  }
  .icon-check {
    color: #38bdf8;
    font-weight: 900;
  }
</style>
</head>
<body>
  <div class="overlay"></div>
  <div class="content">
    <div class="badge">
      <span class="dot"></span>
      my김변 | 1:1 채무관리 플랫폼
    </div>
    <div class="headline-1">여러 변호사 동시 비교</div>
    <div class="headline-2">내가 직접 선택!</div>
    
    <div class="sub-tag-box">
      <div class="sub-tag accent">
        <span class="icon-check">✓</span> 이미 회생 중이어도 끝까지 관리
      </div>
      <div class="sub-tag">
        <span class="icon-check">✓</span> 100% 가명 안심 채무진단
      </div>
    </div>
  </div>
</body>
</html>
`;

// 2. 정사각형 배너 (1200x1200) - 상단 큰 텍스트 + 하단 3D 비주얼
const squareHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    width: 1200px;
    height: 1200px;
    background-color: #080e1e;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }

  /* 하단 3D 그래픽 영역 */
  .bg-image-box {
    position: absolute;
    bottom: -40px;
    left: 0;
    right: 0;
    height: 760px;
    background-image: url('${bgDataUri}');
    background-size: cover;
    background-position: center bottom;
    z-index: 1;
  }
  .bg-fade-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 250px;
    background: linear-gradient(180deg, #080e1e 20%, rgba(8, 14, 30, 0.8) 60%, transparent 100%);
    z-index: 2;
  }

  /* 상단 큰 텍스트 영역 */
  .top-content {
    position: relative;
    z-index: 3;
    padding: 80px 70px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(124, 58, 237, 0.25);
    border: 1.5px solid rgba(167, 139, 250, 0.5);
    padding: 10px 24px;
    border-radius: 9999px;
    font-size: 20px;
    font-weight: 800;
    color: #c4b5fd;
    margin-bottom: 28px;
    letter-spacing: -0.01em;
  }
  .badge .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #a855f7;
    box-shadow: 0 0 14px #c084fc;
  }

  .headline-1 {
    font-size: 72px;
    font-weight: 900;
    line-height: 1.18;
    letter-spacing: -0.04em;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .headline-2 {
    font-size: 72px;
    font-weight: 900;
    line-height: 1.18;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 32px;
  }

  /* 중간 핵심 태그 바 */
  .tag-bar {
    display: flex;
    gap: 16px;
  }
  .sub-tag {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(15, 23, 42, 0.75);
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(16px);
    padding: 14px 26px;
    border-radius: 18px;
    font-size: 22px;
    font-weight: 800;
    color: #ffffff;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }
  .sub-tag.accent {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(14, 165, 233, 0.3) 100%);
    border: 1.5px solid rgba(129, 140, 248, 0.5);
  }
  .icon-check {
    color: #38bdf8;
    font-weight: 900;
  }
</style>
</head>
<body>
  <!-- 상단 큰 텍스트 -->
  <div class="top-content">
    <div class="badge">
      <span class="dot"></span>
      my김변 | 1:1 채무관리 변호사 플랫폼
    </div>
    <div class="headline-1">여러 변호사 동시 비교</div>
    <div class="headline-2">내가 직접 선택!</div>
    
    <div class="tag-bar">
      <div class="sub-tag accent">
        <span class="icon-check">✓</span> 이미 회생 중이어도 끝까지 관리
      </div>
      <div class="sub-tag">
        <span class="icon-check">✓</span> 100% 가명 안심 진단
      </div>
    </div>
  </div>

  <!-- 하단 3D 그래픽 -->
  <div class="bg-image-box">
    <div class="bg-fade-top"></div>
  </div>
</body>
</html>
`;

async function render() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outDir = path.join('C:', 'Users', 'JSH', 'Downloads');
  
  // 1. Landscape 1200x628
  console.log('Rendering bold landscape banner (1200x628)...');
  const pageLandscape = await browser.newPage();
  await pageLandscape.setViewport({ width: 1200, height: 628, deviceScaleFactor: 2 });
  await pageLandscape.setContent(landscapeHtml, { waitUntil: 'networkidle0' });
  const landscapePath = path.join(outDir, 'mykim_google_ad_landscape.jpg');
  await pageLandscape.screenshot({ path: landscapePath, type: 'jpeg', quality: 95 });
  await pageLandscape.close();
  console.log('Saved:', landscapePath);

  // 2. Square 1200x1200
  console.log('Rendering bold square banner (1200x1200)...');
  const pageSquare = await browser.newPage();
  await pageSquare.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });
  await pageSquare.setContent(squareHtml, { waitUntil: 'networkidle0' });
  const squarePath = path.join(outDir, 'mykim_google_ad_square.jpg');
  await pageSquare.screenshot({ path: squarePath, type: 'jpeg', quality: 95 });
  await pageSquare.close();
  console.log('Saved:', squarePath);

  await browser.close();
  console.log('Done!');
}

render().catch(console.error);
