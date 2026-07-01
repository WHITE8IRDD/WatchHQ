// src/types/electron.d.ts
export {};

interface EpgProgram {
  id: string;
  tvg_id: string;
  title: string;
  description?: string;
  start_time: number;
  end_time: number;
  category?: string;
  icon?: string;
  lang?: string;
}

interface WatchHistoryEntry {
  id: string;
  item_type: 'channel' | 'vod' | 'series_episode';
  item_id: string;
  playlist_id?: string;
  title?: string;
  icon?: string;
  url?: string;
  position_seconds: number;
  duration_seconds: number;
  progress_percent: number;
  last_watched: number;
  watch_count: number;
}

interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream' | 'stalker';
  url?: string;
  username?: string;
  password?: string;
  mac_address?: string;
  last_synced?: number;
  channel_count: number;
  vod_count: number;
  series_count: number;
  is_active: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

interface Channel {
  id: string;
  playlist_id: string;
  stream_id?: string;
  tvg_id?: string;
  tvg_name: string;
  tvg_logo?: string;
  tvg_chno?: string;
  group_title: string;
  url: string;
  url_fallback?: string;
  is_favorite: number;
  last_watched?: number;
  watch_count: number;
}

interface VodItem {
  id: string;
  playlist_id: string;
  stream_id?: string;
  name: string;
  icon?: string;
  category_id?: string;
  category_name: string;
  container_extension: string;
  url: string;
  rating?: string;
  rating_5based?: number;
  plot?: string;
  genre?: string;
  release_date?: string;
  duration?: string;
  duration_secs?: number;
  director?: string;
  cast_members?: string;
  tmdb_id?: string;
  year?: number;
  is_favorite: number;
  last_watched?: number;
  watch_position: number;
}

interface SeriesItem {
  id: string;
  playlist_id: string;
  series_id: string;
  name: string;
  cover?: string;
  backdrop?: string;
  category_id?: string;
  category_name: string;
  plot?: string;
  genre?: string;
  release_date?: string;
  rating?: string;
  rating_5based?: number;
  cast_members?: string;
  director?: string;
  tmdb_id?: string;
  year?: number;
  season_count: number;
  episode_count: number;
  is_favorite: number;
  last_watched?: number;
}

interface SeriesEpisode {
  id: string;
  series_id: string;
  season: number;
  episode_num: number;
  title: string;
  url: string;
  container_extension: string;
  duration?: string;
  duration_secs?: number;
  plot?: string;
  info_json?: string;
  watch_position: number;
  is_watched: number;
}

interface AppInfo {
  version: string;
  name: string;
  dataPath: string;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
}

interface UserPreferences {
  id: string;
  theme: string;
  language: string;
  player_type: 'internal' | 'mpv' | 'vlc';
  mpv_path?: string;
  vlc_path?: string;
  default_stream_format: string;
  buffer_size: number;
  hardware_acceleration: number;
  auto_play_next: number;
  remember_position: number;
  epg_auto_update: number;
  epg_update_interval: number;
  startup_page: string;
  sidebar_expanded: number;
  grid_size: 'small' | 'medium' | 'large';
  sort_channels_by: 'name' | 'number' | 'group' | 'recent';
  show_channel_numbers: number;
  show_channel_logos: number;
  parental_lock: number;
  parental_pin?: string;
  proxy_enabled: number;
  proxy_url?: string;
  user_agent?: string;
  referrer?: string;
}

