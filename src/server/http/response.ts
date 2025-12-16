import type { ServerResponse } from 'node:http';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(raw);
}

export function sendNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}

export function sendText(res: ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8'): void {
  res.statusCode = status;
  res.setHeader('content-type', contentType);
  res.end(body);
}
