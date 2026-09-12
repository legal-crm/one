/**
 * 주요 금융기관 및 공공기관 법원 송달용 공식 본점 주소 디렉토리 DB
 * - 대법원 전자소송 개인회생/파산 채권자목록 작성용
 * - 본점 주소, 송달장소, 대표자, 법인/사업자번호, 우편번호 포함
 */

export interface CreditorDirectoryItem {
  id: string;
  officialName: string;          // 정식 법인명 (예: 주식회사 국민은행)
  alias: string[];               // 검색용 별칭/유사어 (예: ['국민은행', 'KB국민은행', 'KB', '국민'])
  category: 'BANK' | 'CARD' | 'CAPITAL' | 'SAVINGS_BANK' | 'LOAN_NPL' | 'PUBLIC_AGENCY';
  categoryLabel: string;
  representative: string;        // 대표자
  bizNumber: string;             // 사업자/법인등록번호
  zipCode: string;               // 우편번호 (5자리)
  address: string;               // 본점 소재지 (법인등기부상 주소)
  serviceAddress: string;        // 법원 우편물 송달장소
  phone?: string;                // 대표 전화
  isPriorityDefault?: boolean;   // 조세/4대보험 우선권 기본값 여부
}

export const CREDITOR_DIRECTORY: CreditorDirectoryItem[] = [
  // ── 1. 시중은행 및 특수은행 ──
  {
    id: 'kb_bank',
    officialName: '주식회사 국민은행',
    alias: ['국민은행', 'KB국민은행', 'KB', '국민'],
    category: 'BANK',
    categoryLabel: '시중은행',
    representative: '은행장 이재근',
    bizNumber: '201-81-47789',
    zipCode: '07331',
    address: '서울특별시 영등포구 의사당대로 141 (여의도동)',
    serviceAddress: '서울특별시 영등포구 의사당대로 141, 여의도영업부 (법원송달팀)',
    phone: '1588-9999'
  },
  {
    id: 'shinhan_bank',
    officialName: '주식회사 신한은행',
    alias: ['신한은행', '신한', 'SHINHAN'],
    category: 'BANK',
    categoryLabel: '시중은행',
    representative: '은행장 정상혁',
    bizNumber: '202-81-50707',
    zipCode: '04513',
    address: '서울특별시 중구 세종대로9길 20 (태평로2가)',
    serviceAddress: '서울특별시 중구 세종대로9길 20, 본점 여신관리부',
    phone: '1599-8000'
  },
  {
    id: 'woori_bank',
    officialName: '주식회사 우리은행',
    alias: ['우리은행', '우리', 'WOORI'],
    category: 'BANK',
    categoryLabel: '시중은행',
    representative: '은행장 조병규',
    bizNumber: '201-81-42515',
    zipCode: '04632',
    address: '서울특별시 중구 소공로 51 (회현동1가)',
    serviceAddress: '서울특별시 중구 소공로 51, 여신감리부 법무팀',
    phone: '1588-5000'
  },
  {
    id: 'hana_bank',
    officialName: '주식회사 하나은행',
    alias: ['하나은행', '하나', 'KEB하나', '외환은행'],
    category: 'BANK',
    categoryLabel: '시중은행',
    representative: '은행장 이호성',
    bizNumber: '202-81-43254',
    zipCode: '04538',
    address: '서울특별시 중구 을지로 35 (을지로1가)',
    serviceAddress: '서울특별시 중구 을지로 35, 본점 관리부문 법무지원부',
    phone: '1599-1111'
  },
  {
    id: 'ibk_bank',
    officialName: '중소기업은행',
    alias: ['기업은행', 'IBK기업은행', 'IBK', '중소기업은행'],
    category: 'BANK',
    categoryLabel: '특수은행',
    representative: '은행장 김성태',
    bizNumber: '201-83-00049',
    zipCode: '04541',
    address: '서울특별시 중구 을지로 79 (을지로2가)',
    serviceAddress: '서울특별시 중구 을지로 79, 본점 여신관리부',
    phone: '1588-2588'
  },
  {
    id: 'nh_bank',
    officialName: '농협은행 주식회사',
    alias: ['농협은행', 'NH농협은행', '농협', 'NH농협', '단위농협'],
    category: 'BANK',
    categoryLabel: '특수은행',
    representative: '은행장 이석용',
    bizNumber: '104-86-39742',
    zipCode: '04517',
    address: '서울특별시 중구 통일로 120 (충정로1가)',
    serviceAddress: '서울특별시 중구 통일로 120, 본점 여신감리부',
    phone: '1661-3000'
  },
  {
    id: 'kakao_bank',
    officialName: '주식회사 카카오뱅크',
    alias: ['카카오뱅크', '카카오', '카뱅'],
    category: 'BANK',
    categoryLabel: '인터넷전문은행',
    representative: '대표이사 윤호영',
    bizNumber: '375-88-00197',
    zipCode: '13529',
    address: '경기도 성남시 분당구 분당내곡로 131, 판교테크원타워 11층 (백현동)',
    serviceAddress: '경기도 성남시 분당구 분당내곡로 131, 판교테크원타워 11층 법무팀',
    phone: '1599-3333'
  },
  {
    id: 'k_bank',
    officialName: '주식회사 케이뱅크',
    alias: ['케이뱅크', '케이', 'K뱅크'],
    category: 'BANK',
    categoryLabel: '인터넷전문은행',
    representative: '은행장 최우형',
    bizNumber: '713-88-00508',
    zipCode: '04539',
    address: '서울특별시 중구 을지로 170, 을지트윈타워 동관 16층 (을지로4가)',
    serviceAddress: '서울특별시 중구 을지로 170, 을지트윈타워 동관 16층 여신관리팀',
    phone: '1522-1000'
  },
  {
    id: 'toss_bank',
    officialName: '토스뱅크 주식회사',
    alias: ['토스뱅크', '토스', '비바리퍼블리카'],
    category: 'BANK',
    categoryLabel: '인터넷전문은행',
    representative: '대표이사 이은미',
    bizNumber: '394-88-01869',
    zipCode: '06133',
    address: '서울특별시 강남구 테헤란로 142, 아크플레이스 12층 (역삼동)',
    serviceAddress: '서울특별시 강남구 테헤란로 142, 아크플레이스 12층 법무지원팀',
    phone: '1661-7654'
  },
  {
    id: 'sc_bank',
    officialName: '한국스탠다드차타드은행',
    alias: ['SC제일은행', '스탠다드차타드', '제일은행'],
    category: 'BANK',
    categoryLabel: '시중은행',
    representative: '은행장 박종복',
    bizNumber: '101-81-04480',
    zipCode: '03160',
    address: '서울특별시 종로구 종로 47 (공평동)',
    serviceAddress: '서울특별시 종로구 종로 47, 본점 소송지원팀',
    phone: '1588-1599'
  },

  // ── 2. 신용카드사 ──
  {
    id: 'shinhan_card',
    officialName: '신한카드 주식회사',
    alias: ['신한카드', '신한', 'LG카드'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 문동권',
    bizNumber: '202-81-48079',
    zipCode: '04543',
    address: '서울특별시 중구 을지로 100, 파인에비뉴 A동 (을지로2가)',
    serviceAddress: '서울특별시 중구 을지로 100, 파인에비뉴 A동 사후관리팀',
    phone: '1544-7000'
  },
  {
    id: 'kb_card',
    officialName: 'KB국민카드 주식회사',
    alias: ['국민카드', 'KB국민카드', 'KB카드'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 이창권',
    bizNumber: '101-86-66471',
    zipCode: '03169',
    address: '서울특별시 종로구 새문안로3길 30 (내수동)',
    serviceAddress: '서울특별시 종로구 새문안로3길 30, 본점 법률지원부',
    phone: '1588-1688'
  },
  {
    id: 'samsung_card',
    officialName: '삼성카드 주식회사',
    alias: ['삼성카드', '삼성'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 김대환',
    bizNumber: '202-81-44759',
    zipCode: '04513',
    address: '서울특별시 중구 세종대로 67 (태평로2가)',
    serviceAddress: '서울특별시 중구 세종대로 67, 본사 채권관리운영팀',
    phone: '1588-8700'
  },
  {
    id: 'hyundai_card',
    officialName: '현대카드 주식회사',
    alias: ['현대카드', '현대'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 정태영',
    bizNumber: '213-86-13042',
    zipCode: '07242',
    address: '서울특별시 영등포구 의사당대로 3 (여의도동)',
    serviceAddress: '서울특별시 영등포구 의사당대로 3, 본점 채권관리센터',
    phone: '1577-6000'
  },
  {
    id: 'lotte_card',
    officialName: '롯데카드 주식회사',
    alias: ['롯데카드', '롯데'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 조좌진',
    bizNumber: '104-81-81765',
    zipCode: '03161',
    address: '서울특별시 종로구 새문안로 76, 콘코디언빌딩 (신문로1가)',
    serviceAddress: '서울특별시 종로구 새문안로 76, 콘코디언빌딩 8층 채권관리팀',
    phone: '1588-8100'
  },
  {
    id: 'woori_card',
    officialName: '우리카드 주식회사',
    alias: ['우리카드'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 박완식',
    bizNumber: '101-86-77457',
    zipCode: '03154',
    address: '서울특별시 종로구 종로1길 50, 더케이트윈타워 B동 (중학동)',
    serviceAddress: '서울특별시 종로구 종로1길 50, 더케이트윈타워 B동 사후관리부',
    phone: '1588-9955'
  },
  {
    id: 'hana_card',
    officialName: '하나카드 주식회사',
    alias: ['하나카드', '외환카드'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 이호성',
    bizNumber: '104-86-53874',
    zipCode: '04538',
    address: '서울특별시 중구 을지로 66 (을지로2가)',
    serviceAddress: '서울특별시 중구 을지로 66, 본점 채권기획팀',
    phone: '1800-1111'
  },
  {
    id: 'bc_card',
    officialName: '비씨카드 주식회사',
    alias: ['비씨카드', 'BC카드', '비씨'],
    category: 'CARD',
    categoryLabel: '카드사',
    representative: '대표이사 최원석',
    bizNumber: '214-81-37726',
    zipCode: '04543',
    address: '서울특별시 중구 을지로 170, 을지트윈타워 동관 (을지로4가)',
    serviceAddress: '서울특별시 중구 을지로 170, 을지트윈타워 동관 법무지원실',
    phone: '1588-4000'
  },

  // ── 3. 캐피탈 및 할부금융사 ──
  {
    id: 'hyundai_capital',
    officialName: '현대캐피탈 주식회사',
    alias: ['현대캐피탈', '현대'],
    category: 'CAPITAL',
    categoryLabel: '캐피탈',
    representative: '대표이사 목진원',
    bizNumber: '214-86-09252',
    zipCode: '07242',
    address: '서울특별시 영등포구 의사당대로 3 (여의도동)',
    serviceAddress: '서울특별시 영등포구 의사당대로 3, 본점 채권지원팀',
    phone: '1588-2114'
  },
  {
    id: 'kb_capital',
    officialName: 'KB캐피탈 주식회사',
    alias: ['KB캐피탈', '국민캐피탈'],
    category: 'CAPITAL',
    categoryLabel: '캐피탈',
    representative: '대표이사 빈중일',
    bizNumber: '214-81-44754',
    zipCode: '06627',
    address: '서울특별시 서초구 서초대로 301, 동익성봉빌딩 (서초동)',
    serviceAddress: '서울특별시 서초구 서초대로 301, 동익성봉빌딩 채권관리센터',
    phone: '1544-1200'
  },
  {
    id: 'hana_capital',
    officialName: '하나캐피탈 주식회사',
    alias: ['하나캐피탈'],
    category: 'CAPITAL',
    categoryLabel: '캐피탈',
    representative: '대표이사 박승오',
    bizNumber: '214-81-40989',
    zipCode: '06164',
    address: '서울특별시 강남구 테헤란로 127, 하나금융그룹 강남사옥 (역삼동)',
    serviceAddress: '서울특별시 강남구 테헤란로 127, 여신관리팀',
    phone: '1599-7942'
  },
  {
    id: 'jb_woori_capital',
    officialName: 'JB우리캐피탈 주식회사',
    alias: ['JB우리캐피탈', '우리캐피탈'],
    category: 'CAPITAL',
    categoryLabel: '캐피탈',
    representative: '대표이사 박춘원',
    bizNumber: '214-81-41940',
    zipCode: '07326',
    address: '서울특별시 영등포구 여의대로 66, KTB빌딩 (여의도동)',
    serviceAddress: '서울특별시 영등포구 여의대로 66, 8층 채권관리팀',
    phone: '1544-2400'
  },
  {
    id: 'woori_fin_capital',
    officialName: '우리금융캐피탈 주식회사',
    alias: ['우리금융캐피탈', '아주캐피탈'],
    category: 'CAPITAL',
    categoryLabel: '캐피탈',
    representative: '대표이사 정석완',
    bizNumber: '214-81-40980',
    zipCode: '06134',
    address: '서울특별시 강남구 테헤란로 212 (역삼동)',
    serviceAddress: '서울특별시 강남구 테헤란로 212, 10층 여신관리센터',
    phone: '1544-8600'
  },
  {
    id: 'lotte_capital',
    officialName: '롯데캐피탈 주식회사',
    alias: ['롯데캐피탈'],
    category: 'CAPITAL',
    categoryLabel: '캐피탈',
    representative: '대표이사 추광식',
    bizNumber: '214-81-45672',
    zipCode: '06164',
    address: '서울특별시 강남구 테헤란로 134, 포스코타워 역삼 (역삼동)',
    serviceAddress: '서울특별시 강남구 테헤란로 134, 포스코타워 역삼 14층 여신지원팀',
    phone: '1588-4488'
  },

  // ── 4. 저축은행 ──
  {
    id: 'sbi_sb',
    officialName: '에스비아이저축은행 주식회사',
    alias: ['SBI저축은행', 'SBI', '현대스위스'],
    category: 'SAVINGS_BANK',
    categoryLabel: '저축은행',
    representative: '대표이사 김문석',
    bizNumber: '214-81-70020',
    zipCode: '04527',
    address: '서울특별시 중구 통일로 92, 케이지타워 (순화동)',
    serviceAddress: '서울특별시 중구 통일로 92, 케이지타워 15층 채권관리본부',
    phone: '1566-2210'
  },
  {
    id: 'ok_sb',
    officialName: '오케이저축은행 주식회사',
    alias: ['OK저축은행', '오케이저축은행', 'OK', '아프로'],
    category: 'SAVINGS_BANK',
    categoryLabel: '저축은행',
    representative: '대표이사 정길호',
    bizNumber: '214-81-88987',
    zipCode: '04523',
    address: '서울특별시 중구 세종대로 39, 대한서울상공회의소빌딩 10층 (남대문로4가)',
    serviceAddress: '서울특별시 중구 세종대로 39, 상공회의소빌딩 10층 여신관리실',
    phone: '1899-7979'
  },
  {
    id: 'welcome_sb',
    officialName: '웰컴저축은행 주식회사',
    alias: ['웰컴저축은행', '웰컴'],
    category: 'SAVINGS_BANK',
    categoryLabel: '저축은행',
    representative: '대표이사 김대웅',
    bizNumber: '214-81-87612',
    zipCode: '04386',
    address: '서울특별시 용산구 한강대로 148, 웰컴금융타워 (한강로2가)',
    serviceAddress: '서울특별시 용산구 한강대로 148, 웰컴금융타워 11층 리테일채권관리부',
    phone: '1661-0001'
  },
  {
    id: 'pepper_sb',
    officialName: '페퍼저축은행 주식회사',
    alias: ['페퍼저축은행', '페퍼'],
    category: 'SAVINGS_BANK',
    categoryLabel: '저축은행',
    representative: '대표이사 장매튜',
    bizNumber: '129-81-99882',
    zipCode: '13590',
    address: '경기도 성남시 분당구 황새울로 347, 페퍼빌딩 (서현동)',
    serviceAddress: '경기도 성남시 분당구 황새울로 347, 페퍼빌딩 6층 채권관리팀',
    phone: '1599-0722'
  },
  {
    id: 'daol_sb',
    officialName: '다올저축은행 주식회사',
    alias: ['다올저축은행', '유진저축은행', '다올'],
    category: 'SAVINGS_BANK',
    categoryLabel: '저축은행',
    representative: '대표이사 김정수',
    bizNumber: '214-81-85514',
    zipCode: '06134',
    address: '서울특별시 강남구 테헤란로 208 (역삼동)',
    serviceAddress: '서울특별시 강남구 테헤란로 208, 9층 채권관리실',
    phone: '1544-6700'
  },
  {
    id: 'koreainvest_sb',
    officialName: '한국투자저축은행 주식회사',
    alias: ['한국투자저축은행', '한투저축은행'],
    category: 'SAVINGS_BANK',
    categoryLabel: '저축은행',
    representative: '대표이사 전찬우',
    bizNumber: '129-81-42008',
    zipCode: '13595',
    address: '경기도 성남시 분당구 서현로 180 (서현동)',
    serviceAddress: '경기도 성남시 분당구 서현로 180, 본점 리테일채권부',
    phone: '1544-7772'
  },

  // ── 5. 대부업체 및 자산유동화(NPL) ──
  {
    id: 'leadcorp',
    officialName: '주식회사 리드코프',
    alias: ['리드코프'],
    category: 'LOAN_NPL',
    categoryLabel: '대부/금융',
    representative: '대표이사 김철우',
    bizNumber: '214-81-72990',
    zipCode: '06060',
    address: '서울특별시 강남구 도산대로 210 (논현동)',
    serviceAddress: '서울특별시 강남구 도산대로 210, 리드코프빌딩 5층 법률지원팀',
    phone: '1544-2525'
  },
  {
    id: 'rush_and_cash',
    officialName: '에이앤피파이낸셜대부 주식회사',
    alias: ['러시앤캐시', '에이앤피', '아프로파이낸셜', '미즈사랑'],
    category: 'LOAN_NPL',
    categoryLabel: '대부업체',
    representative: '대표이사 심상돈',
    bizNumber: '214-86-63029',
    zipCode: '04523',
    address: '서울특별시 중구 세종대로 39, 대한서울상공회의소빌딩 10층 (남대문로4가)',
    serviceAddress: '서울특별시 중구 세종대로 39, 상공회의소빌딩 10층 회생파산대응팀',
    phone: '1566-7979'
  },
  {
    id: 'sanwa',
    officialName: '산와대부 주식회사',
    alias: ['산와대부', '산와머니'],
    category: 'LOAN_NPL',
    categoryLabel: '대부업체',
    representative: '대표이사 아라키마사카즈',
    bizNumber: '214-87-03867',
    zipCode: '06134',
    address: '서울특별시 강남구 테헤란로 216, 신신빌딩 (역삼동)',
    serviceAddress: '서울특별시 강남구 테헤란로 216, 12층 채권회생팀',
    phone: '1544-3800'
  },
  {
    id: 'uumco',
    officialName: '연합자산관리 주식회사',
    alias: ['유암코', '연합자산관리', 'UAMCO'],
    category: 'LOAN_NPL',
    categoryLabel: '자산유동화(NPL)',
    representative: '대표이사 이상기',
    bizNumber: '104-86-27756',
    zipCode: '04520',
    address: '서울특별시 중구 통일로 86, 바비엥3 14층 (순화동)',
    serviceAddress: '서울특별시 중구 통일로 86, 바비엥3 14층 NPL자산관리본부',
    phone: '02-2116-2000'
  },
  {
    id: 'hana_fni',
    officialName: '하나에프앤아이 주식회사',
    alias: ['하나에프앤아이', '하나F&I', '외환에프앤아이'],
    category: 'LOAN_NPL',
    categoryLabel: '자산유동화(NPL)',
    representative: '대표이사 강동훈',
    bizNumber: '104-81-79188',
    zipCode: '04538',
    address: '서울특별시 중구 을지로 35 (을지로1가)',
    serviceAddress: '서울특별시 중구 을지로 35, 하나금융그룹 사옥 NPL본부',
    phone: '02-3788-5800'
  },

  // ── 6. 공공기관, 보증기관 및 우선권(조세/공과금) 채권자 ──
  {
    id: 'kamco',
    officialName: '한국자산관리공사',
    alias: ['캠코', 'KAMCO', '한국자산관리공사'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '공공기관',
    representative: '사장 권남주',
    bizNumber: '214-82-01456',
    zipCode: '48400',
    address: '부산광역시 남구 문현금융로 40, 부산국제금융센터 (문현동)',
    serviceAddress: '서울특별시 강남구 강남대로 262, 캠코양재타워 채권인수관리부',
    phone: '1588-3570'
  },
  {
    id: 'happy_fund',
    officialName: '국민행복기금',
    alias: ['국민행복기금'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '공공기금',
    representative: '이사장 박정식',
    bizNumber: '214-82-09412',
    zipCode: '06263',
    address: '서울특별시 강남구 강남대로 262, 캠코양재타워 (도곡동)',
    serviceAddress: '서울특별시 강남구 강남대로 262, 캠코양재타워 국민행복기금관리부',
    phone: '1588-3570'
  },
  {
    id: 'nhis',
    officialName: '국민건강보험공단',
    alias: ['국민건강보험공단', '건강보험공단', '건보공단', '건보'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '우선권공공기관',
    representative: '이사장 정기석',
    bizNumber: '104-82-04533',
    zipCode: '26464',
    address: '강원특별자치도 원주시 건강로 32 (반곡동)',
    serviceAddress: '신청인 주소지 관할 국민건강보험공단 지사 징수부',
    phone: '1577-1000',
    isPriorityDefault: true
  },
  {
    id: 'nps',
    officialName: '국민연금공단',
    alias: ['국민연금공단', '국민연금'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '우선권공공기관',
    representative: '이사장 김태현',
    bizNumber: '101-82-05452',
    zipCode: '54870',
    address: '전북특별자치도 전주시 덕진구 기지로 180 (만성동)',
    serviceAddress: '신청인 주소지 관할 국민연금공단 지사 징수팀',
    phone: '1355',
    isPriorityDefault: true
  },
  {
    id: 'comwel',
    officialName: '근로복지공단',
    alias: ['근로복지공단', '산재보험', '고용보험'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '우선권공공기관',
    representative: '이사장 박종길',
    bizNumber: '104-82-04423',
    zipCode: '44538',
    address: '울산광역시 중구 종가로 340 (교동)',
    serviceAddress: '신청인 사업장/주소지 관할 근로복지공단 지사 징수부',
    phone: '1588-0075',
    isPriorityDefault: true
  },
  {
    id: 'nts',
    officialName: '대한민국 (소관: 국세청)',
    alias: ['국세청', '세무서', '대한민국', '국세'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '우선권조세',
    representative: '국세청장 강민수',
    bizNumber: '116-83-00010',
    zipCode: '30128',
    address: '세종특별자치시 노을6로 8-14 (나성동)',
    serviceAddress: '신청인 주소지 관할 세무서 납세자보호담당관실 (체납징세과)',
    phone: '126',
    isPriorityDefault: true
  },
  {
    id: 'kodit',
    officialName: '신용보증기금',
    alias: ['신용보증기금', '신보', 'KODIT'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '보증기관',
    representative: '이사장 최원목',
    bizNumber: '104-82-01990',
    zipCode: '41068',
    address: '대구광역시 동구 첨단로 7 (신서동)',
    serviceAddress: '서울특별시 마포구 마포대로 122, 신용보증기금 재기지원센터',
    phone: '1588-6565'
  },
  {
    id: 'kibo',
    officialName: '기술보증기금',
    alias: ['기술보증기금', '기보', 'KIBO'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '보증기관',
    representative: '이사장 김종호',
    bizNumber: '603-82-02685',
    zipCode: '48400',
    address: '부산광역시 남구 문현금융로 24, 기보빌딩 (문현동)',
    serviceAddress: '서울특별시 영등포구 경인로 775, 에이스하이테크시티 재기지원단',
    phone: '1544-1120'
  },
  {
    id: 'sgi',
    officialName: '에스지아이서울보증 주식회사',
    alias: ['서울보증보험', 'SGI', '서울보증', 'SGI서울보증'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '보증기관',
    representative: '대표이사 이명순',
    bizNumber: '101-81-19777',
    zipCode: '03127',
    address: '서울특별시 종로구 김상옥로 29 (연지동)',
    serviceAddress: '서울특별시 종로구 김상옥로 29, 본점 보상지원단',
    phone: '1670-7000'
  },
  {
    id: 'seoul_shinbo',
    officialName: '서울신용보증재단',
    alias: ['서울신용보증재단', '서울신보'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '보증기관',
    representative: '이사장 주철수',
    bizNumber: '105-82-12001',
    zipCode: '04130',
    address: '서울특별시 마포구 마포대로 163 (공덕동)',
    serviceAddress: '서울특별시 마포구 마포대로 163, 본점 채권관리부',
    phone: '1577-6119'
  },
  {
    id: 'hf',
    officialName: '한국주택금융공사',
    alias: ['주택금융공사', 'HF', '한국주택금융공사'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '공공기관',
    representative: '사장 김경환',
    bizNumber: '214-82-05450',
    zipCode: '48400',
    address: '부산광역시 남구 문현금융로 40, 부산국제금융센터 24~27층 (문현동)',
    serviceAddress: '서울특별시 중구 소공로 109, 한화빌딩 12층 서울중부지사 채권팀',
    phone: '1688-8114'
  },
  {
    id: 'kinfa',
    officialName: '서민금융진흥원',
    alias: ['서민금융진흥원', '서금원', '햇살론'],
    category: 'PUBLIC_AGENCY',
    categoryLabel: '공공기관',
    representative: '원장 이재연',
    bizNumber: '104-82-08500',
    zipCode: '04520',
    address: '서울특별시 중구 통일로 92, 케이지타워 4~5층 (순화동)',
    serviceAddress: '서울특별시 중구 통일로 92, 케이지타워 5층 회생파산지원팀',
    phone: '1397'
  }
];

/**
 * 채권자명으로 등록된 공식 송달주소 프리셋 검색 및 매칭
 * @param query 채권자명 키워드 (예: '국민은행', '신한카드', '현대')
 */
export function searchCreditorAddress(query: string): CreditorDirectoryItem[] {
  if (!query || !query.trim()) return [];
  const clean = query.replace(/\s+/g, '').toLowerCase();

  return CREDITOR_DIRECTORY.filter(item => {
    // 1. 공식명 매칭
    const officialClean = item.officialName.replace(/\s+/g, '').toLowerCase();
    if (officialClean.includes(clean)) return true;

    // 2. 별칭 매칭
    return item.alias.some(a => {
      const aliasClean = a.replace(/\s+/g, '').toLowerCase();
      return clean.includes(aliasClean) || aliasClean.includes(clean);
    });
  });
}

/**
 * 특정 채권자명에 가장 적합한 단일 프리셋 자동 매칭
 */
export function matchCreditorPreset(name: string): CreditorDirectoryItem | null {
  if (!name || !name.trim()) return null;
  const results = searchCreditorAddress(name);
  if (results.length === 0) return null;

  // 가장 짧고 정확한 별칭을 가진 항목 우선
  return results[0];
}
