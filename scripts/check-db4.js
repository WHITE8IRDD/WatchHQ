const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'WatchHQ', 'watchhq.db');

// Open WITHOUT WAL mode — try read-only
const db = new DatabaseSync(dbPath, { open: true });

// Force journal_mode to DELETE to read WAL contents
db.exec('PRAGMA journal_mode=DELETE');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');

// Now check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

for (const t of tables) {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM [' + t.name + ']').get();
    console.log('  ' + t.name + ': ' + count.c);
    if (count.c > 0 && t.name === 'playlists') {
      const rows = db.prepare('SELECT * FROM playlists').all();
      console.log('  Data:', JSON.stringify(rows.slice(0, 3)));
    }
    if (count.c > 0 && t.name === 'channels') {
      const rows = db.prepare('SELECT id, tvg_name, url FROM channels LIMIT 5').all();
      console.log('  Sample channels:');
      for (const r of rows) {
        console.log('    ' + r.tvg_name + ': ' + (r.url || '').substring(0, 60));
      }
    }
  } catch(e) {
    console.log('  ' + t.name + ': ERROR ' + e.message);
  }
}

db.close();
