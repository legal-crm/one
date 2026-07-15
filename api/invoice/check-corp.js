// Vercel Serverless Function: 사업자등록번호 유효성 확인
// POST /api/invoice/check-corp
import { taxinvoiceService, SUPPLIER_INFO, setCorsHeaders } from '../lib/popbill-service.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { corpNum } = req.body;
  if (!corpNum) return res.status(400).json({ ok: false, error: 'corpNum is required' });

  try {
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
