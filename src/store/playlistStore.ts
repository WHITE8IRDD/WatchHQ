// src/store/playlistStore.ts
import { create } from 'zustand';

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
  is_favorite: number;
}

interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream' | 'stalker';
  url?: string;
  username?: string;
  password?: string;
  mac_address?: string;
  channel_count: number;
  vod_count: number;
  series_count: number;
}

interface PlaylistState {
  // Data
  playlists: Playlist[];
  activePlaylistId: string | null;
  activePlaylist: Playlist | null;
  channels: Channel[];
  groups: string[];
  currentChannel: Channel | null;
  isPlaying: boolean;

  // UI State
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  activeGroup: string;

  // Actions
  setPlaylists: (p: Playlist[]) => void;
  setActivePlaylist: (id: string | null) => void;
  setChannels: (c: Channel[]) => void;
  setCurrentChannel: (c: Channel | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveGroup: (group: string) => void;

  // Async actions
  loadPlaylists: () => Promise<void>;
  loadChannels: (playlistId: string) => Promise<void>;
  addPlaylist: (data: any) => Promise<{ success: boolean; error?: string }>;
  deletePlaylist: (id: string) => Promise<void>;
  refreshPlaylist: (id: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  activePlaylistId: null,
  activePlaylist: null,
  channels: [],
  groups: [],
  currentChannel: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  searchQuery: '',
  activeGroup: 'All',

  setPlaylists: (playlists) => set({ playlists }),
  setActivePlaylist: (id) => {
    const playlist = get().playlists.find((p) => p.id === id) || null;
    set({ activePlaylistId: id, activePlaylist: playlist });
  },
  setChannels: (channels) => {
    const groups = ['All', ...Array.from(new Set(channels.map((c) => c.group_title))).sort()];
    set({ channels, groups });
  },
  setCurrentChannel: (currentChannel) => {
    console.log('[STORE-1] setCurrentChannel called with:', currentChannel);
    set({ currentChannel, isPlaying: !!currentChannel });
    console.log('[STORE-2] Store updated');
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveGroup: (activeGroup) => set({ activeGroup }),

  loadPlaylists: async () => {
    try {
      set({ isLoading: true, error: null });
      const playlists = await window.electronAPI.getPlaylists();
      set({ playlists });

      // Auto-select first playlist if none selected
      const { activePlaylistId } = get();
      if (!activePlaylistId && playlists.length > 0) {
        const first = playlists[0];
        set({ activePlaylistId: first.id, activePlaylist: first });
      }
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadChannels: async (playlistId: string) => {
    try {
      set({ isLoading: true, error: null });
      const channels = await window.electronAPI.getChannels(playlistId);
      const groups = ['All', ...Array.from(new Set(channels.map((c: Channel) => c.group_title))).sort()];
      set({
        channels,
        groups,
        activePlaylistId: playlistId,
        activePlaylist: get().playlists.find((p) => p.id === playlistId) || null,
      });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addPlaylist: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const result = await window.electronAPI.addPlaylist(data);
      if (result.success) {
        await get().loadPlaylists();
        if (result.id) {
          await get().loadChannels(result.id);
        }
      }
      return result;
    } catch (error: any) {
      set({ error: error.message });
      return { success: false, error: error.message };
    } finally {
      set({ isLoading: false });
    }
  },

  deletePlaylist: async (id) => {
    try {
      set({ isLoading: true });
      await window.electronAPI.deletePlaylist(id);
      await get().loadPlaylists();
      const { activePlaylistId, playlists } = get();
      if (activePlaylistId === id) {
        if (playlists.length > 0) {
          await get().loadChannels(playlists[0].id);
        } else {
          set({ channels: [], groups: [], activePlaylistId: null, activePlaylist: null });
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  refreshPlaylist: async (id) => {
    try {
      set({ isLoading: true, error: null });
      const result = await window.electronAPI.refreshPlaylist(id);
      if (result.success) {
        await get().loadPlaylists();
        if (get().activePlaylistId === id) {
          await get().loadChannels(id);
        }
      } else {
        set({ error: result.error });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Expose store for CDP automation testing
if (typeof window !== 'undefined') (window as any).__playlistStore = usePlaylistStore;
