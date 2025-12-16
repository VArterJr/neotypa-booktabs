import http from 'node:http';
import { CONFIG } from './config.js';
import { Router } from './http/router.js';
import { sendJson } from './http/response.js';
import { serveStatic } from './http/static.js';
import { SqliteFileDb } from './db/db.js';
import { registerApiRoutes } from './api/routes.js';

const dbFile = new SqliteFileDb(CONFIG.dbPath);
const router = new Router();
registerApiRoutes(router, dbFile);

const server = http.createServer(async (req, res) => {
  try {
    // Serve API routes first
    const handledApi = await router.handle(req, res);
    if (handledApi) return;

    // Then static SPA
    const handledStatic = await serveStatic(req, res, CONFIG.publicDir);
    if (handledStatic) return;

    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    const status = message.includes('Not authenticated') ? 401 : 
                   message.includes('Not found') ? 404 :
                   message.includes('already exists') ? 409 : 400;
    sendJson(res, status, { error: message });
  }
});

server.listen(CONFIG.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${CONFIG.port}`);
  // eslint-disable-next-line no-console
  console.log(`DB: ${CONFIG.dbPath}`);
  // eslint-disable-next-line no-console
  console.log(`Public: ${CONFIG.publicDir}`);
  // eslint-disable-next-line no-console
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
