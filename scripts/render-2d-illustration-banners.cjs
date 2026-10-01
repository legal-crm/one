const puppeteer = require('puppeteer');
const path = require('path');

// 머리카락이 풍성하고 단정하게 살아있는 2D 플랫 변호사 군단 일러스트레이션
const lawyersSvgIllustration = `
<svg viewBox="0 0 540 480" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 은은한 후광 배경 -->
  <circle cx="270" cy="240" r="190" fill="url(#bgGlow)" opacity="0.65"/>
  
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="#6366f1" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#070a12" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="suit1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="suit2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="suit3" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="hairDark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="hairBrown" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3f2e21"/>
      <stop offset="100%" stop-color="#1c140d"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <filter id="shadowFlt" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <!-- ==================== 1. 좌측 변호사 (남성 / 댄디 가르마펌) ==================== -->
  <g id="lawyer-left" filter="url(#shadowFlt)">
    <!-- 뒤통수 머리 베이스 -->
    <path d="M125 180 C120 120, 150 95, 180 95 C215 95, 235 120, 230 180 C230 210, 225 230, 215 240 L135 240 C128 220, 125 200, 125 180 Z" fill="url(#hairDark)"/>
    
    <!-- 몸통 수트 -->
    <path d="M75 430 C75 320, 115 270, 180 270 C245 270, 275 320, 275 430 Z" fill="url(#suit1)"/>
    <polygon points="180,270 195,340 180,370 165,340" fill="#ffffff"/>
    <polygon points="180,280 187,350 180,375 173,350" fill="#38bdf8"/>
    <path d="M145 270 L180 350 L165 270 Z" fill="#334155"/>
    <path d="M215 270 L180 350 L195 270 Z" fill="#334155"/>
    
    <!-- 목 -->
    <rect x="167" y="240" width="26" height="35" rx="6" fill="#fde68a"/>
    <!-- 얼굴 (V라인 턱) -->
    <path d="M145 175 C145 150, 215 150, 215 175 C215 220, 195 245, 180 248 C165 245, 145 220, 145 175 Z" fill="#fef3c7"/>
    <!-- 귀 -->
    <circle cx="144" cy="185" r="9" fill="#fde68a"/>
    <circle cx="216" cy="185" r="9" fill="#fde68a"/>

    <!-- 풍성한 앞머리 & 가르마 덮개 (얼굴 위 레이어) -->
    <path d="M130 165 C132 110, 160 92, 180 92 C210 92, 230 110, 226 160 C220 145, 205 135, 185 138 C165 140, 150 150, 145 168 C140 172, 133 175, 130 165 Z" fill="url(#hairDark)"/>
    <!-- 자연스러운 이마 가르마 텍스처 -->
    <path d="M165 138 C175 150, 190 152, 210 145 C205 138, 195 135, 180 135 C172 135, 168 136, 165 138 Z" fill="#18181b"/>

    <!-- 이목구비 -->
    <ellipse cx="163" cy="180" rx="3.5" ry="4" fill="#0f172a"/>
    <ellipse cx="197" cy="180" rx="3.5" ry="4" fill="#0f172a"/>
    <!-- 눈썹 -->
    <path d="M156 170 Q164 167 172 171" stroke="#09090b" stroke-width="3" stroke-linecap="round"/>
    <path d="M188 171 Q196 167 204 170" stroke="#09090b" stroke-width="3" stroke-linecap="round"/>
    <!-- 미소 -->
    <path d="M170 205 Q180 215 190 205" stroke="#b45309" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- ==================== 2. 우측 변호사 (남성 / 스마트 가르마 & 안경) ==================== -->
  <g id="lawyer-right" filter="url(#shadowFlt)">
    <!-- 뒤통수 머리 베이스 -->
    <path d="M305 180 C300 120, 330 95, 360 95 C395 95, 415 120, 410 180 C410 210, 405 230, 395 240 L315 240 C308 220, 305 200, 305 180 Z" fill="url(#hairDark)"/>

    <!-- 몸통 수트 -->
    <path d="M265 430 C265 320, 295 270, 360 270 C425 270, 465 320, 465 430 Z" fill="url(#suit3)"/>
    <polygon points="360,270 375,340 360,370 345,340" fill="#ffffff"/>
    <polygon points="360,280 367,350 360,375 353,350" fill="#818cf8"/>
    <path d="M325 270 L360 350 L345 270 Z" fill="#475569"/>
    <path d="M395 270 L360 350 L375 270 Z" fill="#475569"/>

    <!-- 목 -->
    <rect x="347" y="240" width="26" height="35" rx="6" fill="#fde68a"/>
    <!-- 얼굴 -->
    <path d="M325 175 C325 150, 395 150, 395 175 C395 220, 375 245, 360 248 C345 245, 325 220, 325 175 Z" fill="#fef3c7"/>
    <!-- 귀 -->
    <circle cx="324" cy="185" r="9" fill="#fde68a"/>
    <circle cx="396" cy="185" r="9" fill="#fde68a"/>

    <!-- 풍성한 윗머리 & 7:3 가르마 헤어 (얼굴 위 레이어) -->
    <path d="M310 165 C312 108, 340 92, 360 92 C390 92, 410 108, 406 160 C398 142, 380 132, 360 135 C345 138, 330 148, 325 168 C320 172, 313 175, 310 165 Z" fill="url(#hairDark)"/>
    <path d="M345 135 C358 148, 375 150, 395 142 C388 136, 378 133, 362 133 Z" fill="#18181b"/>

    <!-- 안경 & 이목구비 -->
    <rect x="334" y="170" width="22" height="17" rx="5" fill="none" stroke="#64748b" stroke-width="2.5"/>
    <rect x="364" y="170" width="22" height="17" rx="5" fill="none" stroke="#64748b" stroke-width="2.5"/>
    <line x1="356" y1="178" x2="364" y2="178" stroke="#64748b" stroke-width="2.5"/>
    <circle cx="345" cy="178" r="3" fill="#0f172a"/>
    <circle cx="375" cy="178" r="3" fill="#0f172a"/>
    <!-- 눈썹 -->
    <path d="M336 163 Q345 160 353 163" stroke="#09090b" stroke-width="3" stroke-linecap="round"/>
    <path d="M367 163 Q375 160 384 163" stroke="#09090b" stroke-width="3" stroke-linecap="round"/>
    <!-- 미소 -->
    <path d="M350 205 Q360 215 370 205" stroke="#b45309" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- ==================== 3. 중앙 메인 변호사 (여성 / 풍성한 롱 볼륨 헤어) ==================== -->
  <g id="lawyer-center" filter="url(#shadowFlt)">
    <!-- 뒤로 흘러내리는 풍성한 롱 헤어 베이스 -->
    <path d="M205 160 C200 85, 240 68, 270 68 C300 68, 340 85, 335 160 C335 240, 345 320, 320 350 L220 350 C195 320, 205 240, 205 160 Z" fill="url(#hairBrown)"/>

    <!-- 몸통 수트 -->
    <path d="M175 440 C175 300, 210 250, 270 250 C330 250, 365 300, 365 440 Z" fill="url(#suit2)"/>
    <polygon points="270,250 290,330 270,360 250,330" fill="#ffffff"/>
    <path d="M235 250 L270 330 L250 250 Z" fill="#1d4ed8"/>
    <path d="M305 250 L270 330 L290 250 Z" fill="#1d4ed8"/>

    <!-- 목 -->
    <rect x="257" y="210" width="26" height="42" rx="6" fill="#fde68a"/>
    <!-- 얼굴 (갸름한 계란형) -->
    <path d="M236 160 C236 130, 304 130, 304 160 C304 210, 285 235, 270 238 C255 235, 236 210, 236 160 Z" fill="#fffbeb"/>
    <!-- 귀 -->
    <circle cx="236" cy="172" r="8" fill="#fde68a"/>
    <circle cx="304" cy="172" r="8" fill="#fde68a"/>

    <!-- 풍성한 여성 앞머리 & 사이드 볼륨 (얼굴 위 레이어) -->
    <path d="M210 145 C215 80, 250 68, 270 68 C290 68, 325 80, 330 145 C320 120, 298 105, 270 105 C242 105, 220 120, 210 145 Z" fill="url(#hairBrown)"/>
    <!-- 옆머리가 얼굴 라인을 타고 내려오는 스타일 -->
    <path d="M210 145 C215 180, 225 220, 238 250 C232 230, 225 190, 222 160 Z" fill="#2d2117"/>
    <path d="M330 145 C325 180, 315 220, 302 250 C308 230, 315 190, 318 160 Z" fill="#2d2117"/>
    <!-- 앞머리 볼륨 가르마 라인 -->
    <path d="M245 115 C255 128, 275 130, 290 120 C280 112, 268 110, 255 110 Z" fill="#231911"/>

    <!-- 이목구비 -->
    <ellipse cx="255" cy="168" rx="3.5" ry="4" fill="#0f172a"/>
    <ellipse cx="285" cy="168" rx="3.5" ry="4" fill="#0f172a"/>
    <path d="M248 158 Q255 154 262 157" stroke="#231911" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M278 157 Q285 154 292 158" stroke="#231911" stroke-width="2.5" stroke-linecap="round"/>
    <!-- 밝고 따뜻한 미소 -->
    <path d="M259 190 Q270 200, 281 190" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>

    <!-- 손에 든 법률 태블릿/차트 -->
    <g transform="translate(215, 330) rotate(-6)">
      <rect x="0" y="0" width="112" height="92" rx="12" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/>
      <line x1="18" y1="24" x2="68" y2="24" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      <line x1="18" y1="42" x2="92" y2="42" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <line x1="18" y1="56" x2="82" y2="56" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <line x1="18" y1="70" x2="60" y2="70" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <circle cx="94" cy="24" r="6" fill="#10b981"/>
    </g>
  </g>

  <!-- ==================== 4. 전면 법률 천칭 저울 & 쉴드 심볼 ==================== -->
  <g transform="translate(385, 270)" filter="url(#shadowFlt)">
    <!-- 2D 쉴드 (방패) -->
    <path d="M40 0 L75 14 C75 48, 52 75, 40 85 C28 75, 5 48, 5 14 Z" fill="url(#cyanGrad)" stroke="#ffffff" stroke-width="2.5"/>
    <path d="M40 10 L65 20 C65 46, 48 66, 40 73 C32 66, 15 46, 15 20 Z" fill="#0f172a" opacity="0.4"/>
    <path d="M30 42 L37 49 L52 33" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <g transform="translate(25, 260)" filter="url(#shadowFlt)">
    <!-- 2D 천칭 저울 -->
    <rect x="42" y="15" width="6" height="70" rx="3" fill="url(#goldGrad)"/>
    <rect x="25" y="80" width="40" height="8" rx="4" fill="url(#goldGrad)"/>
    <rect x="10" y="20" width="70" height="5" rx="2.5" fill="url(#goldGrad)"/>
    <circle cx="45" cy="16" r="6" fill="#fbbf24"/>
    <line x1="18" y1="23" x2="8" y2="45" stroke="#fbbf24" stroke-width="2"/>
    <line x1="18" y1="23" x2="28" y2="45" stroke="#fbbf24" stroke-width="2"/>
    <path d="M6 45 Q18 53 30 45 Z" fill="url(#goldGrad)"/>
    <line x1="72" y1="23" x2="62" y2="45" stroke="#fbbf24" stroke-width="2"/>
    <line x1="72" y1="23" x2="82" y2="45" stroke="#fbbf24" stroke-width="2"/>
    <path d="M60 45 Q72 53 84 45 Z" fill="url(#goldGrad)"/>
  </g>
</svg>
`;

