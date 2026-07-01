// electron/services/database.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

const CURRENT_SCHEMA_VERSION = 4;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'watchhq.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache

  runMigrations();
  cleanupOrphans();
}

function cleanupOrphans() {
  try {
    db.exec(`
      DELETE FROM watch_history WHERE playlist_id IS NOT NULL AND playlist_id NOT IN (SELECT id FROM playlists);
      DELETE FROM watch_history WHERE item_type = 'channel' AND item_id NOT IN (SELECT id FROM channels);
      DELETE FROM watch_history WHERE item_type = 'vod' AND item_id NOT IN (SELECT id FROM vod_items);
      DELETE FROM watch_history WHERE item_type = 'series_episode' AND item_id NOT IN (SELECT id FROM series_episodes);
      DELETE FROM favorites WHERE playlist_id IS NOT NULL AND playlist_id NOT IN (SELECT id FROM playlists);
      DELETE FROM favorites WHERE item_type = 'channel' AND item_id NOT IN (SELECT id FROM channels);
      DELETE FROM favorites WHERE item_type = 'vod' AND item_id NOT IN (SELECT id FROM vod_items);
      DELETE FROM favorites WHERE item_type = 'series' AND item_id NOT IN (SELECT id FROM series);
      DELETE FROM series_episodes WHERE series_id NOT IN (SELECT id FROM series);
    `);
    console.log('[DB] Orphan cleanup completed');
  } catch (err) {
    console.error('[DB] Orphan cleanup failed:', err);
  }
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0);
  `);

  const row = db.prepare('SELECT version FROM schema_version WHERE id = 1').get() as {
    version: number;
  };
  let currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('m3u', 'xtream', 'stalker')),
        url TEXT,
        username TEXT,
        password TEXT,
        mac_address TEXT,
        last_synced INTEGER,
        channel_count INTEGER DEFAULT 0,
        vod_count INTEGER DEFAULT 0,
        series_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        stream_id TEXT,
        tvg_id TEXT,
        tvg_name TEXT,
        tvg_logo TEXT,
        tvg_chno TEXT,
        group_title TEXT DEFAULT 'Uncategorized',
        url TEXT NOT NULL,
        is_favorite INTEGER DEFAULT 0,
        last_watched INTEGER,
        watch_count INTEGER DEFAULT 0,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_channels_playlist ON channels(playlist_id);
      CREATE INDEX IF NOT EXISTS idx_channels_group ON channels(group_title);
      CREATE INDEX IF NOT EXISTS idx_channels_tvg_id ON channels(tvg_id);
      CREATE INDEX IF NOT EXISTS idx_channels_favorite ON channels(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(tvg_name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS vod_items (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        stream_id TEXT,
        name TEXT NOT NULL,
        icon TEXT,
        category_id TEXT,
        category_name TEXT DEFAULT 'Uncategorized',
        container_extension TEXT DEFAULT 'mp4',
        url TEXT NOT NULL,
        rating TEXT,
        rating_5based REAL,
        plot TEXT,
        genre TEXT,
        release_date TEXT,
        duration TEXT,
        duration_secs INTEGER,
        director TEXT,
        cast_members TEXT,
        tmdb_id TEXT,
        year INTEGER,
        is_favorite INTEGER DEFAULT 0,
        last_watched INTEGER,
        watch_position INTEGER DEFAULT 0,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_vod_playlist ON vod_items(playlist_id);
      CREATE INDEX IF NOT EXISTS idx_vod_category ON vod_items(category_name);
      CREATE INDEX IF NOT EXISTS idx_vod_name ON vod_items(name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_vod_favorite ON vod_items(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_vod_year ON vod_items(year);

      CREATE TABLE IF NOT EXISTS series (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        series_id TEXT,
        name TEXT NOT NULL,
        cover TEXT,
        backdrop TEXT,
        category_id TEXT,
        category_name TEXT DEFAULT 'Uncategorized',
        plot TEXT,
        genre TEXT,
        release_date TEXT,
        rating TEXT,
        rating_5based REAL,
        cast_members TEXT,
        director TEXT,
        tmdb_id TEXT,
        year INTEGER,
        season_count INTEGER DEFAULT 0,
        episode_count INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        last_watched INTEGER,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_series_playlist ON series(playlist_id);
      CREATE INDEX IF NOT EXISTS idx_series_category ON series(category_name);
      CREATE INDEX IF NOT EXISTS idx_series_name ON series(name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_series_favorite ON series(is_favorite);

      CREATE TABLE IF NOT EXISTS series_episodes (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL,
        season INTEGER NOT NULL,
        episode_num INTEGER NOT NULL,
        title TEXT,
        url TEXT NOT NULL,
        container_extension TEXT DEFAULT 'mp4',
        duration TEXT,
        duration_secs INTEGER,
        plot TEXT,
        info_json TEXT,
        watch_position INTEGER DEFAULT 0,
        is_watched INTEGER DEFAULT 0,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_series ON series_episodes(series_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_season ON series_episodes(series_id, season);

      CREATE TABLE IF NOT EXISTS epg_programs (
        id TEXT PRIMARY KEY,
        tvg_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        category TEXT,
        icon TEXT,
        lang TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_epg_tvgid ON epg_programs(tvg_id);
      CREATE INDEX IF NOT EXISTS idx_epg_start ON epg_programs(start_time);
      CREATE INDEX IF NOT EXISTS idx_epg_tvgid_time ON epg_programs(tvg_id, start_time, end_time);

      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL CHECK(item_type IN ('channel', 'vod', 'series')),
        item_id TEXT NOT NULL,
        playlist_id TEXT,
        added_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(item_type, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_type ON favorites(item_type);

      CREATE TABLE IF NOT EXISTS watch_history (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL CHECK(item_type IN ('channel', 'vod', 'series_episode')),
        item_id TEXT NOT NULL,
        playlist_id TEXT,
        title TEXT,
        icon TEXT,
        url TEXT,
        position_seconds INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        progress_percent REAL DEFAULT 0,
        last_watched INTEGER DEFAULT (strftime('%s', 'now')),
        watch_count INTEGER DEFAULT 1,
        UNIQUE(item_type, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_history_type ON watch_history(item_type);
      CREATE INDEX IF NOT EXISTS idx_history_last ON watch_history(last_watched DESC);

      CREATE TABLE IF NOT EXISTS catchup_sources (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        catchup_type TEXT,
        catchup_source TEXT,
        catchup_days INTEGER DEFAULT 7,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS epg_sources (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        name TEXT,
        last_synced INTEGER,
        program_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        auto_update INTEGER DEFAULT 1,
        update_interval_hours INTEGER DEFAULT 24,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_categories (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        category_type TEXT NOT NULL CHECK(category_type IN ('live', 'vod', 'series')),
        category_id TEXT,
        category_name TEXT NOT NULL,
        parent_id TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        UNIQUE(playlist_id, category_type, category_id)
      );
      CREATE INDEX IF NOT EXISTS idx_playlist_cats ON playlist_categories(playlist_id, category_type);

      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY CHECK (id = 'main'),
        theme TEXT DEFAULT 'dark',
        language TEXT DEFAULT 'en',
        player_type TEXT DEFAULT 'internal' CHECK(player_type IN ('internal', 'mpv', 'vlc')),
        mpv_path TEXT,
        vlc_path TEXT,
        default_stream_format TEXT DEFAULT 'm3u8',
        buffer_size INTEGER DEFAULT 30,
        hardware_acceleration INTEGER DEFAULT 1,
        auto_play_next INTEGER DEFAULT 1,
        remember_position INTEGER DEFAULT 1,
        epg_auto_update INTEGER DEFAULT 1,
        epg_update_interval INTEGER DEFAULT 24,
        startup_page TEXT DEFAULT 'dashboard',
        sidebar_expanded INTEGER DEFAULT 0,
        grid_size TEXT DEFAULT 'medium' CHECK(grid_size IN ('small', 'medium', 'large')),
        sort_channels_by TEXT DEFAULT 'name' CHECK(sort_channels_by IN ('name', 'number', 'group', 'recent')),
        show_channel_numbers INTEGER DEFAULT 1,
        show_channel_logos INTEGER DEFAULT 1,
        parental_lock INTEGER DEFAULT 0,
        parental_pin TEXT,
        proxy_enabled INTEGER DEFAULT 0,
        proxy_url TEXT,
        user_agent TEXT,
        referrer TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      INSERT OR IGNORE INTO user_preferences (id) VALUES ('main');
    `);
    currentVersion = 2;
  }

  if (currentVersion < 3) {
    try { db.exec(`ALTER TABLE channels ADD COLUMN url_fallback TEXT;`); } catch {}
    currentVersion = 3;
  }

  if (currentVersion < 4) {
    try { db.exec(`ALTER TABLE playlist_categories ADD COLUMN is_hidden INTEGER DEFAULT 0;`); } catch {}
    currentVersion = 4;
  }

  db.prepare('UPDATE schema_version SET version = ? WHERE id = 1').run(CURRENT_SCHEMA_VERSION);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}

