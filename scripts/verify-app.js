const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime, Console } = client;
  await Console.enable();
  await Runtime.enable();

  // Collect console errors
  const errors = [];
  Console.on('messageAdded', ({ message }) => {
    if (message.level === 'error') errors.push(message.text);
  });

  // Check current channel
  let r = await Runtime.evaluate({
    expression: 'window.__playlistStore?.getState?.()?.currentChannel?.tvg_name',
    returnByValue: true,
  });
  console.log('currentChannel:', r.result.value);

  // Check video element
  r = await Runtime.evaluate({
    expression: 'document.querySelector("video") !== null',
    returnByValue: true,
  });
  console.log('video element exists:', r.result.value);

  // Check LRU cache stats
  r = await Runtime.evaluate({
    expression: '(async () => { try { return await window.electronAPI.getImageCacheStats(); } catch(e) { return "error: " + e.message; } })()',
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('imageCache stats:', JSON.stringify(r.result.value));

  // Check categories
  r = await Runtime.evaluate({
    expression: '(async () => { try { const s = window.__playlistStore.getState(); const cats = await window.electronAPI.getVisibleCategories(s.activePlaylistId); return cats.length + " categories"; } catch(e) { return "error: " + e.message; } })()',
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('categories:', r.result.value);

  // Report errors
  if (errors.length > 0) {
    console.log('CONSOLE ERRORS:', errors.join('\n  '));
  } else {
    console.log('No console errors');
  }

  await client.close();
})();
