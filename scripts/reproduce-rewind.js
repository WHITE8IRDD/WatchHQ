const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function main() {
  console.log('Waiting 8s for app to boot...');
  await new Promise(r => setTimeout(r, 8000));
  
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.type === 'page' && t.url && t.url.includes('localhost'));
  if (!target) { console.error('No app page target'); process.exit(1); }
  console.log('Target:', target.url?.slice(0, 60));
  
  const client = await CDP({ target });
  const { Runtime } = client;
  await Runtime.enable();
  
  console.log('Navigating to Live TV...');
  await Runtime.evaluate({ expression: `window.location.hash = '#/live'` });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('Waiting for playlist store...');
  let storeReady = false;
  for (let i = 0; i < 30; i++) {
    const r = await Runtime.evaluate({
      expression: `window.__playlistStore ? window.__playlistStore.getState().channels.length : -1`,
      returnByValue: true,
    });
    if (r.result.value > 0) { storeReady = true; break; }
    await Runtime.evaluate({
      expression: `window.__playlistStore?.getState().loadPlaylists();`,
      awaitPromise: true,
    });
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!storeReady) { console.error('Store not ready after 60s'); process.exit(1); }
  
  console.log('Searching for 2M channel...');
  
  // Use store directly — search all channels for 2M
  const searchResult = await Runtime.evaluate({
    expression: `
      (() => {
        try {
          const store = window.__playlistStore;
          if (!store) return JSON.stringify({ error: 'no store' });
          const chs = store.getState().channels;
          if (!chs || !chs.length) return JSON.stringify({ error: 'no channels', len: 0 });
          // Search for 2M
          var found = null;
          for (var i = 0; i < chs.length; i++) {
            var c = chs[i];
            var name = (c.tvg_name || c.name || '').toLowerCase();
            if (name.indexOf('2m') >= 0) {
              // Prefer non-HEVC version
              if (name.indexOf('hevc') === -1) {
                found = { tvg_name: c.tvg_name, url: c.url, id: c.id, name: c.name };
                break;
              }
              if (!found) found = { tvg_name: c.tvg_name, url: c.url, id: c.id, name: c.name };
            }
          }
          if (found) return JSON.stringify(found);
          return JSON.stringify({ error: 'no 2M found', totalChs: chs.length });
        } catch(e) { return JSON.stringify({ error: e.message }); }
      })()
    `,
    returnByValue: true,
  });
  
  const channelInfo = JSON.parse(searchResult.result.value);
  console.log('Channel info:', channelInfo);
  
  if (channelInfo.error) {
    console.error('Failed to find 2M channel:', channelInfo.error);
    process.exit(1);
  }
  
  // Set channel via store
  console.log('Setting channel:', channelInfo.tvg_name);
  await Runtime.evaluate({
    expression: `window.__playlistStore.getState().setCurrentChannel(${JSON.stringify(channelInfo)})`,
    awaitPromise: false,
  });
  
  // Wait up to 45s for playback to actually start
  console.log('\n\u23f3 Waiting up to 45s for playback (currentTime > 2)...');
  let started = false;
  const waitStart = Date.now();
  while (Date.now() - waitStart < 45000) {
    await new Promise(r => setTimeout(r, 2000));
    const state = await Runtime.evaluate({
      expression: `
        (() => {
          const v = document.querySelector('video');
          return {
            currentTime: v?.currentTime || 0,
            readyState: v?.readyState || 0,
            src: v?.currentSrc?.slice(0, 30) || '',
            paused: v?.paused,
          };
        })()
      `,
      returnByValue: true,
    });
    const s = state.result.value;
    console.log(`  t=${s.currentTime.toFixed(2)}s ready=${s.readyState} paused=${s.paused} src=${s.src}`);
    if (s.currentTime > 2) {
      started = true;
      console.log(`\n\u2705 Playback started at t=${s.currentTime.toFixed(2)}s`);
      break;
    }
  }
  
  if (!started) {
    console.error('\n\u274c Playback never started in 45s. Dumping log.');
    const dump = await Runtime.evaluate({
      expression: `JSON.stringify(window.__log || [], null, 2)`,
      returnByValue: true,
    });
    fs.writeFileSync('rewind-log-nostart.json', dump.result.value);
    const events = JSON.parse(dump.result.value);
    console.log('\nEvent counts:');
    const counts = {};
    for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
    console.log(counts);
    process.exit(2);
  }
  
  console.log('\n\U0001f4e1 Monitoring 3 minutes with playback active...');
  const monitorStart = Date.now();
  let checkNum = 0;
  while (Date.now() - monitorStart < 180000) {
    await new Promise(r => setTimeout(r, 15000));
    checkNum++;
    const state = await Runtime.evaluate({
      expression: `
        (() => {
          const events = window.__log || [];
          const rewinds = events.filter(e => e.type === 'REWIND');
          const v = document.querySelector('video');
          return {
            elapsed: ${Date.now() - monitorStart},
            currentTime: v?.currentTime,
            paused: v?.paused,
            rewindCount: rewinds.length,
            msCount: (window.__msCount && window.__msCount()) || 0,
            lastRewind: rewinds[rewinds.length - 1] || null,
          };
        })()
      `,
      returnByValue: true,
    });
    const s = state.result.value;
    console.log(`[${(s.elapsed/1000).toFixed(0)}s] t=${s.currentTime?.toFixed(2)} paused=${s.paused} rewinds=${s.rewindCount} msCount=${s.msCount}`);
    if (s.lastRewind) {
      console.log(`  last rewind: ${s.lastRewind.from} \u2192 ${s.lastRewind.to}`);
    }
  }
  
  // Final dump
  const finalDump = await Runtime.evaluate({
    expression: `JSON.stringify(window.__log || [], null, 2)`,
    returnByValue: true,
  });
  fs.writeFileSync('rewind-log.json', finalDump.result.value);
  const events = JSON.parse(finalDump.result.value);
  
  const summary = {
    totalEvents: events.length,
    byType: {},
    rewindCount: 0,
    rewinds: [],
  };
  for (const e of events) {
    summary.byType[e.type] = (summary.byType[e.type] || 0) + 1;
  }
  summary.rewindCount = summary.byType.REWIND || 0;
  summary.rewinds = events.filter(e => e.type === 'REWIND').slice(0, 5);
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync('rewind-summary.json', JSON.stringify(summary, null, 2));
  
  await client.close();
  process.exit(summary.rewindCount === 0 ? 0 : 1);
}

main().catch(e => { console.error('Test error:', e); process.exit(1); });
