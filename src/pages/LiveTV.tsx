import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePlaylistStore } from '../store/playlistStore';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  Television, Plus, ArrowClockwise, Heart, Play, Gear, MagnifyingGlass,
  CaretLeft, CaretRight, ClockCounterClockwise, Star, Funnel,
} from '@phosphor-icons/react';
import VideoPlayer from '../components/player/VideoPlayer';
import ChannelLogo from '../components/common/ChannelLogo';
import ManageCategoriesModal from '../components/livetv/ManageCategoriesModal';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from '../components/common/Toast';
import * as ContextMenu from '@radix-ui/react-context-menu';

function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

function getCategoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (/sport|football|soccer|bein|dazn|laliga|league/.test(n)) return '⚽';
  if (/news|أخبار|info|jazeera/.test(n)) return '📰';
  if (/movie|film|cinema|سينما/.test(n)) return '🎬';
  if (/music|musi|موسيقى/.test(n)) return '🎵';
  if (/kid|bambini|enfant|أطفال|cartoon/.test(n)) return '👶';
  if (/document|وثائقي/.test(n)) return '📚';
  if (/religious|islam|دينية/.test(n)) return '🕌';
  if (/cook|food|طبخ/.test(n)) return '🍳';
  if (/nature|animal|حيوان/.test(n)) return '🌿';
  if (/entertainment|ترفيه/.test(n)) return '🎭';
  if (/vip|premium/.test(n)) return '⭐';
  if (/4k|uhd|fhd|hd/.test(n)) return '📺';
  return '📡';
}

