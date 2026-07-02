const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function waitStore(client) {
  const { Runtime } = client;
  for (let i = 0; i < 40; i++) {
    const r = await Runtime.evaluate({
      expression: `window.__playlistStore ? window.__playlistStore.getState().channels.length : -1`,
      returnByValue: true,
    });
    if (r.result.value > 0) return r.result.value;
    await Runtime.evaluate({
      expression: `window.__playlistStore?.getState().loadPlaylists();`,
      awaitPromise: true,
    });
    await new Promise(r => setTimeout(r, 2000));
  }
  return 0;
}

async function main() {
  await new Promise(r => setTimeout(r, 3000));
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.type === 'page');
  if (!target) { console.error('No page'); process.exit(1); }
  
  const client = await CDP({ target });
  const { Runtime } = client;
  await Runtime.enable();
  
  // Ensure on /live
  await Runtime.evaluate({ expression: `window.location.hash = '#/live'` });
  await new Promise(r => setTimeout(r, 3000));
  
  // Wait for channels
  const chCount = await waitStore(client);
  console.log('Channels:', chCount);
  if (!chCount) { console.error('No channels'); process.exit(1); }
  
  // Get a beIN TS channel via store (FULL object)
  const ch = await Runtime.evaluate({
    expression: `(() => {
      const chs = window.__playlistStore.getState().channels;
      const bein = chs.filter(function(c) {
        return c.tvg_name.toLowerCase().includes('bein') && (c.url || '').includes('.ts');
      });
      return bein.length > 0 ? bein[0] : null;
    })()`,
    returnByValue: true,
  });
  if (!ch.result.value) { console.error('No beIN channel'); process.exit(1); }
  console.log('Playing:', ch.result.value.name);
  
  // Set channel via store
  await Runtime.evaluate({
    expression: `window.__playlistStore.getState().setCurrentChannel(${JSON.stringify(ch.result.value)})`,
    awaitPromise: false,
  });
  
  // Wait for video element
  for (let i = 0; i < 20; i++) {
    const v = await Runtime.evaluate({
      expression: `document.querySelector('video') !== null`,
      returnByValue: true,
    });
    if (v.result.value) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Poll for 3 minutes
  console.log('Monitoring for 3 minutes...');
  const start = Date.now();
  while (Date.now() - start < 180000) {
    await new Promise(r => setTimeout(r, 15000));
    const state = await Runtime.evaluate({
      expression: `
        (() => {
          const log = window.__log || [];
          const rewinds = log.filter(function(e) { return e.type === 'REWIND'; });
          const mscount = (window.__msCount && window.__msCount()) || 0;
          const v = document.querySelector('video');
          return {
            elapsed: ${Date.now() - start},
            rewindCount: rewinds.length,
            msCount: mscount,
            currentTime: v ? v.currentTime : null,
            currentSrc: v ? (v.currentSrc || '').slice(0, 40) : null,
            lastRewind: rewinds.length > 0 ? rewinds[rewinds.length - 1] : null,
            logLength: log.length,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(`[${(state.result.value.elapsed/1000).toFixed(0)}s]`, JSON.stringify(state.result.value));
    
    // Stop early if we've captured 3+ rewinds
    if (state.result.value.rewindCount >= 3) {
      console.log('Captured 3+ rewinds — stopping early');
      break;
    }
  }
  
  // Dump the full log
  const dump = await Runtime.evaluate({
    expression: `JSON.stringify(window.__log || [], null, 2)`,
    returnByValue: true,
  });
  fs.writeFileSync('rewind-log.json', dump.result.value);
  console.log('\n=== Log written to rewind-log.json ===');
  
  // Summarize
  const events = JSON.parse(dump.result.value);
  const summary = {
    totalEvents: events.length,
    msNewCount: events.filter(function(e) { return e.type === 'MS.new'; }).length,
    blobNewCount: events.filter(function(e) { return e.type === 'blob.new'; }).length,
    srcAssignments: events.filter(function(e) { return e.type === 'src='; }).length,
    rewindCount: events.filter(function(e) { return e.type === 'REWIND'; }).length,
    seekingCount: events.filter(function(e) { return e.type === 'seeking'; }).length,
    rewinds: events.filter(function(e) { return e.type === 'REWIND'; }),
  };
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  
  await client.close();
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
