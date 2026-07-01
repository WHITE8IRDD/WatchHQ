import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, Clock, Film, ListVideo, ChevronLeft, ChevronRight, Tv, Clapperboard } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [heroItem, setHeroItem] = useState<any>(null);
  const [recentlyWatched, setRecentlyWatched] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const recentRef = useRef<HTMLDivElement>(null);
  const playlistRef = useRef<HTMLDivElement>(null);
  const addedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [history, pl] = await Promise.all([
          window.electronAPI.getRecentHistory(20),
          window.electronAPI.getPlaylists(),
        ]);
        setRecentlyWatched(history || []);
        setHeroItem(history?.[0] || null);
        setPlaylists(pl || []);
        if (pl && pl.length > 0) {
          try {
            const vod = await window.electronAPI.getVod(pl[0].id);
            setRecentlyAdded(vod ? vod.slice(0, 20) : []);
          } catch { setRecentlyAdded([]); }
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: number) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 400, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="p-6 pt-10 max-w-7xl mx-auto w-full space-y-6">
        <div className="h-[280px] bg-bg-elevated rounded-2xl animate-pulse" />
        <div className="h-6 w-40 bg-bg-elevated rounded animate-pulse" />
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[180px] h-[100px] bg-bg-elevated rounded-xl flex-shrink-0 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pt-10 max-w-7xl mx-auto space-y-8">
      {/* Hero Banner */}
      {heroItem && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl overflow-hidden h-[280px] flex items-end cursor-pointer group"
        >
          <div className="absolute inset-0 bg-bg-elevated" />
          {heroItem.icon && (
            <div className="absolute inset-0 opacity-20">
              <img src={heroItem.icon} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative z-10 p-8 w-full">
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
              {heroItem.item_type === 'channel' ? 'Continue Watching' : 'Recently Watched'}
            </p>
            <h2 className="text-4xl font-display font-bold tracking-tight truncate">{heroItem.title || 'Unknown'}</h2>
            {heroItem.description && (
              <p className="text-text-secondary text-sm mt-1 line-clamp-1 max-w-xl">{heroItem.description}</p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <Link
                to={heroItem.item_type === 'channel' ? '/live' : '/movies'}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all"
              >
                <Play size={16} /> Continue Watching
              </Link>
              {heroItem.progress_percent > 0 && (
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <Clock size={14} />
                  <span>{heroItem.progress_percent}% complete</span>
                </div>
              )}
            </div>
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
            </div>
            <div className="flex items-center gap-2">
              <Link to="/favorites" className="text-xs text-text-tertiary hover:text-white transition-colors">Manage all</Link>
              <button onClick={() => scroll(recentRef, -1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => scroll(recentRef, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div ref={recentRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyWatched.slice(0, 10).map((item) => (
              <Link
                key={item.id || `${item.item_type}-${item.item_id}`}
                to={item.item_type === 'channel' ? '/live' : '/movies'}
                className="flex-shrink-0 w-[180px] bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-200 group/card"
              >
                <div className="aspect-video bg-bg-base flex items-center justify-center">
                  {item.icon ? (
                    <img src={item.icon} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <Tv size={24} className="text-text-tertiary" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{item.title || 'Unknown'}</p>
                  <p className="text-[11px] text-text-tertiary mt-1">
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
            <button onClick={() => scroll(playlistRef, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
          </div>
          <div ref={playlistRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {playlists.map((pl) => (
              <Link
                key={pl.id}
                to="/live"
                className="flex-shrink-0 w-[200px] bg-bg-elevated border border-border-subtle rounded-xl p-4 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-state-success" />
                  <span className="text-sm font-medium truncate text-white">{pl.name}</span>
                </div>
                <div className="flex gap-2 text-[11px] text-text-tertiary">
                  <span>{pl.channel_count || 0} channels</span>
                  <span>·</span>
                  <span>{pl.vod_count || 0} VOD</span>
                </div>
                <span className={`inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  pl.type === 'm3u' ? 'bg-blue-500/20 text-blue-400' :
                  pl.type === 'xtream' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                }`}>{pl.type.toUpperCase()}</span>
              </Link>
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
            <button onClick={() => scroll(addedRef, 1)} className="w-7 h-7 rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-white transition-colors"><ChevronRight size={14} /></button>
          </div>
          <div ref={addedRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentlyAdded.map((vod) => (
              <Link
                key={vod.id}
                to="/movies"
                className="flex-shrink-0 w-[140px] group/card"
              >
                <div className="aspect-[2/3] bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden flex items-center justify-center hover:-translate-y-1 transition-all duration-200">
                  {vod.icon ? (
                    <img src={vod.icon} alt={vod.name} className="w-full h-full object-cover" />
                  ) : (
                    <Film size={24} className="text-text-tertiary" />
                  )}
                </div>
                <p className="text-xs font-medium mt-1.5 truncate text-text-secondary group-hover/card:text-white transition-colors">{vod.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {playlists.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="bg-bg-elevated border border-border-subtle rounded-2xl p-12 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <ListVideo size={28} className="text-text-tertiary" />
          </div>
          <h3 className="text-xl font-display font-bold mb-2">Get Started</h3>
          <p className="text-text-tertiary text-sm mb-6 max-w-md mx-auto">
            Add your first playlist to start watching Live TV, Movies, and Series.
          </p>
          <Link
            to="/playlists"
            className="inline-block px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-accent-hover transition-all"
          >
            Add Your First Playlist
          </Link>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
