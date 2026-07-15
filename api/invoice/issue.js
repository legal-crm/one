// Vercel Serverless Function: 전자세금계산서 즉시 발행
// POST /api/invoice/issue
// 통합어드민에서 입금 확인 시 호출

import { taxinvoiceService, SUPPLIER_INFO, getTodayStr, setCorsHeaders } from '../lib/popbill-service.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    // 주문 정보
    orderId,
    itemName,          // '프리미엄 광고 30일'
    supplyCost,        // 공급가액 (VAT 제외, 숫자)
    tax,               // 부가세 (숫자)
    totalAmount,       // 합계 (숫자)
    
    // 공급받는 자 (변호사) 정보
    buyerCorpNum,      // 사업자등록번호
    buyerCorpName,     // 법률사무소명
    buyerCEOName,      // 대표 변호사명
    buyerEmail,        // 세금계산서 수신 이메일
    buyerAddr,         // 사업장 주소 (선택)
  } = req.body;

  // 필수 검증
  if (!orderId || !supplyCost || !buyerCorpNum || !buyerCorpName || !buyerCEOName) {
    return res.status(400).json({
      ok: false,
      error: '필수 항목 누락: orderId, supplyCost, buyerCorpNum, buyerCorpName, buyerCEOName'
    });
  }

  const writeDate = getTodayStr();
  const calculatedTax = tax || Math.round(supplyCost * 0.1);
  const calculatedTotal = totalAmount || (supplyCost + calculatedTax);

  const taxinvoice = {
    // 기본 정보
    writeDate,
    chargeDirection: '정과금',
    issueType: '정발행',
    purposeType: '영수',
    taxType: '과세',
    
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
    invoiceeCorpName: buyerCorpName,
    invoiceeCEOName: buyerCEOName,
    invoiceeEmail: buyerEmail || '',
    invoiceeAddr: buyerAddr || '',
    invoiceeBizType: '전문서비스업',
    invoiceeBizClass: '법률서비스',
    
    // 금액
    supplyCostTotal: String(supplyCost),
    taxTotal: String(calculatedTax),
    totalAmount: String(calculatedTotal),
    
    // 품목 상세
    detailList: [{
      serialNum: 1,
      itemName: itemName || '법률 플랫폼 광고 서비스',
      purchaseDT: writeDate,
      supplyCost: String(supplyCost),
      tax: String(calculatedTax),
      qty: '1',
      unitCost: String(supplyCost),
    }],
    
    // 비고 (주문 ID 기록)
    remark1: `주문번호: ${orderId}`,
  };

  try {
    // PopBill registIssue: 즉시 발행 + 국세청 전송
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
        issuedAt: new Date().toISOString(),
        supplyCost,
        tax: calculatedTax,
        totalAmount: calculatedTotal,
      }
    });
  } catch (err) {
    console.error('[Invoice Issue Error]', err);
    return res.status(200).json({
      ok: false,
      error: err.message || '세금계산서 발행 중 오류가 발생했습니다.',
      code: err.code || -1
    });
  }
}