// 1. 가로형 배너 (1200x628)
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
    background: #070a12;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 80px 0 90px;
    position: relative;
    overflow: hidden;
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 1;
  }
  .bg-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    right: 50px;
    top: 20px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.06) 50%, transparent 70%);
    filter: blur(80px);
    z-index: 1;
  }

  .left-area {
    position: relative;
    z-index: 2;
    max-width: 580px;
  }

  .main-copy {
    font-size: 60px;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: -0.04em;
    color: #ffffff;
    word-break: keep-all;
  }

  .highlight {
    color: #38bdf8;
    display: block;
    margin-top: 10px;
  }

  .right-area {
    position: relative;
    z-index: 2;
    width: 490px;
    height: 480px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-glow"></div>

  <div class="left-area">
    <h1 class="main-copy">
      여러 개인회생 변호사를
      <span class="highlight">동시 비교 후 선택</span>
    </h1>
  </div>

  <div class="right-area">
    ${lawyersSvgIllustration}
  </div>
</body>
</html>
`;

// 2. 정사각형 배너 (1200x1200)
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
    background: #070a12;
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 120px 80px 60px;
    position: relative;
    overflow: hidden;
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    z-index: 1;
  }
  .bg-glow {
    position: absolute;
    width: 800px;
    height: 800px;
    left: 200px;
    top: 400px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 70%);
    filter: blur(100px);
    z-index: 1;
  }

  .top-area {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 1000px;
  }

  .main-copy {
    font-size: 76px;
    font-weight: 900;
    line-height: 1.22;
    letter-spacing: -0.04em;
    color: #ffffff;
    word-break: keep-all;
  }

  .highlight {
    color: #38bdf8;
    display: block;
    margin-top: 14px;
  }

  .bottom-area {
    position: relative;
    z-index: 2;
    width: 680px;
    height: 640px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-glow"></div>

  <div class="top-area">
    <h1 class="main-copy">
      여러 개인회생 변호사를
      <span class="highlight">동시 비교 후 선택</span>
    </h1>
  </div>

  <div class="bottom-area">
    ${lawyersSvgIllustration}
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
  console.log('Rendering banners with natural hairstyle...');
  const pageLandscape = await browser.newPage();
  await pageLandscape.setViewport({ width: 1200, height: 628, deviceScaleFactor: 2 });
  await pageLandscape.setContent(landscapeHtml, { waitUntil: 'networkidle0' });
  const landscapePath = path.join(outDir, 'mykim_google_ad_landscape.jpg');
  await pageLandscape.screenshot({ path: landscapePath, type: 'jpeg', quality: 95 });
  await pageLandscape.close();
  console.log('Saved:', landscapePath);

  // 2. Square 1200x1200
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
