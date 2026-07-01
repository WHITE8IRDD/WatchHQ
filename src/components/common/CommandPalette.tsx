import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePlaylistStore } from '../../store/playlistStore';
import ChannelLogo from './ChannelLogo';

interface ResultItem {
  type: 'channel' | 'movie' | 'series';
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
  playlist_id: string;
}

const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const playlists = await window.electronAPI.getPlaylists();
      const all: ResultItem[] = [];
      for (const pl of playlists) {
        const chs = await window.electronAPI.searchChannels({ playlistId: pl.id, query: q });
        for (const ch of chs.slice(0, 5)) all.push({ type: 'channel', id: ch.id, title: ch.tvg_name, subtitle: ch.group_title, icon: ch.tvg_logo, playlist_id: pl.id });
        const vods = await window.electronAPI.searchVod({ playlistId: pl.id, query: q });
        for (const v of vods.slice(0, 3)) all.push({ type: 'movie', id: v.id, title: v.name, subtitle: v.category_name, icon: v.icon, playlist_id: pl.id });
      }
      setResults(all);
      setSelectedIdx(0);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  const select = async (item: ResultItem) => {
    onClose();
    if (item.type === 'channel') {
      usePlaylistStore.getState().setActivePlaylist(item.playlist_id);
      await usePlaylistStore.getState().loadChannels(item.playlist_id);
      const ch = usePlaylistStore.getState().channels.find(c => c.id === item.id);
      if (ch) usePlaylistStore.getState().setCurrentChannel(ch);
      navigate('/live');
    } else if (item.type === 'movie') {
      navigate('/movies');
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) { select(results[selectedIdx]); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: -20 }}
            className="w-full max-w-lg bg-bg-primary border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/5">
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
                placeholder="Search channels, movies, series..."
                className="w-full bg-transparent text-white text-base placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {loading && <p className="text-center text-text-tertiary py-6 text-sm">Searching...</p>}
              {!loading && results.length === 0 && query && (
                <p className="text-center text-text-tertiary py-6 text-sm">No results</p>
              )}
              {results.map((item, i) => (
                <button key={item.id + item.type} onClick={() => select(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === selectedIdx ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-bg-elevated">
                    <ChannelLogo name={item.title} logo={item.icon} size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-text-tertiary">{item.subtitle}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    item.type === 'channel' ? 'bg-state-error/10 text-state-error' :
                    item.type === 'movie' ? 'bg-accent-blue/10 text-accent-blue' :
                    'bg-accent-green/10 text-accent-green'
                  }`}>{item.type}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/5 text-[11px] text-text-tertiary">
              <span><kbd className="px-1 py-0.5 bg-bg-elevated rounded text-[10px]">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-bg-elevated rounded text-[10px]">↵</kbd> select</span>
              <span><kbd className="px-1 py-0.5 bg-bg-elevated rounded text-[10px]">Esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
