// Vercel Serverless Function: 세금계산서 이메일 재발송
// POST /api/invoice/resend
import { taxinvoiceService, SUPPLIER_INFO, setCorsHeaders } from '../_lib/popbill-service.js';
import { withAuth } from '../_lib/auth-middleware.js';

async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { itemKey, receiverEmail } = req.body;

  if (!itemKey || !receiverEmail) {
    return res.status(400).json({ ok: false, error: 'itemKey와 receiverEmail은 필수입니다.' });
  }

  try {
    // API 키 미설정 또는 개발환경인 경우 Mock 성공 응답
    if (!process.env.POPBILL_LINK_ID || process.env.POPBILL_LINK_ID === '') {
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
        '', // UserID
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

export default withAuth(handler);
