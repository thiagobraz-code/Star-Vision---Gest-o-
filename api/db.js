import { put, head } from '@vercel/blob';

const PATH = 'star-vision/database.json';

const EMPTY_DB = {
  cases: [],
  equipment: [],
  maintenance: [],
  movements: [],
  stock: [],
  users: [],
  _version: 0,
  _updatedAt: null
};

async function readCentral() {
  try {
    const blob = await head(PATH);
    const response = await fetch(blob.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Blob HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    if (req.method === 'GET') {
      const data = await readCentral();
      return res.status(200).json(data || EMPTY_DB);
    }

    if (req.method !== 'PUT' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, PUT, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid database payload' });
    }

    const current = await readCentral();
    const currentVersion = Number(current?._version || 0);
    const clientVersion = Number(body._version || 0);

    // Prevent an older browser from silently overwriting a newer database.
    if (currentVersion > 0 && clientVersion !== currentVersion) {
      return res.status(409).json({
        error: 'Database version conflict',
        current: current || EMPTY_DB
      });
    }

    const payload = {
      ...body,
      _version: currentVersion + 1,
      _updatedAt: new Date().toISOString()
    };

    await put(PATH, JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 0
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('DB API error:', error);
    return res.status(500).json({ error: 'Database unavailable' });
  }
}
