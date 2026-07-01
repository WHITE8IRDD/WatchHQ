import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import ChannelLogo from './ChannelLogo';
import { usePlaylistStore } from '../../store/playlistStore';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  type: 'channel' | 'movie' | 'series';
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
  poster?: string;
  playlist_id: string;
}

type Filter = 'all' | 'channel' | 'movie' | 'series';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'channel', label: 'Channels' },
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'Series' },
];

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setFilter('all');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const playlists = await window.electronAPI.getPlaylists();
      if (!playlists?.length) { setResults([]); setLoading(false); return; }
      const all: SearchResult[] = [];
      for (const pl of playlists) {
        const [channels, movies, series] = await Promise.all([
          window.electronAPI.searchChannels({ playlistId: pl.id, query: q }),
          window.electronAPI.searchVod({ playlistId: pl.id, query: q }),
          window.electronAPI.searchSeries({ playlistId: pl.id, query: q }),
        ]);
        for (const ch of (channels || []).slice(0, 8))
          all.push({ type: 'channel', id: ch.id, title: ch.tvg_name || ch.name || '', subtitle: ch.group_title || '', icon: ch.tvg_logo || '', playlist_id: pl.id });
        for (const v of (movies || []).slice(0, 8))
          all.push({ type: 'movie', id: v.id, title: v.name || '', subtitle: v.category_name || '', icon: v.icon || v.poster || '', poster: v.poster || v.icon || '', playlist_id: pl.id });
        for (const s of (series || []).slice(0, 8))
          all.push({ type: 'series', id: s.id, title: s.name || '', subtitle: s.category_name || '', icon: s.cover || s.poster || '', poster: s.cover || s.poster || '', playlist_id: pl.id });
      }
      setResults(all);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  const filtered = filter === 'all' ? results : results.filter(r => r.type === filter);

  const grouped = filtered.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.type === 'channel' ? 'Channels' : r.type === 'movie' ? 'Movies' : 'Series';
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {});

  const flat: { type: 'header' | 'item'; key: string; label?: string; item?: SearchResult; count?: number }[] = [];
  for (const [group, items] of Object.entries(grouped)) {
    flat.push({ type: 'header', key: `header-${group}`, label: group, count: items.length });
    for (const item of items) {
      flat.push({ type: 'item', key: `${item.type}-${item.id}`, item });
    }
  }

  const totalItems = flat.filter(e => e.type === 'item').length;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => (i + 1) % Math.max(totalItems, 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => (i - 1 + totalItems) % Math.max(totalItems, 1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const itemEntries = flat.filter(e => e.type === 'item');
      const entry = itemEntries[selectedIdx];
      if (entry?.item) select(entry.item);
    }
  };

  useEffect(() => {
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll<HTMLButtonElement>('[data-result-idx]');
    items[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const select = (item: SearchResult) => {
    onClose();
    if (item.type === 'channel') {
      const setCurrentChannel = usePlaylistStore.getState().setCurrentChannel;
      setCurrentChannel(item as any);
      navigate('/live');
    } else if (item.type === 'movie') {
      navigate(`/playlist/${item.playlist_id}/vod/${item.id}`);
    } else if (item.type === 'series') {
      navigate(`/playlist/${item.playlist_id}/series/${item.id}`);
    }
  };

  const itemIdxRef = useRef(0);
  itemIdxRef.current = 0;

  const getTypeBadge = (type: SearchResult['type']) => {
    const styles: Record<string, string> = {
      channel: 'bg-state-error/10 text-state-error',
      movie: 'bg-accent-blue/10 text-accent-blue',
      series: 'bg-accent-green/10 text-accent-green',
    };
    const labels: Record<string, string> = {
      channel: 'Live',
      movie: 'Movie',
      series: 'Series',
    };
    return (
      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${styles[type] || ''}`}>
        {labels[type] || type}
      </span>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg bg-bg-elevated border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <Search className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search across channels, movies, and series…"
                className="w-full bg-transparent text-white text-base placeholder:text-text-tertiary focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-text-tertiary" />
                </button>
              )}
              <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 bg-white/5 rounded ml-1">ESC</span>
            </div>

            <div className="flex gap-1.5 px-4 py-2.5 border-b border-white/5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setSelectedIdx(0); }}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    filter === f.key
                      ? 'bg-white text-black'
                      : 'bg-transparent text-text-tertiary hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto" onKeyDown={handleKey}>
              {loading && (
                <p className="text-center text-text-tertiary py-8 text-sm">Searching...</p>
              )}
              {!loading && !query && filtered.length === 0 && (
                <p className="text-center text-text-tertiary py-8 text-sm">Start typing to search</p>
              )}
              {!loading && query && filtered.length === 0 && (
                <p className="text-center text-text-tertiary py-8 text-sm">No results</p>
              )}
              {!loading && flat.map(entry => {
                if (entry.type === 'header') {
                  return (
                    <div key={entry.key} className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {entry.label} · {entry.count}
                    </div>
                  );
                }
                const item = entry.item!;
                const idx = itemIdxRef.current++;
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={entry.key}
                    data-result-idx={idx}
                    onClick={() => select(item)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
                      {item.icon ? (
                        <img src={item.icon} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <ChannelLogo name={item.title} logo={item.icon} size={32} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.title || 'Untitled'}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-text-tertiary truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {getTypeBadge(item.type)}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/5 text-[11px] text-text-tertiary">
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px]">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px]">↵</kbd> select</span>
              <span className="ml-auto"><kbd className="px-1 py-0.5 bg-white/5 rounded text-[10px]">Esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
