import crypto from 'crypto';
import { head } from '@vercel/blob';

const PATH = 'star-vision/database.json';
const COOKIE = 'sv_session';
const TTL = 1000 * 60 * 60 * 12;

async function readCentral() {
  try {
    const blob = await head(PATH);
    const response = await fetch(blob.url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sign(payload) {
  const secret = process.env.sv_auth_secret;
  if (!secret) throw new Error('sv_auth_secret is not configured');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({ user: user.user, role: user.role, exp: Date.now() + TTL })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const login = String(body.user || '').trim();
    const pass = String(body.pass || '');
    if (!login || !pass) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

    const db = await readCentral();
    const user = (db?.users || []).find(u => u.user === login && u.active !== false);
    if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

    const stored = String(user.pass || '');
    const valid = stored.startsWith('sha256:')
      ? hash(pass) === stored.slice(7)
      : stored === pass;
    if (!valid) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

    const session = makeSession(user);
    res.setHeader('Set-Cookie', `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL / 1000}`);
    return res.status(200).json({ user: { user: user.user, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Serviço de autenticação indisponível.' });
  }
}
