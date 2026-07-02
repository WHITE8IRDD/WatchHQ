import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Film, Star, Heart, Play, X } from 'lucide-react';
import { ArrowClockwise } from '@phosphor-icons/react';
import SearchInput from '../components/common/SearchInput';
import VirtualGrid from '../components/common/VirtualGrid';
import CategoryChips from '../components/common/CategoryChips';
import EmptyState from '../components/common/EmptyState';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from '../components/common/Toast';
import type { VodItem } from '@/types/electron';

function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

const Movies: React.FC = () => {
  const [items, setItems] = useState<VodItem[]>([]);
  const [filtered, setFiltered] = useState<VodItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState<VodItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'year' | 'rating'>('name');

  const debouncedSearch = useDebounce(search, 300);

  const loadMovies = async () => {
    setLoading(true);
    try {
      const playlists = await withTimeout(window.electronAPI.getPlaylists());
      if (playlists.length === 0) {
        setLoading(false);
        return;
      }
      const vod = await withTimeout(window.electronAPI.getVod(playlists[0].id));
      setItems(vod);
      setFiltered(vod);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovies();
  }, []);

  const applyFilters = useCallback(async () => {
    const playlists = await window.electronAPI.getPlaylists();
    if (playlists.length === 0) return;
    const pid = playlists[0].id;

    const needsSearch = debouncedSearch || activeCategory !== 'All';
    let list: VodItem[];

    if (needsSearch) {
      const result = await window.electronAPI.searchVod({
        playlistId: pid,
        query: debouncedSearch || '',
        category: activeCategory !== 'All' ? activeCategory : undefined,
      });
      list = result || [];
    } else {
      list = [...items];
    }

    if (showFavoritesOnly) {
      list = list.filter((i) => i.is_favorite);
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'year':
          return (b.year || 0) - (a.year || 0);
        case 'rating':
          return (b.rating_5based || 0) - (a.rating_5based || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFiltered(list);
  }, [debouncedSearch, activeCategory, showFavoritesOnly, sortBy, items]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const playlists = await window.electronAPI.getPlaylists();
      const xtreamPlaylist = playlists.find((p: any) => p.type === 'xtream');
      if (!xtreamPlaylist) {
        toast.error('No Xtream playlist found. Add one first.');
        return;
      }
      const cfg = {
        host: xtreamPlaylist.url,
        username: xtreamPlaylist.username,
        password: xtreamPlaylist.password,
      };
      const result = await window.electronAPI.syncVod({
        playlistId: xtreamPlaylist.id,
        cfg,
      });
      if (result.success) {
        toast.success(`Synced ${result.count} movies`);
        await loadMovies();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } finally {
      setSyncing(false);
    }
  };

  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    for (const item of items) {
      counts[item.category_name] = (counts[item.category_name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name === 'All' ? -1 : a.name.localeCompare(b.name)));
  }, [items]);

  const toggleFavorite = async (item: VodItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await window.electronAPI.toggleVodFavorite(item.id);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_favorite: result.isFavorite ? 1 : 0 } : i,
        ),
      );
      toast.success(result.isFavorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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

  return (
    <div className="flex flex-col h-full py-4 px-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap flex-shrink-0">
        <h1 className="text-2xl font-display font-bold tracking-tight mr-2">Movies</h1>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search movies..."
          className="flex-1 max-w-xs"
        />

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
            showFavoritesOnly
              ? 'border-state-error/30 bg-state-error/10 text-state-error'
              : 'border-border text-text-secondary hover:text-white hover:bg-white/5'
          }`}
        >
          <Heart size={16} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="name">Name</option>
          <option value="year">Year</option>
          <option value="rating">Rating</option>
        </select>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-50"
        >
          <ArrowClockwise size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Library'}
        </button>
      </div>

      <div className="mb-4 flex-shrink-0">
        <CategoryChips categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />
      </div>

      <p className="text-xs text-text-tertiary mb-4 flex-shrink-0">
        {filtered.length} movie{filtered.length !== 1 ? 's' : ''}
      </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Film}
            title={items.length === 0 ? 'No movies yet' : 'No movies found'}
            description={
              items.length === 0
                ? 'Sync your Xtream playlist to load movies.'
                : 'Try a different search or category.'
            }
            action={items.length === 0 ? { label: 'Sync Library', onClick: handleSync } : undefined}
          />
        ) : (
          <div className="flex-1 min-h-0 pb-8 -mx-6 px-6">
            <VirtualGrid
              items={filtered}
              itemHeight={340}
              minItemWidth={160}
              renderItem={(item) => (
                <div onClick={() => setSelected(item)} className="group cursor-pointer">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle group-hover:border-white/20 transition-all duration-200 group-hover:-translate-y-1 relative">
                    {item.icon ? (
                      <img src={item.icon} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                        <Film size={28} />
                      </div>
                    )}

                    <button
                      onClick={(e) => toggleFavorite(item, e)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Heart
                        size={14}
                        className={item.is_favorite ? 'text-state-error fill-state-error' : 'text-white'}
                      />
                    </button>

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Play
                        size={36}
                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                        fill="currentColor"
                      />
                    </div>

                    {item.rating && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
                        <Star size={10} className="text-gold fill-gold" />
                        <span className="text-[10px] text-white font-medium">{item.rating}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm mt-2 truncate font-medium">{item.name}</p>
                  {item.year && <p className="text-xs text-text-tertiary">{item.year}</p>}
                </div>
              )}
            />
          </div>
        )}
        {selected && <MovieDetailModal movie={selected} onClose={() => setSelected(null)} />}
      </div>
    );
};

const MovieDetailModal: React.FC<{ movie: VodItem; onClose: () => void }> = ({
  movie,
  onClose,
}) => {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={() => setPlaying(false)}>
        <button
          className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white"
          onClick={() => setPlaying(false)}
        >
          <X size={24} />
        </button>
        <video
          src={movie.url}
          controls
          autoPlay
          className="w-full h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full bg-bg-elevated border border-border-subtle rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-6 p-6">
          {movie.icon && (
            <img
              src={movie.icon}
              alt={movie.name}
              className="w-40 rounded-xl border border-border-subtle flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold mb-2">{movie.name}</h2>

            <div className="flex items-center gap-3 flex-wrap mb-4">
              {movie.year && (
                <span className="text-sm text-text-secondary">{movie.year}</span>
              )}
              {movie.rating && (
                <span className="flex items-center gap-1 text-sm">
                  <Star size={14} className="text-gold fill-gold" />
                  {movie.rating}
                </span>
              )}
              {movie.duration && (
                <span className="text-sm text-text-secondary">{movie.duration}</span>
              )}
              {movie.genre && (
                <span className="text-sm text-text-secondary">{movie.genre}</span>
              )}
            </div>

            {movie.plot && (
              <p className="text-text-secondary text-sm leading-relaxed mb-4">{movie.plot}</p>
            )}

            {movie.director && (
              <p className="text-sm">
                <span className="text-text-secondary">Director:</span>{' '}
                <span className="text-white">{movie.director}</span>
              </p>
            )}
            {movie.cast_members && (
              <p className="text-sm mt-1">
                <span className="text-text-secondary">Cast:</span>{' '}
                <span className="text-white">{movie.cast_members}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => setPlaying(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl font-medium hover:bg-accent-hover transition-all"
          >
            <Play size={18} /> Play
          </button>
          <button
            onClick={async () => {
              try {
                const result = await window.electronAPI.launchMPV(movie.url);
                if (!result.success) toast.error(result.error || 'Failed to launch MPV');
              } catch (error: any) {
                toast.error(error.message);
              }
            }}
            className="px-4 py-3 border border-border-subtle rounded-xl text-white hover:bg-white/5 transition-colors"
          >
            MPV
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 border border-border-subtle rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Movies;
