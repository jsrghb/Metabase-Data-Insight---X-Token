
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL de destino ausente.' });
  }

  const targetUrl = decodeURIComponent(url);
  const metabaseSession = req.headers['x-metabase-session'];

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Accept': '*/*',
      }
    };

    if (metabaseSession) {
      (fetchOptions.headers as any)['X-Metabase-Session'] = metabaseSession;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      (fetchOptions.headers as any)['Content-Type'] = req.headers['content-type'] || 'application/json';
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text();

    // Repassa o Content-Type original (importante para CSV)
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    return res.status(response.status).send(data);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
