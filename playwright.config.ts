import { defineConfig, devices } from '@playwright/test';

// 연동 시험(29 기획서 X-01~X-17)용 설정.
// 기본 대상은 로컬 개발 서버. 다른 주소는 E2E_BASE_URL로 지정한다.
// 운영 주소로 돌릴 때는 시험 계정·'TEST_' 데이터만 쓰고, 알림톡·세금계산서 실제 발송에 주의한다.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
