// electron/ipc/settings.ts
import { ipcMain, dialog, shell } from 'electron';
import { getDb, preferencesQueries } from '../services/database';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export function registerSettingsHandlers() {
  // Key-value settings
  ipcMain.handle('settings:get', () => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const out: Record<string, any> = {};
    for (const r of rows) {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        out[r.key] = r.value;
      }
    }
    return out;
  });

  ipcMain.handle('settings:set', (_event, { key, value }: { key: string; value: any }) => {
    const db = getDb();
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%s','now')`,
    ).run(key, JSON.stringify(value));
    return { success: true };
  });

  // User preferences
  ipcMain.handle('settings:getPreferences', () => {
    return preferencesQueries.get();
  });

  ipcMain.handle('settings:updatePreferences', (_event, data: Record<string, any>) => {
    try {
      preferencesQueries.update(data);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // File dialog
  ipcMain.handle('system:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Playlist Files', extensions: ['m3u', 'm3u8', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { path: result.filePaths[0], content };
  });

  // Open data folder
  ipcMain.handle('system:openDataFolder', () => {
    shell.openPath(app.getPath('userData'));
  });

  // Get app info
  ipcMain.handle('system:getAppInfo', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      dataPath: app.getPath('userData'),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
    };
  });

  // Export database backup
  ipcMain.handle('system:exportBackup', async () => {
    const dbPath = path.join(app.getPath('userData'), 'watchhq.db');
    const result = await dialog.showSaveDialog({
      defaultPath: `watchhq-backup-${Date.now()}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return { success: false };
    fs.copyFileSync(dbPath, result.filePath);
    return { success: true, path: result.filePath };
  });

  // Import database backup
  ipcMain.handle('system:importBackup', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false };
    const dbPath = path.join(app.getPath('userData'), 'watchhq.db');
    // Create backup of current
    const backupPath = dbPath + '.bak.' + Date.now();
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }
    fs.copyFileSync(result.filePaths[0], dbPath);
    return { success: true, requiresRestart: true };
  });

  // Clear all data
  ipcMain.handle('system:clearAllData', () => {
    const db = getDb();
    try {
      db.exec(`
        DELETE FROM series_episodes;
        DELETE FROM series;
        DELETE FROM vod_items;
        DELETE FROM channels;
        DELETE FROM playlists;
        DELETE FROM epg_programs;
        DELETE FROM epg_sources;
        DELETE FROM favorites;
        DELETE FROM watch_history;
        DELETE FROM playlist_categories;
        DELETE FROM catchup_sources;
        DELETE FROM settings WHERE key NOT IN ('theme', 'language');
        VACUUM;
      `);
      console.log('[Settings] All data cleared');
      return { success: true };
    } catch (error: any) {
      console.error('[Settings] Clear all data failed:', error);
      return { success: false, error: error.message };
    }
  });
}
