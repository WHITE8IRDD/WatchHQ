import { ipcMain } from 'electron';
import { getDb } from '../services/database';

export function registerCategoryHandlers() {
  ipcMain.handle('categories:getAll', async (_event, playlistId: string) => {
    try {
      const rows = getDb().prepare(`SELECT id, category_name AS group_title, is_hidden FROM playlist_categories WHERE playlist_id = ? ORDER BY category_name`).all(playlistId);
      return rows as { id: string; group_title: string; is_hidden: number }[];
    } catch (err: any) {
      return [];
    }
  });

  ipcMain.handle('categories:setHidden', async (_event, { ids, hidden }: { ids: string[]; hidden: boolean }) => {
    try {
      const stmt = getDb().prepare(`UPDATE playlist_categories SET is_hidden = ? WHERE id = ?`);
      const tx = getDb().transaction(() => {
        for (const id of ids) stmt.run(hidden ? 1 : 0, id);
      });
      tx();
      return { success: true as const };
    } catch (err: any) {
      return { success: false as const, error: err.message };
    }
  });

  ipcMain.handle('categories:getVisible', async (_event, playlistId: string) => {
    try {
      const rows = getDb().prepare(`SELECT id, category_name AS group_title FROM playlist_categories WHERE playlist_id = ? AND (is_hidden IS NULL OR is_hidden = 0) ORDER BY category_name`).all(playlistId);
      return rows as { id: string; group_title: string }[];
    } catch (err: any) {
      return [];
    }
  });
}
