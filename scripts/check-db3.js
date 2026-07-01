const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function run() {
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.type === 'page' && t.url.includes('index.html'));
  if (!target) { console.log('No renderer page'); process.exit(1); }

  const client = await CDP({ target: target.id });
  const { Runtime } = client;
  await Runtime.enable();

  // Check IPC responses
  const playlists = await Runtime.evaluate({
    expression: 'await window.electronAPI.getPlaylists()',
    awaitPromise: true,
    returnByValue: true
  });
  console.log('IPC getPlaylists:', JSON.stringify(playlists.result.value));

  // Check store state
  const store = await Runtime.evaluate({
    expression: `(() => {
      const s = window.__playlistStore;
      if (!s) return { error: 'no store' };
      const st = s.getState();
      return {
        playlistsLen: st.playlists.length,
        channelsLen: st.channels.length,
        currentChannel: st.currentChannel ? st.currentChannel.tvg_name : null,
        isLoading: st.isLoading,
        error: st.error
      };
    })()`,
    returnByValue: true
  });
  console.log('Store state:', JSON.stringify(store.result.value));

  // Check all IPC methods work
  for (const method of ['getPlaylists', 'getSettings']) {
    const r = await Runtime.evaluate({
      expression: `await window.electronAPI.${method}()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(`${method}:`, JSON.stringify(r.result.value).substring(0, 200));
  }

  await client.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
