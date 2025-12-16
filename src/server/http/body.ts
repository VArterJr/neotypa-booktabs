import type { IncomingMessage } from 'node:http';

export async function readJson<T>(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) throw new Error('Payload too large');
    chunks.push(buf);
  }

  if (chunks.length === 0) return {} as T;
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw) as T;
}
