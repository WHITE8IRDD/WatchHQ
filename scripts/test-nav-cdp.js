const CDP = require('chrome-remote-interface');
(async()=>{
  const c=await CDP({port:9222});
  const {Runtime}=c;
  const ev=async(ex)=>(await Runtime.evaluate({expression:ex,returnByValue:true,awaitPromise:true})).result.value;
  console.log('Before nav:', (await ev('window.electronAPI.debugSampleUrls()')).length, 'samples');
  await ev("window.location.hash='#/live'");
  await new Promise(r=>setTimeout(r,3000));
  try {
    const s=await ev('window.electronAPI.debugSampleUrls()');
    console.log('After nav:', s.length, 'samples');
  } catch(e) { console.log('After nav error:', e.message); }
  await c.close();
})();
