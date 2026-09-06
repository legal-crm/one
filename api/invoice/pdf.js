// Vercel Serverless Function: 세금계산서 PDF 뷰어 URL 조회
// GET /api/invoice/pdf?itemKey=xxx
import { taxinvoiceService, SUPPLIER_INFO, setCorsHeaders } from '../_lib/popbill-service.js';
import { withAuth } from '../_lib/auth-middleware.js';

async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { itemKey } = req.query;
  if (!itemKey) return res.status(400).json({ ok: false, error: 'itemKey is required' });

  try {
    if (!process.env.POPBILL_LINK_ID || process.env.POPBILL_LINK_ID === '') {
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

export default withAuth(handler);
