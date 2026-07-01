const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime } = client;
  const e = async (expr) => (await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true })).result.value;

  const pid = await e('window.__playlistStore?.getState?.()?.activePlaylistId');
  console.log('activePlaylistId:', pid);

  // Get first 10 channel names and URLs
  const chs = await e('(async()=>{try{var p=window.__playlistStore.getState().activePlaylistId;var r=await window.electronAPI.getChannels(p);return JSON.stringify(r.slice(0,10).map(function(c){return {name:c.tvg_name,url:c.url.substring(0,80)};}));}catch(e){return "err: "+e.message;}})()');
  console.log('first 10 channels:', chs);

  // Try a few different group names (categories)
  const groups = await e('(async()=>{try{var p=window.__playlistStore.getState().activePlaylistId;var g=await window.electronAPI.getGroups(p);return JSON.stringify(g.slice(0,10));}catch(e){return "err: "+e.message;}})()');
  console.log('first 10 groups:', groups);

  // image cache stats
  const img = await e('(async()=>{try{return await window.electronAPI.getImageCacheStats();}catch(e){return null;}})()');
  console.log('image cache:', JSON.stringify(img));

  await client.close();
})();
