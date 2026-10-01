const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

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
    background: radial-gradient(circle at 85% 30%, #1e1b4b 0%, #0f172a 60%, #020617 100%);
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 56px 64px;
    position: relative;
    overflow: hidden;
  }

  /* 배경 빛 효과 */
  .glow-1 {
    position: absolute;
    width: 500px;
    height: 500px;
    right: 50px;
    top: 50px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.22) 0%, rgba(59, 130, 246, 0.1) 45%, transparent 70%);
    filter: blur(40px);
    pointer-events: none;
  }
  .glow-2 {
    position: absolute;
    width: 350px;
    height: 350px;
    left: -50px;
    bottom: -50px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 65%);
    filter: blur(50px);
    pointer-events: none;
  }

  /* 좌측 카피 영역 */
  .left-col {
    flex: 1;
    max-width: 580px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(129, 140, 248, 0.35);
    padding: 7px 16px;
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 700;
    color: #a5b4fc;
    margin-bottom: 20px;
    align-self: flex-start;
  }
  .brand-badge .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6366f1;
    box-shadow: 0 0 10px #818cf8;
  }

  .main-title {
    font-size: 44px;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: -0.035em;
    color: #ffffff;
    margin-bottom: 16px;
  }
  .main-title .gradient-text {
    background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .sub-title {
    font-size: 17px;
    line-height: 1.55;
    color: #94a3b8;
    font-weight: 500;
    letter-spacing: -0.02em;
    margin-bottom: 28px;
  }

  .tag-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .tag-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 8px 15px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 600;
    color: #e2e8f0;
    backdrop-filter: blur(10px);
  }
  .tag-item .check {
    color: #38bdf8;
    font-weight: 900;
  }

  /* 우측 UI 목업 카드 영역 */
  .right-col {
    width: 440px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ui-card {
    background: rgba(30, 41, 59, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 20px;
    padding: 18px 22px;
    backdrop-filter: blur(16px);
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .ui-card.highlight {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.3) 0%, rgba(15, 23, 42, 0.8) 100%);
    border: 1px solid rgba(165, 180, 252, 0.4);
    box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.25);
  }

  .card-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .icon-purple {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
  }
  .icon-blue {
    background: linear-gradient(135deg, #0ea5e9, #2563eb);
    color: #fff;
  }
  .icon-emerald {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
  }

  .card-body {
    flex: 1;
  }
  .card-badge {
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }
  .card-title {
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 3px;
    letter-spacing: -0.02em;
  }
  .card-desc {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.35;
  }
  .badge-tag {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    margin-left: 6px;
  }
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>

  <!-- 좌측 헤드라인 -->
  <div class="left-col">
    <div class="brand-badge">
      <span class="dot"></span>
      my김변 — 1:1 맞춤 채무관리 플랫폼
    </div>
    <h1 class="main-title">
      여러 변호사 동시 상담받고<br>
      <span class="gradient-text">원하는 변호사 직접 선택!</span>
    </h1>
    <p class="sub-title">
      신청 전 채무진단은 물론, 이미 개인회생 진행 중이어도<br>
      변제금 미납·조건부 인가·폐지 위기까지 끝까지 관리합니다.
    </p>
    <div class="tag-group">
      <div class="tag-item"><span class="check">✓</span> 여러 변호사 동시 비교</div>
      <div class="tag-item"><span class="check">✓</span> 진행 중 사건 사후관리</div>
      <div class="tag-item"><span class="check">✓</span> 100% 가명 안심 진단</div>
    </div>
  </div>

  <!-- 우측 핵심 특장점 UI 카드 -->
  <div class="right-col">
    <!-- 장점 1 -->
    <div class="ui-card highlight">
      <div class="card-icon icon-purple">⚖️</div>
      <div class="card-body">
        <div class="card-badge">DIRECT MULTI-CONSULT</div>
        <div class="card-title">여러 변호사 동시 상담 &amp; 선택</div>
        <div class="card-desc">한 번 등록으로 여러 전문가의 전략·수임료 비교</div>
      </div>
    </div>

    <!-- 장점 2 -->
    <div class="ui-card">
      <div class="card-icon icon-blue">🔄</div>
      <div class="card-body">
        <div class="card-badge">POST-CARE SERVICE</div>
        <div class="card-title">이미 회생 중이어도 사후 케어<span class="badge-tag">집중관리</span></div>
        <div class="card-desc">변제금 미납, 소득변동, 폐지위기 방어까지 관리</div>
      </div>
    </div>

    <!-- 장점 3 -->
    <div class="ui-card">
      <div class="card-icon icon-emerald">🛡️</div>
      <div class="card-body">
        <div class="card-badge">PRIVACY FIRST</div>
        <div class="card-title">100% 안심 가명 상담 시스템</div>
        <div class="card-desc">직장·가족 모르게 실명 없이 3분 채무 자가진단</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

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
    background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 55%, #020617 100%);
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 80px 70px 70px;
    position: relative;
    overflow: hidden;
  }

  .glow-top {
    position: absolute;
    width: 700px;
    height: 700px;
    top: -150px;
    left: 250px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, rgba(59, 130, 246, 0.12) 50%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
  }

  .header-section {
    z-index: 2;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(99, 102, 241, 0.18);
    border: 1px solid rgba(129, 140, 248, 0.4);
    padding: 10px 24px;
    border-radius: 9999px;
    font-size: 18px;
    font-weight: 700;
    color: #a5b4fc;
    margin-bottom: 28px;
  }
  .brand-badge .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #6366f1;
    box-shadow: 0 0 12px #818cf8;
  }

  .main-title {
    font-size: 64px;
    font-weight: 900;
    line-height: 1.22;
    letter-spacing: -0.04em;
    color: #ffffff;
    margin-bottom: 20px;
  }
  .main-title .gradient-text {
    background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .sub-title {
    font-size: 24px;
    line-height: 1.5;
    color: #94a3b8;
    font-weight: 500;
    letter-spacing: -0.02em;
    max-width: 900px;
  }

  /* 3대 장점 카드 3단 구조 */
  .card-container {
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin: 40px 0;
  }

  .feature-card {
    background: rgba(30, 41, 59, 0.7);
    border: 1.5px solid rgba(255, 255, 255, 0.14);
    border-radius: 24px;
    padding: 26px 32px;
    backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
  }
  .feature-card.primary {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.35) 0%, rgba(15, 23, 42, 0.85) 100%);
    border: 1.5px solid rgba(165, 180, 252, 0.45);
    box-shadow: 0 24px 48px -12px rgba(99, 102, 241, 0.3);
  }

  .icon-box {
    width: 68px;
    height: 68px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    flex-shrink: 0;
  }
  .icon-purple {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }
  .icon-blue {
    background: linear-gradient(135deg, #0ea5e9, #2563eb);
  }
  .icon-emerald {
    background: linear-gradient(135deg, #10b981, #059669);
  }

  .card-content {
    flex: 1;
  }
  .card-tag {
    font-size: 14px;
    font-weight: 800;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .card-heading {
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-sub {
    font-size: 18px;
    color: #94a3b8;
    line-height: 1.4;
  }
  .pill {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
  }

  /* 하단 CTA 바 */
  .footer-cta {
    z-index: 2;
    background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
    border-radius: 22px;
    padding: 24px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 16px 36px rgba(99, 102, 241, 0.4);
  }
  .cta-text-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cta-title {
    font-size: 24px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: -0.02em;
  }
  .cta-desc {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
  }
  .cta-action {
    background: #ffffff;
    color: #1e1b4b;
    font-size: 20px;
    font-weight: 800;
    padding: 14px 28px;
    border-radius: 14px;
    letter-spacing: -0.02em;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
</style>
</head>
<body>
  <div class="glow-top"></div>

  <!-- 상단 타이틀 -->
  <div class="header-section">
    <div class="brand-badge">
      <span class="dot"></span>
      my김변 — 1:1 맞춤 채무관리 플랫폼
    </div>
    <h1 class="main-title">
      여러 변호사 동시 상담받고<br>
      <span class="gradient-text">원하는 변호사 직접 선택</span>
    </h1>
    <p class="sub-title">
      신청 전 진단부터 진행 중 사건 사후관리까지 끝까지 함께합니다
    </p>
  </div>

  <!-- 3대 핵심 서비스 장점 카드 -->
  <div class="card-container">
    <!-- 장점 1 -->
    <div class="feature-card primary">
      <div class="icon-box icon-purple">⚖️</div>
      <div class="card-content">
        <div class="card-tag">DIRECT MULTI-CONSULT</div>
        <div class="card-heading">여러 변호사 동시 상담 &amp; 직접 선택</div>
        <div class="card-sub">내 채무 등록 한 번으로 여러 전문 변호사의 해결 전략과 수임료 꼼꼼 비교</div>
      </div>
    </div>

    <!-- 장점 2 -->
    <div class="feature-card">
      <div class="icon-box icon-blue">🔄</div>
      <div class="card-content">
        <div class="card-tag">ONGOING POST-CARE</div>
        <div class="card-heading">
          이미 회생 진행 중이어도 사후 케어
          <span class="pill">전담 관리</span>
        </div>
        <div class="card-sub">변제금 미납·연체, 소득변동에 따른 조건부 인가, 폐지 위기 방어까지 관리</div>
      </div>
    </div>

    <!-- 장점 3 -->
    <div class="feature-card">
      <div class="icon-box icon-emerald">🛡️</div>
      <div class="card-content">
        <div class="card-tag">100% STEALTH PRIVACY</div>
        <div class="card-heading">실명 없는 100% 가명 안심 진단</div>
        <div class="card-sub">가족·직장 모르게 개인정보 노출 걱정 없는 안전한 자가진단 및 상담</div>
      </div>
    </div>
  </div>

  <!-- 하단 CTA 바 -->
  <div class="footer-cta">
    <div class="cta-text-left">
      <div class="cta-title">실명 없이 3분 만에 내 상황 체크하기</div>
      <div class="cta-desc">개인회생·파산·신용회복 가장 알맞은 해결 방향을 확인하세요</div>
    </div>
    <div class="cta-action">
      무료 진단 시작하기 ➔
    </div>
  </div>
</body>
</html>
`;

async function generateBanners() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outDir = path.join('C:', 'Users', 'JSH', 'Downloads');
  
  // 1. Landscape 1200x628
  console.log('Rendering landscape banner (1200x628)...');
  const pageLandscape = await browser.newPage();
  await pageLandscape.setViewport({ width: 1200, height: 628, deviceScaleFactor: 2 });
  await pageLandscape.setContent(landscapeHtml, { waitUntil: 'networkidle0' });
  const landscapePath = path.join(outDir, 'mykim_service_ad_landscape.jpg');
  await pageLandscape.screenshot({ path: landscapePath, type: 'jpeg', quality: 95 });
  await pageLandscape.close();
  console.log('Saved:', landscapePath);

  // 2. Square 1200x1200
  console.log('Rendering square banner (1200x1200)...');
  const pageSquare = await browser.newPage();
  await pageSquare.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });
  await pageSquare.setContent(squareHtml, { waitUntil: 'networkidle0' });
  const squarePath = path.join(outDir, 'mykim_service_ad_square.jpg');
  await pageSquare.screenshot({ path: squarePath, type: 'jpeg', quality: 95 });
  await pageSquare.close();
  console.log('Saved:', squarePath);

  await browser.close();
  console.log('All banners generated successfully!');
}

generateBanners().catch(console.error);
