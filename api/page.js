import fs from 'node:fs';
import path from 'node:path';

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    if (!html.includes('/sync.js')) {
      html = html.replace('</body>', '<script src="/sync.js"></script><script>window.addEventListener("load",()=>window.svStartAutoSync&&window.svStartAutoSync());</script></body>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Page render error:', error);
    return res.status(500).send('Star Vision indisponível.');
  }
}
