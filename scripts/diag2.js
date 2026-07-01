const CDP = require('chrome-remote-interface');

(async () => {
  // List targets first
  const list = await CDP.List({ port: 9222 });
  console.log('Targets:', JSON.stringify(list.map(t => ({ title: t.title, url: t.url, type: t.type, webSocketDebuggerUrl: '(hidden)' })), null, 2));

  const c = await CDP({ port: 9222 });
  const { Runtime, Page } = c;
  await Page.enable();
  await Runtime.enable();

  // Check if electronAPI exists
  const check = await Runtime.evaluate({
    expression: 'typeof window !== "undefined" ? (typeof window.electronAPI !== "undefined" ? "exists" : "no electronAPI") : "no window"',
    returnByValue: true,
    awaitPromise: false,
  });
  console.log('electronAPI check:', check.result.value);

  // List window keys
  const keys = await Runtime.evaluate({
    expression: 'Object.keys(window).filter(k => k.startsWith("electron") || k.startsWith("__") || k === "electronAPI").join(",")',
    returnByValue: true,
    awaitPromise: false,
  });
  console.log('Window keys:', keys.result.value);

  // Try accessing location
  const loc = await Runtime.evaluate({
    expression: 'window.location.href',
    returnByValue: true,
    awaitPromise: false,
  });
  console.log('Location:', loc.result.value);

  await c.close();
})();
