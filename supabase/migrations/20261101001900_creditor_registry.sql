-- 공용 채권자 정보 (NF-5, 25 기획서 4장)
--  * creditor_registry: 금융회사·공공기관 공개 정보(정식 이름·본점·송달 장소·대표자·팩스·발급 창구), 확인일·출처·버전
--    누구나 읽기(활성 항목), 쓰기는 통합어드민 함수만. 개인 채권자는 넣지 않는다.
--  * creditor_registry_suggestions: 사무소 수정 제안 → 통합어드민 확인 뒤 반영
--  초기 47곳은 코드 고정 목록(creditorAddressDirectory.ts)을 옮긴 것이라 확인일이 없다 → 화면에 '확인 필요'
CREATE TABLE IF NOT EXISTS public.creditor_registry (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{2,60}$'),
  official_name text NOT NULL CHECK (char_length(official_name) BETWEEN 2 AND 80),
  aliases text[] NOT NULL DEFAULT '{}'::text[],
  category text NOT NULL CHECK (category IN ('BANK', 'CARD', 'CAPITAL', 'SAVINGS_BANK', 'LOAN_NPL', 'PUBLIC_AGENCY', 'INSURANCE', 'MUTUAL', 'OTHER')),
  category_label text NOT NULL DEFAULT '',
  representative text NOT NULL DEFAULT '' CHECK (char_length(representative) <= 60),
  biz_number text NOT NULL DEFAULT '' CHECK (char_length(biz_number) <= 20),
  zip_code text NOT NULL DEFAULT '' CHECK (zip_code = '' OR zip_code ~ '^\d{5}$'),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 200),
  service_address text NOT NULL DEFAULT '' CHECK (char_length(service_address) <= 200),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 30),
  fax text NOT NULL DEFAULT '' CHECK (char_length(fax) <= 30),
  cert_desk text NOT NULL DEFAULT '' CHECK (char_length(cert_desk) <= 300),
  is_priority_default boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT '' CHECK (char_length(source) <= 200),
  verified_on date,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.creditor_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creditor_registry_read ON public.creditor_registry;
CREATE POLICY creditor_registry_read ON public.creditor_registry FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_platform_admin());
REVOKE ALL ON public.creditor_registry FROM anon, authenticated;
GRANT SELECT ON public.creditor_registry TO anon, authenticated;

