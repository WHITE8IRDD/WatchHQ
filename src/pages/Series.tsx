// src/pages/Series.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Clapperboard,
  ChevronLeft,
  Play,
  Heart,
  Star,
  X,
  Check,
} from 'lucide-react';
import { ArrowClockwise } from '@phosphor-icons/react';
import SearchInput from '../components/common/SearchInput';
import VirtualGrid from '../components/common/VirtualGrid';
import CategorySidebar from '../components/common/CategorySidebar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from '../components/common/Toast';

interface SeriesItem {
  id: string;
  playlist_id: string;
  series_id: string;
  name: string;
  cover: string;
  category_name: string;
  plot: string;
  genre: string;
  rating: string;
  rating_5based: number;
  year: number;
  season_count: number;
  episode_count: number;
  is_favorite: number;
}

interface Episode {
  id: string;
  season: number;
  episode_num: number;
  title: string;
  url: string;
  plot: string;
  duration: string;
  is_watched: number;
}

const Series: React.FC = () => {
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState<SeriesItem | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [playing, setPlaying] = useState<Episode | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [xtreamCfg, setXtreamCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [seriesInfo, setSeriesInfo] = useState<any>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    setLoading(true);
    try {
      const playlists = await window.electronAPI.getPlaylists();
      if (playlists.length === 0) return;

      const xtreamPlaylist = playlists.find((p: any) => p.type === 'xtream');
      if (xtreamPlaylist) {
        setXtreamCfg({
          host: xtreamPlaylist.url,
          username: xtreamPlaylist.username,
          password: xtreamPlaylist.password,
        });
      }

      const list = await window.electronAPI.getSeries(playlists[0].id);
      setSeries(list);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!xtreamCfg) {
      toast.error('No Xtream playlist found.');
      return;
    }
    setSyncing(true);
    try {
      const playlists = await window.electronAPI.getPlaylists();
      const xtreamPlaylist = playlists.find((p: any) => p.type === 'xtream');
      if (!xtreamPlaylist) return;

      const result = await window.electronAPI.syncSeries({
        playlistId: xtreamPlaylist.id,
        cfg: xtreamCfg,
      });
      if (result.success) {
        toast.success(`Synced ${result.count} series`);
        await loadSeries();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } finally {
      setSyncing(false);
    }
  };

  const openSeries = async (s: SeriesItem) => {
    setSelected(s);
    setLoadingEpisodes(true);
    setActiveSeason(1);
    try {
      if (xtreamCfg) {
        const result = await window.electronAPI.getSeriesEpisodes({
          seriesDbId: s.id,
          seriesId: s.series_id,
          cfg: xtreamCfg,
        });
        if (result.success && result.episodes) {
          setEpisodes(result.episodes);
          setSeriesInfo(result.info);
          const seasons = [...new Set(result.episodes.map((e: Episode) => e.season))].sort(
            (a, b) => a - b,
          );
          if (seasons.length > 0) setActiveSeason(seasons[0]);
        }
      }
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const [filtered, setFiltered] = useState<SeriesItem[]>([]);

  const doSearch = useCallback(async () => {
    const playlists = await window.electronAPI.getPlaylists();
    if (playlists.length === 0) return;
    const pid = playlists[0].id;
    if (debouncedSearch || activeCategory !== 'All') {
      const result = await window.electronAPI.searchSeries({
        playlistId: pid,
        query: debouncedSearch || '',
        category: activeCategory !== 'All' ? activeCategory : undefined,
      });
      setFiltered(result || []);
    } else {
      setFiltered(series);
    }
  }, [debouncedSearch, activeCategory, series]);

  useEffect(() => { doSearch(); }, [doSearch]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: series.length };
    for (const s of series) {
      counts[s.category_name] = (counts[s.category_name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name === 'All' ? -1 : a.name.localeCompare(b.name)));
  }, [series]);

  const seasons = useMemo(
    () => [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b),
    [episodes],
  );

  const seasonEpisodes = useMemo(
    () =>
      episodes
        .filter((e) => e.season === activeSeason)
        .sort((a, b) => a.episode_num - b.episode_num),
    [episodes, activeSeason],
  );

  if (loading) {
    return (
      <div className="w-full p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="p-8 pt-8 overflow-y-auto h-full">
        <button
          onClick={() => {
            setSelected(null);
            setEpisodes([]);
            setSeriesInfo(null);
          }}
          className="flex items-center gap-2 text-textSecondary hover:text-white mb-6 transition-colors"
        >
          <ChevronLeft size={18} /> Back
        </button>

        <div className="flex gap-6 mb-8">
          {selected.cover && (
            <img
              src={selected.cover}
              alt={selected.name}
              className="w-44 rounded-xl border border-white/5 shadow-lg"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold mb-2">{selected.name}</h1>

            <div className="flex items-center gap-3 flex-wrap mb-4">
              {selected.year && (
                <span className="text-sm text-text-secondary">{selected.year}</span>
              )}
              {selected.rating && (
                <span className="flex items-center gap-1 text-sm">
                  <Star size={14} className="text-gold fill-gold" />
                  {selected.rating}
                </span>
              )}
              {selected.season_count > 0 && (
                <span className="text-sm text-text-secondary">
                  {selected.season_count} Season{selected.season_count !== 1 ? 's' : ''}
                </span>
              )}
              {selected.episode_count > 0 && (
                <span className="text-sm text-text-secondary">
                  {selected.episode_count} Episode{selected.episode_count !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-sm text-text-secondary">{selected.category_name}</span>
            </div>

            {(selected.plot || seriesInfo?.plot) && (
              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                {selected.plot || seriesInfo?.plot}
              </p>
            )}

            {selected.genre && (
              <div className="flex gap-2 flex-wrap">
                {selected.genre.split(',').map((g) => (
                  <span
                    key={g}
                    className="text-xs px-2 py-1 bg-bg-elevated border border-border-subtle rounded-full text-text-secondary"
                  >
                    {g.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {loadingEpisodes ? (
          <LoadingSpinner size="md" message="Loading episodes..." className="py-10" />
        ) : (
          <>
            {seasons.length > 1 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {seasons.map((season) => (
                  <button
                    key={season}
                    onClick={() => setActiveSeason(season)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      activeSeason === season
                        ? 'bg-white text-black'
                        : 'bg-bg-elevated border border-border-subtle text-text-secondary hover:text-white'
                    }`}
                  >
                    Season {season}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {seasonEpisodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => setPlaying(ep)}
                  className="flex items-center gap-4 bg-bg-elevated border border-border-subtle rounded-xl p-4 cursor-pointer hover:bg-white/[0.04] hover:border-white/10 transition-all duration-150 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    {ep.is_watched ? (
                      <Check size={16} className="text-state-success" />
                    ) : (
                      <Play size={16} className="text-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      <span className="text-text-secondary mr-2">E{ep.episode_num}</span>
                      {ep.title}
                    </p>
                    {ep.plot && (
                      <p className="text-xs text-text-secondary/70 truncate mt-0.5">{ep.plot}</p>
                    )}
                  </div>

                  {ep.duration && (
                    <span className="text-xs text-text-secondary flex-shrink-0">{ep.duration}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {playing && (
          <div
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setPlaying(null)}
          >
            <button
              className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white"
              onClick={() => setPlaying(null)}
            >
              <X size={24} />
            </button>
            <video
              src={playing.url}
              controls
              autoPlay
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <CategorySidebar
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
      />

      <div className="flex-1 py-4 px-6 min-w-0 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h1 className="text-2xl font-display font-bold tracking-tight mr-4">Series</h1>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search series..."
            className="flex-1 max-w-xs"
          />

          <div className="flex-1" />

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-50"
          >
            <ArrowClockwise size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Library'}
          </button>
        </div>

        <p className="text-xs text-text-tertiary mb-4">
          {filtered.length} series
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title={series.length === 0 ? 'No series yet' : 'No series found'}
            description={
              series.length === 0
                ? 'Sync your Xtream playlist to load series.'
                : 'Try a different search or category.'
            }
            action={
              series.length === 0 ? { label: 'Sync Library', onClick: handleSync } : undefined
            }
          />
        ) : (
          <div className="flex-1 min-h-0 pb-8 -mx-6 px-6">
            <VirtualGrid
              items={filtered}
              itemHeight={340}
              minItemWidth={160}
              renderItem={(s) => (
                <div onClick={() => openSeries(s)} className="group cursor-pointer">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle group-hover:border-white/20 transition-all duration-200 group-hover:-translate-y-1 relative">
                    {s.cover ? (
                      <img src={s.cover} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                        <Clapperboard size={28} />
                      </div>
                    )}

                    {s.rating && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
                        <Star size={10} className="text-gold fill-gold" />
                        <span className="text-[10px] text-white font-medium">{s.rating}</span>
                      </div>
                    )}

                    {s.is_favorite === 1 && (
                      <Heart size={14} className="absolute top-2 right-2 text-state-error fill-state-error drop-shadow" />
                    )}
                  </div>

                  <p className="text-sm mt-2 truncate font-medium">{s.name}</p>
                  {s.season_count > 0 && (
                    <p className="text-xs text-text-tertiary">{s.season_count}S · {s.episode_count}E</p>
                  )}
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Series;
