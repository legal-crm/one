// Vercel Serverless Function: 세금계산서 PDF 뷰어 URL 조회
// GET /api/invoice/pdf?itemKey=xxx
import { taxinvoiceService, SUPPLIER_INFO, setCorsHeaders } from '../lib/popbill-service.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { itemKey } = req.query;
  if (!itemKey) return res.status(400).json({ ok: false, error: 'itemKey is required' });

  try {
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
