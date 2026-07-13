// Vercel Serverless Function: Telegram Bot API Proxy
// POST /api/telegram
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { botToken, chatId, text, parseMode = 'Markdown' } = req.body;

  if (!botToken || !chatId || !text) {
    return res.status(400).json({ ok: false, error: 'botToken, chatId, text are required' });
  }

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      }
    );

    const data = await telegramRes.json();

    if (data.ok) {
      return res.status(200).json({ ok: true });
    } else {
      return res.status(200).json({ ok: false, error: data.description || 'Telegram API error' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
}
