// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Tv, Film, Clapperboard, ListVideo, Heart, TrendingUp } from 'lucide-react';
import { ClockCounterClockwise, Play } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { usePlaylistStore } from '../store/playlistStore';
import ChannelLogo from '../components/common/ChannelLogo';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { staggerContainer, fadeInUp } from '../lib/motion';

interface DashboardStats {
  playlists: number;
  channels: number;
  vod: number;
  series: number;
  epgPrograms: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    playlists: 0,
    channels: 0,
    vod: 0,
    series: 0,
    epgPrograms: 0,
  });
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { loadPlaylists, setCurrentChannel } = usePlaylistStore();

  useEffect(() => {
    (async () => {
      try {
        const playlists = await window.electronAPI.getPlaylists();
        let channelCount = 0;
        let vodCount = 0;
        let seriesCount = 0;

        for (const p of playlists) {
          channelCount += p.channel_count || 0;
          vodCount += p.vod_count || 0;
          seriesCount += p.series_count || 0;
        }

        let epgPrograms = 0;
        try {
          const epgStats = await window.electronAPI.getEpgStats();
          epgPrograms = epgStats.totalPrograms;
        } catch {}

        setStats({
          playlists: playlists.length,
          channels: channelCount,
          vod: vodCount,
          series: seriesCount,
          epgPrograms,
        });

        // Only load history if playlists exist
        if (playlists.length > 0) {
          try {
            const validIds = new Set(playlists.map((p: any) => p.id));
            const history = await window.electronAPI.getRecentHistory(10);
            const valid = history.filter((h: any) => !h.playlist_id || validIds.has(h.playlist_id));
            setRecentHistory(valid);
          } catch {}
        } else {
          setRecentHistory([]);
        }

        await loadPlaylists();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-8 pt-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-elevated border border-border-subtle rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] animate-pulse mb-3" />
              <div className="w-16 h-6 bg-white/[0.04] animate-pulse rounded mb-1" />
              <div className="w-12 h-3 bg-white/[0.04] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const quickStats = [
    { label: 'Channels', value: stats.channels, icon: Tv },
    { label: 'Movies', value: stats.vod, icon: Film },
    { label: 'Series', value: stats.series, icon: Clapperboard },
    { label: 'EPG Programs', value: stats.epgPrograms, icon: TrendingUp },
  ];

  const navCards = [
    {
      label: 'Live TV',
      description: `${stats.channels} channels available`,
      icon: Tv,
      path: '/live',
    },
    {
      label: 'Movies',
      description: `${stats.vod} movies in library`,
      icon: Film,
      path: '/movies',
    },
    {
      label: 'Series',
      description: `${stats.series} series available`,
      icon: Clapperboard,
      path: '/series',
    },
  ];

  return (
    <motion.div className="p-8 pt-12 max-w-7xl mx-auto" {...staggerContainer}>
      <motion.div className="mb-8" {...fadeInUp}>
        <h1 className="text-3xl font-display font-bold tracking-tight mb-1">Welcome back</h1>
        <p className="text-text-secondary">
          {stats.playlists} playlist{stats.playlists !== 1 ? 's' : ''} configured
        </p>
      </motion.div>

      {/* Hero — last watched channel */}
      {recentHistory.length > 0 && recentHistory[0].item_type === 'channel' && (
        <motion.div
          {...fadeInUp}
          className="relative rounded-2xl overflow-hidden mb-8 h-[280px] flex items-end cursor-pointer group"
          onClick={() => {
            const h = recentHistory[0];
            setCurrentChannel({
              id: h.item_id,
              playlist_id: h.playlist_id || '',
              tvg_name: h.title || 'Unknown',
              tvg_logo: h.icon,
              url: h.url || '',
              group_title: '',
              is_favorite: 0,
              watch_count: 0,
            });
          }}
        >
          <div className="absolute inset-0 bg-bg-elevated" />
          {recentHistory[0].icon && (
            <div className="absolute inset-0 opacity-20">
              <img src={recentHistory[0].icon} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative z-10 p-8 flex items-end gap-6 w-full">
            <ChannelLogo name={recentHistory[0].title || ''} url={recentHistory[0].icon} size={120} className="rounded-2xl shadow-2xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Continue Watching</p>
              <h2 className="text-4xl font-display font-bold tracking-tight truncate">{recentHistory[0].title || 'Unknown'}</h2>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all">
                  <Play size={16} weight="fill" /> Resume
                </span>
                {recentHistory[0].progress_percent > 0 && (
                  <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${recentHistory[0].progress_percent}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8" {...staggerContainer}>
        {quickStats.map((stat) => (
          <motion.div
            key={stat.label}
            {...fadeInUp}
            className="bg-bg-elevated border border-border-subtle rounded-xl p-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
              <stat.icon size={20} className="text-text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-text-tertiary">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8" {...staggerContainer}>
        {navCards.map((card) => (
          <motion.div key={card.path} {...fadeInUp}>
            <Link
              to={card.path}
              className="group block bg-bg-elevated border border-border-subtle rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 relative"
            >
              <card.icon className="text-text-secondary group-hover:text-white transition-colors" size={28} />
              <h3 className="mt-4 text-lg font-display font-semibold">{card.label}</h3>
              <p className="text-text-tertiary text-sm mt-1">{card.description}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {recentHistory.length > 0 && (
        <motion.section className="mb-8" {...fadeInUp}>
          <div className="flex items-center gap-2 mb-4">
            <ClockCounterClockwise size={18} className="text-text-tertiary" weight="fill" />
            <h2 className="font-display font-semibold text-sm">Continue Watching</h2>
          </div>
          <motion.div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4" {...staggerContainer}>
            {recentHistory.slice(0, 5).map((item) => (
              <motion.div
                key={item.id}
                {...fadeInUp}
                onClick={() => {
                  if (item.item_type === 'channel' && item.url) {
                    setCurrentChannel({
                      id: item.item_id,
                      playlist_id: item.playlist_id || '',
                      tvg_name: item.title || 'Unknown',
                      tvg_logo: item.icon,
                      url: item.url,
                      group_title: '',
                      is_favorite: 0,
                      watch_count: 0,
                    });
                  }
                }}
                className="bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-200"
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
                  <p className="text-xs text-text-tertiary mt-1">
                    {new Date(item.last_watched * 1000).toLocaleDateString()}
                  </p>
                  {item.progress_percent > 0 && item.progress_percent < 95 && (
                    <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${item.progress_percent}%` }} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {stats.playlists === 0 && (
        <motion.div {...fadeInUp} className="bg-bg-elevated border border-border-subtle rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <ListVideo size={28} className="text-text-tertiary" />
          </div>
          <h3 className="text-xl font-display font-bold mb-2">Get Started</h3>
          <p className="text-text-tertiary text-sm mb-6 max-w-md mx-auto">
            Add your first playlist to start watching Live TV, Movies, and Series. Supports M3U,
            Xtream Codes, and Stalker/Ministra portals.
          </p>
          <Link
            to="/live"
            className="inline-block px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-accent-hover transition-all"
          >
            Add Your First Playlist
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Dashboard;