// === CRUD Helper Functions ===

export const playlistQueries = {
  getAll: () => getDb().prepare('SELECT * FROM playlists ORDER BY sort_order, created_at DESC').all(),

  getById: (id: string) => getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(id),

  insert: (playlist: any) => {
    return getDb()
      .prepare(
        `INSERT INTO playlists (id, name, type, url, username, password, mac_address, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        playlist.id,
        playlist.name,
        playlist.type,
        playlist.url,
        playlist.username,
        playlist.password,
        playlist.mac_address,
        playlist.sort_order ?? 0,
      );
  },

  update: (id: string, data: Partial<any>) => {
    const fields = Object.keys(data)
      .map((k) => `${k} = @${k}`)
      .join(', ');
    return getDb()
      .prepare(`UPDATE playlists SET ${fields}, updated_at = strftime('%s','now') WHERE id = @id`)
      .run({ ...data, id });
  },

  delete: (id: string) => getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id),

  updateCounts: (id: string) => {
    const db = getDb();
    const channels = (
      db.prepare('SELECT COUNT(*) as c FROM channels WHERE playlist_id = ?').get(id) as any
    ).c;
    const vod = (
      db.prepare('SELECT COUNT(*) as c FROM vod_items WHERE playlist_id = ?').get(id) as any
    ).c;
    const series = (
      db.prepare('SELECT COUNT(*) as c FROM series WHERE playlist_id = ?').get(id) as any
    ).c;
    db.prepare(
      'UPDATE playlists SET channel_count = ?, vod_count = ?, series_count = ? WHERE id = ?',
    ).run(channels, vod, series, id);
    return { channels, vod, series };
  },
};

export const channelQueries = {
  getByPlaylist: (playlistId: string) =>
    getDb()
      .prepare('SELECT * FROM channels WHERE playlist_id = ? ORDER BY tvg_chno, tvg_name COLLATE NOCASE')
      .all(playlistId),

  getGroups: (playlistId: string) =>
    getDb()
      .prepare(
        `SELECT group_title, COUNT(*) as count FROM channels 
         WHERE playlist_id = ? GROUP BY group_title ORDER BY group_title COLLATE NOCASE`,
      )
      .all(playlistId),

  search: (playlistId: string, query: string, group?: string, favoritesOnly = false) => {
    let sql = 'SELECT * FROM channels WHERE playlist_id = ?';
    const params: any[] = [playlistId];
    // When searching with a query, ignore the group filter — search across all channels
    if (!query && group && group !== 'All') {
      sql += ' AND group_title = ?';
      params.push(group);
    }
    if (query) {
      sql += ' AND tvg_name LIKE ? COLLATE NOCASE';
      params.push(`%${query}%`);
    }
    if (favoritesOnly) {
      sql += ' AND is_favorite = 1';
    }
    sql += ' ORDER BY CASE WHEN tvg_name LIKE ? THEN 0 ELSE 1 END, tvg_name COLLATE NOCASE LIMIT 500';
    params.push(`${query}%`);
    return getDb().prepare(sql).all(...params);
  },

  toggleFavorite: (id: string) => {
    const db = getDb();
    const channel = db.prepare('SELECT is_favorite FROM channels WHERE id = ?').get(id) as any;
    if (!channel) return;
    const newVal = channel.is_favorite ? 0 : 1;
    db.prepare('UPDATE channels SET is_favorite = ? WHERE id = ?').run(newVal, id);
    return newVal;
  },

  getFavorites: (playlistId?: string) => {
    if (playlistId) {
      return getDb()
        .prepare('SELECT * FROM channels WHERE is_favorite = 1 AND playlist_id = ?')
        .all(playlistId);
    }
    return getDb().prepare('SELECT * FROM channels WHERE is_favorite = 1').all();
  },

  deleteByPlaylist: (playlistId: string) =>
    getDb().prepare('DELETE FROM channels WHERE playlist_id = ?').run(playlistId),

  bulkInsert: (channels: any[]) => {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO channels (id, playlist_id, stream_id, tvg_id, tvg_name, tvg_logo, tvg_chno, group_title, url, url_fallback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMany = db.transaction((items: any[]) => {
      for (const ch of items) {
        stmt.run(
          ch.id,
          ch.playlist_id,
          ch.stream_id || null,
          ch.tvg_id || null,
          ch.tvg_name,
          ch.tvg_logo || null,
          ch.tvg_chno || null,
          ch.group_title || 'Uncategorized',
          ch.url,
          ch.url_fallback || null,
        );
      }
    });
    insertMany(channels);
  },
};

export const vodQueries = {
  getByPlaylist: (playlistId: string) =>
    getDb()
      .prepare('SELECT * FROM vod_items WHERE playlist_id = ? ORDER BY name COLLATE NOCASE')
      .all(playlistId),

  getCategories: (playlistId: string) =>
    getDb()
      .prepare(
        `SELECT category_name, COUNT(*) as count FROM vod_items 
         WHERE playlist_id = ? GROUP BY category_name ORDER BY category_name COLLATE NOCASE`,
      )
      .all(playlistId),

  search: (playlistId: string, query: string, category?: string) => {
    let sql = 'SELECT * FROM vod_items WHERE playlist_id = ?';
    const params: any[] = [playlistId];
    if (category && category !== 'All') {
      sql += ' AND category_name = ?';
      params.push(category);
    }
    if (query) {
      sql += ' AND name LIKE ?';
      params.push(`%${query}%`);
    }
    sql += ' ORDER BY name COLLATE NOCASE';
    return getDb().prepare(sql).all(...params);
  },

  toggleFavorite: (id: string) => {
    const db = getDb();
    const item = db.prepare('SELECT is_favorite FROM vod_items WHERE id = ?').get(id) as any;
    if (!item) return;
    const newVal = item.is_favorite ? 0 : 1;
    db.prepare('UPDATE vod_items SET is_favorite = ? WHERE id = ?').run(newVal, id);
    return newVal;
  },

  getFavorites: (playlistId?: string) => {
    if (playlistId) {
      return getDb()
        .prepare('SELECT * FROM vod_items WHERE is_favorite = 1 AND playlist_id = ?')
        .all(playlistId);
    }
    return getDb().prepare('SELECT * FROM vod_items WHERE is_favorite = 1').all();
  },

  deleteByPlaylist: (playlistId: string) =>
    getDb().prepare('DELETE FROM vod_items WHERE playlist_id = ?').run(playlistId),

  bulkInsert: (items: any[]) => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO vod_items 
      (id, playlist_id, stream_id, name, icon, category_id, category_name,
       container_extension, url, rating, rating_5based, plot, genre, release_date, duration, duration_secs,
       director, cast_members, tmdb_id, year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((rows: any[]) => {
      for (const item of rows) {
        stmt.run(
          item.id,
          item.playlist_id,
          item.stream_id || null,
          item.name,
          item.icon || null,
          item.category_id || null,
          item.category_name || 'Uncategorized',
          item.container_extension || 'mp4',
          item.url,
          item.rating || null,
          item.rating_5based || null,
          item.plot || null,
          item.genre || null,
          item.release_date || null,
          item.duration || null,
          item.duration_secs || null,
          item.director || null,
          item.cast_members || null,
          item.tmdb_id || null,
          item.year || null,
        );
      }
    });
    insertMany(items);
  },
};

export const seriesQueries = {
  getByPlaylist: (playlistId: string) =>
    getDb()
      .prepare('SELECT * FROM series WHERE playlist_id = ? ORDER BY name COLLATE NOCASE')
      .all(playlistId),

  getCategories: (playlistId: string) =>
    getDb()
      .prepare(
        `SELECT category_name, COUNT(*) as count FROM series 
         WHERE playlist_id = ? GROUP BY category_name ORDER BY category_name COLLATE NOCASE`,
      )
      .all(playlistId),

  search: (playlistId: string, query: string, category?: string) => {
    let sql = 'SELECT * FROM series WHERE playlist_id = ?';
    const params: any[] = [playlistId];
    if (category && category !== 'All') {
      sql += ' AND category_name = ?';
      params.push(category);
    }
    if (query) {
      sql += ' AND name LIKE ?';
      params.push(`%${query}%`);
    }
    sql += ' ORDER BY name COLLATE NOCASE';
    return getDb().prepare(sql).all(...params);
  },

  getEpisodes: (seriesId: string) =>
    getDb()
      .prepare('SELECT * FROM series_episodes WHERE series_id = ? ORDER BY season, episode_num')
      .all(seriesId),

  toggleFavorite: (id: string) => {
    const db = getDb();
    const item = db.prepare('SELECT is_favorite FROM series WHERE id = ?').get(id) as any;
    if (!item) return;
    const newVal = item.is_favorite ? 0 : 1;
    db.prepare('UPDATE series SET is_favorite = ? WHERE id = ?').run(newVal, id);
    return newVal;
  },

  deleteByPlaylist: (playlistId: string) => {
    const db = getDb();
    const seriesIds = db
      .prepare('SELECT id FROM series WHERE playlist_id = ?')
      .all(playlistId)
      .map((s: any) => s.id);
    if (seriesIds.length > 0) {
      const placeholders = seriesIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM series_episodes WHERE series_id IN (${placeholders})`).run(
        ...seriesIds,
      );
    }
    db.prepare('DELETE FROM series WHERE playlist_id = ?').run(playlistId);
  },
};

