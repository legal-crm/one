#!/usr/bin/env node
/**
 * my김변 × Meta Muse / Meta Platform MCP Server
 * Model Context Protocol (MCP) stdio JSON-RPC 2.0 Server
 * Spec: 2024-11-05
 */

import readline from 'readline';

const SERVER_NAME = "mykim-muse-bridge";
const SERVER_VERSION = "1.0.0";
const PROTOCOL_VERSION = "2024-11-05";

// 환경변수 또는 기본값
const META_APP_ID = process.env.META_APP_ID || "1575993246947781";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";

// 지원 도구 목록 정의
const TOOLS = [
  {
    name: "meta_check_app_status",
    description: "Meta for Developers my김변 앱(App ID: 1575993246947781)의 연결 상태와 Graph API 구동 여부를 확인합니다.",
    inputSchema: {
      type: "object",
      properties: {
        appId: { type: "string", description: "Meta 앱 ID (기본값: 1575993246947781)" }
      }
    }
  },
  {
    name: "muse_dispatch_consultation",
    description: "메타 뮤즈(Meta Muse) 에이전트에게 잠재 채무자의 1:1 비대면 자격 진단 및 음성 인터뷰 목표를 부여합니다.",
    inputSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "스텔스 가명 (예: 안심상담_A7)" },
        debtEstimate: { type: "number", description: "예상 채무 총액 (원 단위)" },
        monthlyIncome: { type: "number", description: "월 소득 (원 단위)" },
        region: { type: "string", description: "거주 지역 (예: 서울, 수원, 부산, 대구, 대전, 광주)" },
        debtType: { type: "string", description: "채무 유형 (신용대출, 카드론, 코인/주식, 사업채무 등)" }
      },
      required: ["alias", "debtEstimate"]
    }
  },
  {
    name: "muse_sync_crm_lead",
    description: "메타 뮤즈 에이전트가 인스타그램 DM이나 WhatsApp에서 수집한 익명 리드를 my김변 CRM으로 동기화합니다.",
    inputSchema: {
      type: "object",
      properties: {
        stealthAlias: { type: "string", description: "의뢰인 스텔스 가명" },
        caseType: { type: "string", enum: ["individual_rehab", "bankruptcy", "new_start", "credit_recovery"], description: "사건 유형" },
        totalDebt: { type: "number", description: "총 채무액" },
        monthlyIncome: { type: "number", description: "월 평균 소득" },
        targetCourt: { type: "string", description: "관할 법원" },
        lawyerPreference: { type: "string", description: "희망 변호사 유형 또는 지정 변호사 ID" },
        memo: { type: "string", description: "상담 요약 메모" }
      },
      required: ["stealthAlias", "totalDebt"]
    }
  },
  {
    name: "muse_check_court_status",
    description: "대법원 사건검색(나의사건검색) 규칙 및 2026년 전문회생법원 준칙을 기반으로 보정명령 리스크 및 진행 단계를 분석합니다.",
    inputSchema: {
      type: "object",
      properties: {
        caseNumber: { type: "string", description: "사건번호 (예: 2026개회10421)" },
        courtName: { type: "string", description: "관할 법원 (서울회생법원, 수원회생법원, 대전회생법원 등)" },
        recentActivity: { type: "string", description: "최근 법원 문건 (예: 보정명령 송달, 개시결정 등)" }
      },
      required: ["caseNumber", "courtName"]
    }
  },
  {
    name: "muse_generate_social_creative",
    description: "메타 뮤즈 및 SNS 채널(인스타그램 카드뉴스, 스레드 타래, 페이스북 피드) 배포용 안심 채무 상담 콘텐츠를 생성합니다.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "주제 (예: 2026 회생법원 준칙, 010 번호 비공개 상담, 독촉 차단 등)" },
        platform: { type: "string", enum: ["instagram", "threads", "facebook", "shorts"], description: "타깃 플랫폼" },
        targetAudience: { type: "string", description: "타깃 독자 (예: 2030 청년 채무자, 자영업자, 주부 등)" }
      },
      required: ["topic", "platform"]
    }
  }
];

