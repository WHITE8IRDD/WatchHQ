// electron/ipc/playlist.ts
import { ipcMain } from 'electron';
import {
  getDb,
  playlistQueries,
  channelQueries,
  vodQueries,
  seriesQueries,
} from '../services/database';
import { parseM3U, extractExtension } from '../services/m3u-parser';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as xtream from '../services/xtream';
import * as stalker from '../services/stalker';

export function registerPlaylistHandlers() {
  ipcMain.handle('playlist:add', async (_event, data) => {
    const db = getDb();
    const id = uuidv4();

    try {
      playlistQueries.insert({
        id,
        name: data.name,
        type: data.type,
        url: data.url || null,
        username: data.username || null,
        password: data.password || null,
        mac_address: data.mac_address || null,
        sort_order: data.sort_order ?? 0,
      });

      let result = { channels: 0, movies: 0, series: 0 };

      if (data.type === 'm3u') {
        result = await importM3U(id, data);
      } else if (data.type === 'xtream') {
        const c = await importXtream(id, data);
        result = { channels: c, movies: 0, series: 0 };
      } else if (data.type === 'stalker') {
        const c = await importStalker(id, data);
        result = { channels: c, movies: 0, series: 0 };
      }

      db.prepare('UPDATE playlists SET last_synced = strftime(\'%s\',\'now\') WHERE id = ?').run(id);
      playlistQueries.updateCounts(id);

      return {
        success: true,
        id,
        count: result.channels + result.movies + result.series,
        breakdown: result,
      };
    } catch (error: any) {
      playlistQueries.delete(id);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playlist:getAll', () => playlistQueries.getAll());
  ipcMain.handle('playlist:getById', (_event, id: string) => playlistQueries.getById(id));
  ipcMain.handle('playlist:getChannels', (_event, playlistId: string) => channelQueries.getByPlaylist(playlistId));
  ipcMain.handle('playlist:getGroups', (_event, playlistId: string) => channelQueries.getGroups(playlistId));
  ipcMain.handle('playlist:searchChannels', (_event, payload: { playlistId: string; query: string; group?: string; favoritesOnly?: boolean }) =>
    channelQueries.search(payload.playlistId, payload.query, payload.group, payload.favoritesOnly),
  );

  ipcMain.handle('playlist:delete', (_event, id: string) => {
    const db = getDb();
    try {
      const cleanup = db.transaction(() => {
        // Collect all item IDs before deleting
        const channelIds = db.prepare('SELECT id FROM channels WHERE playlist_id = ?').all(id).map((r: any) => r.id);
        const vodIds = db.prepare('SELECT id FROM vod_items WHERE playlist_id = ?').all(id).map((r: any) => r.id);
        const seriesIds = db.prepare('SELECT id FROM series WHERE playlist_id = ?').all(id).map((r: any) => r.id);

        const allIds = [...channelIds, ...vodIds, ...seriesIds];
        if (allIds.length > 0) {
          const ph = allIds.map(() => '?').join(',');
          db.prepare(`DELETE FROM watch_history WHERE item_id IN (${ph})`).run(...allIds);
          db.prepare(`DELETE FROM favorites WHERE item_id IN (${ph})`).run(...allIds);
        }

        db.prepare('DELETE FROM watch_history WHERE playlist_id = ?').run(id);
        db.prepare('DELETE FROM favorites WHERE playlist_id = ?').run(id);

        if (seriesIds.length > 0) {
          const ph = seriesIds.map(() => '?').join(',');
          db.prepare(`DELETE FROM series_episodes WHERE series_id IN (${ph})`).run(...seriesIds);
        }
        db.prepare('DELETE FROM series WHERE playlist_id = ?').run(id);
        db.prepare('DELETE FROM vod_items WHERE playlist_id = ?').run(id);
        db.prepare('DELETE FROM channels WHERE playlist_id = ?').run(id);
        db.prepare('DELETE FROM playlist_categories WHERE playlist_id = ?').run(id);
        db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
      });
      cleanup();
      console.log('[Playlist] Deleted', id, 'and all associated data');
      return { success: true };
    } catch (error: any) {
      console.error('[Playlist] Delete failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playlist:refresh', async (_event, id: string) => {
    const playlist = playlistQueries.getById(id) as any;
    if (!playlist) return { success: false, error: 'Playlist not found' };

    try {
      channelQueries.deleteByPlaylist(id);
      let result = { channels: 0, movies: 0, series: 0 };

      if (playlist.type === 'm3u') {
        result = await importM3U(id, playlist);
      } else if (playlist.type === 'xtream') {
        const c = await importXtream(id, { url: playlist.url, username: playlist.username, password: playlist.password });
        result = { channels: c, movies: 0, series: 0 };
      } else if (playlist.type === 'stalker') {
        const c = await importStalker(id, { url: playlist.url, mac_address: playlist.mac_address });
        result = { channels: c, movies: 0, series: 0 };
      }

      const db = getDb();
      db.prepare('UPDATE playlists SET last_synced = strftime(\'%s\',\'now\') WHERE id = ?').run(id);
      playlistQueries.updateCounts(id);
      return { success: true, count: result.channels + result.movies + result.series, breakdown: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playlist:update', (_event, payload: { id: string; data: any }) => {
    try {
      playlistQueries.update(payload.id, payload.data);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('playlist:toggleFavorite', (_event, channelId: string) => {
    const result = channelQueries.toggleFavorite(channelId);
    return { success: true, isFavorite: result === 1 };
  });

  ipcMain.handle('playlist:getFavorites', (_event, playlistId?: string) => channelQueries.getFavorites(playlistId));
}

// === Import Helpers ===

async function importM3U(playlistId: string, data: any): Promise<{ channels: number; movies: number; series: number }> {
  let content = data.rawContent;
  if (!content && data.url) {
    const res = await axios.get(data.url, {
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
    });
    content = res.data;
  }
  if (!content) throw new Error('No M3U content provided');

  const parsed = parseM3U(content);

  const liveItems = parsed.filter((p) => p.content_type === 'live');
  const movieItems = parsed.filter((p) => p.content_type === 'movie');
  const seriesItems = parsed.filter((p) => p.content_type === 'series');

  // Insert live channels
  if (liveItems.length > 0) {
    const channels = liveItems.map((ch) => ({
      id: uuidv4(),
      playlist_id: playlistId,
      stream_id: null,
      tvg_id: ch.tvg_id || null,
      tvg_name: ch.tvg_name || ch.name,
      tvg_logo: ch.tvg_logo || null,
      tvg_chno: ch.tvg_chno || null,
      group_title: ch.group_title || 'Uncategorized',
      url: ch.url,
    }));
    channelQueries.bulkInsert(channels);
  }

  // Insert movies into vod_items
  if (movieItems.length > 0) {
    const movies = movieItems.map((m) => ({
      id: uuidv4(),
      playlist_id: playlistId,
      stream_id: null,
      name: m.name,
      icon: m.tvg_logo || null,
      category_id: null,
      category_name: m.group_title || 'Uncategorized',
      container_extension: extractExtension(m.url) || 'mp4',
      url: m.url,
      rating: null,
      rating_5based: null,
      plot: null,
      genre: null,
      release_date: null,
      duration: null,
      duration_secs: null,
      director: null,
      cast_members: null,
      tmdb_id: null,
      year: m.year || null,
    }));
    vodQueries.bulkInsert(movies);
  }

  // Group series episodes by series_name
  if (seriesItems.length > 0) {
    const seriesMap = new Map<string, typeof seriesItems>();
    for (const ep of seriesItems) {
      const key = ep.series_name || ep.name;
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      seriesMap.get(key)!.push(ep);
    }

    const db = getDb();
    const seriesStmt = db.prepare(`
      INSERT INTO series (id, playlist_id, series_id, name, cover, category_name, year)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const epStmt = db.prepare(`
      INSERT INTO series_episodes (id, series_id, season, episode_num, title, url, container_extension)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const [seriesName, episodes] of seriesMap.entries()) {
        const seriesDbId = uuidv4();
        const first = episodes[0];
        seriesStmt.run(seriesDbId, playlistId, uuidv4(), seriesName, first.tvg_logo || null, first.group_title || 'Uncategorized', first.year || null);
        for (const ep of episodes) {
          epStmt.run(uuidv4(), seriesDbId, ep.season || 1, ep.episode || 1, ep.name, ep.url, extractExtension(ep.url) || 'mp4');
        }
      }
    })();
  }

  return { channels: liveItems.length, movies: movieItems.length, series: seriesItems.length };
}

async function importXtream(playlistId: string, data: any): Promise<number> {
  const cfg: xtream.XtreamConfig = { host: data.url, username: data.username, password: data.password };
  await xtream.authenticate(cfg);

  const [liveStreams, categories] = await Promise.all([
    xtream.getLiveStreams(cfg),
    xtream.getLiveCategories(cfg),
  ]);

  const catMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

  const db = getDb();
  const catStmt = db.prepare(
    `INSERT OR REPLACE INTO playlist_categories (id, playlist_id, category_type, category_id, category_name, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  db.transaction(() => {
    for (let i = 0; i < categories.length; i++) {
      catStmt.run(uuidv4(), playlistId, 'live', categories[i].category_id, categories[i].category_name, i);
    }
  })();

  const prepared = liveStreams.map((ch: any) => ({
    id: uuidv4(), playlist_id: playlistId, stream_id: String(ch.stream_id),
    tvg_id: String(ch.epg_channel_id || ''), tvg_name: ch.name,
    tvg_logo: ch.stream_icon?.startsWith('http') ? ch.stream_icon : null,
    tvg_chno: String(ch.num || ''),
    group_title: catMap.get(ch.category_id) || 'Uncategorized',
    url: xtream.buildLiveStreamUrl(cfg, ch.stream_id, 'ts'),
    url_fallback: xtream.buildLiveStreamUrl(cfg, ch.stream_id, 'm3u8'),
  }));

  console.log('[ImportXtream] First 3 prepared channels:', JSON.stringify(prepared.slice(0, 3).map((p: any) => ({ name: p.tvg_name, logo: p.tvg_logo }))));
  channelQueries.bulkInsert(prepared);
  return liveStreams.length;
}

async function importStalker(playlistId: string, data: any): Promise<number> {
  const cfg: stalker.StalkerConfig = { portalUrl: data.url, macAddress: data.mac_address };
  const token = await stalker.handshake(cfg);
  const channels = await stalker.getAllChannels(cfg, token);

  const prepared = (channels || []).map((ch: any) => ({
    id: uuidv4(), playlist_id: playlistId, stream_id: String(ch.id || ''),
    tvg_id: String(ch.xmltv_id || ''), tvg_name: ch.name,
    tvg_logo: ch.logo || null, tvg_chno: String(ch.number || ''),
    group_title: ch.tv_genre_id || 'Uncategorized',
    url: ch.cmd,
  }));

  channelQueries.bulkInsert(prepared);
  return channels.length;
}
