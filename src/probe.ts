// Probe MUST be imported before any player/React code
(function () {
  const log: any[] = [];
  (window as any).__log = log;
  const push = (o: any) => {
    log.push({ ms: performance.now() | 0, ...o });
    if (log.length > 8000) log.shift();
  };

  let msCount = 0;
  const NativeMS = window.MediaSource;
  window.MediaSource = new Proxy(NativeMS, {
    construct(T, a) {
      msCount++;
      push({
        type: 'MS.new',
        msCount,
        at: (new Error().stack || '').split('\n')[2]?.trim(),
      });
      return new (T as any)(...a);
    },
  }) as any;
  (window.MediaSource as any).isTypeSupported = NativeMS.isTypeSupported.bind(NativeMS);
  (window as any).__msCount = () => msCount;

  const oc = URL.createObjectURL;
  URL.createObjectURL = function (o: any) {
    const u = oc.call(this, o);
    push({ type: 'blob.new', kind: o?.constructor?.name, url: u.slice(0, 28) });
    return u;
  };

  const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    get() { return d.get!.call(this); },
    set(v) {
      push({
        type: 'src=',
        url: String(v).slice(0, 40),
        at: (new Error().stack || '').split('\n')[2]?.trim(),
      });
      d.set!.call(this, v);
    },
  });

  // Hook SourceBuffer.appendBuffer
  const origAppend = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function (this: SourceBuffer, data: any) {
    push({ type: 'append', bytes: data?.byteLength || 0, updating: this.updating });
    return origAppend.call(this, data);
  };

  // Hook SourceBuffer.remove (eviction)
  const origRemove = SourceBuffer.prototype.remove;
  SourceBuffer.prototype.remove = function (this: SourceBuffer, start: number, end: number) {
    push({ type: 'remove', start: +start.toFixed(2), end: +end.toFixed(2), updating: this.updating });
    return origRemove.call(this, start, end);
  };

  // Hook SourceBuffer.timestampOffset writes
  const tsDesc = Object.getOwnPropertyDescriptor(SourceBuffer.prototype, 'timestampOffset');
  if (tsDesc?.set) {
    Object.defineProperty(SourceBuffer.prototype, 'timestampOffset', {
      get() { return tsDesc.get!.call(this); },
      set(v: number) {
        push({ type: 'timestampOffset=', value: v, at: (new Error().stack || '').split('\n')[2]?.trim() });
        tsDesc.set!.call(this, v);
      },
    });
  }

  // Hook video.load()
  const origLoad = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function () {
    push({ type: 'video.load()', at: (new Error().stack || '').split('\n')[2]?.trim() });
    return origLoad.call(this);
  };

  // Hook removeAttribute('src')
  const origRemoveAttr = HTMLMediaElement.prototype.removeAttribute;
  HTMLMediaElement.prototype.removeAttribute = function (this: HTMLMediaElement, name: string) {
    if (name === 'src') {
      push({ type: 'removeAttribute(src)', at: (new Error().stack || '').split('\n')[2]?.trim() });
    }
    return origRemoveAttr.call(this, name);
  };

  // Hook endOfStream
  const origEOS = MediaSource.prototype.endOfStream;
  MediaSource.prototype.endOfStream = function (this: MediaSource, reason?: EndOfStreamError) {
    push({ type: 'endOfStream', reason: reason || undefined, at: (new Error().stack || '').split('\n')[2]?.trim() });
    return origEOS.call(this, reason);
  };

  (window as any).__dump = () => {
    const b = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'rewind-log.json';
    a.click();
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F9') (window as any).__dump();
  });

  (window as any).__probeState = { queueLen: 0, destroyed: false, sbUpdating: false, msReady: false, fetchStarted: false, dataReceived: 0, canplay: false, playing: false };

  // Capture console errors
  const origErr = console.error;
  (window as any).__consoleErrors = [];
  console.error = function (...args: any[]) {
    (window as any).__consoleErrors!.push(args.map(String).join(' '));
    if ((window as any).__consoleErrors!.length > 500) (window as any).__consoleErrors!.shift();
    origErr.apply(console, args);
  };

  (window as any).__attachHUD = function (video: HTMLVideoElement) {
    if (document.getElementById('__probe_hud')) return;
    const hud = document.createElement('div');
    hud.id = '__probe_hud';
    hud.style.cssText =
      'position:fixed;top:0;left:0;z-index:2147483647;background:#000d;color:#0f0;font:11px monospace;padding:6px;white-space:pre;pointer-events:none';
    document.body.appendChild(hud);
    let last = 0;
    let seeking = false;
    let rewinds = 0;
    video.addEventListener('seeking', () => {
      seeking = true;
      log.push({ ms: performance.now() | 0, type: 'seeking', ct: +video.currentTime.toFixed(3) });
    });
    video.addEventListener('seeked', () => { seeking = false; });
    setInterval(() => {
      const ct = video.currentTime;
      const b = video.buffered;
      const s = video.seekable;
      const bs = b.length ? b.start(0).toFixed(2) : '-';
      const be = b.length ? b.end(b.length - 1).toFixed(2) : '-';
      const se = s.length ? s.end(s.length - 1).toFixed(2) : '-';
      if (ct < last - 0.15 && !seeking) {
        rewinds++;
        const context = log.slice(-8).map(e => ({ ms: e.ms, type: e.type, ...(e.value !== undefined ? { v: e.value } : {}) }));
        log.push({
          ms: performance.now() | 0,
          type: 'REWIND',
          from: +last.toFixed(3),
          to: +ct.toFixed(3),
          msCount: (window as any).__msCount(),
          src: video.currentSrc.slice(0, 40),
          bStart: bs,
          bEnd: be,
          seekEnd: se,
          readyState: video.readyState,
          context,
        });
        hud.style.color = '#f33';
        setTimeout(() => (hud.style.color = '#0f0'), 500);
      }
      last = ct;
      hud.textContent =
        `src   ${video.currentSrc.slice(0, 24)}\nMS#   ${(window as any).__msCount()}\nt     ${ct.toFixed(2)}\n` +
        `buf   ${bs} → ${be}\nseek  ${se}\nrewinds ${rewinds}`;
    }, 200);
  };
})();