export const epgQueries = {
  getNowPlaying: (tvgId: string) => {
    const now = Math.floor(Date.now() / 1000);
    return getDb()
      .prepare(
        'SELECT * FROM epg_programs WHERE tvg_id = ? AND start_time <= ? AND end_time > ? LIMIT 1',
      )
      .get(tvgId, now, now);
  },

  getNowNext: (tvgId: string) => {
    const now = Math.floor(Date.now() / 1000);
    const rows = getDb()
      .prepare(
        'SELECT * FROM epg_programs WHERE tvg_id = ? AND end_time >= ? ORDER BY start_time ASC LIMIT 2',
      )
      .all(tvgId, now) as any[];
    return { now: rows[0] ?? null, next: rows[1] ?? null };
  },

  getBatchNowNext: (tvgIds: string[]) => {
    const now = Math.floor(Date.now() / 1000);
    const results: Record<string, { now: any; next: any }> = {};
    if (tvgIds.length === 0) return results;
    const placeholders = tvgIds.map(() => '?').join(',');
    const rows = getDb()
      .prepare(
        `SELECT * FROM epg_programs WHERE tvg_id IN (${placeholders}) AND end_time >= ? ORDER BY tvg_id, start_time ASC`,
      )
      .all(...tvgIds, now) as any[];
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      if (!grouped[row.tvg_id]) grouped[row.tvg_id] = [];
      if (grouped[row.tvg_id].length < 2) grouped[row.tvg_id].push(row);
    }
    for (const tvgId of tvgIds) {
      const g = grouped[tvgId] || [];
      results[tvgId] = { now: g[0] ?? null, next: g[1] ?? null };
    }
    return results;
  },

  getSchedule: (tvgId: string, startFrom?: number, limit = 50) => {
    const from = startFrom ?? Math.floor(Date.now() / 1000);
    return getDb()
      .prepare(
        'SELECT * FROM epg_programs WHERE tvg_id = ? AND end_time >= ? ORDER BY start_time ASC LIMIT ?',
      )
      .all(tvgId, from, limit);
  },

  getByTimeRange: (tvgId: string, startTime: number, endTime: number) => {
    return getDb()
      .prepare(
        `SELECT * FROM epg_programs WHERE tvg_id = ? 
         AND ((start_time >= ? AND start_time < ?) OR (start_time < ? AND end_time > ?))
         ORDER BY start_time ASC`,
      )
      .all(tvgId, startTime, endTime, startTime, startTime);
  },

  clearAll: () => getDb().prepare('DELETE FROM epg_programs').run(),

  clearOld: () => {
    const yesterday = Math.floor(Date.now() / 1000) - 86400;
    return getDb().prepare('DELETE FROM epg_programs WHERE end_time < ?').run(yesterday);
  },

  getCount: () =>
    (getDb().prepare('SELECT COUNT(*) as c FROM epg_programs').get() as any).c,

  bulkInsert: (programs: any[]) => {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO epg_programs (id, tvg_id, title, description, start_time, end_time, category, icon, lang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMany = db.transaction((rows: any[]) => {
      for (const p of rows) {
        stmt.run(
          p.id,
          p.tvg_id,
          p.title,
          p.description || null,
          p.start_time,
          p.end_time,
          p.category || null,
          p.icon || null,
          p.lang || null,
        );
      }
    });
    insertMany(programs);
  },
};

