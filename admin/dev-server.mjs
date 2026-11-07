import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const apiOrigin = 'https://viora-auth-website.onrender.com';
const proxyPrefix = '/__admin_api';
const port = Number(process.env.PORT || 4173);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

async function requestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(response, status, message, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' });
  response.end(message);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');

  if (url.pathname === proxyPrefix || url.pathname.startsWith(proxyPrefix + '/')) {
    const apiPath = url.pathname.slice(proxyPrefix.length) || '/';
    if (!apiPath.startsWith('/api/admin/')) return send(response, 404, 'Not found.');
    if (!['GET', 'POST'].includes(request.method || '')) return send(response, 405, 'Method not allowed.');

    try {
      const headers = { Accept: 'application/json' };
      if (request.headers.authorization) headers.Authorization = request.headers.authorization;
      if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'];
      const body = request.method === 'POST' ? await requestBody(request) : undefined;
      const upstream = await fetch(apiOrigin + apiPath + url.search, {
        method: request.method,
        headers,
        body,
        redirect: 'manual'
      });
      const responseBody = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(responseBody);
    } catch (error) {
      send(response, error.status || 502, JSON.stringify({ error: error.message || 'Admin API proxy failed.' }), 'application/json; charset=utf-8');
    }
    return;
  }

  if (!['GET', 'HEAD'].includes(request.method || '')) return send(response, 405, 'Method not allowed.');

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(response, 400, 'Invalid path.');
  }
  let filename = resolve(root, '.' + pathname);
  if (filename !== root && !filename.startsWith(root + sep)) return send(response, 403, 'Forbidden.');

  try {
    let info = await stat(filename);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(301, { Location: pathname + '/' + url.search, 'Cache-Control': 'no-store' });
        return response.end();
      }
      filename = resolve(filename, 'index.html');
      info = await stat(filename);
    }
    if (!info.isFile()) return send(response, 404, 'Not found.');
    const content = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    send(response, 404, 'Not found.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Viora admin preview: http://localhost:${port}/admin/`);
});