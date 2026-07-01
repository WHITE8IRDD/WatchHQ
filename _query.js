const Database = require('better-sqlite3');
const db = new Database('C:/Users/m_oya/AppData/Roaming/watchhq/watchhq.db', { readonly: true });
const bein = db.prepare("SELECT tvg_name, group_title, url FROM channels WHERE group_title LIKE '%BEIN%' ORDER BY tvg_name LIMIT 5").all();
console.log('=== BEIN SPORTS ===');
console.log(JSON.stringify(bein, null, 2));
const groups = db.prepare("SELECT DISTINCT group_title FROM channels ORDER BY group_title").all();
console.log('\n=== GROUPS ===');
console.log(groups.map(g => g.group_title).join('\n'));
db.close();
