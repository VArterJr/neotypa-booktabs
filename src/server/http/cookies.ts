import cookie from 'cookie';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function getCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const parsed = cookie.parse(header);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export function setCookie(res: ServerResponse, name: string, value: string, opts: cookie.SerializeOptions): void {
  const serialized = cookie.serialize(name, value, opts);
  const prev = res.getHeader('set-cookie');

  if (!prev) {
    res.setHeader('set-cookie', serialized);
    return;
  }

  if (Array.isArray(prev)) {
    res.setHeader('set-cookie', [...prev, serialized]);
    return;
  }

  res.setHeader('set-cookie', [String(prev), serialized]);
}
