const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA || '', 'watchhq', 'watchhq.db');
console.log('Checking DB at:', dbPath);
try {
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));
  const playlists = db.prepare('SELECT * FROM playlists').all();
  console.log('Playlists:', JSON.stringify(playlists));
  const channels = db.prepare('SELECT COUNT(*) as c FROM channels').get();
  console.log('Channels count:', channels.c);
  const channels_data = db.prepare('SELECT * FROM channels LIMIT 3').all();
  console.log('Sample channels:', JSON.stringify(channels_data));
  db.close();
} catch(e) { console.error('Error:', e.message); }
