/**
 * Minimal static server for dist/ (tests and local checks). Mirrors GitHub Pages behaviour:
 * directory index files, 301 to trailing slash, 404.html with a 404 status.
 * Usage: node scripts/serve.mjs [port] [basePath]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(new URL('../dist/', import.meta.url).pathname);
const port = Number(process.argv[2] ?? 4173);
const base = process.argv[3] ?? '/';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (base !== '/' && path.startsWith(base)) path = path.slice(base.length - 1);
    let file = resolve(join(root, normalize(path)));
    if (!file.startsWith(root + sep) && file !== root) {
      res.statusCode = 403;
      return res.end('forbidden');
    }
    let s = await stat(file).catch(() => null);
    if (s?.isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { Location: (base === '/' ? '' : base.slice(0, -1)) + path + '/' });
        return res.end();
      }
      file = join(file, 'index.html');
      s = await stat(file).catch(() => null);
    }
    if (!s) {
      file = join(root, '404.html');
      res.statusCode = 404;
    }
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err));
  }
}).listen(port, '127.0.0.1', () => console.log(`serving dist/ at http://127.0.0.1:${port}${base}`));
