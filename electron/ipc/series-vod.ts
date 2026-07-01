// electron/ipc/series-vod.ts
import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDb, vodQueries, seriesQueries, playlistQueries } from '../services/database';
import * as xtream from '../services/xtream';

export function registerSeriesVodHandlers() {
  // === VOD ===

  ipcMain.handle(
    'vod:sync',
    async (_event, payload: { playlistId: string; cfg: xtream.XtreamConfig }) => {
      const { playlistId, cfg } = payload;

      try {
        const [categories, streams] = await Promise.all([
          xtream.getVodCategories(cfg),
          xtream.getVodStreams(cfg),
        ]);

        const catMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

        // Store categories
        const db = getDb();
        const catStmt = db.prepare(
          `INSERT OR REPLACE INTO playlist_categories (id, playlist_id, category_type, category_id, category_name, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
        );
        const insertCats = db.transaction(() => {
          db.prepare(
            "DELETE FROM playlist_categories WHERE playlist_id = ? AND category_type = 'vod'",
          ).run(playlistId);
          for (let i = 0; i < categories.length; i++) {
            catStmt.run(
              uuidv4(),
              playlistId,
              'vod',
              categories[i].category_id,
              categories[i].category_name,
              i,
            );
          }
        });
        insertCats();

        // Clear existing VOD items and insert new ones
        vodQueries.deleteByPlaylist(playlistId);

        const prepared = streams.map((item: any) => {
          const ext = item.container_extension || 'mp4';
          return {
            id: uuidv4(),
            playlist_id: playlistId,
            stream_id: String(item.stream_id),
            name: item.name,
            icon: item.stream_icon || null,
            category_id: item.category_id || null,
            category_name: catMap.get(item.category_id) || 'Uncategorized',
            container_extension: ext,
            url: xtream.buildVodStreamUrl(cfg, item.stream_id, ext),
            rating: item.rating || null,
            rating_5based: item.rating_5based || null,
            plot: item.plot || null,
            genre: item.genre || null,
            release_date: item.releaseDate || item.release_date || null,
            duration: item.duration || null,
            duration_secs: item.duration_secs || null,
            director: item.director || null,
            cast_members: item.cast || null,
            tmdb_id: item.tmdb_id || null,
            year: item.year || null,
          };
        });

        // Batch insert in chunks
        const BATCH_SIZE = 2000;
        for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
          vodQueries.bulkInsert(prepared.slice(i, i + BATCH_SIZE));
        }

        playlistQueries.updateCounts(playlistId);
        return { success: true, count: streams.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle('vod:getAll', (_event, playlistId: string) => {
    return vodQueries.getByPlaylist(playlistId);
  });

  ipcMain.handle('vod:getCategories', (_event, playlistId: string) => {
    return vodQueries.getCategories(playlistId);
  });

  ipcMain.handle(
    'vod:search',
    (_event, payload: { playlistId: string; query: string; category?: string }) => {
      return vodQueries.search(payload.playlistId, payload.query, payload.category);
    },
  );

  ipcMain.handle('vod:toggleFavorite', (_event, id: string) => {
    const result = vodQueries.toggleFavorite(id);
    return { success: true, isFavorite: result === 1 };
  });

  ipcMain.handle('vod:getFavorites', (_event, playlistId?: string) => {
    return vodQueries.getFavorites(playlistId);
  });

  // === SERIES ===

  ipcMain.handle(
    'series:sync',
    async (_event, payload: { playlistId: string; cfg: xtream.XtreamConfig }) => {
      const { playlistId, cfg } = payload;

      try {
        const [categories, list] = await Promise.all([
          xtream.getSeriesCategories(cfg),
          xtream.getSeriesList(cfg),
        ]);

        const catMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

        // Store categories
        const db = getDb();
        const catStmt = db.prepare(
          `INSERT OR REPLACE INTO playlist_categories (id, playlist_id, category_type, category_id, category_name, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
        );
        const insertCats = db.transaction(() => {
          db.prepare(
            "DELETE FROM playlist_categories WHERE playlist_id = ? AND category_type = 'series'",
          ).run(playlistId);
          for (let i = 0; i < categories.length; i++) {
            catStmt.run(
              uuidv4(),
              playlistId,
              'series',
              categories[i].category_id,
              categories[i].category_name,
              i,
            );
          }
        });
        insertCats();

        // Clear and re-import
        seriesQueries.deleteByPlaylist(playlistId);

        const stmt = db.prepare(`
          INSERT INTO series (id, playlist_id, series_id, name, cover, category_id, category_name,
            plot, genre, release_date, rating, rating_5based, cast_members, director, tmdb_id, year)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((items: any[]) => {
          for (const item of items) {
            stmt.run(
              uuidv4(),
              playlistId,
              String(item.series_id),
              item.name,
              item.cover || null,
              item.category_id || null,
              catMap.get(item.category_id) || 'Uncategorized',
              item.plot || null,
              item.genre || null,
              item.releaseDate || item.release_date || null,
              item.rating || null,
              item.rating_5based || null,
              item.cast || null,
              item.director || null,
              item.tmdb_id || null,
              item.year || null,
            );
          }
        });
        insertMany(list);

        playlistQueries.updateCounts(playlistId);
        return { success: true, count: list.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle('series:getAll', (_event, playlistId: string) => {
    return seriesQueries.getByPlaylist(playlistId);
  });

  ipcMain.handle('series:getCategories', (_event, playlistId: string) => {
    return seriesQueries.getCategories(playlistId);
  });

  ipcMain.handle(
    'series:search',
    (_event, payload: { playlistId: string; query: string; category?: string }) => {
      return seriesQueries.search(payload.playlistId, payload.query, payload.category);
    },
  );

  ipcMain.handle(
    'series:getEpisodes',
    async (
      _event,
      payload: { seriesDbId: string; seriesId: string; cfg: xtream.XtreamConfig },
    ) => {
      const { seriesDbId, seriesId, cfg } = payload;

      try {
        const info = await xtream.getSeriesInfo(cfg, seriesId);
        const db = getDb();

        const stmt = db.prepare(`
          INSERT OR REPLACE INTO series_episodes (id, series_id, season, episode_num, title, url, container_extension, duration, duration_secs, plot, info_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction(() => {
          db.prepare('DELETE FROM series_episodes WHERE series_id = ?').run(seriesDbId);

          let totalEpisodes = 0;
          let totalSeasons = 0;

          for (const seasonKey of Object.keys(info.episodes || {})) {
            totalSeasons++;
            for (const ep of info.episodes[seasonKey]) {
              totalEpisodes++;
              const ext = ep.container_extension || 'mp4';
              const url = xtream.buildSeriesEpisodeUrl(cfg, ep.id, ext);
              stmt.run(
                uuidv4(),
                seriesDbId,
                Number(seasonKey),
                Number(ep.episode_num),
                ep.title || `Episode ${ep.episode_num}`,
                url,
                ext,
                ep.info?.duration || null,
                ep.info?.duration_secs || null,
                ep.info?.plot || null,
                JSON.stringify(ep.info || {}),
              );
            }
          }

          // Update series counts
          db.prepare('UPDATE series SET season_count = ?, episode_count = ? WHERE id = ?').run(
            totalSeasons,
            totalEpisodes,
            seriesDbId,
          );
        });

        insertMany();

        return {
          success: true,
          episodes: seriesQueries.getEpisodes(seriesDbId),
          info: info.info || null,
        };
      } catch (error: any) {
        // Return cached episodes if available
        const cached = seriesQueries.getEpisodes(seriesDbId);
        if (cached.length > 0) {
          return { success: true, episodes: cached, cached: true };
        }
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle('series:toggleFavorite', (_event, id: string) => {
    const result = seriesQueries.toggleFavorite(id);
    return { success: true, isFavorite: result === 1 };
  });
}