export const historyQueries = {
  upsert: (entry: {
    id: string;
    item_type: string;
    item_id: string;
    playlist_id?: string;
    title?: string;
    icon?: string;
    url?: string;
    position_seconds: number;
    duration_seconds: number;
  }) => {
    const progress =
      entry.duration_seconds > 0
        ? Math.round((entry.position_seconds / entry.duration_seconds) * 100)
        : 0;
    return getDb()
      .prepare(
        `INSERT INTO watch_history (id, item_type, item_id, playlist_id, title, icon, url, position_seconds, duration_seconds, progress_percent, last_watched, watch_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'), 1)
         ON CONFLICT(item_type, item_id) DO UPDATE SET
           position_seconds = excluded.position_seconds,
           duration_seconds = excluded.duration_seconds,
           progress_percent = excluded.progress_percent,
           last_watched = strftime('%s','now'),
           watch_count = watch_count + 1,
           title = COALESCE(excluded.title, title),
           icon = COALESCE(excluded.icon, icon),
           url = COALESCE(excluded.url, url)`,
      )
      .run(
        entry.id,
        entry.item_type,
        entry.item_id,
        entry.playlist_id || null,
        entry.title || null,
        entry.icon || null,
        entry.url || null,
        entry.position_seconds,
        entry.duration_seconds,
        progress,
      );
  },

  getRecent: (limit = 20) =>
    getDb()
      .prepare('SELECT * FROM watch_history ORDER BY last_watched DESC LIMIT ?')
      .all(limit),

  getByType: (itemType: string, limit = 20) =>
    getDb()
      .prepare('SELECT * FROM watch_history WHERE item_type = ? ORDER BY last_watched DESC LIMIT ?')
      .all(itemType, limit),

  getPosition: (itemType: string, itemId: string) =>
    getDb()
      .prepare('SELECT position_seconds, duration_seconds FROM watch_history WHERE item_type = ? AND item_id = ?')
      .get(itemType, itemId),

  clear: () => getDb().prepare('DELETE FROM watch_history').run(),

  delete: (itemType: string, itemId: string) =>
    getDb()
      .prepare('DELETE FROM watch_history WHERE item_type = ? AND item_id = ?')
      .run(itemType, itemId),
};

