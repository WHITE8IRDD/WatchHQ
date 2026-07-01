// scripts/test-playback.js — Automated playback test via Chrome DevTools Protocol
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function connectCDP(retries = 20, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const targets = await CDP.List({ port: 9222 });
      const target = targets.find(t => t.type === 'page' && t.url.includes('index.html'));
      if (target) {
        const client = await CDP({ target: target.id, port: 9222 });
        console.log(`[CDP] Connected to target: ${target.title}`);
        return client;
      }
      console.log(`[CDP] Attempt ${i+1}: no target found, awaiting page...`);
    } catch (e) {
      console.log(`[CDP] Attempt ${i+1}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('Could not connect to CDP after ' + retries + ' retries');
}

async function testPlayback() {
  console.log('═══ CONNECTING TO ELECTRON CDP ═══\n');
  const client = await connectCDP(30, 2000);

  const { Runtime, Console, Network, Page } = client;

  await Runtime.enable();
  await Console.enable();
  await Network.enable();

  const logs = [];
  const networkLogs = [];

  Console.messageAdded(({ message }) => {
    const line = `[CONSOLE.${message.level}] ${message.text}`;
    console.log(line);
    logs.push(line);
  });

  Runtime.consoleAPICalled(({ type, args }) => {
    const text = args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
    const line = `[${type}] ${text}`;
    console.log(line);
    logs.push(line);
  });

  Runtime.exceptionThrown(({ exceptionDetails }) => {
    const line = `[EXCEPTION] ${exceptionDetails.text} ${exceptionDetails.exception?.description || ''}`;
    console.error(line);
    logs.push(line);
  });

  Network.responseReceived(({ response }) => {
    if (response.url.includes('127.0.0.1') || response.url.includes('cloud-ip') || response.url.includes('abrdns') || response.url.includes('m3u8') || response.url.includes('.ts')) {
      const line = `[NET] ${response.status} ${response.mimeType} ${response.url.substring(0, 120)}`;
      console.log(line);
      networkLogs.push({ status: response.status, url: response.url, mimeType: response.mimeType, remoteIPAddress: response.remoteIPAddress });
    }
  });

  // Wait for page fully loaded
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n═══ CHECKING APP STATE ═══\n');

  // Wait for store to be ready and playlists loaded
  await new Promise(r => setTimeout(r, 2000));

  let storeCheck = await Runtime.evaluate({
    expression: `typeof window.__playlistStore !== 'undefined' ? 'available' : 'not available'`,
    returnByValue: true,
  });
  console.log(`Store: ${storeCheck.result.value}`);

  // Check window.electronAPI availability
  const apiCheck = await Runtime.evaluate({
    expression: `typeof window.electronAPI !== 'undefined' ? Object.keys(window.electronAPI).join(',') : 'NOT FOUND'`,
    returnByValue: true,
  });
  console.log('electronAPI methods:', apiCheck.result.value);

  // Explicitly call loadPlaylists and wait
  const loadResult = await Runtime.evaluate({
    expression: `(async () => { 
      try {
        const s = window.__playlistStore; 
        if (!s) return 'no store';
        await s.getState().loadPlaylists(); 
        return 'ok, channels=' + s.getState().channels.length;
      } catch(e) { return 'error: ' + e.message; }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('loadPlaylists() result:', loadResult.result.value);

  await new Promise(r => setTimeout(r, 3000));

  // Get channels
  let getChannelsResult = await Runtime.evaluate({
    expression: `
      (async () => {
        const store = window.__playlistStore;
        let channels = store ? store.getState().channels : [];
        let playlists = [];
        
        console.log('[AUTO] Store channels:', channels.length);
        
        if (channels.length === 0) {
          playlists = await window.electronAPI.getPlaylists();
          console.log('[AUTO] IPC playlists:', playlists.length);
          if (playlists.length > 0) {
            const chs = await window.electronAPI.getChannels(playlists[0].id);
            console.log('[AUTO] IPC channels:', chs.length);
            channels = chs;
          }
        } else {
          playlists = store.getState().playlists;
          console.log('[AUTO] Store playlists:', playlists.length);
        }
        
        const targets = ['bein.*max.*4', 'alwan sport 1', 'dazn sport', 'netflix', 'world cup 2026'];
        let selected = null;
        for (const pattern of targets) {
          const regex = new RegExp(pattern, 'i');
          selected = channels.find(c => regex.test(c.tvg_name));
          if (selected) {
            console.log('[AUTO] Found:', selected.tvg_name);
            break;
          }
        }
        if (!selected && channels.length > 0) {
          selected = channels[0];
          console.log('[AUTO] Using first:', selected.tvg_name);
        }
        return selected ? { id: selected.id, name: selected.tvg_name, url: (selected.url || '').substring(0, 60) } : null;
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });

  const channelInfo = getChannelsResult.result.value;
  console.log('\nChannel to test:', JSON.stringify(channelInfo, null, 2));

  if (!channelInfo) {
    console.error('No channel found. Exiting.');
    await client.close();
    process.exit(1);
  }

  console.log('\n═══ TRIGGERING PLAYBACK ═══\n');

  // Trigger playback via store — bypass UI navigation
  const triggerResult = await Runtime.evaluate({
    expression: `
      (async () => {
        const store = window.__playlistStore;
        if (!store) { console.log('[AUTO] Store not available'); return 'no store'; }
        
        // Directly load playlists and channels into the store
        console.log('[AUTO] Loading playlists...');
        await store.getState().loadPlaylists();
        const playlists = store.getState().playlists;
        console.log('[AUTO] Playlists loaded:', playlists.length);
        
        if (playlists.length === 0) {
          console.log('[AUTO] No playlists, trying IPC directly');
          const pls = await window.electronAPI.getPlaylists();
          if (pls.length > 0) {
            store.getState().setPlaylists(pls);
            store.getState().setActivePlaylist(pls[0].id);
            console.log('[AUTO] Set playlist from IPC:', pls[0].name);
          }
        }
        
        const activeId = store.getState().activePlaylistId;
        console.log('[AUTO] Active playlist ID:', activeId);
        
        if (!activeId) return 'no active playlist';
        
        console.log('[AUTO] Loading channels for:', activeId);
        await store.getState().loadChannels(activeId);
        console.log('[AUTO] Channels loaded:', store.getState().channels.length);
        
        const channels = store.getState().channels;
        console.log('[AUTO] Store channels:', channels.length);
        
        // Find target channel
        const regex = new RegExp('${channelInfo.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}', 'i');
        const channel = channels.find(c => regex.test(c.tvg_name)) || channels[0];
        
        if (channel) {
          console.log('[AUTO] Setting current channel:', channel.tvg_name);
          store.getState().setCurrentChannel(channel);
          return 'channel set: ' + channel.tvg_name;
        }
        return 'no matching channel';
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Trigger result:', triggerResult.result.value);

  // Navigate to Live TV route first
  await Runtime.evaluate({
    expression: `window.location.hash = '#/live'`,
    returnByValue: true,
  });
  await new Promise(r => setTimeout(r, 3000));

  // Wait for video element to appear (polling)
  console.log('\n═══ WAITING FOR VIDEO ELEMENT... ═══\n');
  let videoFound = false;
  for (let i = 0; i < 20; i++) {
    const check = await Runtime.evaluate({
      expression: `document.querySelector('video') !== null`,
      returnByValue: true,
    });
    if (check.result.value) { videoFound = true; break; }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Video element found:', videoFound);

  // If video found, check the PLAY logs
  if (videoFound) {
    console.log('\n═══ CHECKING CONSOLE LOGS (PLAY/VIDEO) ═══\n');
    const lastLogs = await Runtime.evaluate({
      expression: `(() => {
        // We can't access past console logs directly, but we can check current state
        const video = document.querySelector('video');
        if (!video) return null;
        return {
          src: (video.src || '').substring(0, 120),
          currentSrc: (video.currentSrc || '').substring(0, 120),
          readyState: video.readyState,
          paused: video.paused,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          error: video.error ? { code: video.error.code, message: video.error.message } : null,
        };
      })()`,
      returnByValue: true,
    });
    console.log('Initial video state:', JSON.stringify(lastLogs.result.value, null, 2));
  }

  // Wait 15 seconds for playback to start
  console.log('\n═══ WAITING 15s FOR PLAYBACK... ═══\n');
  
  // Poll video state every 3 seconds
  let finalState = null;
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const state = await Runtime.evaluate({
      expression: `
        (() => {
          const video = document.querySelector('video');
          if (!video) return { error: 'no video element' };
          const err = video.error;
          return {
            readyState: video.readyState,
            paused: video.paused,
            currentTime: video.currentTime,
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            error: err ? { code: err.code, message: err.message } : null,
            buffered: video.buffered.length > 0 ? { start: video.buffered.start(0), end: video.buffered.end(0) } : null,
            src: (video.src || '').substring(0, 100),
          };
        })()
      `,
      returnByValue: true,
    });
    finalState = state.result.value;
    console.log(`[t=${(i+1)*3}s]`, JSON.stringify(finalState));
    // If playing and time > 0, success
    if (finalState && !finalState.error && finalState.readyState >= 3 && finalState.currentTime > 0) {
      console.log('✅ PLAYBACK CONFIRMED!');
      break;
    }
  }

  console.log('Final video state:');
  console.log(JSON.stringify(finalState, null, 2));

  // Also check if there's an error overlay
  const errorState = await Runtime.evaluate({
    expression: `
      (() => {
        const errEl = document.querySelector('.text-state-error');
        if (errEl) return errEl.textContent;
        return null;
      })()
    `,
    returnByValue: true,
  });
  if (errorState.result.value) {
    console.log('Error overlay text:', errorState.result.value);
  }

  // Check if mpegts player or HLS is loading
  const playerState = await Runtime.evaluate({
    expression: `
      (() => {
        return {
          hlsRef: typeof window.__hlsRef !== 'undefined' ? 'exists' : 'not found',
          mpegtsRef: typeof window.__mpegtsRef !== 'undefined' ? 'exists' : 'not found',
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('\nPlayer refs:', JSON.stringify(playerState.result.value));

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    channelTested: channelInfo,
    videoState: finalState,
    errorOverlay: errorState.result.value,
    playerState: playerState.result.value,
    networkEvents: networkLogs.slice(-50),
    consoleLogs: logs,
  };
  fs.writeFileSync('scripts/playback-test-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to scripts/playback-test-report.json');

  // Print summary
  const vs = finalState;
  console.log('\n══════════════ RESULTS ══════════════');
  console.log('Channel:', channelInfo.name);
  console.log('Video element:', vs?.error ? 'NOT FOUND' : 'FOUND');
  console.log('ReadyState:', vs?.readyState, '(0=nothing, 1=metadata, 2=current, 3=future, 4=enough)');
  console.log('Playing:', vs ? !vs.paused : 'N/A');
  console.log('CurrentTime:', vs?.currentTime);
  console.log('Resolution:', (vs?.videoWidth || 0) + 'x' + (vs?.videoHeight || 0));
  console.log('Error:', vs?.error ? JSON.stringify(vs.error) : 'null');
  console.log('Console logs captured:', logs.length);
  console.log('Network events captured:', networkLogs.length);
  console.log('====================================');

  await client.close();
  process.exit(0);
}

testPlayback().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
