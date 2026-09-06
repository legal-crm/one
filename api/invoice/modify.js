// Vercel Serverless Function: 수정세금계산서 발행 (계약의 해제 / 공급가액 변동)
// POST /api/invoice/modify
// 통합어드민에서 광고 취소/환불 처리 시 호출

import { taxinvoiceService, SUPPLIER_INFO, getTodayStr, setCorsHeaders } from '../_lib/popbill-service.js';
import { withAuth } from '../_lib/auth-middleware.js';

async function handler(req, res) {
  setCorsHeaders(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    orderId,
    orgNTSConfirmNum,      // 당초 국세청 승인번호 (필수)
    modifyCode = 4,        // 4: 계약의 해제, 2: 공급가액 변동
    modifyReason,          // 취소/환불 사유
    refundSupplyCost,      // 취소/환불 공급가액 (양수로 전달받음)
    refundTax,             // 취소/환불 부가세 (선택, 미입력 시 10%)
    refundTotalAmount,     // 취소/환불 합계금액 (선택)
    itemName,              // 품목명
    buyerCorpNum,
    buyerCorpName,
    buyerCEOName,
    buyerEmail,
    buyerAddr,
  } = req.body;

  if (!orderId || !orgNTSConfirmNum || !refundSupplyCost || !buyerCorpNum) {
    return res.status(400).json({
      ok: false,
      error: '필수 항목 누락: orderId, orgNTSConfirmNum, refundSupplyCost, buyerCorpNum'
    });
  }

  const writeDate = getTodayStr(); // 작성일자는 계약 해제일(오늘)
  const calcTax = refundTax !== undefined ? refundTax : Math.round(refundSupplyCost * 0.1);
  const calcTotal = refundTotalAmount !== undefined ? refundTotalAmount : (refundSupplyCost + calcTax);

  // 국세청 규정에 따라 금액을 음수(-)로 변환
  const negSupplyCost = -Math.abs(refundSupplyCost);
  const negTax = -Math.abs(calcTax);
  const negTotal = -Math.abs(calcTotal);

  const reasonText = modifyCode === 2 ? '공급가액 변동(부분환불)' : '계약의 해제(취소환불)';

  const taxinvoice = {
    // 기본 정보
    writeDate,
    chargeDirection: '정과금',
    issueType: '정발행',
    purposeType: '영수',
    taxType: '과세',
    
    // [수정세금계산서 핵심 필드]
    modifyCode: Number(modifyCode),
    orgNTSConfirmNum: String(orgNTSConfirmNum),

    // 공급자 (몬스터랩)
    invoicerCorpNum: SUPPLIER_INFO.corpNum,
    invoicerCorpName: SUPPLIER_INFO.corpName,
    invoicerCEOName: SUPPLIER_INFO.ceoName,
    invoicerBizType: SUPPLIER_INFO.bizType,
    invoicerBizClass: SUPPLIER_INFO.bizClass,
    invoicerContactName: SUPPLIER_INFO.contactName,
    invoicerEmail: SUPPLIER_INFO.contactEmail,
    invoicerTEL: SUPPLIER_INFO.contactTEL,

    // 공급받는 자 (변호사)
    invoiceeType: '사업자',
    invoiceeCorpNum: buyerCorpNum.replace(/-/g, ''),
    invoiceeCorpName: buyerCorpName || '',
    invoiceeCEOName: buyerCEOName || '',
    invoiceeEmail: buyerEmail || '',
    invoiceeAddr: buyerAddr || '',
    invoiceeBizType: '전문서비스업',
    invoiceeBizClass: '법률서비스',

    // 음수(-) 금액 기재
    supplyCostTotal: String(negSupplyCost),
    taxTotal: String(negTax),
    totalAmount: String(negTotal),

    // 품목 상세
    detailList: [{
      serialNum: 1,
      itemName: `${itemName || '법률 플랫폼 광고'} [${reasonText}]`,
      purchaseDT: writeDate,
      supplyCost: String(negSupplyCost),
      tax: String(negTax),
      qty: '-1',
      unitCost: String(Math.abs(refundSupplyCost)),
    }],

    // 비고란에 당초 승인번호 및 사유 명시
    remark1: `[${reasonText}] ${modifyReason || '주문 취소 및 환불'}`.slice(0, 100),
    remark2: `당초 승인번호: ${orgNTSConfirmNum}`.slice(0, 100),
  };

  try {
    // API 키가 아직 없거나 테스트 모드일 때 안전한 mock fallback
    if (!process.env.POPBILL_LINK_ID || process.env.POPBILL_LINK_ID === '') {
      const mockConfirmNum = `${writeDate}41000000${Math.floor(10000000 + Math.random() * 90000000)}`;
      return res.status(200).json({
        ok: true,
        data: {
          ntsConfirmNum: mockConfirmNum,
          itemKey: `mod-${Date.now()}`,
          orderId,
          modifyCode,
          modifyReason: modifyReason || reasonText,
          issuedAt: new Date().toISOString(),
          supplyCost: negSupplyCost,
          tax: negTax,
          totalAmount: negTotal,
          mock: true,
        }
      });
    }

    const result = await new Promise((resolve, reject) => {
      taxinvoiceService.registIssue(
        SUPPLIER_INFO.corpNum,
        taxinvoice,
        (response) => resolve(response),
        (error) => reject(error)
      );
    });

    return res.status(200).json({
      ok: true,
      data: {
        ntsConfirmNum: result.ntsConfirmNum || '',
        itemKey: result.itemKey || '',
        orderId,
        modifyCode,
        modifyReason: modifyReason || reasonText,
        issuedAt: new Date().toISOString(),
        supplyCost: negSupplyCost,
        tax: negTax,
        totalAmount: negTotal,
      }
    });
  } catch (err) {
    console.error('[Modify Invoice Issue Error]', err);
    return res.status(200).json({
      ok: false,
      error: err.message || '수정세금계산서 발행 중 오류가 발생했습니다.',
      code: err.code || -1
    });
  }
}

export default withAuth(handler, { requiredRole: 'admin' });
