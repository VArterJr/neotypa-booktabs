import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import mime from 'mime';
import { sendText } from './response.js';

export async function serveStatic(req: IncomingMessage, res: ServerResponse, publicDir: string): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname.startsWith('/api')) return false;

  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = safeJoin(publicDir, rel);
  if (!filePath) return false;

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) return false;
    const data = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader('content-type', mime.getType(filePath) ?? 'application/octet-stream');
    res.setHeader('cache-control', filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600');
    res.end(data);
    return true;
  } catch (e: any) {
    // SPA fallback (avoid swallowing missing static assets like /assets/app.js)
    if (e?.code === 'ENOENT') {
      if (path.posix.basename(url.pathname).includes('.')) {
        sendText(res, 404, 'Not found');
        return true;
      }
      try {
        const indexPath = path.join(publicDir, 'index.html');
        const data = await fs.readFile(indexPath);
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(data);
        return true;
      } catch {
        sendText(res, 404, 'Not found');
        return true;
      }
    }

    sendText(res, 500, 'Static file error');
    return true;
  }
}

function safeJoin(root: string, relPath: string): string | null {
  const normalized = path.posix.normalize(relPath);
  const safeRel = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const joined = path.join(root, safeRel);
  const resolved = path.resolve(joined);
  const resolvedRoot = path.resolve(root);
  if (!resolved.startsWith(resolvedRoot)) return null;
  return resolved;
}