INSERT INTO public.creditor_registry (id, official_name, aliases, category, category_label, representative, biz_number, zip_code, address, service_address, phone, is_priority_default)
VALUES
  ('kb_bank', '주식회사 국민은행', ARRAY['국민은행', 'KB국민은행', 'KB', '국민']::text[], 'BANK', '시중은행', '은행장 이재근', '201-81-47789', '07331', '서울특별시 영등포구 의사당대로 141 (여의도동)', '서울특별시 영등포구 의사당대로 141, 여의도영업부 (법원송달팀)', '1588-9999', false),
  ('shinhan_bank', '주식회사 신한은행', ARRAY['신한은행', '신한', 'SHINHAN']::text[], 'BANK', '시중은행', '은행장 정상혁', '202-81-50707', '04513', '서울특별시 중구 세종대로9길 20 (태평로2가)', '서울특별시 중구 세종대로9길 20, 본점 여신관리부', '1599-8000', false),
  ('woori_bank', '주식회사 우리은행', ARRAY['우리은행', '우리', 'WOORI']::text[], 'BANK', '시중은행', '은행장 조병규', '201-81-42515', '04632', '서울특별시 중구 소공로 51 (회현동1가)', '서울특별시 중구 소공로 51, 여신감리부 법무팀', '1588-5000', false),
  ('hana_bank', '주식회사 하나은행', ARRAY['하나은행', '하나', 'KEB하나', '외환은행']::text[], 'BANK', '시중은행', '은행장 이호성', '202-81-43254', '04538', '서울특별시 중구 을지로 35 (을지로1가)', '서울특별시 중구 을지로 35, 본점 관리부문 법무지원부', '1599-1111', false),
  ('ibk_bank', '중소기업은행', ARRAY['기업은행', 'IBK기업은행', 'IBK', '중소기업은행']::text[], 'BANK', '특수은행', '은행장 김성태', '201-83-00049', '04541', '서울특별시 중구 을지로 79 (을지로2가)', '서울특별시 중구 을지로 79, 본점 여신관리부', '1588-2588', false),
  ('nh_bank', '농협은행 주식회사', ARRAY['농협은행', 'NH농협은행', '농협', 'NH농협', '단위농협']::text[], 'BANK', '특수은행', '은행장 이석용', '104-86-39742', '04517', '서울특별시 중구 통일로 120 (충정로1가)', '서울특별시 중구 통일로 120, 본점 여신감리부', '1661-3000', false),
  ('kakao_bank', '주식회사 카카오뱅크', ARRAY['카카오뱅크', '카카오', '카뱅']::text[], 'BANK', '인터넷전문은행', '대표이사 윤호영', '375-88-00197', '13529', '경기도 성남시 분당구 분당내곡로 131, 판교테크원타워 11층 (백현동)', '경기도 성남시 분당구 분당내곡로 131, 판교테크원타워 11층 법무팀', '1599-3333', false),
  ('k_bank', '주식회사 케이뱅크', ARRAY['케이뱅크', '케이', 'K뱅크']::text[], 'BANK', '인터넷전문은행', '은행장 최우형', '713-88-00508', '04539', '서울특별시 중구 을지로 170, 을지트윈타워 동관 16층 (을지로4가)', '서울특별시 중구 을지로 170, 을지트윈타워 동관 16층 여신관리팀', '1522-1000', false),
  ('toss_bank', '토스뱅크 주식회사', ARRAY['토스뱅크', '토스', '비바리퍼블리카']::text[], 'BANK', '인터넷전문은행', '대표이사 이은미', '394-88-01869', '06133', '서울특별시 강남구 테헤란로 142, 아크플레이스 12층 (역삼동)', '서울특별시 강남구 테헤란로 142, 아크플레이스 12층 법무지원팀', '1661-7654', false),
  ('sc_bank', '한국스탠다드차타드은행', ARRAY['SC제일은행', '스탠다드차타드', '제일은행']::text[], 'BANK', '시중은행', '은행장 박종복', '101-81-04480', '03160', '서울특별시 종로구 종로 47 (공평동)', '서울특별시 종로구 종로 47, 본점 소송지원팀', '1588-1599', false),
  ('shinhan_card', '신한카드 주식회사', ARRAY['신한카드', '신한', 'LG카드']::text[], 'CARD', '카드사', '대표이사 문동권', '202-81-48079', '04543', '서울특별시 중구 을지로 100, 파인에비뉴 A동 (을지로2가)', '서울특별시 중구 을지로 100, 파인에비뉴 A동 사후관리팀', '1544-7000', false),
  ('kb_card', 'KB국민카드 주식회사', ARRAY['국민카드', 'KB국민카드', 'KB카드']::text[], 'CARD', '카드사', '대표이사 이창권', '101-86-66471', '03169', '서울특별시 종로구 새문안로3길 30 (내수동)', '서울특별시 종로구 새문안로3길 30, 본점 법률지원부', '1588-1688', false),
  ('samsung_card', '삼성카드 주식회사', ARRAY['삼성카드', '삼성']::text[], 'CARD', '카드사', '대표이사 김대환', '202-81-44759', '04513', '서울특별시 중구 세종대로 67 (태평로2가)', '서울특별시 중구 세종대로 67, 본사 채권관리운영팀', '1588-8700', false),
  ('hyundai_card', '현대카드 주식회사', ARRAY['현대카드', '현대']::text[], 'CARD', '카드사', '대표이사 정태영', '213-86-13042', '07242', '서울특별시 영등포구 의사당대로 3 (여의도동)', '서울특별시 영등포구 의사당대로 3, 본점 채권관리센터', '1577-6000', false),
  ('lotte_card', '롯데카드 주식회사', ARRAY['롯데카드', '롯데']::text[], 'CARD', '카드사', '대표이사 조좌진', '104-81-81765', '03161', '서울특별시 종로구 새문안로 76, 콘코디언빌딩 (신문로1가)', '서울특별시 종로구 새문안로 76, 콘코디언빌딩 8층 채권관리팀', '1588-8100', false),
  ('woori_card', '우리카드 주식회사', ARRAY['우리카드']::text[], 'CARD', '카드사', '대표이사 박완식', '101-86-77457', '03154', '서울특별시 종로구 종로1길 50, 더케이트윈타워 B동 (중학동)', '서울특별시 종로구 종로1길 50, 더케이트윈타워 B동 사후관리부', '1588-9955', false),
  ('hana_card', '하나카드 주식회사', ARRAY['하나카드', '외환카드']::text[], 'CARD', '카드사', '대표이사 이호성', '104-86-53874', '04538', '서울특별시 중구 을지로 66 (을지로2가)', '서울특별시 중구 을지로 66, 본점 채권기획팀', '1800-1111', false),
  ('bc_card', '비씨카드 주식회사', ARRAY['비씨카드', 'BC카드', '비씨']::text[], 'CARD', '카드사', '대표이사 최원석', '214-81-37726', '04543', '서울특별시 중구 을지로 170, 을지트윈타워 동관 (을지로4가)', '서울특별시 중구 을지로 170, 을지트윈타워 동관 법무지원실', '1588-4000', false),
  ('hyundai_capital', '현대캐피탈 주식회사', ARRAY['현대캐피탈', '현대']::text[], 'CAPITAL', '캐피탈', '대표이사 목진원', '214-86-09252', '07242', '서울특별시 영등포구 의사당대로 3 (여의도동)', '서울특별시 영등포구 의사당대로 3, 본점 채권지원팀', '1588-2114', false),
  ('kb_capital', 'KB캐피탈 주식회사', ARRAY['KB캐피탈', '국민캐피탈']::text[], 'CAPITAL', '캐피탈', '대표이사 빈중일', '214-81-44754', '06627', '서울특별시 서초구 서초대로 301, 동익성봉빌딩 (서초동)', '서울특별시 서초구 서초대로 301, 동익성봉빌딩 채권관리센터', '1544-1200', false),
  ('hana_capital', '하나캐피탈 주식회사', ARRAY['하나캐피탈']::text[], 'CAPITAL', '캐피탈', '대표이사 박승오', '214-81-40989', '06164', '서울특별시 강남구 테헤란로 127, 하나금융그룹 강남사옥 (역삼동)', '서울특별시 강남구 테헤란로 127, 여신관리팀', '1599-7942', false),
  ('jb_woori_capital', 'JB우리캐피탈 주식회사', ARRAY['JB우리캐피탈', '우리캐피탈']::text[], 'CAPITAL', '캐피탈', '대표이사 박춘원', '214-81-41940', '07326', '서울특별시 영등포구 여의대로 66, KTB빌딩 (여의도동)', '서울특별시 영등포구 여의대로 66, 8층 채권관리팀', '1544-2400', false),
  ('woori_fin_capital', '우리금융캐피탈 주식회사', ARRAY['우리금융캐피탈', '아주캐피탈']::text[], 'CAPITAL', '캐피탈', '대표이사 정석완', '214-81-40980', '06134', '서울특별시 강남구 테헤란로 212 (역삼동)', '서울특별시 강남구 테헤란로 212, 10층 여신관리센터', '1544-8600', false),
  ('lotte_capital', '롯데캐피탈 주식회사', ARRAY['롯데캐피탈']::text[], 'CAPITAL', '캐피탈', '대표이사 추광식', '214-81-45672', '06164', '서울특별시 강남구 테헤란로 134, 포스코타워 역삼 (역삼동)', '서울특별시 강남구 테헤란로 134, 포스코타워 역삼 14층 여신지원팀', '1588-4488', false),
  ('sbi_sb', '에스비아이저축은행 주식회사', ARRAY['SBI저축은행', 'SBI', '현대스위스']::text[], 'SAVINGS_BANK', '저축은행', '대표이사 김문석', '214-81-70020', '04527', '서울특별시 중구 통일로 92, 케이지타워 (순화동)', '서울특별시 중구 통일로 92, 케이지타워 15층 채권관리본부', '1566-2210', false),
  ('ok_sb', '오케이저축은행 주식회사', ARRAY['OK저축은행', '오케이저축은행', 'OK', '아프로']::text[], 'SAVINGS_BANK', '저축은행', '대표이사 정길호', '214-81-88987', '04523', '서울특별시 중구 세종대로 39, 대한서울상공회의소빌딩 10층 (남대문로4가)', '서울특별시 중구 세종대로 39, 상공회의소빌딩 10층 여신관리실', '1899-7979', false),
  ('welcome_sb', '웰컴저축은행 주식회사', ARRAY['웰컴저축은행', '웰컴']::text[], 'SAVINGS_BANK', '저축은행', '대표이사 김대웅', '214-81-87612', '04386', '서울특별시 용산구 한강대로 148, 웰컴금융타워 (한강로2가)', '서울특별시 용산구 한강대로 148, 웰컴금융타워 11층 리테일채권관리부', '1661-0001', false),
  ('pepper_sb', '페퍼저축은행 주식회사', ARRAY['페퍼저축은행', '페퍼']::text[], 'SAVINGS_BANK', '저축은행', '대표이사 장매튜', '129-81-99882', '13590', '경기도 성남시 분당구 황새울로 347, 페퍼빌딩 (서현동)', '경기도 성남시 분당구 황새울로 347, 페퍼빌딩 6층 채권관리팀', '1599-0722', false),
  ('daol_sb', '다올저축은행 주식회사', ARRAY['다올저축은행', '유진저축은행', '다올']::text[], 'SAVINGS_BANK', '저축은행', '대표이사 김정수', '214-81-85514', '06134', '서울특별시 강남구 테헤란로 208 (역삼동)', '서울특별시 강남구 테헤란로 208, 9층 채권관리실', '1544-6700', false),
  ('koreainvest_sb', '한국투자저축은행 주식회사', ARRAY['한국투자저축은행', '한투저축은행']::text[], 'SAVINGS_BANK', '저축은행', '대표이사 전찬우', '129-81-42008', '13595', '경기도 성남시 분당구 서현로 180 (서현동)', '경기도 성남시 분당구 서현로 180, 본점 리테일채권부', '1544-7772', false),
  ('leadcorp', '주식회사 리드코프', ARRAY['리드코프']::text[], 'LOAN_NPL', '대부/금융', '대표이사 김철우', '214-81-72990', '06060', '서울특별시 강남구 도산대로 210 (논현동)', '서울특별시 강남구 도산대로 210, 리드코프빌딩 5층 법률지원팀', '1544-2525', false),
  ('rush_and_cash', '에이앤피파이낸셜대부 주식회사', ARRAY['러시앤캐시', '에이앤피', '아프로파이낸셜', '미즈사랑']::text[], 'LOAN_NPL', '대부업체', '대표이사 심상돈', '214-86-63029', '04523', '서울특별시 중구 세종대로 39, 대한서울상공회의소빌딩 10층 (남대문로4가)', '서울특별시 중구 세종대로 39, 상공회의소빌딩 10층 회생파산대응팀', '1566-7979', false),
  ('sanwa', '산와대부 주식회사', ARRAY['산와대부', '산와머니']::text[], 'LOAN_NPL', '대부업체', '대표이사 아라키마사카즈', '214-87-03867', '06134', '서울특별시 강남구 테헤란로 216, 신신빌딩 (역삼동)', '서울특별시 강남구 테헤란로 216, 12층 채권회생팀', '1544-3800', false),
  ('uumco', '연합자산관리 주식회사', ARRAY['유암코', '연합자산관리', 'UAMCO']::text[], 'LOAN_NPL', '자산유동화(NPL)', '대표이사 이상기', '104-86-27756', '04520', '서울특별시 중구 통일로 86, 바비엥3 14층 (순화동)', '서울특별시 중구 통일로 86, 바비엥3 14층 NPL자산관리본부', '02-2116-2000', false),
  ('hana_fni', '하나에프앤아이 주식회사', ARRAY['하나에프앤아이', '하나F&I', '외환에프앤아이']::text[], 'LOAN_NPL', '자산유동화(NPL)', '대표이사 강동훈', '104-81-79188', '04538', '서울특별시 중구 을지로 35 (을지로1가)', '서울특별시 중구 을지로 35, 하나금융그룹 사옥 NPL본부', '02-3788-5800', false),
  ('kamco', '한국자산관리공사', ARRAY['캠코', 'KAMCO', '한국자산관리공사']::text[], 'PUBLIC_AGENCY', '공공기관', '사장 권남주', '214-82-01456', '48400', '부산광역시 남구 문현금융로 40, 부산국제금융센터 (문현동)', '서울특별시 강남구 강남대로 262, 캠코양재타워 채권인수관리부', '1588-3570', false),
  ('happy_fund', '국민행복기금', ARRAY['국민행복기금']::text[], 'PUBLIC_AGENCY', '공공기금', '이사장 박정식', '214-82-09412', '06263', '서울특별시 강남구 강남대로 262, 캠코양재타워 (도곡동)', '서울특별시 강남구 강남대로 262, 캠코양재타워 국민행복기금관리부', '1588-3570', false),
  ('nhis', '국민건강보험공단', ARRAY['국민건강보험공단', '건강보험공단', '건보공단', '건보']::text[], 'PUBLIC_AGENCY', '우선권공공기관', '이사장 정기석', '104-82-04533', '26464', '강원특별자치도 원주시 건강로 32 (반곡동)', '신청인 주소지 관할 국민건강보험공단 지사 징수부', '1577-1000', true),
  ('nps', '국민연금공단', ARRAY['국민연금공단', '국민연금']::text[], 'PUBLIC_AGENCY', '우선권공공기관', '이사장 김태현', '101-82-05452', '54870', '전북특별자치도 전주시 덕진구 기지로 180 (만성동)', '신청인 주소지 관할 국민연금공단 지사 징수팀', '1355', true),
  ('comwel', '근로복지공단', ARRAY['근로복지공단', '산재보험', '고용보험']::text[], 'PUBLIC_AGENCY', '우선권공공기관', '이사장 박종길', '104-82-04423', '44538', '울산광역시 중구 종가로 340 (교동)', '신청인 사업장/주소지 관할 근로복지공단 지사 징수부', '1588-0075', true),
  ('nts', '대한민국 (소관: 국세청)', ARRAY['국세청', '세무서', '대한민국', '국세']::text[], 'PUBLIC_AGENCY', '우선권조세', '국세청장 강민수', '116-83-00010', '30128', '세종특별자치시 노을6로 8-14 (나성동)', '신청인 주소지 관할 세무서 납세자보호담당관실 (체납징세과)', '126', true),
  ('kodit', '신용보증기금', ARRAY['신용보증기금', '신보', 'KODIT']::text[], 'PUBLIC_AGENCY', '보증기관', '이사장 최원목', '104-82-01990', '41068', '대구광역시 동구 첨단로 7 (신서동)', '서울특별시 마포구 마포대로 122, 신용보증기금 재기지원센터', '1588-6565', false),
  ('kibo', '기술보증기금', ARRAY['기술보증기금', '기보', 'KIBO']::text[], 'PUBLIC_AGENCY', '보증기관', '이사장 김종호', '603-82-02685', '48400', '부산광역시 남구 문현금융로 24, 기보빌딩 (문현동)', '서울특별시 영등포구 경인로 775, 에이스하이테크시티 재기지원단', '1544-1120', false),
  ('sgi', '에스지아이서울보증 주식회사', ARRAY['서울보증보험', 'SGI', '서울보증', 'SGI서울보증']::text[], 'PUBLIC_AGENCY', '보증기관', '대표이사 이명순', '101-81-19777', '03127', '서울특별시 종로구 김상옥로 29 (연지동)', '서울특별시 종로구 김상옥로 29, 본점 보상지원단', '1670-7000', false),
  ('seoul_shinbo', '서울신용보증재단', ARRAY['서울신용보증재단', '서울신보']::text[], 'PUBLIC_AGENCY', '보증기관', '이사장 주철수', '105-82-12001', '04130', '서울특별시 마포구 마포대로 163 (공덕동)', '서울특별시 마포구 마포대로 163, 본점 채권관리부', '1577-6119', false),
  ('hf', '한국주택금융공사', ARRAY['주택금융공사', 'HF', '한국주택금융공사']::text[], 'PUBLIC_AGENCY', '공공기관', '사장 김경환', '214-82-05450', '48400', '부산광역시 남구 문현금융로 40, 부산국제금융센터 24~27층 (문현동)', '서울특별시 중구 소공로 109, 한화빌딩 12층 서울중부지사 채권팀', '1688-8114', false),
  ('kinfa', '서민금융진흥원', ARRAY['서민금융진흥원', '서금원', '햇살론']::text[], 'PUBLIC_AGENCY', '공공기관', '원장 이재연', '104-82-08500', '04520', '서울특별시 중구 통일로 92, 케이지타워 4~5층 (순화동)', '서울특별시 중구 통일로 92, 케이지타워 5층 회생파산지원팀', '1397', false)
