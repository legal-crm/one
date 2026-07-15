// Vercel Serverless Function: 세금계산서 목록 조회
// GET /api/invoice/list?startDate=20260701&endDate=20260731&buyerCorpNum=1234567890
import { taxinvoiceService, SUPPLIER_INFO, setCorsHeaders } from '../lib/popbill-service.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { startDate, endDate, buyerCorpNum, page = '1', perPage = '20' } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'startDate, endDate are required (YYYYMMDD)' });
  }

  try {
    const state = ['300', '301', '302', '303', '304', '305']; // 발행 완료 상태들
    const result = await new Promise((resolve, reject) => {
      taxinvoiceService.search(
        SUPPLIER_INFO.corpNum,
        '매출',            // 매입/매출
        'I',               // 세금계산서 유형
        startDate,
        endDate,
        state,
        ['N'],             // 수정 여부
        ['', '정발행'],     // 발행 유형
        '', '',            // 공급자/공급받는자
        buyerCorpNum ? buyerCorpNum.replace(/-/g, '') : '',
        '',
        parseInt(page),
        parseInt(perPage),
        'D',               // 정렬 (최신순)
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
    return res.status(200).json({ ok: false, error: err.message || '세금계산서 목록 조회 실패', code: err.code });
  }
}
