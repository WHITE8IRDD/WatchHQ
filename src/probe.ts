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