ON CONFLICT (id) DO NOTHING;
UPDATE public.creditor_registry SET source = '마이김변 초기 목록(공식 자료와 대조 전)' WHERE source = '';

CREATE TABLE IF NOT EXISTS public.creditor_registry_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id text REFERENCES public.creditor_registry(id) ON DELETE CASCADE,
  office_id text NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL DEFAULT auth.uid(),
  changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'object'),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  review_note text NOT NULL DEFAULT '' CHECK (char_length(review_note) <= 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creditor_registry_suggestions_status_idx ON public.creditor_registry_suggestions (status, created_at DESC);
ALTER TABLE public.creditor_registry_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creditor_suggestions_read ON public.creditor_registry_suggestions;
-- 제안한 사람·관리자만 본다 (쓰기는 함수만)
CREATE POLICY creditor_suggestions_read ON public.creditor_registry_suggestions FOR SELECT TO authenticated
  USING (suggested_by = auth.uid() OR public.is_platform_admin());
REVOKE ALL ON public.creditor_registry_suggestions FROM anon, authenticated;
GRANT SELECT ON public.creditor_registry_suggestions TO authenticated;

-- 제안·관리자 편집이 받는 칸 (그 밖의 칸은 버림)
CREATE OR REPLACE FUNCTION public.creditor_registry_clean(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  out jsonb := '{}'::jsonb;
  k text;
  allowed text[] := ARRAY['official_name', 'aliases', 'category', 'category_label', 'representative', 'biz_number', 'zip_code', 'address', 'service_address', 'phone', 'fax', 'cert_desk', 'is_priority_default', 'source', 'verified_on'];
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN out; END IF;
  FOREACH k IN ARRAY allowed LOOP
    IF p ? k THEN out := out || jsonb_build_object(k, p -> k); END IF;
  END LOOP;
  -- 주민등록번호 형식은 받지 않는다 (개인 채권자 정보 차단)
  IF out::text ~ '\d{6}\s*-?\s*[1-8]\d{6}' THEN
    RAISE EXCEPTION 'resident number not allowed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN out;
END;
$$;

-- 사무소 구성원이 수정·추가 제안 (registry_id NULL = 새 채권자 제안)
CREATE OR REPLACE FUNCTION public.suggest_creditor_registry_change(p_office_id text, p_registry_id text, p_changes jsonb, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changes jsonb := public.creditor_registry_clean(p_changes);
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_account_active() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.office_members m WHERE m.office_id = p_office_id AND m.user_id = auth.uid() AND m.status = 'active') THEN
    RAISE EXCEPTION 'not an office member' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'no changes' USING ERRCODE = 'check_violation';
  END IF;
  IF p_registry_id IS NULL AND COALESCE(v_changes ->> 'official_name', '') = '' THEN
    RAISE EXCEPTION 'official name required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_registry_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.creditor_registry WHERE id = p_registry_id) THEN
    RAISE EXCEPTION 'unknown creditor' USING ERRCODE = 'no_data_found';
  END IF;
  -- 같은 사람이 같은 항목에 대기 중 제안 1건만, 하루 20건
  IF EXISTS (SELECT 1 FROM public.creditor_registry_suggestions WHERE suggested_by = auth.uid() AND status = 'pending' AND registry_id IS NOT DISTINCT FROM p_registry_id AND (p_registry_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'pending suggestion exists' USING ERRCODE = 'unique_violation';
  END IF;
  IF (SELECT count(*) FROM public.creditor_registry_suggestions WHERE suggested_by = auth.uid() AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'too many suggestions' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.creditor_registry_suggestions (registry_id, office_id, changes, note)
  VALUES (p_registry_id, p_office_id, v_changes, left(COALESCE(p_note, ''), 500))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_creditor_registry_change(text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_creditor_registry_change(text, text, jsonb, text) TO authenticated;

-- 통합어드민: 항목 저장(새로 만들기·고치기). 고칠 때마다 버전 +1
CREATE OR REPLACE FUNCTION public.admin_upsert_creditor_registry(p_id text, p_values jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb := public.creditor_registry_clean(p_values);
  v_before jsonb;
  v_version integer;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT to_jsonb(r) INTO v_before FROM public.creditor_registry r WHERE r.id = p_id;
  IF v_before IS NULL THEN
    IF COALESCE(v ->> 'official_name', '') = '' OR COALESCE(v ->> 'category', '') = '' THEN
      RAISE EXCEPTION 'official name and category required' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.creditor_registry (id, official_name, category, updated_by) VALUES (p_id, v ->> 'official_name', v ->> 'category', auth.uid());
  END IF;
  UPDATE public.creditor_registry r SET
    official_name = COALESCE(v ->> 'official_name', r.official_name),
    aliases = CASE WHEN v ? 'aliases' AND jsonb_typeof(v -> 'aliases') = 'array'
      THEN ARRAY(SELECT left(x, 40) FROM jsonb_array_elements_text(v -> 'aliases') AS x WHERE x <> '' LIMIT 20) ELSE r.aliases END,
    category = COALESCE(v ->> 'category', r.category),
    category_label = COALESCE(v ->> 'category_label', r.category_label),
    representative = COALESCE(v ->> 'representative', r.representative),
    biz_number = COALESCE(v ->> 'biz_number', r.biz_number),
    zip_code = COALESCE(v ->> 'zip_code', r.zip_code),
    address = COALESCE(v ->> 'address', r.address),
    service_address = COALESCE(v ->> 'service_address', r.service_address),
    phone = COALESCE(v ->> 'phone', r.phone),
    fax = COALESCE(v ->> 'fax', r.fax),
    cert_desk = COALESCE(v ->> 'cert_desk', r.cert_desk),
    is_priority_default = COALESCE((v ->> 'is_priority_default')::boolean, r.is_priority_default),
    source = COALESCE(v ->> 'source', r.source),
    verified_on = CASE WHEN v ? 'verified_on' THEN NULLIF(v ->> 'verified_on', '')::date ELSE r.verified_on END,
    version = CASE WHEN v_before IS NULL THEN 1 ELSE r.version + 1 END,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE r.id = p_id
  RETURNING version INTO v_version;
  PERFORM public.admin_record_action('creditor_registry.upsert', 'creditor_registry', p_id, v_before, v, NULL);
  RETURN v_version;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_upsert_creditor_registry(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_creditor_registry(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_creditor_active(p_id text, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.creditor_registry SET is_active = p_active, version = version + 1, updated_at = now(), updated_by = auth.uid() WHERE id = p_id;
  PERFORM public.admin_record_action('creditor_registry.active', 'creditor_registry', p_id, NULL, jsonb_build_object('active', p_active), NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_creditor_active(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_creditor_active(text, boolean) TO authenticated;

-- 통합어드민: 제안 반영·반려. 반영하면 확인일 = 오늘, 출처 = 제안 확인
CREATE OR REPLACE FUNCTION public.admin_review_creditor_suggestion(p_id uuid, p_accept boolean, p_note text, p_new_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.creditor_registry_suggestions;
  v_target text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO s FROM public.creditor_registry_suggestions WHERE id = p_id FOR UPDATE;
  IF s.id IS NULL OR s.status <> 'pending' THEN
    RAISE EXCEPTION 'suggestion not pending' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_accept THEN
    v_target := COALESCE(s.registry_id, p_new_id);
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'new id required' USING ERRCODE = 'check_violation';
    END IF;
    PERFORM public.admin_upsert_creditor_registry(v_target,
      s.changes || jsonb_build_object('verified_on', to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD'),
        'source', COALESCE(NULLIF(s.changes ->> 'source', ''), '사무소 제안 확인')));
  ELSIF COALESCE(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'reason required' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.creditor_registry_suggestions
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
         review_note = left(COALESCE(p_note, ''), 500), reviewed_by = auth.uid(), reviewed_at = now(),
         registry_id = COALESCE(registry_id, CASE WHEN p_accept THEN p_new_id END)
   WHERE id = p_id;
  PERFORM public.notify_user(s.suggested_by, 'office', s.office_id, 'creditor_suggestion',
    CASE WHEN p_accept THEN '채권자 정보 수정 제안이 반영됐어요' ELSE '채권자 정보 수정 제안이 반영되지 않았어요' END,
    CASE WHEN p_accept THEN '' ELSE left(COALESCE(p_note, ''), 200) END, NULL, NULL, 'creditor_suggestion:' || p_id::text);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_creditor_suggestion(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_creditor_suggestion(uuid, boolean, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_creditor_suggestions(p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'registry_id', s.registry_id, 'office_name', COALESCE(o.name, ''), 'changes', s.changes, 'note', s.note,
      'status', s.status, 'review_note', s.review_note, 'created_at', s.created_at,
      'current', CASE WHEN r.id IS NULL THEN NULL ELSE to_jsonb(r) - 'updated_by' END
    ) ORDER BY s.created_at DESC)
    FROM public.creditor_registry_suggestions s
    LEFT JOIN public.creditor_registry r ON r.id = s.registry_id
    LEFT JOIN public.offices o ON o.id = s.office_id
    WHERE p_status = 'all' OR s.status = p_status
    LIMIT 200
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_creditor_suggestions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_creditor_suggestions(text) TO authenticated;
