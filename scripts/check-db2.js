const path = require('path');
const os = require('os');
const fs = require('fs');

// Check common database paths
const paths = [
  path.join(process.env.APPDATA || '', 'watchhq', 'watchhq.db'),
  path.join(process.env.APPDATA || '', 'WatchHQ', 'watchhq.db'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'watchhq', 'watchhq.db'),
];

for (const p of paths) {
  console.log(`Checking: ${p}`);
  console.log(`  Exists: ${fs.existsSync(p)}`);
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    console.log(`  Size: ${stat.size} bytes`);
    console.log(`  Modified: ${stat.mtime}`);
  }
}

// Also check the current WAL file for the app database
const appDb = path.join(process.env.APPDATA || '', 'watchhq', 'watchhq.db');
if (fs.existsSync(appDb)) {
  // Try to read it with node:sqlite
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(appDb, { open: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('\nTables:', tables.map(t => t.name));
    try {
      const playlists = db.prepare('SELECT * FROM playlists').all();
      console.log('\nPlaylists:', JSON.stringify(playlists, null, 2));
    } catch(e) { console.log('Error reading playlists:', e.message); }
    try {
      const channels = db.prepare('SELECT COUNT(*) as cnt FROM channels').get();
      console.log('\nChannels count:', channels.cnt);
    } catch(e) { console.log('Error counting channels:', e.message); }
    try {
      const prefs = db.prepare('SELECT * FROM user_preferences').all();
      console.log('\nPreferences:', JSON.stringify(prefs, null, 2));
    } catch(e) { console.log('Error reading preferences:', e.message); }
    db.close();
  } catch(e) {
    console.log('\nnode:sqlite error:', e.message);
    // Fallback: read raw bytes
    const buf = Buffer.alloc(100);
    const fd = fs.openSync(appDb, 'r');
    fs.readSync(fd, buf, 0, 100, 0);
    fs.closeSync(fd);
    console.log('First 100 bytes:', buf.toString('hex'));
    // Check for SQLite header
    const header = buf.toString('ascii', 0, 16);
    console.log('SQLite header:', header);
  }
}
