// Vercel Serverless Function: 전자세금계산서 통합 라우터 (Popbill 연동)
// 지원 액션:
//   - POST /api/invoice/check-corp  (사업자등록번호 유효성 확인)
//   - POST /api/invoice/issue       (세금계산서 즉시 발행)
//   - GET  /api/invoice/list        (세금계산서 목록 조회)
//   - POST /api/invoice/modify      (수정세금계산서 발행)
//   - GET  /api/invoice/pdf         (세금계산서 뷰어 URL 조회)
//   - POST /api/invoice/resend      (세금계산서 이메일 재발송)

import { taxinvoiceService, closedownService, SUPPLIER_INFO, getTodayStr, setCorsHeaders, isTaxinvoiceConfigured, isValidCorpNum } from '../popbill-service.js';
import { withAuth, isAdminWithMfa, supabase } from '../auth-middleware.js';

// 주문 기준 확인·기록 (AD-6, 20261031003300). 서버 키가 없으면(로컬) 건너뛴다
const hasServerKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
async function loadOrderTarget(orderId) {
  if (!hasServerKey()) return null;
  const { data, error } = await supabase.rpc('ad_order_invoice_target', { p_order_id: String(orderId) });
  if (error) throw new Error('주문을 확인하지 못했습니다.');
  return data || null;
}
async function recordInvoice(orderId, kind, invoice) {
  if (!hasServerKey()) return false;
  const { data, error } = await supabase.rpc('record_ad_order_invoice', { p_order_id: String(orderId), p_kind: kind, p_invoice: invoice });
  if (error) console.error('[Invoice record]', error.message);
  return Boolean(data);
}

