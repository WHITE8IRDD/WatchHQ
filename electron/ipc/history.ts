// electron/ipc/history.ts
import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { historyQueries } from '../services/database';

export function registerHistoryHandlers() {
  ipcMain.handle('history:update', (_event, entry: any) => {
    try {
      historyQueries.upsert({
        id: entry.id || uuidv4(),
        item_type: entry.item_type,
        item_id: entry.item_id,
        playlist_id: entry.playlist_id,
        title: entry.title,
        icon: entry.icon,
        url: entry.url,
        position_seconds: entry.position_seconds || 0,
        duration_seconds: entry.duration_seconds || 0,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('history:getRecent', (_event, limit?: number) => {
    return historyQueries.getRecent(limit || 20);
  });

  ipcMain.handle('history:getByType', (_event, payload: { type: string; limit?: number }) => {
    return historyQueries.getByType(payload.type, payload.limit || 20);
  });

  ipcMain.handle(
    'history:getPosition',
    (_event, payload: { item_type: string; item_id: string }) => {
      return historyQueries.getPosition(payload.item_type, payload.item_id);
    },
  );

  ipcMain.handle('history:clear', () => {
    historyQueries.clear();
    return { success: true };
  });

  ipcMain.handle('history:delete', (_event, payload: { item_type: string; item_id: string }) => {
    historyQueries.delete(payload.item_type, payload.item_id);
    return { success: true };
  });
}
