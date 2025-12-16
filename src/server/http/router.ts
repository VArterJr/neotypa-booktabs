import type { IncomingMessage, ServerResponse } from 'node:http';

export type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void> | void;

export interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  on(method: string, pathPattern: string, handler: Handler): void {
    const { pattern, paramNames } = compilePattern(pathPattern);
    this.routes.push({ method: method.toUpperCase(), pattern, paramNames, handler });
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(pathname);
      if (!m) continue;

      const params: Record<string, string> = {};
      r.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1] ?? '');
      });

      await r.handler(req, res, params);
      return true;
    }

    return false;
  }
}

function compilePattern(input: string): { pattern: RegExp; paramNames: string[] } {
  const parts = input.split('/').filter(Boolean);
  const paramNames: string[] = [];
  const regex = parts
    .map((p) => {
      if (p.startsWith(':')) {
        paramNames.push(p.slice(1));
        return '([^/]+)';
      }
      return escapeRegExp(p);
    })
    .join('/');

  return { pattern: new RegExp(`^/${regex}/?$`), paramNames };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