export const favoritesQueries = {
  add: (id: string, itemType: string, itemId: string, playlistId?: string) => {
    return getDb()
      .prepare(
        `INSERT OR IGNORE INTO favorites (id, item_type, item_id, playlist_id) VALUES (?, ?, ?, ?)`,
      )
      .run(id, itemType, itemId, playlistId || null);
  },

  remove: (itemType: string, itemId: string) =>
    getDb()
      .prepare('DELETE FROM favorites WHERE item_type = ? AND item_id = ?')
      .run(itemType, itemId),

  toggle: (id: string, itemType: string, itemId: string, playlistId?: string) => {
    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM favorites WHERE item_type = ? AND item_id = ?')
      .get(itemType, itemId);
    if (existing) {
      db.prepare('DELETE FROM favorites WHERE item_type = ? AND item_id = ?').run(
        itemType,
        itemId,
      );
      return false;
    } else {
      db.prepare(
        'INSERT INTO favorites (id, item_type, item_id, playlist_id) VALUES (?, ?, ?, ?)',
      ).run(id, itemType, itemId, playlistId || null);
      return true;
    }
  },

  getAll: (itemType?: string) => {
    if (itemType) {
      return getDb()
        .prepare('SELECT * FROM favorites WHERE item_type = ? ORDER BY added_at DESC')
        .all(itemType);
    }
    return getDb().prepare('SELECT * FROM favorites ORDER BY added_at DESC').all();
  },

  isFavorite: (itemType: string, itemId: string) => {
    const row = getDb()
      .prepare('SELECT id FROM favorites WHERE item_type = ? AND item_id = ?')
      .get(itemType, itemId);
    return !!row;
  },
};

export const preferencesQueries = {
  get: () => getDb().prepare('SELECT * FROM user_preferences WHERE id = ?').get('main'),

  update: (data: Record<string, any>) => {
    const fields = Object.keys(data)
      .map((k) => `${k} = @${k}`)
      .join(', ');
    return getDb()
      .prepare(
        `UPDATE user_preferences SET ${fields}, updated_at = strftime('%s','now') WHERE id = 'main'`,
      )
      .run(data);
  },
};
