const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Dev-only reverse proxy for browser testing.
 *
 * Browsers enforce the Same-Origin Policy *and* the SameSite cookie rules, so
 * when the web build runs under `expo start --web` any request to the Frappe
 * benchmark is blocked by CORS and Frappe's `SameSite=Lax` `sid` cookie is
 * dropped as cross-site. On web the app therefore uses *relative* API URLs
 * (see BASE_URL in src/api/frappe.js) and this middleware forwards them to the
 * benchmark, making every /api and /files call same-origin — no CORS or
 * `allow_cors` configuration is needed.
 *
 * The target follows `EXPO_PUBLIC_API_URL` from `.env`, so pointing the app at
 * another bench only requires changing that one value.
 *
 * Native builds never run Metro's dev server, so this is a no-op for devices.
 */
const PROXY_TARGET = (
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.36:8000'
)
  .trim()
  .replace(/\/+$/, '');
const PROXY_PREFIXES = ['/api/', '/files/', '/private/files/'];

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    const pathname = (req.url || '').split('?')[0];
    if (!PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return middleware(req, res, next);
    }

    const target = new URL(PROXY_TARGET);
    const isHttps = target.protocol === 'https:';
    const transport = require(isHttps ? 'https' : 'http');

    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: req.url,
        method: req.method || 'GET',
        // Frappe builds absolute URLs and validates the Host header, so present
        // the benchmark's own host even though the browser talked to Metro.
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