declare global {
  interface Window {
    electronAPI: {
      // Playlist
      addPlaylist: (data: any) => Promise<{ success: boolean; id?: string; count?: number; error?: string }>;
      getPlaylists: () => Promise<Playlist[]>;
      getPlaylistById: (id: string) => Promise<Playlist | undefined>;
      getChannels: (playlistId: string) => Promise<Channel[]>;
      getGroups: (playlistId: string) => Promise<{ group_title: string; count: number }[]>;
      searchChannels: (payload: { playlistId: string; query: string; group?: string; favoritesOnly?: boolean }) => Promise<Channel[]>;
      deletePlaylist: (id: string) => Promise<{ success: boolean; error?: string }>;
      refreshPlaylist: (id: string) => Promise<{ success: boolean; count?: number; error?: string }>;
      updatePlaylist: (payload: { id: string; data: any }) => Promise<{ success: boolean }>;
      toggleChannelFavorite: (channelId: string) => Promise<{ success: boolean; isFavorite: boolean }>;
      getFavoriteChannels: (playlistId?: string) => Promise<Channel[]>;

      // Player
      launchMPV: (url: string, options?: { fullscreen?: boolean }) => Promise<{ success: boolean; error?: string }>;
      launchVLC: (url: string) => Promise<{ success: boolean; error?: string }>;
      resolveStalkerUrl: (payload: { playlistId: string; cmd: string }) => Promise<{ success: boolean; url?: string; error?: string }>;
      checkPlayerAvailability: (player: 'mpv' | 'vlc') => Promise<{ available: boolean; version?: string }>;

      // Settings
      getSettings: () => Promise<Record<string, any>>;
      setSetting: (key: string, value: any) => Promise<{ success: boolean }>;
      getPreferences: () => Promise<UserPreferences>;
      updatePreferences: (data: Record<string, any>) => Promise<{ success: boolean }>;

      // System
      selectFile: () => Promise<{ path: string; content: string } | null>;
      openDataFolder: () => Promise<void>;
      getAppInfo: () => Promise<AppInfo>;
      exportBackup: () => Promise<{ success: boolean; path?: string }>;
      importBackup: () => Promise<{ success: boolean; requiresRestart?: boolean }>;
      clearAllData: () => Promise<{ success: boolean }>;

      // EPG
      importEpg: (url: string) => Promise<{ success: boolean; count?: number; error?: string }>;
      getEpgForChannel: (tvgId: string) => Promise<EpgProgram[]>;
      getNowNext: (tvgId: string) => Promise<{ now: EpgProgram | null; next: EpgProgram | null }>;
      getEpgSchedule: (payload: { tvgId: string; startTime: number; endTime: number }) => Promise<EpgProgram[]>;
      getBatchNowNext: (tvgIds: string[]) => Promise<Record<string, { now: EpgProgram | null; next: EpgProgram | null }>>;
      getEpgSources: () => Promise<any[]>;
      removeEpgSource: (id: string) => Promise<{ success: boolean }>;
      clearEpg: () => Promise<{ success: boolean }>;
      cleanupEpg: () => Promise<{ success: boolean; removed: number }>;
      getEpgStats: () => Promise<{ totalPrograms: number; totalSources: number; uniqueChannels: number }>;

      // VOD
      syncVod: (payload: { playlistId: string; cfg: any }) => Promise<{ success: boolean; count?: number; error?: string }>;
      getVod: (playlistId: string) => Promise<VodItem[]>;
      getVodCategories: (playlistId: string) => Promise<{ category_name: string; count: number }[]>;
      searchVod: (payload: { playlistId: string; query: string; category?: string }) => Promise<VodItem[]>;
      toggleVodFavorite: (id: string) => Promise<{ success: boolean; isFavorite: boolean }>;
      getFavoriteVod: (playlistId?: string) => Promise<VodItem[]>;

      // Series
      syncSeries: (payload: { playlistId: string; cfg: any }) => Promise<{ success: boolean; count?: number; error?: string }>;
      getSeries: (playlistId: string) => Promise<SeriesItem[]>;
      getSeriesCategories: (playlistId: string) => Promise<{ category_name: string; count: number }[]>;
      searchSeries: (payload: { playlistId: string; query: string; category?: string }) => Promise<SeriesItem[]>;
      getSeriesEpisodes: (payload: any) => Promise<{ success: boolean; episodes?: SeriesEpisode[]; info?: any; error?: string }>;
      toggleSeriesFavorite: (id: string) => Promise<{ success: boolean; isFavorite: boolean }>;

      // History
      updateHistory: (entry: any) => Promise<{ success: boolean }>;
      getRecentHistory: (limit?: number) => Promise<WatchHistoryEntry[]>;
      getHistoryByType: (payload: { type: string; limit?: number }) => Promise<WatchHistoryEntry[]>;
      getWatchPosition: (payload: { item_type: string; item_id: string }) => Promise<{ position_seconds: number; duration_seconds: number } | undefined>;
      clearHistory: () => Promise<{ success: boolean }>;
      deleteHistoryEntry: (payload: { item_type: string; item_id: string }) => Promise<{ success: boolean }>;

      // Favorites
      toggleFavorite: (payload: { item_type: string; item_id: string; playlist_id?: string }) => Promise<{ success: boolean; isFavorite: boolean }>;
      getAllFavorites: (itemType?: string) => Promise<any[]>;
      checkFavorite: (payload: { item_type: string; item_id: string }) => Promise<{ isFavorite: boolean }>;

      // Image Cache
      fetchImage: (url: string) => Promise<{ dataUrl: string } | null>;
      clearImageCache: () => Promise<{ success: boolean }>;
      getImageCacheStats: () => Promise<{ size: number; calculatedSize: number; failed: number }>;

      // Debug
      debugSampleUrls: () => Promise<any[]>;

      // Categories
      getAllCategories: (playlistId: string) => Promise<{ id: string; group_title: string; is_hidden: number }[]>;
      setCategoriesHidden: (payload: { ids: string[]; hidden: boolean }) => Promise<{ success: boolean }>;
      getVisibleCategories: (playlistId: string) => Promise<{ id: string; group_title: string }[]>;

      // Stream Proxy
      getStreamProxyPort: () => Promise<number>;

      // Import Progress
      onImportProgress: (callback: (progress: { phase: string; current: number; total: number }) => void) => () => void;

      // Media Keys
      onMediaPlayPause: (callback: () => void) => () => void;
      onMediaStop: (callback: () => void) => () => void;
    };
  }
}
