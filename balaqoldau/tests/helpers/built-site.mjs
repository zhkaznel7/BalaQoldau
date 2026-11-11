// Local QA adapter only: built static assets + API reverse proxy, without Vite.
// The public deployment uses the separately documented TLS ingress.
import { createServer, request as proxyRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

export async function serveBuiltSite(directory, port, apiPort) {
  const root = path.resolve(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
  const server = createServer(async (request, response) => {
    if (request.url === '/api' || request.url.startsWith('/api/')) {
      const upstream = proxyRequest({ hostname: '127.0.0.1', port: apiPort, path: request.url,
        method: request.method, headers: { ...request.headers, 'x-forwarded-for': request.socket.remoteAddress } }, result => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      });
      upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
      request.pipe(upstream);
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filename = path.resolve(root, '.' + pathname);
      const relative = path.relative(root, filename);
      if (!['GET', 'HEAD'].includes(request.method) || relative.startsWith('..') || path.isAbsolute(relative)
        || relative.split(/[\\/]/).some(part => part.startsWith('.'))) {
        response.writeHead(404); response.end(); return;
      }
      // Only extensionless SPA routes fall back; missing assets must be a 404.
      const extension = path.extname(filename);
      const file = extension ? filename : path.join(root, 'index.html');
      if (extension && !types[extension]) { response.writeHead(404); response.end(); return; }
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extension || '.html'], 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404); response.end(); }
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server;
}
