const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'WatchHQ', 'watchhq.db');
console.log('DB path:', dbPath);
try {
  const db = new DatabaseSync(dbPath, { open: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', JSON.stringify(tables));
  for (const t of tables) {
    const count = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
    console.log('  ' + t.name + ': ' + JSON.stringify(count));
  }
  const playlists = db.prepare('SELECT * FROM playlists').all();
  console.log('Playlists:', JSON.stringify(playlists, null, 2));
  db.close();
} catch(e) {
  console.log('Error:', e.message);
}
