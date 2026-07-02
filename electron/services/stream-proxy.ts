import http from 'http';
import https from 'https';
import { URL } from 'url';
import { spawn, ChildProcess } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 120000,
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 0,
  scheduling: 'lifo',
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 120000,
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 0,
  rejectUnauthorized: false,
  scheduling: 'lifo',
});

let proxyServer: http.Server | null = null;
let proxyPort = 0;
const activeFfmpegProcs = new Set<ChildProcess>();
const resolvedFfmpegPath = ffmpegPath ? ffmpegPath.replace('app.asar', 'app.asar.unpacked') : null;

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
    }, (proxyRes) => {
      resolve({ statusCode: proxyRes.statusCode || 200, headers: proxyRes.headers, stream: proxyRes });
    });
    proxyReq.on('error', (err) => {
      console.warn('[proxy] upstream request error:', err.message);
    });
    proxyReq.end();
  });
}

function handleRemux(targetUrl: string, req: http.IncomingMessage, res: http.ServerResponse) {
  if (!resolvedFfmpegPath) {
    console.error('[remux] ffmpeg not available');
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('ffmpeg not available');
    return;
  }

  const referer = `${new URL(targetUrl).origin}/`;

  const targetFps = 25;
  const gop = targetFps * 2;

  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
    '-headers', `Referer: ${referer}\r\n`,
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-analyzeduration', '2000000',
    '-probesize', '2000000',
    '-fflags', '+discardcorrupt',
    '-i', targetUrl,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', `fps=${targetFps},settb=AVTB,setpts=N/(${targetFps}*TB)`,
    '-af', 'aresample=async=1:first_pts=0,asetpts=N/SR/TB',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-profile:v', 'high',
    '-level', '4.1',
    '-pix_fmt', 'yuv420p',
    '-bf', '0',
    '-g', String(gop),
    '-keyint_min', String(gop),
    '-sc_threshold', '0',
    '-x264-params', 'force-cfr=1',
    '-c:a', 'aac',
    '-ar', '48000',
    '-ac', '2',
    '-b:a', '128k',
    '-muxpreload', '0',
    '-muxdelay', '0',
    '-f', 'mp4',
    '-movflags', '+empty_moov+default_base_moof+frag_keyframe+dash',
    '-frag_duration', '1000000',
    'pipe:1',
  ];

  console.log('[remux] Re-clock starting:', targetUrl.substring(0, 100));
  const ff = spawn(resolvedFfmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  activeFfmpegProcs.add(ff);

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  ff.stdout.pipe(res);

  ff.stderr.on('data', (d: Buffer) => {
    const msg = d.toString().trim();
    if (msg && !msg.includes('deprecated')) {
      console.log('[ffmpeg]', msg.substring(0, 300));
    }
  });

  const cleanup = () => {
    activeFfmpegProcs.delete(ff);
    try { ff.kill('SIGKILL'); } catch {}
  };

  ff.on('exit', (code) => {
    console.log('[remux] ffmpeg exited with code:', code);
    activeFfmpegProcs.delete(ff);
    if (!res.writableEnded) {
      try { res.end(); } catch {}
    }
  });

  ff.on('error', (err) => {
    console.error('[remux] ffmpeg spawn error:', err);
    cleanup();
    if (!res.headersSent) { try { res.writeHead(502); } catch {} }
    try { res.end(); } catch {}
  });

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
}

export function startStreamProxy(): Promise<number> {
  return new Promise((resolve, reject) => {
    proxyServer = http.createServer(async (req, res) => {
      const url = req.url || '';

      // Remux endpoint for MPEG-TS live streams
      if (url.startsWith('/remux/')) {
        const targetUrl = decodeURIComponent(url.slice('/remux/'.length));
        if (!targetUrl.startsWith('http')) {
          res.writeHead(400);
          res.end('Invalid URL');
          return;
        }
        handleRemux(targetUrl, req, res);
        return;
      }

      const targetUrl = decodeURIComponent(url.slice(1) || '');
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

          const isLive = /\/live\//.test(currentUrl);
          let contentType = getForcedContentType(currentUrl) || result.headers['content-type'] || '';
          if (isLive && !contentType) contentType = 'video/mp2t';

          const responseHeaders: Record<string, string | string[]> = {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'no-cache',
          };

          if (!isLive && result.headers['content-length']) {
            responseHeaders['Content-Length'] = result.headers['content-length'];
          }
          if (result.headers['content-range']) {
            responseHeaders['Content-Range'] = result.headers['content-range'];
          }

          res.writeHead(result.statusCode, responseHeaders);
          result.stream.pipe(res, { end: true });

          result.stream.on('error', (err) => {
            console.warn('[proxy] upstream stream error:', err.message);
            if (!res.headersSent) res.writeHead(502);
            try { res.destroy(); } catch {}
          });

          res.on('error', (err) => {
            console.warn('[proxy] client error:', err.message);
            try { result.stream.destroy(); } catch {}
          });

          req.on('close', () => {
            try { if (!result.stream.destroyed) result.stream.destroy(); } catch {}
          });

          res.on('close', () => {
            try { if (!result.stream.destroyed) result.stream.destroy(); } catch {}
          });

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

    proxyServer.keepAliveTimeout = 300000;
    proxyServer.headersTimeout = 305000;
    proxyServer.requestTimeout = 0;
    proxyServer.maxConnections = 500;

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

export function killAllFfmpeg() {
  for (const p of activeFfmpegProcs) {
    try { p.kill('SIGKILL'); } catch {}
  }
  activeFfmpegProcs.clear();
}

export function stopStreamProxy() {
  killAllFfmpeg();
  if (proxyServer) { proxyServer.close(); proxyServer = null; proxyPort = 0; }
}
