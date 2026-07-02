// src/main.tsx
import './probe';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Watchdog: detects IPC hang > 10s and force-reloads renderer
(function installWatchdog() {
  let lastHeartbeat = Date.now();
  const HEARTBEAT_INTERVAL = 5000;
  const TIMEOUT_MS = 15000;

  const check = setInterval(() => {
    const elapsed = Date.now() - lastHeartbeat;
    if (elapsed > TIMEOUT_MS) {
      console.warn('[WATCHDOG] No heartbeat for ' + elapsed + 'ms, reloading...');
      window.location.reload();
    }
  }, 5000);

  window.addEventListener('load', () => {
    const hb = () => { lastHeartbeat = Date.now(); };
    setInterval(hb, HEARTBEAT_INTERVAL);
    // Also heartbeat on any user interaction
    document.addEventListener('click', hb);
    document.addEventListener('keydown', hb);
  });
})();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
