import { LRUCache } from 'lru-cache';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ipcMain } from 'electron';

interface CachedImage {
  data: Buffer;
  contentType: string;
}

const cache = new LRUCache<string, CachedImage>({
  max: 10000,
  maxSize: 300 * 1024 * 1024,
  maxEntrySize: 3 * 1024 * 1024,
  sizeCalculation: (value) => value.data.length + 128,
  ttl: 1000 * 60 * 60 * 24 * 14,
  allowStale: false,
  updateAgeOnGet: true,
});

const failedUrls = new Set<string>();
const inflightRequests = new Map<string, Promise<{ dataUrl: string } | null>>();

function fetchImageRaw(url: string): Promise<{ data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'image/*' },
    }, (res) => {
      const chunks: Buffer[] = [];
      const ct = (res.headers['content-type'] as string) || 'image/jpeg';
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        if (data.length === 0 || data.length > 3 * 1024 * 1024) {
          reject(new Error('Invalid image size'));
          return;
        }
        resolve({ data, contentType: ct.startsWith('image/') ? ct : 'image/jpeg' });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

export function registerImageCacheHandlers() {
  ipcMain.handle('image:fetch', async (_e, url: string) => {
    if (!url || failedUrls.has(url)) return null;

    const cached = cache.get(url);
    if (cached) {
      return { dataUrl: `data:${cached.contentType};base64,${cached.data.toString('base64')}` };
    }

    if (inflightRequests.has(url)) {
      return inflightRequests.get(url)!;
    }

    const fetchPromise = (async () => {
      try {
        const result = await fetchImageRaw(url);
        cache.set(url, result);
        return { dataUrl: `data:${result.contentType};base64,${result.data.toString('base64')}` };
      } catch {
        failedUrls.add(url);
        return null;
      } finally {
        inflightRequests.delete(url);
      }
    })();

    inflightRequests.set(url, fetchPromise);
    return fetchPromise;
  });

  ipcMain.handle('image:clearCache', () => {
    cache.clear();
    failedUrls.clear();
    inflightRequests.clear();
    return { success: true };
  });

  ipcMain.handle('image:stats', () => ({
    size: cache.size,
    calculatedSize: cache.calculatedSize,
    failed: failedUrls.size,
  }));
}
