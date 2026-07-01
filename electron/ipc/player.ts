import { ipcMain } from 'electron';
import { spawn, execSync } from 'child_process';
import { getDb } from '../services/database';
import * as stalker from '../services/stalker';
import { URL } from 'url';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';

function getMpvPath(): string | null {
  try {
    const db = getDb();
    const prefs = db.prepare('SELECT mpv_path FROM user_preferences WHERE id = 1').get() as any;
    if (prefs?.mpv_path) return prefs.mpv_path;
  } catch {}

  // bundled copy
  const bundled = path.join(process.resourcesPath || '', 'mpv', 'mpv.exe');
  if (existsSync(bundled)) return bundled;

  // system PATH
  try {
    const whichResult = execSync('where mpv', { encoding: 'utf8', timeout: 3000 }).trim();
    if (whichResult && existsSync(whichResult)) return whichResult;
  } catch {}

  // common install paths
  const candidates = [
    'C:\\Program Files\\mpv\\mpv.exe',
    'C:\\Program Files (x86)\\mpv\\mpv.exe',
    path.join(os.homedir(), 'scoop', 'apps', 'mpv', 'current', 'mpv.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'mpv', 'mpv.exe'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  return null;
}

export function registerPlayerHandlers() {
  ipcMain.handle('player:mpv', async (_event, url: string, options?: { fullscreen?: boolean }) => {
    const mpvPath = getMpvPath();
    if (!mpvPath) {
      return { success: false, error: 'MPV not found. Download from https://mpv.io/installation/' };
    }
    return new Promise((resolve) => {
      let origin = '';
      try { origin = new URL(url).origin + '/'; } catch {}

      const args = [
        '--force-window=yes',
        '--ontop',
        '--user-agent=VLC/3.0.20 LibVLC/3.0.20',
        '--cache=yes',
        '--demuxer-max-bytes=100MiB',
        '--profile=low-latency',
        '--keep-open=always',
      ];
      if (origin) args.push(`--referrer=${origin}`);
      if (options?.fullscreen) args.push('--fs');
      args.push(url);

      const proc = spawn(mpvPath, args, { detached: true, stdio: 'ignore' });
      proc.on('error', (err) => {
        resolve({ success: false, error: `MPV launch failed: ${err.message}. Install MPV or set path in Settings.` });
      });
      proc.unref();
      resolve({ success: true });
    });
  });

  ipcMain.handle('player:vlc', async (_event, url: string) => {
    return new Promise((resolve) => {
      const db = getDb();
      let prefs: any = null;
      try { prefs = db.prepare('SELECT vlc_path FROM user_preferences WHERE id = 1').get() as any; } catch {}
      let vlcPath = prefs?.vlc_path || '';
      if (!vlcPath) {
        const candidates: string[] = [];
        if (process.platform === 'win32') {
          candidates.push('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
            'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe');
        } else if (process.platform === 'darwin') {
          candidates.push('/Applications/VLC.app/Contents/MacOS/VLC');
        }
        candidates.push('vlc');

        const tryLaunch = (idx: number) => {
          if (idx >= candidates.length) {
            resolve({ success: false, error: 'VLC not found. Install VLC or set path in Settings.' });
            return;
          }
          const proc = spawn(candidates[idx], [url], { detached: true, stdio: 'ignore' });
          proc.on('error', () => tryLaunch(idx + 1));
          proc.unref();
          resolve({ success: true });
        };
        tryLaunch(0);
      } else {
        const proc = spawn(vlcPath, [url], { detached: true, stdio: 'ignore' });
        proc.on('error', (err) => resolve({ success: false, error: err.message }));
        proc.unref();
        resolve({ success: true });
      }
    });
  });

  ipcMain.handle('player:resolveStalkerUrl', async (_event, payload: { playlistId: string; cmd: string }) => {
    try {
      const db = getDb();
      const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(payload.playlistId) as any;
      if (!playlist || playlist.type !== 'stalker') return { success: false, error: 'Not a Stalker playlist' };
      const cfg: stalker.StalkerConfig = { portalUrl: playlist.url, macAddress: playlist.mac_address };
      const token = await stalker.handshake(cfg);
      const resolvedUrl = await stalker.createLink(cfg, token, payload.cmd);
      if (!resolvedUrl) return { success: false, error: 'Failed to resolve Stalker stream URL' };
      return { success: true, url: resolvedUrl };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('player:checkAvailability', async (_event, player: 'mpv' | 'vlc') => {
    if (player === 'mpv') {
      const mpvPath = getMpvPath();
      if (!mpvPath) return { available: false };
    }
    return new Promise((resolve) => {
      const cmd = player === 'vlc' ? 'vlc' : (getMpvPath() || 'mpv');
      const proc = spawn(cmd, ['--version'], { stdio: 'pipe' });
      let output = '';
      proc.stdout?.on('data', (d) => (output += d.toString()));
      proc.on('error', () => resolve({ available: false }));
      proc.on('close', (code) => {
        resolve({ available: code === 0, version: output.split('\n')[0]?.trim() });
      });
    });
  });

  ipcMain.handle('launchMPV', async (_event, url: string) => {
    const mpvPath = getMpvPath();
    if (!mpvPath) {
      return { success: false, error: 'MPV not found. Download from https://mpv.io/installation/' };
    }
    return new Promise((resolve) => {
      let origin = '';
      try { origin = new URL(url).origin + '/'; } catch {}
      const args = [
        '--force-window=yes',
        '--user-agent=VLC/3.0.20 LibVLC/3.0.20',
        '--cache=yes',
        '--demuxer-max-bytes=100MiB',
        '--profile=low-latency',
        '--keep-open=always',
      ];
      if (origin) args.push(`--referrer=${origin}`);
      args.push(url);
      const proc = spawn(mpvPath, args, { detached: true, stdio: 'ignore' });
      proc.on('error', (err) => resolve({ success: false, error: err.message }));
      proc.unref();
      resolve({ success: true });
    });
  });
}