const ChannelRow = React.memo(({
  ch, isActive, showLogos, showNumbers, epg, onSelect, onToggleFavorite,
}: {
  ch: any; isActive: boolean; showLogos: boolean; showNumbers: boolean;
  epg: { now: any; next: any } | null;
  onSelect: (ch: any) => void;
  onToggleFavorite: (ch: any) => void;
}) => {
  const isLive = !!epg?.now;

  const handlePlayInMpv = () => {
    window.electronAPI.launchMPV(ch.url).catch(() => {});
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(ch.url).then(() => toast.success('URL copied')).catch(() => {});
  };

  const handleChannelInfo = () => {
    toast.info(`${ch.tvg_name}\nGroup: ${ch.group_title}\nID: ${ch.id}`);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          onClick={() => onSelect(ch)}
          className={`w-full flex items-center gap-3 px-3 text-left transition-colors ${
            isActive
              ? 'bg-white/10 border-l-2 border-white'
              : 'hover:bg-white/5 border-l-2 border-transparent'
          }`}
          style={{ height: 64 }}
        >
          {showNumbers && ch.tvg_chno && (
            <span className="w-7 text-right text-[11px] text-text-tertiary font-mono flex-shrink-0">{ch.tvg_chno}</span>
          )}
          {showLogos && (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elevated">
              <ChannelLogo name={ch.tvg_name} logo={ch.tvg_logo} size={40} />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(ch); }}
            className="p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0 ml-1"
            title={ch.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Star size={14} weight={ch.is_favorite ? 'fill' : 'regular'} className={ch.is_favorite ? 'text-gold' : 'text-text-tertiary hover:text-white'} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{ch.tvg_name}</span>
            </div>
            {epg?.now && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">{epg.now.title}</p>
            )}
          </div>
          {isLive && (
            <span className="w-2 h-2 rounded-full bg-state-error animate-pulse flex-shrink-0" title="Live" />
          )}
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[190px] bg-bg-overlay backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-2xl z-50">
          <ContextMenu.Item
            onSelect={() => onSelect(ch)}
            className="flex items-center gap-3 px-3 py-2 text-sm text-white rounded-lg hover:bg-white/10 cursor-pointer outline-none"
          >
            <Play size={14} weight="fill" /> Play
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={handlePlayInMpv}
            className="flex items-center gap-3 px-3 py-2 text-sm text-white rounded-lg hover:bg-white/10 cursor-pointer outline-none"
          >
            <Play size={14} /> Play in MPV
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={() => onToggleFavorite(ch)}
            className="flex items-center gap-3 px-3 py-2 text-sm text-white rounded-lg hover:bg-white/10 cursor-pointer outline-none"
          >
            <Heart size={14} /> {ch.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </ContextMenu.Item>
          <ContextMenu.Separator className="h-px bg-white/5 mx-2 my-1" />
          <ContextMenu.Item
            onSelect={handleCopyUrl}
            className="flex items-center gap-3 px-3 py-2 text-sm text-white rounded-lg hover:bg-white/10 cursor-pointer outline-none"
          >
            <ClockCounterClockwise size={14} /> Copy URL
          </ContextMenu.Item>
          <ContextMenu.Item
            onSelect={handleChannelInfo}
            className="flex items-center gap-3 px-3 py-2 text-sm text-white rounded-lg hover:bg-white/10 cursor-pointer outline-none"
          >
            <MagnifyingGlass size={14} /> Channel Info
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
},
(prev: any, next: any) =>
  prev.ch.id === next.ch.id &&
  prev.isActive === next.isActive &&
  prev.ch.is_favorite === next.ch.is_favorite &&
  prev.epg?.now?.title === next.epg?.now?.title,
);

const LiveTV: React.FC = () => {
  const {
    playlists, channels, currentChannel, isLoading,
    activeGroup,
    setCurrentChannel, setActiveGroup,
    loadPlaylists, loadChannels,
  } = usePlaylistStore();
  const prefs = usePreferencesStore((s) => s.prefs);

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showManageCats, setShowManageCats] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [sortChannelsBy, setSortChannelsBy] = useState<'name' | 'number'>('name');
  const [categories, setCategories] = useState<{ id: string; group_title: string; count: number }[]>([]);
  const [displayedCategories, setDisplayedCategories] = useState<{ id: string; group_title: string; count: number }[]>([]);
  const [categoryChannels, setCategoryChannels] = useState<any[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [epgData, setEpgData] = useState<Record<string, { now: any; next: any }>>({});

  const debouncedCategorySearch = useDebounce(categorySearch, 250);

  const showNumbers = prefs?.show_channel_numbers === 1;
  const showLogos = prefs?.show_channel_logos === 1;

  useEffect(() => {
    loadPlaylists().then(() => {
      const s = usePlaylistStore.getState();
      if (s.playlists.length > 0) {
        setActivePlaylistId(s.playlists[0].id);
        loadChannels(s.playlists[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!activePlaylistId) return;
    (async () => {
      let visible = await window.electronAPI.getVisibleCategories(activePlaylistId);
      if (!visible || visible.length === 0) {
        const groups = await window.electronAPI.getGroups(activePlaylistId);
        visible = groups.map((g: any) => ({ id: g.group_title, group_title: g.group_title }));
      }
      const chs = await window.electronAPI.getChannels(activePlaylistId);
      const counts: Record<string, number> = { All: chs.length };
      for (const ch of chs) counts[ch.group_title] = (counts[ch.group_title] || 0) + 1;
      setCategories(visible.map((v: any) => ({ ...v, count: counts[v.group_title] || 0 })));
    })();
  }, [activePlaylistId, channels]);

  useEffect(() => {
    if (debouncedCategorySearch) {
      setDisplayedCategories(
        categories.filter((c) =>
          c.group_title.toLowerCase().includes(debouncedCategorySearch.toLowerCase()),
        ),
      );
    } else {
      setDisplayedCategories(categories);
    }
  }, [categories, debouncedCategorySearch]);

  useEffect(() => {
    if (!activePlaylistId) return;
    setLoadingCat(true);
    (async () => {
      try {
        if (debouncedCategorySearch || showFavoritesOnly) {
          const result = await window.electronAPI.searchChannels({
            playlistId: activePlaylistId,
            query: debouncedCategorySearch || '',
            favoritesOnly: showFavoritesOnly || undefined,
          });
          setCategoryChannels(result || []);
        } else if (activeGroup && activeGroup !== 'All') {
          const result = await window.electronAPI.searchChannels({
            playlistId: activePlaylistId,
            query: '',
            group: activeGroup,
          });
          setCategoryChannels(result || []);
        } else {
          const allChs = await window.electronAPI.getChannels(activePlaylistId);
          setCategoryChannels(allChs || []);
        }
      } finally {
        setLoadingCat(false);
      }
    })();
  }, [activePlaylistId, activeGroup, debouncedCategorySearch, showFavoritesOnly]);

  const sortedChannels = React.useMemo(() => {
    const list = [...categoryChannels];
    if (sortChannelsBy === 'name') {
      list.sort((a, b) => a.tvg_name.localeCompare(b.tvg_name));
    } else {
      list.sort((a, b) => (a.tvg_chno || '').localeCompare(b.tvg_chno || '', undefined, { numeric: true }));
    }
    return list;
  }, [categoryChannels, sortChannelsBy]);

  useEffect(() => {
    const tvgIds = [...new Set(sortedChannels.slice(0, 100).map((ch) => ch.tvg_id).filter(Boolean))] as string[];
    if (tvgIds.length === 0) { setEpgData({}); return; }
    window.electronAPI.getBatchNowNext(tvgIds).then(setEpgData).catch(() => {});
  }, [sortedChannels]);

  const handlePlaylistSwitch = async (id: string) => {
    setActivePlaylistId(id);
    await loadChannels(id);
    setActiveGroup('All');
    setCategorySearch('');
    setShowFavoritesOnly(false);
  };

  const handleRefresh = async () => {
    if (!activePlaylistId) return;
    toast.info('Refreshing...');
    try {
      await usePlaylistStore.getState().refreshPlaylist(activePlaylistId);
      toast.success('Refreshed');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleFavorite = useCallback(async (ch: any) => {
    try {
      const result = await window.electronAPI.toggleChannelFavorite(ch.id);
      if (result.success) {
        setCategoryChannels((prev) =>
          prev.map((c) =>
            c.id === ch.id ? { ...c, is_favorite: result.isFavorite ? 1 : 0 } : c,
          ),
        );
        if (currentChannel && currentChannel.id === ch.id) {
          setCurrentChannel({ ...currentChannel, is_favorite: result.isFavorite ? 1 : 0 } as any);
        }
        toast.success(result.isFavorite ? 'Added to favorites' : 'Removed from favorites');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [currentChannel, setCurrentChannel]);

  const handleCategoryClick = (group: string) => {
    setActiveGroup(group);
    setCategorySearch('');
  };

  const handleHome = () => {
    setActiveGroup('All');
    setCategorySearch('');
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const categoryVirtualizer = useVirtualizer({
    count: displayedCategories.length + 1,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 10,
  });

  const channelParentRef = useRef<HTMLDivElement>(null);
  const channelVirtualizer = useVirtualizer({
    count: sortedChannels.length,
    getScrollElement: () => channelParentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const currentEpg = currentChannel?.tvg_id ? epgData[currentChannel.tvg_id] : null;

  return (
    <div className="flex h-full overflow-hidden">
      <ManageCategoriesModal open={showManageCats} onClose={() => setShowManageCats(false)} />

      {/* ── LEFT: Categories (240px) ── */}
      <div className="w-[240px] flex-shrink-0 border-r border-border-subtle h-full flex flex-col bg-bg-secondary/30">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
          <h3 className="text-[11px] uppercase tracking-wider text-text-tertiary font-semibold">LIVE CATEGORIES</h3>
          <button
            onClick={() => setShowManageCats(true)}
            className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-tertiary hover:text-white transition-colors"
            title="Manage categories"
          >
            <Gear size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border-subtle flex-shrink-0">
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-text-tertiary focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>

        {/* Category list */}
        <div ref={parentRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5" style={{ contain: 'strict' }}>
          <div style={{ height: categoryVirtualizer.getTotalSize(), position: 'relative' }}>
            {categoryVirtualizer.getVirtualItems().map((virtualRow) => {
              const isAll = virtualRow.index === 0;
              const cat = isAll ? null : displayedCategories[virtualRow.index - 1];
              if (!isAll && !cat) return null;
              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isAll ? (
                    <button
                      onClick={() => handleCategoryClick('All')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        activeGroup === 'All' && !debouncedCategorySearch
                          ? 'bg-white/10 text-white'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="text-base w-6 text-center flex-shrink-0">📺</span>
                      <span className="truncate flex-1">All Channels</span>
                      <span className="text-[10px] text-text-tertiary ml-2">
                        {categories.find((c) => c.group_title === 'All')?.count ?? channels.length}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCategoryClick(cat!.group_title)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        activeGroup === cat!.group_title
                          ? 'bg-white/10 text-white'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="text-base w-6 text-center flex-shrink-0">{getCategoryIcon(cat!.group_title)}</span>
                      <span className="truncate flex-1">{cat!.group_title}</span>
                      <span className="text-[10px] text-text-tertiary ml-2">{cat!.count}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Channel List (320px) ── */}
      <div className="w-[320px] flex-shrink-0 border-r border-border-subtle h-full flex flex-col bg-bg-base">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle flex-shrink-0 min-h-[44px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={handleHome}
              className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-tertiary hover:text-white transition-colors flex-shrink-0"
              title="All Channels"
            >
              <CaretLeft size={14} weight="bold" />
            </button>
            <span className="text-sm font-semibold truncate">
              {debouncedCategorySearch ? 'Search Results' : activeGroup === 'All' ? 'All Channels' : activeGroup}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-text-tertiary font-mono">{sortedChannels.length}</span>
            <button
              onClick={() => setSortChannelsBy((s) => (s === 'name' ? 'number' : 'name'))}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                sortChannelsBy === 'number'
                  ? 'bg-white/10 text-white'
                  : 'text-text-tertiary hover:text-white hover:bg-white/5'
              }`}
              title={`Sort by ${sortChannelsBy === 'name' ? 'number' : 'name'}`}
            >
              {sortChannelsBy === 'name' ? (
                <span className="text-[10px] font-bold tracking-wide">A-Z</span>
              ) : (
                <span className="text-[10px] font-bold">#</span>
              )}
            </button>
          </div>
        </div>

        {/* Channel list */}
        <div ref={channelParentRef} className="flex-1 overflow-y-auto" style={{ contain: 'strict' }}>
          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Television size={32} className="text-text-tertiary mb-3" />
              <p className="text-text-secondary text-sm mb-1">No playlists found</p>
              <p className="text-text-tertiary text-xs mb-4">Add one to start watching.</p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-add-playlist'))}
                className="px-4 py-2 bg-white text-black rounded-xl text-sm font-medium"
              >
                Add Playlist
              </button>
            </div>
          ) : loadingCat ? (
            <div className="flex items-center justify-center py-16">
              <ArrowClockwise size={20} className="text-text-tertiary animate-spin" />
            </div>
          ) : sortedChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Television size={28} className="text-text-tertiary mb-3" />
              <p className="text-text-secondary text-sm">No channels found</p>
            </div>
          ) : (
            <div style={{ height: channelVirtualizer.getTotalSize(), position: 'relative' }}>
              {channelVirtualizer.getVirtualItems().map((virtualRow) => {
                const ch = sortedChannels[virtualRow.index];
                if (!ch) return null;
                return (
                  <div
                    key={ch.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ChannelRow
                      ch={ch}
                      isActive={currentChannel?.id === ch.id}
                      showLogos={showLogos}
                      showNumbers={showNumbers}
                      epg={epgData[ch.tvg_id] || null}
                      onSelect={setCurrentChannel}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle flex-shrink-0">
          {playlists.length > 1 && (
            <select
              value={activePlaylistId || ''}
              onChange={(e) => handlePlaylistSwitch(e.target.value)}
              className="flex-1 bg-bg-elevated border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
            >
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showFavoritesOnly
                ? 'bg-state-error/10 text-state-error'
                : 'text-text-tertiary hover:text-white hover:bg-white/5'
            }`}
            title="Favorites"
          >
            <Heart size={14} weight={showFavoritesOnly ? 'fill' : 'regular'} />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center disabled:opacity-40"
            title="Refresh"
          >
            <ArrowClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-add-playlist'))}
            className="w-8 h-8 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center"
            title="Add Playlist"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* ── RIGHT: Player panel (1fr) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-black">
        {playlists.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-black text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-bg-elevated/30 flex items-center justify-center mb-5">
              <Television size={36} className="text-text-tertiary opacity-40" />
            </div>
            <h2 className="text-xl font-bold text-white/80 mb-2">No playlists found</h2>
            <p className="text-sm text-text-tertiary max-w-md">Add a playlist to start watching live TV.</p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-add-playlist'))}
              className="mt-6 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium"
            >
              Add Playlist
            </button>
          </div>
        ) : currentChannel ? (
          <div className="flex-1 flex flex-col">
            <div className="aspect-video w-full bg-black flex-shrink-0">
              <VideoPlayer />
            </div>
            <div className="flex-1 px-6 py-4 bg-bg-base overflow-y-auto">
              <h3 className="text-[11px] uppercase tracking-wider text-text-tertiary font-semibold mb-3">
                CURRENT PROGRAM
              </h3>
              {currentEpg?.now ? (
                <div>
                  <p className="text-sm font-medium text-white">{currentEpg.now.title}</p>
                  {currentEpg.now.description && (
                    <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{currentEpg.now.description}</p>
                  )}
                  <p className="text-xs text-text-tertiary mt-2">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                    , {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                  </p>
                  {currentEpg.next && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">Next</p>
                      <p className="text-xs text-text-secondary">{currentEpg.next.title}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-text-tertiary">No program information available</p>
                  <p className="text-xs text-text-tertiary mt-2">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-black text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-bg-elevated/30 flex items-center justify-center mb-5">
              <Television size={36} className="text-text-tertiary opacity-40" />
            </div>
            <h2 className="text-xl font-bold text-white/80 mb-2">Select a channel to start watching</h2>
            <p className="text-sm text-text-tertiary max-w-md">
              Please select a channel to start playback
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTV;
