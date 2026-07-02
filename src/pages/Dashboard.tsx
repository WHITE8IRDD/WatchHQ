import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Clock, Film, ListVideo, ChevronLeft, ChevronRight, Tv, Info, RefreshCw, Trash2, Clapperboard, Heart } from 'lucide-react';
import { toast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

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
  return `${pct}% · ${formatTime(pos)} / ${formatTime(dur)}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const Dashboard: React.FC = () => {
  const [recentlyWatched, setRecentlyWatched] = useState<WatchHistoryEntry[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
  const [vodCount, setVodCount] = useState(0);
  const [seriesCount, setSeriesCount] = useState(0);
  const [totalChannels, setTotalChannels] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const recentRef = useRef<HTMLDivElement>(null);
  const addedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [history, pl] = await Promise.all([
          withTimeout(window.electronAPI.getRecentHistory(20)),
          withTimeout(window.electronAPI.getPlaylists()),
        ]);
        setRecentlyWatched(history || []);
        setPlaylists(pl || []);
        if (pl && pl.length > 0) {
          const id = pl[0].id;
          setTotalChannels(pl.reduce((sum: number, p: any) => sum + (p.channel_count || 0), 0));
          try {
            const [vod, series] = await Promise.all([
              withTimeout(window.electronAPI.getVod(id)),
              withTimeout(window.electronAPI.getSeries(id)),
            ]);
            setVodCount(vod?.length || 0);
            setSeriesCount(series?.length || 0);
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

  const hasAnySource = playlists.length > 0;

  if (!hasAnySource) {
    return (
      <div className="flex items-center justify-center h-[80vh] px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent/20">
            <span className="text-black font-bold text-2xl font-display">W</span>
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">Welcome to WatchHQ</h1>
          <p className="text-text-secondary text-sm mb-8 max-w-sm mx-auto">
            Add your first IPTV playlist to start browsing channels, movies, and series.
          </p>
          <Link
            to="/playlists"
            className="inline-flex items-center gap-2 bg-white text-black rounded-xl px-6 py-3 font-medium hover:bg-white/90 transition-colors"
          >
            <Plus size={16} /> Add Your First Source
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 max-w-[1400px] mx-auto space-y-8">
      {/* Status strip */}
      <div className="flex items-center gap-6 flex-wrap">
        {[
          { label: 'Channels', value: totalChannels.toLocaleString(), icon: Tv },
          { label: 'Movies', value: vodCount.toLocaleString(), icon: Film },
          { label: 'Series', value: seriesCount.toLocaleString(), icon: Clapperboard },
          { label: 'Sources', value: playlists.length.toLocaleString(), icon: ListVideo },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <stat.icon size={16} className="text-accent" />
            </div>
            <div>
              <p className="text-lg font-display font-bold tracking-tight bg-gradient-to-r from-accent to-emerald-300 bg-clip-text text-transparent">{stat.value}</p>
              <p className="text-[11px] text-text-tertiary leading-tight">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick-jump banner tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { to: '/live', icon: Tv, label: 'Live TV', desc: `${totalChannels.toLocaleString()} channels`, gradient: 'from-blue-500/20 to-blue-600/5' },
          { to: '/movies', icon: Film, label: 'Movies', desc: `${vodCount.toLocaleString()} titles`, gradient: 'from-purple-500/20 to-purple-600/5' },
          { to: '/series', icon: Clapperboard, label: 'Series', desc: `${seriesCount.toLocaleString()} series`, gradient: 'from-amber-500/20 to-amber-600/5' },
          { to: '/favorites', icon: Heart, label: 'Favorites', desc: 'Your saved content', gradient: 'from-rose-500/20 to-rose-600/5' },
        ].map((tile) => (
          <Link key={tile.to} to={tile.to} className="card-depth-hover group p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tile.gradient} flex items-center justify-center mb-3`}>
              <tile.icon size={20} className="text-white" />
            </div>
            <p className="text-base font-semibold">{tile.label}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{tile.desc}</p>
          </Link>
        ))}
      </div>

      {/* Continue Watching rail */}
      {recentlyWatched.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-accent" />
              <h2 className="font-display font-semibold text-sm text-white">Continue Watching</h2>
              <span className="text-[11px] text-text-tertiary bg-white/5 px-1.5 py-0.5 rounded-md">{recentlyWatched.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scroll(recentRef, -1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => scroll(recentRef, 1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div ref={recentRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyWatched.map((item) => (
              <Link
                key={item.id || `${item.item_type}-${item.item_id}`}
                to={item.item_type === 'channel' ? '/live' : item.item_type === 'vod' ? '/movies' : '/series'}
                className="flex-shrink-0 w-[180px] group/card"
              >
                <div className="aspect-video card-depth overflow-hidden flex items-center justify-center group-hover/card:-translate-y-1 transition-all duration-200 group-hover/card:shadow-lg">
                  {item.icon ? (
                    <img src={item.icon} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Tv size={24} className="text-text-tertiary" />
                  )}
                </div>
                <div className="mt-2.5">
                  <p className="text-sm font-medium truncate">{item.title || 'Unknown'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1 h-1 rounded-full bg-accent" />
                    <p className="text-[11px] text-text-tertiary">{formatProgress(item)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recently Added rail */}
      {recentlyAdded.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film size={16} className="text-accent" />
              <h2 className="font-display font-semibold text-sm text-white">Recently Added</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scroll(addedRef, -1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => scroll(addedRef, 1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div ref={addedRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyAdded.map((item: any, i: number) => (
              <Link
                key={item.id || item.stream_id || i}
                to={item._type === 'series' ? '/series' : '/movies'}
                className="flex-shrink-0 w-[140px] group/card"
              >
                <div className="aspect-[2/3] card-depth overflow-hidden flex items-center justify-center group-hover/card:-translate-y-1 transition-all duration-200 group-hover/card:shadow-lg">
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

      {/* Sources (demoted) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ListVideo size={16} className="text-text-tertiary" />
          <h2 className="font-display font-semibold text-sm text-white">Sources</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {playlists.map((pl) => (
            <div key={pl.id} className="group relative">
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5 text-sm hover:bg-white/[0.06] transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-state-success flex-shrink-0" />
                <span className="text-text-secondary group-hover:text-white transition-colors">{pl.name}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                  pl.type === 'm3u' ? 'bg-blue-500/20 text-blue-400' :
                  pl.type === 'xtream' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                }`}>{pl.type.toUpperCase()}</span>
                <span className="text-[11px] text-text-tertiary">{pl.channel_count || 0}ch</span>
              </div>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
                    ⋮
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="min-w-[160px] bg-bg-elevated border border-border rounded-xl p-1 shadow-xl z-50" sideOffset={4} align="end">
                    <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 rounded-lg cursor-pointer outline-none transition-colors" onClick={() => handleRefreshPlaylist(pl.id)}>
                      <RefreshCw size={14} /> Refresh
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 rounded-lg cursor-pointer outline-none transition-colors" onClick={() => toast.info(`${pl.name} · ${pl.type.toUpperCase()} · ${pl.channel_count} channels · ${pl.vod_count} VOD`)}>
                      <Info size={14} /> Info
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                    <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-state-error hover:text-state-error hover:bg-state-error/5 rounded-lg cursor-pointer outline-none transition-colors" onClick={() => setDeleteTarget(pl.id)}>
                      <Trash2 size={14} /> Remove
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          ))}
        </div>
      </section>

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
