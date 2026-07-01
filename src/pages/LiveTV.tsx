import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaylistStore } from '../store/playlistStore';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  Television, Plus, ArrowClockwise, Heart, Play, Gear, MagnifyingGlass, CaretLeft, CaretRight, ClockCounterClockwise,
} from '@phosphor-icons/react';
import VideoPlayer from '../components/player/VideoPlayer';
import AddPlaylistModal from '../components/playlist/AddPlaylistModal';
import ChannelLogo from '../components/common/ChannelLogo';
import CommandPalette from '../components/common/CommandPalette';
import ManageCategoriesModal from '../components/livetv/ManageCategoriesModal';
import AdvancedSearchBar from '../components/livetv/AdvancedSearchBar';
import { toast } from '../components/common/Toast';
import { useDebounce } from '../hooks/useDebounce';
import { ChannelGridSkeleton } from '../components/common/Skeleton';
import { staggerContainer, fadeInUp, springSnappy } from '../lib/motion';

const CHANNELS_PER_PAGE = 2000;

const log = (() => {
  if (process.env.NODE_ENV === 'development') return console.log.bind(console);
  return () => {};
})();

const LiveTV: React.FC = () => {
  const {
    playlists, channels, currentChannel, isLoading,
    searchQuery, activeGroup,
    setCurrentChannel, setSearchQuery, setActiveGroup,
    loadPlaylists, loadChannels,
  } = usePlaylistStore();
  const prefs = usePreferencesStore((s) => s.prefs);

  const [showAddModal, setShowAddModal] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [showManageCats, setShowManageCats] = useState(false);
  const [epgData, setEpgData] = useState<Record<string, { now: any; next: any }>>({});

  const debouncedSearch = useDebounce(searchQuery, 300);
  const sortBy = prefs?.sort_channels_by || 'name';
  const showNumbers = prefs?.show_channel_numbers === 1;
  const showLogos = prefs?.show_channel_logos === 1;

  const [categories, setCategories] = useState<{ id: string; group_title: string; count: number }[]>([]);
  const [categoryChannels, setCategoryChannels] = useState<any[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<any[] | null>(null);

  useEffect(() => { loadPlaylists().then(() => { const s = usePlaylistStore.getState(); if (s.playlists.length > 0) { setActivePlaylistId(s.playlists[0].id); loadChannels(s.playlists[0].id); } }); }, []);

  // Load visible categories (with fallback to groups for M3U imports)
  useEffect(() => {
    if (!activePlaylistId) return;
    (async () => {
      let visible = await window.electronAPI.getVisibleCategories(activePlaylistId);
      if (!visible || visible.length === 0) {
        const groups = await window.electronAPI.getGroups(activePlaylistId);
        visible = groups.map((g: any) => ({ id: g.group_title, group_title: g.group_title }));
        console.log('[LiveTV] Fallback to groups:', visible.length);
      }
      const chs = await window.electronAPI.getChannels(activePlaylistId);
      const counts: Record<string, number> = { All: chs.length };
      for (const ch of chs) counts[ch.group_title] = (counts[ch.group_title] || 0) + 1;
      setCategories(visible.map((v: any) => ({ ...v, count: counts[v.group_title] || 0 })));
    })();
  }, [activePlaylistId, channels]);

  // SQL-per-category channel load
  useEffect(() => {
    if (!activePlaylistId) return;
    setLoadingCat(true);
    (async () => {
      try {
        if (advancedSearchResults !== null) {
          setCategoryChannels(advancedSearchResults.slice(0, CHANNELS_PER_PAGE));
        } else if (debouncedSearch || showFavoritesOnly) {
          const result = await window.electronAPI.searchChannels({
            playlistId: activePlaylistId,
            query: debouncedSearch || '',
            favoritesOnly: showFavoritesOnly || undefined,
          });
          setCategoryChannels(result || []);
        } else if (activeGroup && activeGroup !== 'All') {
          const result = await window.electronAPI.searchChannels({
            playlistId: activePlaylistId,
            query: '',
            group: activeGroup,
          });
          setCategoryChannels((result || []).slice(0, CHANNELS_PER_PAGE));
        } else {
          const chs = await window.electronAPI.getChannels(activePlaylistId);
          setCategoryChannels(chs.slice(0, CHANNELS_PER_PAGE));
        }
      } finally { setLoadingCat(false); }
    })();
  }, [activePlaylistId, activeGroup, debouncedSearch, showFavoritesOnly, advancedSearchResults]);

  // EPG for visible channels
  useEffect(() => {
    const tvgIds = [...new Set(categoryChannels.slice(0, 100).map(ch => ch.tvg_id).filter(Boolean))] as string[];
    if (tvgIds.length === 0) { setEpgData({}); return; }
    window.electronAPI.getBatchNowNext(tvgIds).then(setEpgData).catch(() => {});
  }, [categoryChannels]);

  const handlePlaylistSwitch = async (id: string) => {
    setActivePlaylistId(id);
    await loadChannels(id);
    setActiveGroup('All');
    setSearchQuery('');
    setAdvancedSearchResults(null);
  };

  const handleRefresh = async () => {
    if (!activePlaylistId) return;
    toast.info('Refreshing...');
    try {
      await usePlaylistStore.getState().refreshPlaylist(activePlaylistId);
      toast.success('Refreshed');
    } catch (e: any) { toast.error(e.message); }
  };

  const noChannels = channels.length === 0 && !isLoading;

  // Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowCmdPalette(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Virtualized category list
  const parentRef = useRef<HTMLDivElement>(null);
  const categoryVirtualizer = useVirtualizer({
    count: categories.length + 1,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 10,
  });

  // Virtualized channel list
  const channelParentRef = useRef<HTMLDivElement>(null);
  const channelVirtualizer = useVirtualizer({
    count: categoryChannels.length,
    getScrollElement: () => channelParentRef.current,
    estimateSize: () => 56,
    overscan: 15,
  });

  log('[LIVETV] render channels:', channels.length, 'cat:', categoryChannels.length);

  return (
    <div className="flex h-full overflow-hidden">
      <CommandPalette open={showCmdPalette} onClose={() => setShowCmdPalette(false)} />
      <ManageCategoriesModal open={showManageCats} onClose={() => setShowManageCats(false)} />

      {/* ── LEFT: Categories (240px) ── */}
      <div className="w-[240px] flex-shrink-0 border-r border-border-subtle h-full flex flex-col bg-bg-secondary/30">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
          <h3 className="text-[11px] uppercase tracking-wider text-text-tertiary font-semibold">Categories</h3>
          <button onClick={() => setShowManageCats(true)}
            className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-tertiary hover:text-white transition-colors"
            title="Manage categories">
            <Gear size={14} />
          </button>
        </div>
        <div ref={parentRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5" style={{ contain: 'strict' }}>
          <div style={{ height: categoryVirtualizer.getTotalSize(), position: 'relative' }}>
            {categoryVirtualizer.getVirtualItems().map((virtualRow) => {
              const isAll = virtualRow.index === 0;
              const cat = isAll ? null : categories[virtualRow.index - 1];
              return (
                <div key={virtualRow.index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}>
                  {isAll ? (
                    <button onClick={() => setActiveGroup('All')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        activeGroup === 'All' && !debouncedSearch && !showFavoritesOnly ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}>
                      <span className="truncate">All Channels</span>
                      <span className="text-[10px] text-text-tertiary ml-2">{channels.length}</span>
                    </button>
                  ) : (
                    <button onClick={() => { setActiveGroup(cat!.group_title); setSearchQuery(''); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        activeGroup === cat!.group_title ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}>
                      <span className="truncate">{cat!.group_title}</span>
                      <span className="text-[10px] text-text-tertiary ml-2">{cat!.count}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Channel List (280px) ── */}
      <div className="w-[280px] flex-shrink-0 border-r border-border-subtle h-full flex flex-col bg-bg-base">
        {/* Search bar */}
        {activePlaylistId && (
          <AdvancedSearchBar
            playlistId={activePlaylistId}
            onResults={(results) => {
              setAdvancedSearchResults(results);
              if (results.length === 0 || (results[0] && results[0].query !== searchQuery)) {
                // Sync searchQuery for backward compat
              }
            }}
          />
        )}

        {/* Channel list */}
        <div ref={channelParentRef} className="flex-1 overflow-y-auto" style={{ contain: 'strict' }}>
          {noChannels ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Television size={32} className="text-text-tertiary mb-3" />
              <p className="text-text-secondary text-sm mb-3">No channels yet</p>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-white text-black rounded-xl text-sm font-medium">Add Playlist</button>
            </div>
          ) : loadingCat ? (
            <div className="p-4"><ChannelGridSkeleton count={8} /></div>
          ) : (
            <div style={{ height: channelVirtualizer.getTotalSize(), position: 'relative' }}>
              {channelVirtualizer.getVirtualItems().map((virtualRow) => {
                const ch = categoryChannels[virtualRow.index];
                if (!ch) return null;
                const epg = epgData[ch.tvg_id] || null;
                return (
                  <div key={ch.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}>
                    <button onClick={() => setCurrentChannel(ch)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        currentChannel?.id === ch.id ? 'bg-white/10 border-l-2 border-white' : 'hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elevated">
                        {showLogos ? <ChannelLogo name={ch.tvg_name} logo={ch.tvg_logo} size={36} /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {showNumbers && ch.tvg_chno && <span className="text-[10px] text-text-tertiary font-mono">{ch.tvg_chno}</span>}
                          <p className="text-sm font-medium truncate">{ch.tvg_name}</p>
                          {ch.is_favorite === 1 && <Heart size={10} weight="fill" className="text-state-error flex-shrink-0" />}
                        </div>
                        {epg?.now && <p className="text-[11px] text-text-tertiary truncate">{epg.now.title}</p>}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle flex-shrink-0">
          {playlists.length > 1 && (
            <select value={activePlaylistId || ''} onChange={e => handlePlaylistSwitch(e.target.value)}
              className="flex-1 bg-bg-elevated border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
              {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showFavoritesOnly ? 'bg-state-error/10 text-state-error' : 'text-text-tertiary hover:text-white hover:bg-white/5'}`}>
            <Heart size={14} weight={showFavoritesOnly ? 'fill' : 'regular'} />
          </button>
          <button onClick={handleRefresh} disabled={isLoading}
            className="w-8 h-8 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center disabled:opacity-40">
            <ArrowClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="w-8 h-8 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* ── RIGHT: Player area (1fr) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-black">
        {currentChannel ? (
          <div className="flex-1 flex flex-col">
            <div className="relative w-full flex-1 bg-black">
              <VideoPlayer />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-black text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-bg-elevated/30 flex items-center justify-center mb-5">
              <Television size={36} className="text-text-tertiary opacity-40" />
            </div>
            <h2 className="text-xl font-bold text-white/80 mb-2">Select a channel to start watching</h2>
            <p className="text-sm text-text-tertiary max-w-md">
              Browse categories on the left, then pick a channel from the list to begin playback.
            </p>
            <div className="flex items-center gap-2 mt-6 text-xs text-text-tertiary">
              <span><kbd className="px-1.5 py-0.5 bg-bg-elevated rounded text-[10px]">Ctrl+K</kbd> Quick search</span>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPlaylistModal onClose={async () => {
          setShowAddModal(false);
          await loadPlaylists();
          const lists = await window.electronAPI.getPlaylists();
          if (lists.length > 0 && !activePlaylistId) {
            setActivePlaylistId(lists[0].id);
            await loadChannels(lists[0].id);
          }
        }} />
      )}
    </div>
  );
};

export default LiveTV;
