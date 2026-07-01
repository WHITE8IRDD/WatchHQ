// electron/ipc/favorites.ts
import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { favoritesQueries } from '../services/database';

export function registerFavoritesHandlers() {
  ipcMain.handle(
    'favorites:toggle',
    (_event, payload: { item_type: string; item_id: string; playlist_id?: string }) => {
      const isFavorite = favoritesQueries.toggle(
        uuidv4(),
        payload.item_type,
        payload.item_id,
        payload.playlist_id,
      );
      return { success: true, isFavorite };
    },
  );

  ipcMain.handle('favorites:getAll', (_event, itemType?: string) => {
    return favoritesQueries.getAll(itemType);
  });

  ipcMain.handle(
    'favorites:check',
    (_event, payload: { item_type: string; item_id: string }) => {
      return { isFavorite: favoritesQueries.isFavorite(payload.item_type, payload.item_id) };
    },
  );
}
