// Vercel Serverless Function: 전자세금계산서 통합 라우터 (Popbill 연동)
// 지원 액션:
//   - POST /api/invoice/check-corp  (사업자등록번호 유효성 확인)
//   - POST /api/invoice/issue       (세금계산서 즉시 발행)
//   - GET  /api/invoice/list        (세금계산서 목록 조회)
//   - POST /api/invoice/modify      (수정세금계산서 발행)
//   - GET  /api/invoice/pdf         (세금계산서 뷰어 URL 조회)
//   - POST /api/invoice/resend      (세금계산서 이메일 재발송)

import { taxinvoiceService, SUPPLIER_INFO, getTodayStr, setCorsHeaders } from './_lib/popbill-service.js';
import { withAuth } from './_lib/auth-middleware.js';

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

  // 1. 사업자등록번호 유효성 확인 (check-corp)
  if (action === 'check-corp') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { corpNum } = req.body || {};
    if (!corpNum) return res.status(400).json({ ok: false, error: 'corpNum is required' });

    try {
      if (!process.env.POPBILL_LINK_ID) {
        return res.status(200).json({ ok: true, data: { corpNum, state: 'NORMAL', mock: true } });
      }
      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.checkCorpNum(
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

    const writeDate = getTodayStr();
    const calculatedTax = tax || Math.round(supplyCost * 0.1);
    const calculatedTotal = totalAmount || (supplyCost + calculatedTax);

    const taxinvoice = {
      writeDate,
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
      if (!process.env.POPBILL_LINK_ID) {
        return res.status(200).json({
          ok: true,
          data: {
            ntsConfirmNum: `MOCK-${Date.now()}`,
            writeDate,
            supplyCost: String(supplyCost),
            tax: String(calculatedTax),
            totalAmount: String(calculatedTotal),
            buyerCorpNum,
            buyerCorpName,
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
          ntsConfirmNum: result.ntsconfirmNum || result.ntsConfirmNum || '',
          writeDate,
          supplyCost: String(supplyCost),
          tax: String(calculatedTax),
          totalAmount: String(calculatedTotal),
          buyerCorpNum,
          buyerCorpName,
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

    try {
      if (!process.env.POPBILL_LINK_ID) {
        return res.status(200).json({ ok: true, data: { total: 0, list: [], mock: true } });
      }

      const state = ['300', '301', '302', '303', '304', '305'];
      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.search(
          SUPPLIER_INFO.corpNum,
          '매출',
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

    const writeDate = getTodayStr();
    const calcTax = refundTax !== undefined ? refundTax : Math.round(refundSupplyCost * 0.1);
    const calcTotal = refundTotalAmount !== undefined ? refundTotalAmount : (refundSupplyCost + calcTax);
    const negSupplyCost = -Math.abs(refundSupplyCost);
    const negTax = -Math.abs(calcTax);
    const negTotal = -Math.abs(calcTotal);
    const reasonText = modifyCode === 2 ? '공급가액 변동(부분환불)' : '계약의 해제(취소환불)';

    const taxinvoice = {
      writeDate,
      chargeDirection: '정과금',
      issueType: '정발행',
      purposeType: '영수',
      taxType: '과세',
      modifyCode: String(modifyCode),
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
      if (!process.env.POPBILL_LINK_ID) {
        return res.status(200).json({
          ok: true,
          data: {
            ntsConfirmNum: `MOD-MOCK-${Date.now()}`,
            writeDate,
            supplyCost: String(negSupplyCost),
            tax: String(negTax),
            totalAmount: String(negTotal),
            modifyCode,
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
          ntsConfirmNum: result.ntsconfirmNum || result.ntsConfirmNum || '',
          writeDate,
          supplyCost: String(negSupplyCost),
          tax: String(negTax),
          totalAmount: String(negTotal),
          modifyCode,
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
    if (!itemKey) return res.status(400).json({ ok: false, error: 'itemKey is required' });

    try {
      if (!process.env.POPBILL_LINK_ID) {
        return res.status(200).json({
          ok: true,
          data: { url: `https://www.popbill.com/Taxinvoice/View?itemKey=${encodeURIComponent(itemKey)}&demo=true` }
        });
      }

      const url = await new Promise((resolve, reject) => {
        taxinvoiceService.getURL(
          SUPPLIER_INFO.corpNum,
          itemKey,
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

  // 6. 세금계산서 이메일 재발송 (resend)
  if (action === 'resend') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { itemKey, receiverEmail } = req.body || {};
    if (!itemKey || !receiverEmail) {
      return res.status(400).json({ ok: false, error: 'itemKey와 receiverEmail은 필수입니다.' });
    }

    try {
      if (!process.env.POPBILL_LINK_ID) {
        return res.status(200).json({
          ok: true,
          data: {
            message: `[모의 재발송] ${receiverEmail} 주소로 세금계산서 안내 메일이 발송되었습니다.`,
            sentAt: new Date().toISOString(),
            receiverEmail,
            mock: true
          }
        });
      }

      const result = await new Promise((resolve, reject) => {
        taxinvoiceService.sendEmail(
          SUPPLIER_INFO.corpNum,
          itemKey,
          receiverEmail,
          '',
          (response) => resolve(response),
          (error) => reject(error)
        );
      });

      return res.status(200).json({
        ok: true,
        data: {
          message: `${receiverEmail} 주소로 세금계산서 메일이 정상 재발송되었습니다.`,
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
