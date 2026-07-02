export interface Fmp4Options {
  onFirstFrame?: () => void;
  onError?: (err: Error) => void;
}

export class Fmp4Player {
  private video: HTMLVideoElement;
  private url: string;
  private opts: Fmp4Options;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private abortController: AbortController | null = null;
  private queue: Uint8Array[] = [];
  private destroyed = false;
  private firstFrameSent = false;

  constructor(video: HTMLVideoElement, url: string, opts: Fmp4Options = {}) {
    this.video = video;
    this.url = url;
    this.opts = opts;
  }

  async load(): Promise<void> {
    if (!('MediaSource' in window)) {
      throw new Error('MediaSource unsupported');
    }

    this.mediaSource = new MediaSource();
    const objUrl = URL.createObjectURL(this.mediaSource);
    this.video.src = objUrl;

    await new Promise<void>((resolve, reject) => {
      if (!this.mediaSource) return reject(new Error('MediaSource null'));
      const onOpen = () => {
        this.mediaSource!.removeEventListener('sourceopen', onOpen);
        URL.revokeObjectURL(objUrl);
        resolve();
      };
      this.mediaSource.addEventListener('sourceopen', onOpen);
    });

    const candidates = [
      'video/mp4; codecs="avc1.640028, mp4a.40.2"',
      'video/mp4; codecs="avc1.4D401F, mp4a.40.2"',
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      'video/mp4; codecs="avc1.640028"',
      'video/mp4',
    ];

    let mimeType = '';
    for (const c of candidates) {
      if (MediaSource.isTypeSupported(c)) { mimeType = c; break; }
    }
    if (!mimeType) throw new Error('No MP4 codec supported');

    this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
    this.sourceBuffer.mode = 'segments';

    this.sourceBuffer.addEventListener('updateend', () => this.pump());
    this.sourceBuffer.addEventListener('error', (e) => {
      console.error('[fMP4] SourceBuffer error', e);
    });

    const onCanPlay = () => {
      if (!this.firstFrameSent) {
        this.firstFrameSent = true;
        this.opts.onFirstFrame?.();
      }
    };
    this.video.addEventListener('canplay', onCanPlay, { once: true });
    this.video.addEventListener('loadeddata', onCanPlay, { once: true });

    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, { signal: this.abortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No body');

      const reader = response.body.getReader();

      while (!this.destroyed) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[fMP4] Stream ended');
          break;
        }
        if (value && value.byteLength > 0) {
          this.queue.push(value);
          this.pump();
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[fMP4] Fetch error:', err);
      this.opts.onError?.(err);
    }
  }

  private pump() {
    if (this.destroyed) return;
    if (!this.sourceBuffer || this.sourceBuffer.updating) return;
    if (this.queue.length === 0) return;

    try {
      const buffered = this.sourceBuffer.buffered;
      if (buffered.length > 0) {
        const start = buffered.start(0);
        const current = this.video.currentTime;
        if (current - start > 120) {
          this.sourceBuffer.remove(start, current - 90);
          return;
        }
      }
    } catch {}

    const chunk = this.queue.shift()!;
    try {
      this.sourceBuffer.appendBuffer(chunk as unknown as BufferSource);
    } catch (err: any) {
      if (err.name === 'QuotaExceededError') {
        try {
          const buf = this.sourceBuffer.buffered;
          if (buf.length > 0) {
            const start = buf.start(0);
            const current = this.video.currentTime;
            this.sourceBuffer.remove(start, Math.max(start + 10, current - 30));
            this.queue.unshift(chunk);
            return;
          }
        } catch {}
      }
      console.error('[fMP4] appendBuffer error:', err);
    }
  }

  destroy() {
    this.destroyed = true;
    try { this.abortController?.abort(); } catch {}
    try {
      if (this.sourceBuffer && this.sourceBuffer.updating) this.sourceBuffer.abort();
    } catch {}
    try {
      if (this.mediaSource && this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }
    } catch {}
    try { this.video.removeAttribute('src'); this.video.load(); } catch {}
    this.sourceBuffer = null;
    this.mediaSource = null;
    this.queue = [];
  }
}
