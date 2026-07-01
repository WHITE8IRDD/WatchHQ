const CDP = require('chrome-remote-interface');

(async () => {
  const list = await CDP.List({ port: 9222 });
  // Find the WatchHQ page target
  const target = list.find(t => t.url && (t.url.includes('localhost:5173') || t.url.includes('dist/index.html')));
  if (!target) {
    console.log('ERROR: No WatchHQ page target found. Targets:', list.map(t => t.url));
    process.exit(1);
  }
  console.log('Connecting to:', target.url);

  const c = await CDP({ port: 9222, target: target.id });
  const { Runtime } = c;
  await Runtime.enable();

  const ev = async (ex) => (await Runtime.evaluate({ expression: ex, returnByValue: true, awaitPromise: true })).result.value;

  const script = `
(async () => {
  const api = window.electronAPI;
  if (!api) return { error: 'No electronAPI - contextBridge may have failed' };
  const r = {};
  r.playlists = await api.getPlaylists().catch(e => 'ERR:' + e.message);
  r.count = Array.isArray(r.playlists) ? r.playlists.length : 0;
  if (r.count > 0) {
    const p = r.playlists[0];
    r.channels = await api.getChannels(p.id).then(c => c.length).catch(e => 'ERR:' + e.message);
    r.search = await api.searchChannels({playlistId:p.id,query:'bein'}).then(c => c.length).catch(e => 'ERR:' + e.message);
    r.vod = await api.getVod(p.id).then(c => c.length).catch(e => 'ERR:' + e.message);
    r.series = await api.getSeries(p.id).then(c => c.length).catch(e => 'ERR:' + e.message);
    r.categories = await api.getVisibleCategories(p.id).then(c => c.length).catch(e => 'ERR:' + e.message);
  }
  r.preferences = await api.getPreferences().catch(e => 'ERR:' + e.message);
  r.history = await api.getRecentHistory(5).catch(e => 'ERR:' + e.message);
  r.favorites = await api.getAllFavorites().catch(e => 'ERR:' + e.message);
  r.proxyPort = await api.getStreamProxyPort().catch(e => 'ERR:' + e.message);
  return r;
})()
`;

  const result = await ev(script);
  console.log(JSON.stringify(result, null, 2));
  await c.close();
})();
