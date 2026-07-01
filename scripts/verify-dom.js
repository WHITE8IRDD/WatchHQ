const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 9222 });
  const { Runtime } = client;

  const e = async (expr) => {
    const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
    return r.result.value;
  };

  console.log('URL:', await e('window.location.href'));
  console.log('Hash:', await e('window.location.hash'));

  const rootHTML = await e('document.querySelector("#root") ? document.querySelector("#root").innerHTML.substring(0, 300) : "no root"');
  console.log('Root HTML:', rootHTML);

  const videoCount = await e('document.querySelectorAll("video").length');
  console.log('Video count:', videoCount);

  const liveTV = await e('document.querySelectorAll("video").length > 0 ? "has video" : "no video"');
  console.log('Video status:', liveTV);

  const storeChan = await e('window.__playlistStore?.getState?.()?.currentChannel?.tvg_name');
  console.log('Store channel:', storeChan);

  // Navigate to live TV
  const navResult = await e('window.location.hash = "#/live"');
  console.log('Navigate result:', navResult);

  // Wait a moment for React to render
  await new Promise(r => setTimeout(r, 2000));

  const videoCount2 = await e('document.querySelectorAll("video").length');
  console.log('Video count after nav:', videoCount2);

  const bodyText = await e('document.body.innerText.substring(0, 400)');
  console.log('Body text:', bodyText);

  await client.close();
})();
