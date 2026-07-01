const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime } = client;
  
  const ev = async (expr) => {
    const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { error: r.exceptionDetails.text, value: r.result?.value };
    return r.result?.value;
  };

  // Get data before navigation
  const samples = await ev('window.electronAPI.debugSampleUrls()');
  const playlists = await ev('window.electronAPI.getPlaylists()');
  const proxyPort = await ev('window.electronAPI.getStreamProxyPort()');
  
  console.log('=== DEBUG-STREAMS OUTPUT ===');
  console.log('Sample channel URLs (first 5):');
  samples.forEach((s, i) => console.log(`  ${i+1}. ${s.tvg_name} \u2014 ${s.url}`));
  console.log(`Proxy port: ${proxyPort}`);
  console.log(`Playlists: ${playlists?.length}`);

  if (!playlists || !playlists.length) { await client.close(); return; }
  const ch0 = samples[0];
  const chJson = JSON.stringify({
    id: 'test-' + Date.now(),
    playlist_id: playlists[0].id,
    tvg_name: ch0.tvg_name,
    tvg_logo: '',
    url: ch0.url,
    url_fallback: ch0.url_fallback || '',
    group_title: ch0.group_title || '',
    is_favorite: 0,
    watch_count: 0,
  });

  // Single async eval: navigate, set, wait, report
  console.log('\n=== PLAYBACK TEST ===');
  const result = await ev(`(async function(){
    window.location.hash = '#/live';
    await new Promise(function(r){ setTimeout(r, 1000); });
    window.__playlistStore.getState().setCurrentChannel(${chJson});
    await new Promise(function(r){ setTimeout(r, 15000); });
    var v = document.querySelector('video');
    var state = v ? {
      exists: true,
      paused: v.paused,
      currentTime: v.currentTime,
      readyState: v.readyState,
      networkState: v.networkState,
      error: v.error ? v.error.code : null,
      src: (v.src || '').substring(0, 80)
    } : { error: 'no video element' };
    return JSON.stringify(state);
  })()`);
  
  console.log('Result:', typeof result === 'string' ? JSON.parse(result) : result);
  await client.close();
  console.log('Done');
})();