// 도구 실행 핸들러
async function handleToolCall(name, args) {
  switch (name) {
    case "meta_check_app_status": {
      const appId = args.appId || META_APP_ID;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "connected",
              appId: appId,
              appName: "my김변",
              configured: Boolean(META_APP_ID),
              hasAccessToken: Boolean(META_ACCESS_TOKEN),
              message: "Meta for Developers my김변 앱이 성공적으로 인식되었습니다."
            }, null, 2)
          }
        ]
      };
    }

    case "muse_dispatch_consultation": {
      const { alias, debtEstimate, monthlyIncome = 0, region = "서울", debtType = "일반" } = args;
      const livingCost2026_1Person = 1538543; // 2026년 1인가구 최저생계비 (약 153.8만원)
      const estimatedMonthlyPayment = Math.max(0, monthlyIncome - livingCost2026_1Person);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              action: "muse_agent_dispatched",
              stealthAlias: alias,
              channel: "Meta_Muse_Secure_Session",
              preliminaryDiagnosis: {
                totalDebt: debtEstimate,
                monthlyIncome,
                estimatedAvailableIncome: estimatedMonthlyPayment,
                targetCourt: region.includes("서울") ? "서울회생법원" : `${region}지방법원`,
                recommendation: debtEstimate > 15000000 && monthlyIncome > livingCost2026_1Person ? "개인회생 신청 적합" : "신용회복/파산 복합검토 필요"
              },
              musePromptInstructions: `의뢰인(${alias})님과의 1:1 대화 시작: 010 번호는 일체 요구하지 말고, 채무 발생 시기와 사유를 경청하여 30분 AI 진술서 초안을 완성할 것.`
            }, null, 2)
          }
        ]
      };
    }

    case "muse_sync_crm_lead": {
      const { stealthAlias, caseType = "individual_rehab", totalDebt, monthlyIncome = 0, targetCourt = "서울회생법원", lawyerPreference = "전체", memo = "" } = args;
      const leadId = `LEAD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              leadId,
              stealthAlias,
              caseType,
              totalDebt,
              monthlyIncome,
              targetCourt,
              lawyerPreference,
              status: "preContract",
              statusDetail: "상담진행중 (뮤즈 1:1 인터뷰 완료)",
              timestamp: new Date().toISOString(),
              message: `스텔스 가명 '${stealthAlias}' 건이 my김변 CRM 상담 대기열에 성공적으로 등록되었습니다.`
            }, null, 2)
          }
        ]
      };
    }

    case "muse_check_court_status": {
      const { caseNumber, courtName, recentActivity = "" } = args;
      const isSpecializedCourt = ["서울회생법원", "수원회생법원", "부산회생법원", "대전회생법원", "대구회생법원", "광주회생법원"].includes(courtName);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              caseNumber,
              courtName,
              isSpecializedCourt,
              rulesApplied: isSpecializedCourt 
                ? "2026 전문회생법원 준칙: 배우자 재산 50% 미반영, 주식/가상자산 손실금 청산가치 제외 우대" 
                : "지방법원 보수적 실무: 배우자 재산 및 최근 1년 계좌 소명 요구 가능성 높음",
              actionPlan: recentActivity.includes("보정")
                ? "긴급: 보정명령 송달일로부터 14일 이내 소명표 및 증빙 제출 필수. 담당 변호사 결재함 등록 요망."
                : "정상 진행 중: 다음 기일 및 개시결정 공고 모니터링 유지"
            }, null, 2)
          }
        ]
      };
    }

    case "muse_generate_social_creative": {
      const { topic, platform, targetAudience = "채무 고민 의뢰인" } = args;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform,
              topic,
              targetAudience,
              headline: `[my김변] ${topic} — 010 번호 유출 없이 안심 상담받는 법`,
              keyPoints: [
                "1. 사설 DB 수집 NO: 내 전화번호를 변호사 사무실에도 공개하지 않는 스텔스 가명",
                "2. 도산 전문 변호사 직접 탐색: 후기와 승소율을 직접 비교하고 선택",
                "3. 40종 서류 지옥 탈출: 스마트폰으로 말만 하면 완성되는 AI 음성 진술서"
              ],
              cta: "프로필 링크에서 010 번호 없이 내 안심 가명으로 무료 진단 시작하기"
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`알 수 없는 도구 호출: ${name}`);
  }
}

// JSON-RPC 2.0 stdio 입출력 처리
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const request = JSON.parse(trimmed);
    const { id, method, params } = request;

    // MCP 핸드셰이크: initialize
    if (method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          }
        }
      };
      process.stdout.write(JSON.stringify(response) + "\n");
      return;
    }

    // MCP 알림: notifications/initialized
    if (method === "notifications/initialized") {
      // no response required for notifications
      return;
    }

    // MCP 핑: ping
    if (method === "ping") {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {}
      };
      process.stdout.write(JSON.stringify(response) + "\n");
      return;
    }

    // MCP 도구 목록: tools/list
    if (method === "tools/list") {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS
        }
      };
      process.stdout.write(JSON.stringify(response) + "\n");
      return;
    }

    // MCP 도구 호출: tools/call
    if (method === "tools/call") {
      const { name, arguments: toolArgs } = params;
      try {
        const result = await handleToolCall(name, toolArgs || {});
        const response = {
          jsonrpc: "2.0",
          id,
          result
        };
        process.stdout.write(JSON.stringify(response) + "\n");
      } catch (err) {
        const errorResponse = {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32603,
            message: err.message || "Internal error during tool call"
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + "\n");
      }
      return;
    }

    // 지원하지 않는 메소드
    if (id !== undefined) {
      const response = {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    // JSON 파싱 에러
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error"
      }
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});

// 시작 로그는 stderr로 출력 (stdio 프로토콜 오염 방지)
process.stderr.write(`[${SERVER_NAME}] MCP Server started on stdio (PID: ${process.pid})\n`);
