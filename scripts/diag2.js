const CDP = require('chrome-remote-interface');
const http = require('http');

(async () => {
  const targets = await CDP.List({port:9222});
  const target = targets.find(t => t.type === 'page');
  const client = await CDP({target});
  const {Runtime} = client;
  await Runtime.enable();

  // Get current channel and its URL
  let r = await Runtime.evaluate({expression: `(() => {
    const ch = window.__playlistStore?.getState().currentChannel;
    return JSON.stringify({tvg_name: ch?.tvg_name, url: ch?.url, name: ch?.name});
  })()`});
  const channel = JSON.parse(r.result.value);
  console.log('Channel:', channel);

  // Get video state
  r = await Runtime.evaluate({expression: `(() => {
    const v = document.querySelector('video');
    if (!v) return 'NO_VIDEO';
    return JSON.stringify({
      readyState: v.readyState,
      paused: v.paused,
      currentTime: v.currentTime,
      src: (v.src || '').slice(0,60),
      networkState: v.networkState,
      error: v.error ? v.error.message : null,
      bufferedLen: v.buffered.length
    });
  })()`});
  console.log('Video:', r.result.value);

  // Console errors
  r = await Runtime.evaluate({expression: `JSON.stringify(window.__consoleErrors || [])`});
  console.log('Console errors:', r.result.value);

  // Probe state
  r = await Runtime.evaluate({expression: `typeof window.__probeState !== 'undefined' ? JSON.stringify(window.__probeState) : 'no_probe'`});
  console.log('Probe:', r.result.value);

  // Test remux endpoint directly
  if (channel.url) {
    const remuxUrl = `http://127.0.0.1:6290/remux/${encodeURIComponent(channel.url)}`;
    console.log('Testing remux:', remuxUrl.slice(0,120));
    
    // Try fetching first 100KB of remux stream with timeout
    const result = await new Promise((resolve) => {
      const req = http.get(remuxUrl, (res) => {
        let data = Buffer.alloc(0);
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; req.destroy(); resolve({ok: false, error: 'TIMEOUT 10s', status: res.statusCode}); }, 10000);
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
          if (data.length > 100000 || timedOut) {
            clearTimeout(timer);
            req.destroy();
            resolve({ok: true, bytes: data.length, status: res.statusCode, headers: res.headers});
          }
        });
        res.on('end', () => {
          clearTimeout(timer);
          resolve({ok: data.length > 0, bytes: data.length, status: res.statusCode, ended: true});
        });
        res.on('error', (e) => { clearTimeout(timer); resolve({ok: false, error: e.message, status: res.statusCode}); });
      });
      req.on('error', (e) => resolve({ok: false, error: e.message}));
    });
    console.log('Remux result:', JSON.stringify(result));
  }

  await client.close();
})();
