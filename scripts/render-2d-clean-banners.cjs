const puppeteer = require('puppeteer');
const path = require('path');

// 1. 가로형 배너 (1200x628) - 2D 플랫 일러스트 & 오직 지정 카피만
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
    background: #090d16;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 80px;
    position: relative;
    overflow: hidden;
  }

  /* 2D 플랫 배경 장식 */
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    z-index: 1;
  }
  .bg-circle-left {
    position: absolute;
    width: 450px;
    height: 450px;
    left: -100px;
    top: -50px;
    border-radius: 50%;
    background: rgba(79, 70, 229, 0.12);
    filter: blur(80px);
    z-index: 1;
  }
  .bg-circle-right {
    position: absolute;
    width: 500px;
    height: 500px;
    right: 40px;
    bottom: -80px;
    border-radius: 50%;
    background: rgba(14, 165, 233, 0.12);
    filter: blur(80px);
    z-index: 1;
  }

  /* 좌측: 오직 사용자가 지정한 카피만 배치! */
  .left-area {
    position: relative;
    z-index: 2;
    max-width: 600px;
  }

  .main-copy {
    font-size: 58px;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: -0.04em;
    color: #ffffff;
    word-break: keep-all;
  }

  .highlight {
    color: #38bdf8;
    display: block;
    margin-top: 8px;
  }

  /* 우측: 2D 플랫 벡터 일러스트레이션 (변호사 비교 & 선택 메타포) */
  .right-area {
    position: relative;
    z-index: 2;
    width: 420px;
    height: 440px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 2D 플랫 카드 3개 스택 */
  .card-stack {
    position: relative;
    width: 360px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .flat-card {
    background: #151d30;
    border: 2px solid #23304b;
    border-radius: 18px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;
  }

  /* 가운데 선택된 카드 강조 */
  .flat-card.selected {
    background: #1e2947;
    border: 2.5px solid #38bdf8;
    box-shadow: 0 14px 35px rgba(56, 189, 248, 0.2);
    transform: scale(1.05);
  }

  .avatar {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .avatar-1 { background: #312e81; color: #a5b4fc; }
  .avatar-2 { background: #075985; color: #7dd3fc; }
  .avatar-3 { background: #1e3a5f; color: #93c5fd; }

  .card-info {
    flex: 1;
  }
  .card-name {
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 2px;
  }
  .card-meta {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 600;
  }

  .status-badge {
    padding: 6px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .badge-wait {
    background: #1e293b;
    color: #64748b;
  }
  .badge-selected {
    background: #0284c7;
    color: #ffffff;
  }

  /* 2D 플랫 아이콘 데코 */
  .flat-decor-scale {
    position: absolute;
    top: -20px;
    right: -10px;
    width: 52px;
    height: 52px;
    background: #1e1b4b;
    border: 2px solid #4338ca;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
  }
  .flat-decor-shield {
    position: absolute;
    bottom: -15px;
    left: -15px;
    width: 48px;
    height: 48px;
    background: #0c4a6e;
    border: 2px solid #0284c7;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-circle-left"></div>
  <div class="bg-circle-right"></div>

  <!-- 좌측: 오직 요청하신 단 하나의 큰 카피 -->
  <div class="left-area">
    <h1 class="main-copy">
      여러 개인회생 변호사를
      <span class="highlight">동시 비교 후 선택</span>
    </h1>
  </div>

  <!-- 우측: 2D 플랫 일러스트 (변호사 비교 & 선택) -->
  <div class="right-area">
    <div class="card-stack">
      <div class="flat-decor-scale">⚖️</div>
      <div class="flat-decor-shield">🛡️</div>

      <!-- 변호사 A -->
      <div class="flat-card">
        <div class="avatar avatar-1">👨‍⚖️</div>
        <div class="card-info">
          <div class="card-name">회생 전담 변호사 A</div>
          <div class="card-meta">맞춤 솔루션 제안서 도착</div>
        </div>
        <div class="status-badge badge-wait">비교</div>
      </div>

      <!-- 변호사 B (선택됨) -->
      <div class="flat-card selected">
        <div class="avatar avatar-2">👩‍⚖️</div>
        <div class="card-info">
          <div class="card-name">회생 전담 변호사 B</div>
          <div class="card-meta">수임료 &amp; 변제계획 제안</div>
        </div>
        <div class="status-badge badge-selected">✓ 선택</div>
      </div>

      <!-- 변호사 C -->
      <div class="flat-card">
        <div class="avatar avatar-3">👨‍⚖️</div>
        <div class="card-info">
          <div class="card-name">회생 전담 변호사 C</div>
          <div class="card-meta">맞춤 솔루션 제안서 도착</div>
        </div>
        <div class="status-badge badge-wait">비교</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// 2. 정사각형 배너 (1200x1200) - 2D 플랫 일러스트 & 오직 지정 카피만
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
    background: #090d16;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 110px 80px 100px;
    position: relative;
    overflow: hidden;
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 54px 54px;
    z-index: 1;
  }
  .bg-circle {
    position: absolute;
    width: 700px;
    height: 700px;
    left: 250px;
    top: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.14) 0%, rgba(79, 70, 229, 0.08) 50%, transparent 70%);
    filter: blur(90px);
    z-index: 1;
  }

  /* 상단: 오직 요청하신 단 하나의 큰 카피 */
  .top-area {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 950px;
  }

  .main-copy {
    font-size: 78px;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: -0.04em;
    color: #ffffff;
    word-break: keep-all;
  }

  .highlight {
    color: #38bdf8;
    display: block;
    margin-top: 12px;
  }

  /* 하단: 2D 플랫 일러스트 (변호사 3곳 비교 및 직접 선택) */
  .bottom-area {
    position: relative;
    z-index: 2;
    width: 600px;
  }

  .card-stack {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .flat-card {
    background: #151d30;
    border: 2.5px solid #23304b;
    border-radius: 22px;
    padding: 22px 28px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 14px 35px rgba(0, 0, 0, 0.45);
  }

  .flat-card.selected {
    background: #1a243f;
    border: 3px solid #38bdf8;
    box-shadow: 0 18px 45px rgba(56, 189, 248, 0.25);
    transform: scale(1.04);
  }

  .avatar {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    flex-shrink: 0;
  }
  .avatar-1 { background: #312e81; color: #a5b4fc; }
  .avatar-2 { background: #075985; color: #7dd3fc; }
  .avatar-3 { background: #1e3a5f; color: #93c5fd; }

  .card-info {
    flex: 1;
  }
  .card-name {
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .card-meta {
    font-size: 17px;
    color: #94a3b8;
    font-weight: 600;
  }

  .status-badge {
    padding: 10px 18px;
    border-radius: 14px;
    font-size: 18px;
    font-weight: 800;
  }
  .badge-wait {
    background: #1e293b;
    color: #64748b;
  }
  .badge-selected {
    background: #0284c7;
    color: #ffffff;
  }

  .flat-decor-scale {
    position: absolute;
    top: -28px;
    right: -24px;
    width: 68px;
    height: 68px;
    background: #1e1b4b;
    border: 2.5px solid #4338ca;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.35);
  }
  .flat-decor-shield {
    position: absolute;
    bottom: -20px;
    left: -20px;
    width: 64px;
    height: 64px;
    background: #0c4a6e;
    border: 2.5px solid #0284c7;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.35);
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-circle"></div>

  <!-- 상단: 오직 요청하신 단 하나의 큰 카피 -->
  <div class="top-area">
    <h1 class="main-copy">
      여러 개인회생 변호사를
      <span class="highlight">동시 비교 후 선택</span>
    </h1>
  </div>

  <!-- 하단: 2D 플랫 일러스트 -->
  <div class="bottom-area">
    <div class="card-stack">
      <div class="flat-decor-scale">⚖️</div>
      <div class="flat-decor-shield">🛡️</div>

      <!-- 변호사 A -->
      <div class="flat-card">
        <div class="avatar avatar-1">👨‍⚖️</div>
        <div class="card-info">
          <div class="card-name">회생 전담 변호사 A</div>
          <div class="card-meta">맞춤 솔루션 제안서 도착</div>
        </div>
        <div class="status-badge badge-wait">비교</div>
      </div>

      <!-- 변호사 B (선택됨) -->
      <div class="flat-card selected">
        <div class="avatar avatar-2">👩‍⚖️</div>
        <div class="card-info">
          <div class="card-name">회생 전담 변호사 B</div>
          <div class="card-meta">수임료 &amp; 변제계획 제안</div>
        </div>
        <div class="status-badge badge-selected">✓ 선택</div>
      </div>

      <!-- 변호사 C -->
      <div class="flat-card">
        <div class="avatar avatar-3">👨‍⚖️</div>
        <div class="card-info">
          <div class="card-name">회생 전담 변호사 C</div>
          <div class="card-meta">맞춤 솔루션 제안서 도착</div>
        </div>
        <div class="status-badge badge-wait">비교</div>
      </div>
    </div>
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
  console.log('Rendering 2D clean landscape banner (1200x628)...');
  const pageLandscape = await browser.newPage();
  await pageLandscape.setViewport({ width: 1200, height: 628, deviceScaleFactor: 2 });
  await pageLandscape.setContent(landscapeHtml, { waitUntil: 'networkidle0' });
  const landscapePath = path.join(outDir, 'mykim_google_ad_landscape.jpg');
  await pageLandscape.screenshot({ path: landscapePath, type: 'jpeg', quality: 95 });
  await pageLandscape.close();
  console.log('Saved:', landscapePath);

  // 2. Square 1200x1200
  console.log('Rendering 2D clean square banner (1200x1200)...');
  const pageSquare = await browser.newPage();
  await pageSquare.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });
  await pageSquare.setContent(squareHtml, { waitUntil: 'networkidle0' });
  const squarePath = path.join(outDir, 'mykim_google_ad_square.jpg');
  await pageSquare.screenshot({ path: squarePath, type: 'jpeg', quality: 95 });
  await pageSquare.close();
  console.log('Saved:', squarePath);

  await browser.close();
  console.log('All 2D banners rendered successfully!');
}

render().catch(console.error);
