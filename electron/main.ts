// electron/main.ts
import { app, BrowserWindow, Menu, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { registerPlaylistHandlers } from './ipc/playlist';
import { registerPlayerHandlers } from './ipc/player';
import { registerSettingsHandlers } from './ipc/settings';
import { registerEpgHandlers } from './ipc/epg';
import { registerSeriesVodHandlers } from './ipc/series-vod';
import { registerHistoryHandlers } from './ipc/history';
import { registerFavoritesHandlers } from './ipc/favorites';
import { registerCategoryHandlers } from './ipc/categories';
import { registerImageCacheHandlers } from './services/imageCache';
import { initDatabase, closeDatabase, getDb } from './services/database';
import { startStreamProxy, getProxyPort, stopStreamProxy } from './services/stream-proxy';

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#08090C',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform === 'darwin' ? true : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      offscreen: false,
      autoplayPolicy: 'no-user-gesture-required',
      allowRunningInsecureContent: false,
    },
    show: false,
  });

  // Show window when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register global shortcuts
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('media:playPause');
  });
  globalShortcut.register('MediaStop', () => {
    mainWindow?.webContents.send('media:stop');
  });

  // F12 to toggle dev tools
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12') mainWindow?.webContents.toggleDevTools();
  });
}

app.commandLine.appendSwitch('remote-debugging-port', '9222');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

app.whenReady().then(async () => {
  console.log('[MAIN-1] App ready, initializing...');
  // Hardware acceleration flags
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');

  initDatabase();
  console.log('[MAIN-2] Database initialized');
  Menu.setApplicationMenu(null);

  try {
    const port = await startStreamProxy();
    console.log('[MAIN-3] Stream proxy started on port:', port);
  } catch (err) {
    console.error('Failed to start stream proxy:', err);
  }

  createWindow();
  console.log('[MAIN-4] Window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  closeDatabase();
  stopStreamProxy();
});

// Health check for renderer watchdog
ipcMain.handle('app:healthCheck', () => {
  return { ok: true, timestamp: Date.now() };
});

// Expose stream proxy port
ipcMain.handle('stream:getProxyPort', () => {
  const port = getProxyPort();
  console.log('[IPC] stream:getProxyPort returning:', port);
  return port;
});

// Debug: sample channel URLs
ipcMain.handle('debug:sampleUrls', () => {
  try {
    return getDb().prepare('SELECT tvg_name, url, url_fallback, group_title FROM channels LIMIT 5').all();
  } catch { return []; }
});

// Register all IPC handlers
registerPlaylistHandlers();
registerPlayerHandlers();
registerSettingsHandlers();
registerEpgHandlers();
registerSeriesVodHandlers();
registerHistoryHandlers();
registerFavoritesHandlers();
registerCategoryHandlers();
registerImageCacheHandlers();
