const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Dev-only reverse proxy for browser testing.
 *
 * Browsers enforce the Same-Origin Policy, so when the web build runs under
 * `expo start --web` any request to the Frappe benchmark (192.168.1.35:8000)
 * is blocked by CORS. On web the app therefore uses *relative* API URLs
 * (see BASE_URL in src/api/frappe.js) and this middleware forwards them to
 * the benchmark, making every /api and /files call same-origin.
 * Native builds never run Metro's dev server, so this is a no-op for devices.
 */
const PROXY_TARGET = 'http://192.168.1.33:8000';
const PROXY_PREFIXES = ['/api/', '/files/', '/private/files/'];

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const pathname = (req.url || '').split('?')[0];
    if (!PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return middleware(req, res, next);
    }

    const http = require('http');
    const target = new URL(PROXY_TARGET);

    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: req.url,
        method: req.method || 'GET',
        headers: { ...req.headers, host: target.host },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      res.end(`Proxy error: ${err.message}`);
    });

    req.pipe(proxyReq);
  };
};

module.exports = config;