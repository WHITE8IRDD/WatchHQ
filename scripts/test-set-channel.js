const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime } = client;
  const e = async (expr) => {
    const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { console.log('EXCEPTION:', r.exceptionDetails.text); return null; }
    return r.result.value;
  };

  const playlists = await e('window.electronAPI.getPlaylists()');
  console.log('Playlists:', playlists?.length);
  if (!playlists || !playlists.length) { console.log('No playlists'); await client.close(); return; }

  const samples = await e('window.electronAPI.debugSampleUrls()');
  console.log('Samples:', samples?.length);
  if (!samples || !samples.length) { console.log('No samples'); await client.close(); return; }

  const ch = samples[0];
  console.log('Channel:', ch.tvg_name);

  const setCode = `(function(){
    try {
      window.__playlistStore.getState().setCurrentChannel({
        id: "test-1",
        playlist_id: "",
        tvg_name: ${JSON.stringify(ch.tvg_name)},
        tvg_logo: "",
        url: ${JSON.stringify(ch.url)},
        url_fallback: ${JSON.stringify(ch.url_fallback || '')},
        group_title: ${JSON.stringify(ch.group_title || '')},
        is_favorite: 0,
        watch_count: 0
      });
      return "ok";
    } catch(e) { return "err: " + e.message; }
  })()`;

  const ok = await e(setCode);
  console.log('Set channel:', ok);

  console.log('Waiting 15s...');
  await new Promise(r => setTimeout(r, 15000));

  const videoState = await e(`(function(){
    var v = document.querySelector("video");
    if (!v) return JSON.stringify({error: "no video element"});
    return JSON.stringify({
      exists: true,
      paused: v.paused,
      currentTime: v.currentTime,
      readyState: v.readyState,
      networkState: v.networkState,
      error: v.error ? v.error.code : null,
      src: (v.src || "").substring(0, 80)
    });
  })()`);
  console.log('Video:', JSON.parse(videoState));

  await client.close();
})();
