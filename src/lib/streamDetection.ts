export type StreamType = 'hls' | 'mpegts' | 'dash' | 'mp4' | 'unknown';

export function detectStreamType(url: string): StreamType {
  const clean = url.toLowerCase().split('?')[0];

  if (clean.endsWith('.m3u8') || clean.includes('/hls/')) return 'hls';
  if (clean.endsWith('.ts') || clean.endsWith('.mts') || clean.endsWith('.m2ts')) return 'mpegts';
  if (clean.endsWith('.mpd')) return 'dash';
  if (clean.endsWith('.mp4') || clean.endsWith('.mkv') || clean.endsWith('.webm')) return 'mp4';

  if (/\/(live|livetv)\/[^/]+\/[^/]+\/\d+/.test(clean)) return 'mpegts';
  if (/\/(live|livetv)\/[^/]+\/[^/]+\/\d+\.ts$/.test(clean)) return 'mpegts';
  if (/\/(movie|series|vod)\//.test(clean)) return 'mp4';

  return 'unknown';
}
