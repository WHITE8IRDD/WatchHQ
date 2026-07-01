const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(process.env.APPDATA, 'WatchHQ', 'watchhq.db');
console.log('Seeding DB at:', dbPath);

// Backup existing db
try {
  require('fs').copyFileSync(dbPath, dbPath + '.bak');
  console.log('Backed up to:', dbPath + '.bak');
} catch(e) { console.log('No backup needed:', e.message); }

const db = new DatabaseSync(dbPath, { open: true });

// Ensure tables exist (run schema if not)
db.exec("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='playlists'");

// Clear existing data
db.exec('DELETE FROM channels');
db.exec('DELETE FROM playlist_categories');
db.exec('DELETE FROM watch_history');
db.exec('DELETE FROM favorites');
db.exec('DELETE FROM epg_programs');
db.exec('DELETE FROM vod_items');
db.exec('DELETE FROM series');
db.exec('DELETE FROM series_episodes');
db.exec('DELETE FROM playlists');
db.exec('DELETE FROM settings');

// Create a test playlist
const playlistId = crypto.randomUUID();
const now = Math.floor(Date.now() / 1000);

const insertPlaylist = db.prepare(`
  INSERT INTO playlists (id, name, type, url, channel_count, vod_count, series_count, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertPlaylist.run(playlistId, 'IPTV Test Playlist', 'm3u', 'https://example.com/test.m3u', 100, 0, 0, now, now);
console.log('Created playlist:', playlistId);

// Insert test channels with various names
const testChannels = [
  { name: 'BEIN MAX 4', group: 'Sports', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'ALWAN SPORT 1', group: 'Sports', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'DAZN SPORT', group: 'Sports', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'NETFLIX', group: 'Movies', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'WORLD CUP 2026', group: 'Sports', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'CNN NEWS', group: 'News', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'BBC WORLD', group: 'News', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
  { name: 'DISCOVERY CHANNEL', group: 'Documentary', url: 'https://top.cloud-ip.cc:8443/play/Z4w3xgfxkzxes5GUFmqQ2zDwJPLuemKWAXsdSB6vCz0/ts' },
];

const insertChannel = db.prepare(`
  INSERT INTO channels (id, playlist_id, tvg_name, group_title, url)
  VALUES (?, ?, ?, ?, ?)
`);

const channelIds = [];
for (const ch of testChannels) {
  const id = crypto.randomUUID();
  insertChannel.run(id, playlistId, ch.name, ch.group, ch.url);
  channelIds.push(id);
  console.log('  Created channel:', ch.name, id);
}

// Update playlist count
const updateCount = db.prepare('UPDATE playlists SET channel_count = ? WHERE id = ?');
updateCount.run(testChannels.length, playlistId);

db.close();
console.log('\nSeeded', testChannels.length, 'channels successfully!');
