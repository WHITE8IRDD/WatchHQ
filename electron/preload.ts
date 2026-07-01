// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // === Playlist ===
  addPlaylist: (data: any) => ipcRenderer.invoke('playlist:add', data),
  getPlaylists: () => ipcRenderer.invoke('playlist:getAll'),
  getPlaylistById: (id: string) => ipcRenderer.invoke('playlist:getById', id),
  getChannels: (playlistId: string) => ipcRenderer.invoke('playlist:getChannels', playlistId),
  getGroups: (playlistId: string) => ipcRenderer.invoke('playlist:getGroups', playlistId),
  searchChannels: (payload: { playlistId: string; query: string; group?: string; favoritesOnly?: boolean }) =>
    ipcRenderer.invoke('playlist:searchChannels', payload),
  deletePlaylist: (id: string) => ipcRenderer.invoke('playlist:delete', id),
  refreshPlaylist: (id: string) => ipcRenderer.invoke('playlist:refresh', id),
  updatePlaylist: (payload: { id: string; data: any }) =>
    ipcRenderer.invoke('playlist:update', payload),
  toggleChannelFavorite: (channelId: string) =>
    ipcRenderer.invoke('playlist:toggleFavorite', channelId),
  getFavoriteChannels: (playlistId?: string) =>
    ipcRenderer.invoke('playlist:getFavorites', playlistId),

  // === Player ===
  launchMPV: (url: string, options?: any) => ipcRenderer.invoke('player:mpv', url, options),
  launchVLC: (url: string) => ipcRenderer.invoke('player:vlc', url),
  resolveStalkerUrl: (payload: { playlistId: string; cmd: string }) =>
    ipcRenderer.invoke('player:resolveStalkerUrl', payload),
  checkPlayerAvailability: (player: 'mpv' | 'vlc') =>
    ipcRenderer.invoke('player:checkAvailability', player),

  // === Settings ===
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', { key, value }),
  getPreferences: () => ipcRenderer.invoke('settings:getPreferences'),
  updatePreferences: (data: Record<string, any>) =>
    ipcRenderer.invoke('settings:updatePreferences', data),

  // === System ===
  selectFile: () => ipcRenderer.invoke('system:selectFile'),
  openDataFolder: () => ipcRenderer.invoke('system:openDataFolder'),
  getAppInfo: () => ipcRenderer.invoke('system:getAppInfo'),
  exportBackup: () => ipcRenderer.invoke('system:exportBackup'),
  importBackup: () => ipcRenderer.invoke('system:importBackup'),
  clearAllData: () => ipcRenderer.invoke('system:clearAllData'),

  // === EPG ===
  importEpg: (url: string) => ipcRenderer.invoke('epg:import', url),
  getEpgForChannel: (tvgId: string) => ipcRenderer.invoke('epg:getForChannel', tvgId),
  getNowNext: (tvgId: string) => ipcRenderer.invoke('epg:getNowNext', tvgId),
  getEpgSchedule: (payload: { tvgId: string; startTime: number; endTime: number }) =>
    ipcRenderer.invoke('epg:getSchedule', payload),
  getBatchNowNext: (tvgIds: string[]) => ipcRenderer.invoke('epg:getBatchNowNext', tvgIds),
  getEpgSources: () => ipcRenderer.invoke('epg:getSources'),
  removeEpgSource: (id: string) => ipcRenderer.invoke('epg:removeSource', id),
  clearEpg: () => ipcRenderer.invoke('epg:clearAll'),
  cleanupEpg: () => ipcRenderer.invoke('epg:cleanup'),
  getEpgStats: () => ipcRenderer.invoke('epg:getStats'),

  // === VOD ===
  syncVod: (payload: any) => ipcRenderer.invoke('vod:sync', payload),
  getVod: (playlistId: string) => ipcRenderer.invoke('vod:getAll', playlistId),
  getVodCategories: (playlistId: string) => ipcRenderer.invoke('vod:getCategories', playlistId),
  searchVod: (payload: { playlistId: string; query: string; category?: string }) =>
    ipcRenderer.invoke('vod:search', payload),
  toggleVodFavorite: (id: string) => ipcRenderer.invoke('vod:toggleFavorite', id),
  getFavoriteVod: (playlistId?: string) => ipcRenderer.invoke('vod:getFavorites', playlistId),

  // === Series ===
  syncSeries: (payload: any) => ipcRenderer.invoke('series:sync', payload),
  getSeries: (playlistId: string) => ipcRenderer.invoke('series:getAll', playlistId),
  getSeriesCategories: (playlistId: string) =>
    ipcRenderer.invoke('series:getCategories', playlistId),
  searchSeries: (payload: { playlistId: string; query: string; category?: string }) =>
    ipcRenderer.invoke('series:search', payload),
  getSeriesEpisodes: (payload: any) => ipcRenderer.invoke('series:getEpisodes', payload),
  toggleSeriesFavorite: (id: string) => ipcRenderer.invoke('series:toggleFavorite', id),

  // === History ===
  updateHistory: (entry: any) => ipcRenderer.invoke('history:update', entry),
  getRecentHistory: (limit?: number) => ipcRenderer.invoke('history:getRecent', limit),
  getHistoryByType: (payload: { type: string; limit?: number }) =>
    ipcRenderer.invoke('history:getByType', payload),
  getWatchPosition: (payload: { item_type: string; item_id: string }) =>
    ipcRenderer.invoke('history:getPosition', payload),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  deleteHistoryEntry: (payload: { item_type: string; item_id: string }) =>
    ipcRenderer.invoke('history:delete', payload),

  // === Favorites ===
  toggleFavorite: (payload: { item_type: string; item_id: string; playlist_id?: string }) =>
    ipcRenderer.invoke('favorites:toggle', payload),
  getAllFavorites: (itemType?: string) => ipcRenderer.invoke('favorites:getAll', itemType),
  checkFavorite: (payload: { item_type: string; item_id: string }) =>
    ipcRenderer.invoke('favorites:check', payload),

  // === Image Cache ===
  fetchImage: (url: string) => ipcRenderer.invoke('image:fetch', url),
  clearImageCache: () => ipcRenderer.invoke('image:clearCache'),
  getImageCacheStats: () => ipcRenderer.invoke('image:stats'),

  // === Categories ===
  getAllCategories: (playlistId: string) => ipcRenderer.invoke('categories:getAll', playlistId),
  setCategoriesHidden: (payload: { ids: string[]; hidden: boolean }) =>
    ipcRenderer.invoke('categories:setHidden', payload),
  getVisibleCategories: (playlistId: string) => ipcRenderer.invoke('categories:getVisible', playlistId),

  // === Stream Proxy ===
  getStreamProxyPort: () => ipcRenderer.invoke('stream:getProxyPort'),

  // === Import Progress ===
  onImportProgress: (callback: (progress: { phase: string; current: number; total: number }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('playlist:importProgress', handler);
    return () => ipcRenderer.removeListener('playlist:importProgress', handler);
  },

  // === Media Key Listeners ===
  onMediaPlayPause: (callback: () => void) => {
    ipcRenderer.on('media:playPause', callback);
    return () => ipcRenderer.removeListener('media:playPause', callback);
  },
  onMediaStop: (callback: () => void) => {
    ipcRenderer.on('media:stop', callback);
    return () => ipcRenderer.removeListener('media:stop', callback);
  },
});
