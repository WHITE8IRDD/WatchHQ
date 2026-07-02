import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, Clock, Film, ListVideo, ChevronLeft, ChevronRight, Tv, Info, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { WatchHistoryEntry, Playlist, VodItem, SeriesItem } from '@/types/electron';

function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

function formatProgress(entry: WatchHistoryEntry): string {
  const pos = entry.position_seconds || 0;
  const dur = entry.duration_seconds || 0;
  if (dur === 0) return 'Started';
  const pct = Math.round((pos / dur) * 100);
  return `${pct}% complete • ${formatTime(pos)} / ${formatTime(dur)}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const Dashboard: React.FC = () => {
  const [heroItem, setHeroItem] = useState<WatchHistoryEntry | null>(null);
  const [recentlyWatched, setRecentlyWatched] = useState<WatchHistoryEntry[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const recentRef = useRef<HTMLDivElement>(null);
  const playlistRef = useRef<HTMLDivElement>(null);
  const addedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [history, pl] = await Promise.all([
          withTimeout(window.electronAPI.getRecentHistory(20)),
          withTimeout(window.electronAPI.getPlaylists()),
        ]);
        setRecentlyWatched(history || []);
        setHeroItem(history?.[0] || null);
        setPlaylists(pl || []);
        if (pl && pl.length > 0) {
          const id = pl[0].id;
          try {
            const [vod, series] = await Promise.all([
              withTimeout(window.electronAPI.getVod(id)),
              withTimeout(window.electronAPI.getSeries(id)),
            ]);
            const combined = [
              ...(vod || []).map((v: VodItem) => ({ ...v, _type: 'vod' })),
              ...(series || []).map((s: SeriesItem) => ({ ...s, _type: 'series', icon: s.cover })),
            ];
            setRecentlyAdded(combined.slice(0, 20));
          } catch { setRecentlyAdded([]); }
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: number) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 400, behavior: 'smooth' });
  };

  const handleRefreshPlaylist = async (id: string) => {
    try {
      const result = await window.electronAPI.refreshPlaylist(id);
      if (result.success) {
        toast.success('Playlist refreshed successfully');
        const updated = await window.electronAPI.getPlaylists();
        setPlaylists(updated || []);
      } else {
        toast.error(result.error || 'Failed to refresh playlist');
      }
    } catch { toast.error('Failed to refresh playlist'); }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      const result = await window.electronAPI.deletePlaylist(id);
      if (result.success) {
        toast.success('Playlist removed');
        const updated = await window.electronAPI.getPlaylists();
        setPlaylists(updated || []);
      } else {
        toast.error(result.error || 'Failed to remove playlist');
      }
    } catch { toast.error('Failed to remove playlist'); }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 pt-10 max-w-7xl mx-auto space-y-8">
      {/* Hero Banner */}
      {heroItem ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          className="relative rounded-2xl overflow-hidden h-[60vh] max-h-[720px] flex items-end">
          {heroItem.icon && (
            <div className="absolute inset-0">
              <img src={heroItem.icon} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative z-10 p-8 md:p-12 w-full">
            <span className="inline-block bg-gold/10 text-gold text-xs uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full mb-4">
              Continue Watching
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-2">
              {heroItem.title || 'Unknown'}
            </h1>
            <p className="text-text-secondary text-sm mb-4">
              {heroItem.item_type} · {formatProgress(heroItem)}
            </p>
            <div className="flex items-center gap-3">
              <Link
                to={heroItem.item_type === 'channel' ? '/live' : '/movies'}
                className="flex items-center gap-2 bg-white text-black rounded-xl px-5 py-2.5 font-medium hover:bg-white/90 transition-colors"
              >
                <Play size={16} /> Continue Watching
              </Link>
              <Link
                to={heroItem.item_type === 'channel' ? '/live' : '/movies'}
                className="flex items-center gap-2 border border-border rounded-xl px-4 py-2.5 text-text-secondary hover:text-white hover:border-white/30 transition-colors"
              >
                <Info size={16} /> Info
              </Link>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          className="relative rounded-2xl overflow-hidden h-[60vh] max-h-[720px] flex items-center justify-center bg-gradient-to-b from-bg-elevated to-bg-base border border-border-subtle">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">Welcome to WatchHQ</h1>
            <p className="text-text-secondary text-sm mb-6">Add your first playlist to get started</p>
            <Link
              to="/playlists"
              className="inline-flex items-center gap-2 bg-white text-black rounded-xl px-5 py-2.5 font-medium hover:bg-white/90 transition-colors"
            >
              <ListVideo size={16} /> Add Playlist
            </Link>
          </div>
        </motion.div>
      )}

      {/* Recently Watched */}
      {recentlyWatched.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-text-tertiary" />
              <h2 className="font-display font-semibold text-sm">Recently Watched</h2>
              <span className="text-[11px] text-text-tertiary bg-bg-elevated px-1.5 py-0.5 rounded-md">{recentlyWatched.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/favorites" className="text-xs text-text-tertiary hover:text-white transition-colors">Manage all →</Link>
              <button onClick={() => scroll(recentRef, -1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => scroll(recentRef, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div ref={recentRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyWatched.map((item) => (
              <Link
                key={item.id || `${item.item_type}-${item.item_id}`}
                to={item.item_type === 'channel' ? '/live' : '/movies'}
                className="flex-shrink-0 w-[160px] group/card"
              >
                <div className="aspect-video bg-bg-elevated border border-border rounded-xl overflow-hidden flex items-center justify-center group-hover/card:-translate-y-1 transition-all duration-200 group-hover/card:shadow-lg">
                  {item.icon ? (
                    <img src={item.icon} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Tv size={24} className="text-text-tertiary" />
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium truncate">{item.title || 'Unknown'}</p>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    {item.last_watched ? new Date(item.last_watched * 1000).toLocaleDateString() : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recently Used Sources */}
      {playlists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListVideo size={18} className="text-text-tertiary" />
              <h2 className="font-display font-semibold text-sm">Recently Used Sources</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scroll(playlistRef, -1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => scroll(playlistRef, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div ref={playlistRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="flex-shrink-0 w-[220px] bg-bg-elevated border border-border rounded-xl p-4 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-state-success flex-shrink-0" />
                    <span className="text-sm font-medium truncate text-white">{pl.name}</span>
                  </div>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/5 transition-colors flex-shrink-0">
                        ⋮
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-[160px] bg-bg-elevated border border-border rounded-xl p-1 shadow-xl z-50"
                        sideOffset={4}
                        align="end"
                      >
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 rounded-lg cursor-pointer outline-none transition-colors"
                          onClick={() => handleRefreshPlaylist(pl.id)}
                        >
                          <RefreshCw size={14} /> Refresh
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 rounded-lg cursor-pointer outline-none transition-colors"
                          onClick={() => toast.info(`${pl.name} · ${pl.type.toUpperCase()} · ${pl.channel_count} channels · ${pl.vod_count} VOD`)}
                        >
                          <Info size={14} /> Info
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="h-px bg-border my-1" />
                        <DropdownMenu.Item
                          className="flex items-center gap-2 px-3 py-2 text-sm text-state-error hover:text-state-error hover:bg-state-error/5 rounded-lg cursor-pointer outline-none transition-colors"
                          onClick={() => setDeleteTarget(pl.id)}
                        >
                          <Trash2 size={14} /> Remove
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    pl.type === 'm3u' ? 'bg-blue-500/20 text-blue-400' :
                    pl.type === 'xtream' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>{pl.type.toUpperCase()}</span>
                  <span className="text-[11px] text-text-tertiary">{pl.channel_count || 0} channels</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film size={18} className="text-text-tertiary" />
              <h2 className="font-display font-semibold text-sm">Recently Added</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scroll(addedRef, -1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => scroll(addedRef, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div ref={addedRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyAdded.map((item: any, i: number) => (
              <Link
                key={item.id || item.stream_id || i}
                to="/movies"
                className="flex-shrink-0 w-[140px] group/card"
              >
                <div className="aspect-[2/3] bg-bg-elevated border border-border rounded-xl overflow-hidden flex items-center justify-center group-hover/card:-translate-y-1 transition-all duration-200 group-hover/card:shadow-lg">
                  {item.icon || item.cover ? (
                    <img src={item.icon || item.cover} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Film size={24} className="text-text-tertiary" />
                  )}
                </div>
                <p className="text-xs font-medium mt-1.5 truncate text-text-secondary group-hover/card:text-white transition-colors">{item.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove Playlist"
          message="Are you sure you want to remove this playlist? This action cannot be undone."
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => handleDeletePlaylist(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