// 팝빌 미설정 시 응답 (이전: ok:true + MOCK 국세청승인번호 → 발행된 것처럼 저장·표시됨)
const notConfigured = (res, what) => res.status(200).json({
  ok: false,
  simulated: true,
  error: `팝빌 세금계산서 연동이 설정되지 않아 ${what}되지 않았습니다.`,
});
const isPosInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0 && String(v).trim() !== '';
const isNonNegInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && String(v).trim() !== '';
const str = (v, max) => typeof v === 'string' && v.length <= max;
// 문서번호(MgtKey): 영문·숫자·-·_ 최대 24자. 주문번호에서 만들어 같은 주문의 중복 발행을 팝빌이 거부하게 함
const toMgtKey = (prefix, orderId) => `${prefix}${String(orderId).replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 24);

async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 액션 판별 (쿼리스트링 action 또는 URL 경로)
  let action = req.query?.action;
  if (!action) {
    try {
      const url = new URL(req.url, 'https://mykim.kr');
      const parts = url.pathname.replace(/^\/api\/invoice\/?/, '').split('/').filter(Boolean);
      if (parts.length > 0) action = parts[0];
    } catch (_) {}
  }

  // [SECURITY] 발행·수정·목록·뷰어·재발송은 플랫폼 관리자만 (이전: 로그인한 누구나 임의 사업자번호로 법적 효력 있는 세금계산서 발행 가능)
  // 관리자 판정은 role=admin + 2단계 인증(aal2) 세션 (PART 3-1, DB is_platform_admin과 같은 기준)
  const isAdmin = isAdminWithMfa(req, req.user);
  if (['issue', 'modify', 'list', 'pdf', 'resend'].includes(action) && !isAdmin) {
    return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 사용할 수 있습니다.' });
  }

  // 1. 사업자등록번호 유효성 확인 (check-corp)
  if (action === 'check-corp') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { corpNum } = req.body || {};
    if (!corpNum || typeof corpNum !== 'string') return res.status(400).json({ ok: false, error: 'corpNum is required' });
    if (!isValidCorpNum(corpNum)) return res.status(400).json({ ok: false, error: '사업자등록번호 형식(체크섬)이 올바르지 않습니다.' });

    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '조회');
      const result = await new Promise((resolve, reject) => {
        closedownService.checkCorpNum(
          SUPPLIER_INFO.corpNum,
          corpNum.replace(/-/g, ''),
          (response) => resolve(response),
          (error) => reject(error)
        );
      });
      return res.status(200).json({ ok: true, data: result });
    } catch (err) {
      console.error('[CheckCorp Error]', err);
      return res.status(200).json({ ok: false, error: err.message || '사업자 확인 실패', code: err.code });
    }
  }

  // 2. 세금계산서 즉시 발행 (issue)
  if (action === 'issue') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const {
      orderId, itemName, supplyCost, tax, totalAmount,
      buyerCorpNum, buyerCorpName, buyerCEOName, buyerEmail, buyerAddr,
    } = req.body || {};

    if (!orderId || !supplyCost || !buyerCorpNum || !buyerCorpName || !buyerCEOName) {
      return res.status(400).json({
        ok: false,
        error: '필수 항목 누락: orderId, supplyCost, buyerCorpNum, buyerCorpName, buyerCEOName'
      });
    }
    if (!str(orderId, 64) || !str(buyerCorpNum, 20) || !str(buyerCorpName, 70) || !str(buyerCEOName, 30)
      || (buyerEmail && !str(buyerEmail, 100)) || (buyerAddr && !str(buyerAddr, 150)) || (itemName && !str(itemName, 100))) {
      return res.status(400).json({ ok: false, error: '입력 형식 또는 길이가 올바르지 않습니다.' });
    }
    if (!isValidCorpNum(buyerCorpNum)) {
      return res.status(400).json({ ok: false, error: '공급받는자 사업자등록번호가 올바르지 않습니다.' });
    }
    if (!isPosInt(supplyCost) || (tax !== undefined && tax !== null && !isNonNegInt(tax))) {
      return res.status(400).json({ ok: false, error: '공급가액·세액은 원 단위 정수여야 합니다.' });
    }

    const writeDate = getTodayStr();
    // tax=0(영세·면세)도 그대로 인정 (이전: tax || ... → 0이면 10%로 덮어씀)
    const calculatedTax = (tax !== undefined && tax !== null) ? Number(tax) : Math.round(Number(supplyCost) * 0.1);
    const calculatedTotal = Number(supplyCost) + calculatedTax;
    if (totalAmount !== undefined && totalAmount !== null && Number(totalAmount) !== calculatedTotal) {
      return res.status(400).json({ ok: false, error: `합계금액(${totalAmount})이 공급가액+세액(${calculatedTotal})과 다릅니다.` });
    }
    // 주문에 저장된 금액과 같아야 발행한다 (화면이 보낸 금액을 그대로 믿지 않음)
    let target = null;
    try { target = await loadOrderTarget(orderId); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    if (hasServerKey()) {
      if (!target) return res.status(404).json({ ok: false, error: '주문을 찾지 못했습니다.' });
      if (!['paid', 'active', 'expired'].includes(target.status)) return res.status(409).json({ ok: false, error: '입금 확인된 주문만 세금계산서를 발행할 수 있습니다.' });
      if (target.has_invoice) return res.status(409).json({ ok: false, error: '이미 세금계산서를 발행한 주문입니다.' });
      if (target.supply != null && (Number(target.supply) !== Number(supplyCost) || Number(target.vat) !== calculatedTax)) {
        return res.status(400).json({ ok: false, error: `주문 금액(공급가 ${target.supply}원·부가세 ${target.vat}원)과 다릅니다.` });
      }
    }
    const invoicerMgtKey = toMgtKey('AD-', orderId);

    const taxinvoice = {
      writeDate,
      invoicerMgtKey,
      chargeDirection: '정과금',
      issueType: '정발행',
      purposeType: '영수',
      taxType: '과세',
      invoicerCorpNum: SUPPLIER_INFO.corpNum,
      invoicerCorpName: SUPPLIER_INFO.corpName,
      invoicerCEOName: SUPPLIER_INFO.ceoName,
      invoicerBizType: SUPPLIER_INFO.bizType,
      invoicerBizClass: SUPPLIER_INFO.bizClass,
      invoicerContactName: SUPPLIER_INFO.contactName,
      invoicerEmail: SUPPLIER_INFO.contactEmail,
      invoicerTEL: SUPPLIER_INFO.contactTEL,
      invoiceeType: '사업자',
      invoiceeCorpNum: buyerCorpNum.replace(/-/g, ''),
      invoiceeCorpName: buyerCorpName,
      invoiceeCEOName: buyerCEOName,
      invoiceeEmail: buyerEmail || '',
      invoiceeAddr: buyerAddr || '',
      invoiceeBizType: '전문서비스업',
      invoiceeBizClass: '법률서비스',
      supplyCostTotal: String(supplyCost),
      taxTotal: String(calculatedTax),
      totalAmount: String(calculatedTotal),
      detailList: [{
        serialNum: 1,
        itemName: itemName || '법률 플랫폼 광고 서비스',
        purchaseDT: writeDate,
        supplyCost: String(supplyCost),
        tax: String(calculatedTax),
        qty: '1',
        unitCost: String(supplyCost),
      }],
      remark1: `주문번호: ${orderId}`,
    };

    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '발행');

      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.registIssue(
          SUPPLIER_INFO.corpNum,
          taxinvoice,
          (response) => resolve(response),
          (error) => reject(error)
        );
      });

      const issuedAt = new Date().toISOString();
      const ntsConfirmNum = result.ntsconfirmNum || result.ntsConfirmNum || '';
      // 금액은 숫자로 (이전: 문자열이라 관리자 합계가 '3000000300000'처럼 이어붙었다)
      const recorded = await recordInvoice(orderId, 'issue', {
        itemKey: invoicerMgtKey, ntsConfirmNum, issuedAt, writeDate,
        supplyCost: Number(supplyCost), tax: calculatedTax, totalAmount: calculatedTotal, status: 'issued',
      });
      return res.status(200).json({
        ok: true,
        data: {
          ntsConfirmNum,
          // 뷰어·재발송에 쓰는 키 = 문서번호(MgtKey) (이전: 반환하지 않아 뷰어·재발송 버튼이 항상 동작 안 함)
          itemKey: invoicerMgtKey,
          writeDate,
          issuedAt,
          supplyCost: Number(supplyCost),
          tax: calculatedTax,
          totalAmount: calculatedTotal,
          buyerCorpNum,
          buyerCorpName,
          recorded,
        }
      });
    } catch (err) {
      console.error('[Issue Error]', err);
      return res.status(200).json({ ok: false, error: err.message || '세금계산서 발행 실패', code: err.code });
    }
  }

  // 3. 세금계산서 목록 조회 (list)
  if (action === 'list') {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { startDate, endDate, buyerCorpNum, page = '1', perPage = '20' } = req.query || {};

    if (!startDate || !endDate) {
      return res.status(400).json({ ok: false, error: 'startDate, endDate are required (YYYYMMDD)' });
    }

    if (!/^\d{8}$/.test(String(startDate)) || !/^\d{8}$/.test(String(endDate))) {
      return res.status(400).json({ ok: false, error: '날짜 형식은 YYYYMMDD 입니다.' });
    }

    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '조회');

      const state = ['300', '301', '302', '303', '304', '305'];
      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.search(
          SUPPLIER_INFO.corpNum,
          'SELL', // 문서번호 유형: 매출 (이전: '매출' 문자열 → SDK 유형 검사에서 거부)
          'I',
          startDate,
          endDate,
          state,
          ['N'],
          ['', '정발행'],
          '', '',
          buyerCorpNum ? buyerCorpNum.replace(/-/g, '') : '',
          '',
          parseInt(page),
          parseInt(perPage),
          'D',
          '',
          (response) => resolve(response),
          (error) => reject(error)
        );
      });

      return res.status(200).json({
        ok: true,
        data: {
          total: result.total || 0,
          list: (result.list || []).map(item => ({
            itemKey: item.itemKey,
            ntsConfirmNum: item.ntsconfirmNum || '',
            writeDate: item.writeDate,
            supplyCostTotal: item.supplyCostTotal,
            taxTotal: item.taxTotal,
            totalAmount: item.totalAmount,
            buyerCorpNum: item.invoiceeCorpNum,
            buyerCorpName: item.invoiceeCorpName,
            buyerCEOName: item.invoiceeCEOName,
            itemName: item.itemName,
            stateCode: item.stateCode,
            stateDT: item.stateDT,
            remark1: item.remark1,
          }))
        }
      });
    } catch (err) {
      console.error('[Invoice List Error]', err);
      return res.status(200).json({ ok: false, error: err.message || '목록 조회 실패', code: err.code });
    }
  }

  // 4. 수정세금계산서 발행 (modify)
  if (action === 'modify') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const {
      orderId, orgNTSConfirmNum, modifyCode = 4, modifyReason,
      refundSupplyCost, refundTax, refundTotalAmount,
      itemName, buyerCorpNum, buyerCorpName, buyerCEOName, buyerEmail, buyerAddr,
    } = req.body || {};

    if (!orderId || !orgNTSConfirmNum || !refundSupplyCost || !buyerCorpNum) {
      return res.status(400).json({
        ok: false,
        error: '필수 항목 누락: orderId, orgNTSConfirmNum, refundSupplyCost, buyerCorpNum'
      });
    }
    const modCode = Number(modifyCode);
    if (![1, 2, 3, 4, 5, 6].includes(modCode)) {
      return res.status(400).json({ ok: false, error: '수정사유 코드(modifyCode)가 올바르지 않습니다 (1~6).' });
    }
    if (!/^[A-Za-z0-9]{24}$/.test(String(orgNTSConfirmNum))) {
      return res.status(400).json({ ok: false, error: '당초 국세청승인번호(24자리) 형식이 올바르지 않습니다.' });
    }
    if (!str(orderId, 64) || !isValidCorpNum(buyerCorpNum) || !isPosInt(Math.abs(Number(refundSupplyCost)))
      || (refundTax !== undefined && refundTax !== null && !isNonNegInt(Math.abs(Number(refundTax))))) {
      return res.status(400).json({ ok: false, error: '입력 형식이 올바르지 않습니다 (사업자번호·금액).' });
    }

    const writeDate = getTodayStr();
    const absSupply = Math.abs(Number(refundSupplyCost));
    const calcTax = (refundTax !== undefined && refundTax !== null) ? Math.abs(Number(refundTax)) : Math.round(absSupply * 0.1);
    const calcTotal = absSupply + calcTax;
    if (refundTotalAmount !== undefined && refundTotalAmount !== null && Math.abs(Number(refundTotalAmount)) !== calcTotal) {
      return res.status(400).json({ ok: false, error: '환불 합계금액이 공급가액+세액과 다릅니다.' });
    }
    const negSupplyCost = -Math.abs(refundSupplyCost);
    const negTax = -Math.abs(calcTax);
    const negTotal = -Math.abs(calcTotal);
    const reasonText = modCode === 2 ? '공급가액 변동(부분환불)' : '계약의 해제(취소환불)';
    // 수정발행은 주문당 한 번 — 문서번호를 주문에서 만들어 같은 요청이 두 번 와도 팝빌이 중복을 거부한다 (이전: 시각을 붙여 중복 발행 가능)
    let target = null;
    try { target = await loadOrderTarget(orderId); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
    if (hasServerKey()) {
      if (!target || !target.has_invoice) return res.status(409).json({ ok: false, error: '당초 세금계산서가 기록된 주문이 아닙니다.' });
      if (target.has_modified) return res.status(409).json({ ok: false, error: '이미 수정세금계산서를 발행한 주문입니다.' });
      if (target.nts_confirm_num && target.nts_confirm_num !== String(orgNTSConfirmNum)) return res.status(400).json({ ok: false, error: '당초 승인번호가 주문 기록과 다릅니다.' });
      if (target.invoice_supply != null && absSupply > Number(target.invoice_supply)) return res.status(400).json({ ok: false, error: '환불 공급가액이 당초 공급가액보다 큽니다.' });
    }
    const invoicerMgtKey = toMgtKey('MD-', orderId);

    const taxinvoice = {
      writeDate,
      invoicerMgtKey,
      chargeDirection: '정과금',
      issueType: '정발행',
      purposeType: '영수',
      taxType: '과세',
      modifyCode: String(modCode),
      orgNTSConfirmNum,
      invoicerCorpNum: SUPPLIER_INFO.corpNum,
      invoicerCorpName: SUPPLIER_INFO.corpName,
      invoicerCEOName: SUPPLIER_INFO.ceoName,
      invoicerBizType: SUPPLIER_INFO.bizType,
      invoicerBizClass: SUPPLIER_INFO.bizClass,
      invoicerContactName: SUPPLIER_INFO.contactName,
      invoicerEmail: SUPPLIER_INFO.contactEmail,
      invoicerTEL: SUPPLIER_INFO.contactTEL,
      invoiceeType: '사업자',
      invoiceeCorpNum: buyerCorpNum.replace(/-/g, ''),
      invoiceeCorpName: buyerCorpName || '',
      invoiceeCEOName: buyerCEOName || '',
      invoiceeEmail: buyerEmail || '',
      invoiceeAddr: buyerAddr || '',
      supplyCostTotal: String(negSupplyCost),
      taxTotal: String(negTax),
      totalAmount: String(negTotal),
      detailList: [{
        serialNum: 1,
        itemName: `${itemName || '법률 플랫폼 광고'} [${reasonText}]`,
        purchaseDT: writeDate,
        supplyCost: String(negSupplyCost),
        tax: String(negTax),
        qty: '1',
        unitCost: String(negSupplyCost),
      }],
      remark1: `원승인: ${orgNTSConfirmNum} | 주문: ${orderId}${modifyReason ? ` | 사유: ${modifyReason}` : ''}`,
    };

    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '수정발행');

      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.registIssue(
          SUPPLIER_INFO.corpNum,
          taxinvoice,
          (response) => resolve(response),
          (error) => reject(error)
        );
      });

      const issuedAt = new Date().toISOString();
      const ntsConfirmNum = result.ntsconfirmNum || result.ntsConfirmNum || '';
      const recorded = await recordInvoice(orderId, 'modify', {
        itemKey: invoicerMgtKey, ntsConfirmNum, issuedAt, writeDate, modifyCode: modCode,
        modifyReason: modifyReason || reasonText,
        supplyCost: negSupplyCost, tax: negTax, totalAmount: negTotal, status: 'issued',
      });
      return res.status(200).json({
        ok: true,
        data: {
          ntsConfirmNum,
          itemKey: invoicerMgtKey,
          writeDate,
          issuedAt,
          supplyCost: negSupplyCost,
          tax: negTax,
          totalAmount: negTotal,
          modifyCode: modCode,
          recorded,
        }
      });
    } catch (err) {
      console.error('[Modify Error]', err);
      return res.status(200).json({ ok: false, error: err.message || '수정세금계산서 발행 실패', code: err.code });
    }
  }

  // 5. 세금계산서 PDF 뷰어 URL 조회 (pdf)
  if (action === 'pdf') {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { itemKey } = req.query || {};
    if (!itemKey || !/^[A-Za-z0-9_-]{1,24}$/.test(String(itemKey))) return res.status(400).json({ ok: false, error: 'itemKey(문서번호) 형식이 올바르지 않습니다.' });

    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '조회');

      // getViewURL(CorpNum, KeyType, MgtKey, UserID) (이전: getURL(CorpNum, itemKey) — 잘못된 시그니처)
      const url = await new Promise((resolve, reject) => {
        taxinvoiceService.getViewURL(
          SUPPLIER_INFO.corpNum,
          'SELL',
          String(itemKey),
          '',
          (response) => resolve(response),
          (error) => reject(error)
        );
      });
      return res.status(200).json({ ok: true, data: { url } });
    } catch (err) {
      console.error('[Invoice PDF Error]', err);
      return res.status(200).json({ ok: false, error: err.message || 'PDF URL 조회 실패' });
    }
  }

  // 5-1. 사무소: 우리 광고 주문의 세금계산서 보기 (AD-6)
  //   주문 번호만 받고, 서버가 그 주문 사무소의 '광고 결제·세금계산서 보기' 권한을 확인한 뒤 팝빌 보기 주소를 준다
  //   (이전: 관리자 전용 pdf 액션을 불러 늘 403)
  if (action === 'office-pdf') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { orderId, kind } = req.body || {};
    if (!orderId || !str(orderId, 64)) return res.status(400).json({ ok: false, error: '주문 번호가 올바르지 않습니다.' });
    if (!hasServerKey()) return res.status(503).json({ ok: false, error: '서버가 설정되지 않았습니다.' });
    const { data: itemKey, error: keyErr } = await supabase.rpc('ad_invoice_view_key', {
      p_order_id: String(orderId), p_user_id: req.user?.id, p_kind: kind === 'modify' ? 'modify' : 'issue',
    });
    if (keyErr) return res.status(500).json({ ok: false, error: '권한을 확인하지 못했습니다.' });
    if (!itemKey) return res.status(403).json({ ok: false, error: '이 주문의 세금계산서를 볼 권한이 없거나 아직 발행되지 않았습니다.' });
    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '조회');
      const url = await new Promise((resolve, reject) => {
        taxinvoiceService.getViewURL(SUPPLIER_INFO.corpNum, 'SELL', String(itemKey), '', (r) => resolve(r), (e) => reject(e));
      });
      return res.status(200).json({ ok: true, data: { url } });
    } catch (err) {
      console.error('[Invoice office view Error]', err);
      return res.status(200).json({ ok: false, error: err.message || '세금계산서 보기 주소를 만들지 못했습니다.' });
    }
  }

  // 6. 세금계산서 이메일 재발송 (resend)
  if (action === 'resend') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { itemKey, receiverEmail } = req.body || {};
    if (!itemKey || !receiverEmail) {
      return res.status(400).json({ ok: false, error: 'itemKey와 receiverEmail은 필수입니다.' });
    }
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(String(itemKey)) || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(receiverEmail))) {
      return res.status(400).json({ ok: false, error: '문서번호 또는 이메일 형식이 올바르지 않습니다.' });
    }

    try {
      if (!isTaxinvoiceConfigured) return notConfigured(res, '재발송');

      // sendEmail(CorpNum, KeyType, MgtKey, Receiver, UserID) (이전: 인자 순서 불일치)
      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.sendEmail(
          SUPPLIER_INFO.corpNum,
          'SELL',
          String(itemKey),
          String(receiverEmail),
          '',
          (response) => resolve(response),
          (error) => reject(error)
        );
      });

      return res.status(200).json({
        ok: true,
        data: {
          message: `${receiverEmail} 주소로 세금계산서 메일 재발송이 팝빌에 접수되었습니다.`,
          sentAt: new Date().toISOString(),
          receiverEmail,
          result
        }
      });
    } catch (err) {
      console.error('[Invoice Resend Error]', err);
      return res.status(200).json({
        ok: false,
        error: err.message || '이메일 재발송에 실패했습니다.',
        code: err.code || -1
      });
    }
  }

  return res.status(400).json({ ok: false, error: `알 수 없는 액션입니다: ${action}` });
}

export default withAuth(handler);
