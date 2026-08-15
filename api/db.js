import { put, head } from '@vercel/blob';

const PATH = 'star-vision/database.json';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      try {
        const blob = await head(PATH);
        const response = await fetch(blob.url, { cache: 'no-store' });
        const data = await response.json();
        return res.status(200).json(data);
      } catch (e) {
        return res.status(200).json({
          cases: [], patrimons: [], events: [], maintenances: [], stock: [],
          _version: 0,
          _updatedAt: null
        });
      }
    }

    if (req.method !== 'PUT' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, PUT, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid database payload' });
    }

    const payload = {
      ...body,
      _version: Number(body._version || 0) + 1,
      _updatedAt: new Date().toISOString()
    };

    await put(PATH, JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('DB API error:', error);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
