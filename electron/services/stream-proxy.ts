import http from 'http';
import https from 'https';
import { URL } from 'url';

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 120000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 120000,
});

let proxyServer: http.Server | null = null;
let proxyPort = 0;

function getForcedContentType(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes('/live/')) return 'video/mp2t';
  if (u.endsWith('.m3u8') || u.includes('.m3u8?')) return 'application/vnd.apple.mpegurl';
  if (u.endsWith('.ts') || u.includes('.ts?')) return 'video/mp2t';
  if (u.endsWith('.jpg') || u.includes('.jpg?')) return 'image/jpeg';
  if (u.endsWith('.jpeg') || u.includes('.jpeg?')) return 'image/jpeg';
  if (u.endsWith('.png') || u.includes('.png?')) return 'image/png';
  if (u.endsWith('.gif') || u.includes('.gif?')) return 'image/gif';
  if (u.endsWith('.webp') || u.includes('.webp?')) return 'image/webp';
  return null;
}

function doRequest(url: string, extraHeaders: Record<string, string>): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; stream: http.IncomingMessage }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const agent = client === https ? httpsAgent : httpAgent;
    const proxyReq = client.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        'Accept': '*/*',
        'Icy-MetaData': '0',
        ...extraHeaders,
      },
      agent,
      timeout: 120000,
    }, (proxyRes) => {
      resolve({ statusCode: proxyRes.statusCode || 200, headers: proxyRes.headers, stream: proxyRes });
    });
    proxyReq.on('error', reject);
    proxyReq.on('timeout', () => { proxyReq.destroy(); reject(new Error('Timeout')); });
    proxyReq.end();
  });
}

export function startStreamProxy(): Promise<number> {
  return new Promise((resolve, reject) => {
    proxyServer = http.createServer(async (req, res) => {
      const targetUrl = decodeURIComponent(req.url?.slice(1) || '');
      console.log('[PROXY-1]', targetUrl.substring(0, 100));
      if (!targetUrl.startsWith('http')) {
        res.writeHead(400);
        res.end('Invalid URL');
        return;
      }

      const extraHeaders: Record<string, string> = {};
      if (req.headers.range) extraHeaders['Range'] = req.headers.range as string;

      let currentUrl = targetUrl;
      let redirects = 5;

      while (redirects > 0) {
        try {
          const result = await doRequest(currentUrl, extraHeaders);
          const isRedirect = result.statusCode >= 300 && result.statusCode < 400 && !!result.headers.location;

          if (isRedirect) {
            const redirectUrl = new URL(result.headers.location as string, currentUrl).toString();
            console.log('[PROXY-R]', redirectUrl.substring(0, 80) + '...');
            result.stream.destroy();
            currentUrl = redirectUrl;
            redirects--;
            continue;
          }

          const responseHeaders: Record<string, string | string[]> = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Expose-Headers': '*',
          };
          const forcedCt = getForcedContentType(currentUrl);
          if (forcedCt) responseHeaders['Content-Type'] = forcedCt;
          for (const [key, value] of Object.entries(result.headers)) {
            if (!key.startsWith('access-control-') && key !== 'content-type') {
              responseHeaders[key] = value as string;
            }
          }
          res.writeHead(result.statusCode, responseHeaders);
          result.stream.pipe(res);
          req.on('close', () => result.stream.destroy());
          return;
        } catch (err: any) {
          console.log('[PROXY-5]', err.message, 'for', currentUrl.substring(0, 60));
          if (!res.headersSent) {
            res.writeHead(502);
            res.end(`Proxy error: ${err.message}`);
          }
          return;
        }
      }

      if (!res.headersSent) { res.writeHead(502); res.end('Too many redirects'); }
    });

    proxyServer.keepAliveTimeout = 120000;
    proxyServer.headersTimeout = 125000;
    proxyServer.requestTimeout = 0;
    proxyServer.maxConnections = 200;

    proxyServer.listen(0, '127.0.0.1', () => {
      const addr = proxyServer!.address();
      if (typeof addr === 'object' && addr) {
        proxyPort = addr.port;
        resolve(proxyPort);
      } else {
        reject(new Error('Failed to bind proxy port'));
      }
    });
    proxyServer.on('error', reject);
  });
}

export function getProxyPort(): number { return proxyPort; }

export function stopStreamProxy() {
  if (proxyServer) { proxyServer.close(); proxyServer = null; proxyPort = 0; }
}
