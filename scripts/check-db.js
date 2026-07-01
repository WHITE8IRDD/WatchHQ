const sqlite3 = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'WatchHQ', 'watchhq.db');
console.log('DB path:', dbPath);
const db = new sqlite3(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
for (const t of tables) {
  const count = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
  console.log('  ' + t.name + ': ' + count.c + ' rows');
}
const playlists = db.prepare('SELECT id, name, type, channel_count FROM playlists').all();
console.log('\nPlaylists:');
console.log(JSON.stringify(playlists, null, 2));
if (playlists.length > 0) {
  const channels = db.prepare('SELECT id, tvg_name, url FROM channels LIMIT 5').all();
  console.log('\nSample channels:');
  console.log(JSON.stringify(channels, null, 2));
}
db.close();
