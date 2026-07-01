let portCache: number | null = null;

export async function getProxiedImageUrl(originalUrl: string): Promise<string> {
  if (!originalUrl) return '';
  if (!portCache) {
    portCache = await window.electronAPI.getStreamProxyPort();
  }
  if (!portCache) return originalUrl;
  return `http://127.0.0.1:${portCache}/${encodeURIComponent(originalUrl)}`;
}
