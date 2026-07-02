import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Television, FilmStrip, FilmSlate } from '@phosphor-icons/react';
import { usePlaylistStore } from '../store/playlistStore';
import VirtualGrid from '../components/common/VirtualGrid';
import { toast } from '../components/common/Toast';
import { useNavigate } from 'react-router-dom';

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
}

type Tab = 'all' | 'channel' | 'vod' | 'series';

const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [channels, setChannels] = useState<any[]>([]);
  const [vod, setVod] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentChannel } = usePlaylistStore();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const [favChannels, favVod, playlists] = await Promise.all([
        withTimeout(window.electronAPI.getFavoriteChannels()),
        withTimeout(window.electronAPI.getFavoriteVod()),
        withTimeout(window.electronAPI.getPlaylists()),
      ]);
      setChannels(favChannels || []);
      setVod(favVod || []);

      if (playlists.length > 0) {
        const [allSeries, seriesFavs] = await Promise.all([
          withTimeout(window.electronAPI.getSeries(playlists[0].id)),
          withTimeout(window.electronAPI.getAllFavorites('series')),
        ]);
        const favIds = new Set((seriesFavs || []).map((f: any) => f.item_id || f.id || f.series_id));
        setSeries((allSeries || []).filter((s: any) => favIds.has(s.id) || favIds.has(s.series_id)));
      }
    } catch { /* IPC error */ } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (itemType: string, itemId: string) => {
    try {
      const result = await window.electronAPI.toggleFavorite({ item_type: itemType, item_id: itemId });
      if (!result.isFavorite) {
        toast.success('Removed from favorites');
        if (itemType === 'channel') setChannels((prev) => prev.filter((c: any) => c.id !== itemId));
        else if (itemType === 'vod') setVod((prev) => prev.filter((v: any) => v.id !== itemId));
        else if (itemType === 'series') setSeries((prev) => prev.filter((s: any) => s.id !== itemId && s.series_id !== itemId));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  const totalCount = channels.length + vod.length + series.length;

  const tabs: { id: Tab; label: string; icon: React.FC<any>; count: number }[] = [
    { id: 'all', label: 'All', icon: Heart, count: totalCount },
    { id: 'channel', label: 'Channels', icon: Television, count: channels.length },
    { id: 'vod', label: 'Movies', icon: FilmStrip, count: vod.length },
    { id: 'series', label: 'Series', icon: FilmSlate, count: series.length },
  ];

  const isEmpty = totalCount === 0;

  const renderChannelCard = (ch: any) => (
    <div
      onClick={() => { setCurrentChannel(ch); navigate('/live'); }}
      className="bg-bg-elevated border border-border-subtle rounded-xl p-3 cursor-pointer hover:border-white/20 transition-colors group"
    >
      <div className="w-full h-10 flex items-center justify-center mb-2">
        {ch.tvg_logo ? (
          <img src={ch.tvg_logo} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <Television size={20} className="text-text-tertiary" />
        )}
      </div>
      <h4 className="text-sm text-white font-medium truncate text-center">{ch.tvg_name}</h4>
      <button
        onClick={(e) => { e.stopPropagation(); removeFavorite('channel', ch.id); }}
        className="mt-2 w-full text-xs text-text-tertiary hover:text-state-error transition-colors text-center"
      >
        Remove
      </button>
    </div>
  );

  const renderVodCard = (item: any) => (
    <div className="group cursor-pointer">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle relative">
        {item.icon ? (
          <img src={item.icon} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FilmStrip size={28} className="text-text-tertiary" />
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); removeFavorite('vod', item.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Heart size={14} className="text-state-error fill-state-error" weight="fill" />
        </button>
      </div>
      <p className="text-sm mt-2 truncate font-medium">{item.name}</p>
      {item.year && <p className="text-xs text-text-tertiary">{item.year}</p>}
    </div>
  );

  const renderSeriesCard = (s: any) => (
    <div className="group cursor-pointer" onClick={() => navigate('/series')}>
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle relative">
        {s.cover ? (
          <img src={s.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FilmSlate size={28} className="text-text-tertiary" />
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); removeFavorite('series', s.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Heart size={14} className="text-state-error fill-state-error" weight="fill" />
        </button>
      </div>
      <p className="text-sm mt-2 truncate font-medium">{s.name}</p>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
        <Heart size={28} className="text-text-tertiary" />
      </div>
      <h3 className="font-display font-semibold text-lg mb-1">No favorites yet</h3>
      <p className="text-text-secondary text-sm max-w-sm mb-6">
        Star channels, movies, and series to see them here
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/live')}
          className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
        >
          <Television size={16} /> Browse Channels
        </button>
        <button
          onClick={() => navigate('/movies')}
          className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
        >
          <FilmStrip size={16} /> Browse Movies
        </button>
        <button
          onClick={() => navigate('/series')}
          className="flex items-center gap-2 px-4 py-2 border border-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
        >
          <FilmSlate size={16} /> Browse Series
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      className="max-w-[1400px] mx-auto px-8 py-6 h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h1 className="text-2xl font-display font-bold tracking-tight">Favorites</h1>
      </motion.div>

      <motion.div
        className="flex gap-2 mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-black'
                : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
            }`}
          >
            <tab.icon size={16} weight={activeTab === tab.id ? 'fill' : 'regular'} />
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] opacity-60">{tab.count}</span>
            )}
          </button>
        ))}
      </motion.div>

      {isEmpty ? (
        renderEmptyState()
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(activeTab === 'all' || activeTab === 'channel') && channels.length > 0 && (
            <div className={activeTab !== 'all' ? '' : 'mb-8'}>
              {activeTab === 'all' && (
                <h2 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <Television size={16} /> Channels
                </h2>
              )}
              <VirtualGrid
                items={channels}
                itemHeight={110}
                minItemWidth={160}
                renderItem={renderChannelCard}
              />
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'vod') && vod.length > 0 && (
            <div className={activeTab !== 'all' ? '' : 'mb-8'}>
              {activeTab === 'all' && (
                <h2 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <FilmStrip size={16} /> Movies
                </h2>
              )}
              <VirtualGrid
                items={vod}
                itemHeight={340}
                minItemWidth={160}
                renderItem={renderVodCard}
              />
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'series') && series.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h2 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <FilmSlate size={16} /> Series
                </h2>
              )}
              <VirtualGrid
                items={series}
                itemHeight={340}
                minItemWidth={160}
                renderItem={renderSeriesCard}
              />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default Favorites;
