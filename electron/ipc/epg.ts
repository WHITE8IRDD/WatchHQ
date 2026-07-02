// electron/ipc/epg.ts
import { ipcMain } from 'electron';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getDb, epgQueries } from '../services/database';
import { parseXMLTV } from '../services/epg-parser';
import zlib from 'zlib';

export function registerEpgHandlers() {
  // Import EPG from URL
  ipcMain.handle('epg:import', async (_event, url: string) => {
    const db = getDb();

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000, // 2 min timeout for large EPGs
        maxContentLength: 500 * 1024 * 1024, // 500MB
      });

      let xmlContent: string;
      const contentType = response.headers['content-type'] || '';
      const buffer = Buffer.from(response.data);

      // Detect and decompress gzipped content
      if (
        url.endsWith('.gz') ||
        String(contentType).includes('gzip') ||
        (buffer[0] === 0x1f && buffer[1] === 0x8b)
      ) {
        xmlContent = zlib.gunzipSync(buffer).toString('utf-8');
      } else {
        xmlContent = buffer.toString('utf-8');
      }

      const programs = parseXMLTV(xmlContent);

      if (programs.length === 0) {
        return { success: false, error: 'No programs found in EPG data' };
      }

      // Clear old programs first, then insert new ones
      const prepared = programs.map((p) => ({
        ...p,
        id: uuidv4(),
      }));

      // Process in batches of 5000 for large EPGs
      const BATCH_SIZE = 5000;
      epgQueries.clearAll();

      for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
        const batch = prepared.slice(i, i + BATCH_SIZE);
        epgQueries.bulkInsert(batch);
      }

      // Update/create EPG source record
      db.prepare(
        `INSERT INTO epg_sources (id, url, last_synced, program_count)
         VALUES (?, ?, strftime('%s','now'), ?)
         ON CONFLICT(url) DO UPDATE SET
           last_synced = strftime('%s','now'),
           program_count = excluded.program_count`,
      ).run(uuidv4(), url, programs.length);

      return { success: true, count: programs.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get EPG for a specific channel
  ipcMain.handle('epg:getForChannel', (_event, tvgId: string) => {
    return epgQueries.getSchedule(tvgId, undefined, 50);
  });

  // Get now/next programs
  ipcMain.handle('epg:getNowNext', (_event, tvgId: string) => {
    return epgQueries.getNowNext(tvgId);
  });

  // Get schedule for a time range
  ipcMain.handle(
    'epg:getSchedule',
    (_event, payload: { tvgId: string; startTime: number; endTime: number }) => {
      return epgQueries.getByTimeRange(payload.tvgId, payload.startTime, payload.endTime);
    },
  );

  // Batch get now/next for multiple channels (for grid view)
  ipcMain.handle('epg:getBatchNowNext', (_event, tvgIds: string[]) => {
    return epgQueries.getBatchNowNext(tvgIds.filter(Boolean));
  });

  // Get EPG sources
  ipcMain.handle('epg:getSources', () => {
    const db = getDb();
    return db.prepare('SELECT * FROM epg_sources ORDER BY created_at DESC').all();
  });

  // Remove EPG source
  ipcMain.handle('epg:removeSource', (_event, id: string) => {
    const db = getDb();
    db.prepare('DELETE FROM epg_sources WHERE id = ?').run(id);
    return { success: true };
  });

  // Clear all EPG data
  ipcMain.handle('epg:clearAll', () => {
    epgQueries.clearAll();
    return { success: true };
  });

  // Cleanup old EPG entries
  ipcMain.handle('epg:cleanup', () => {
    const result = epgQueries.clearOld();
    return { success: true, removed: result.changes };
  });

  // Get EPG stats
  ipcMain.handle('epg:getStats', () => {
    const count = epgQueries.getCount();
    const db = getDb();
    const sources = db.prepare('SELECT COUNT(*) as c FROM epg_sources').get() as any;
    const uniqueChannels = db
      .prepare('SELECT COUNT(DISTINCT tvg_id) as c FROM epg_programs')
      .get() as any;
    return {
      totalPrograms: count,
      totalSources: sources.c,
      uniqueChannels: uniqueChannels.c,
    };
  });
}
