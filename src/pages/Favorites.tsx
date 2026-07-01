// src/pages/Favorites.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Television, FilmStrip, FilmSlate } from '@phosphor-icons/react';
import { usePlaylistStore } from '../store/playlistStore';
import VirtualGrid from '../components/common/VirtualGrid';
import { toast } from '../components/common/Toast';
import { staggerContainer, fadeInUp } from '../lib/motion';

const Favorites: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'channel' | 'vod' | 'series'>('channel');
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
      const [favChannels, favVod] = await Promise.all([
        window.electronAPI.getFavoriteChannels(),
        window.electronAPI.getFavoriteVod(),
      ]);
      setChannels(favChannels);
      setVod(favVod);
    } catch (error: any) {
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (itemType: string, itemId: string) => {
    try {
      const result = await window.electronAPI.toggleFavorite({ item_type: itemType, item_id: itemId });
      if (!result.isFavorite) {
        toast.success('Removed from favorites');
        if (itemType === 'channel') setChannels((prev) => prev.filter((c) => c.id !== itemId));
        else if (itemType === 'vod') setVod((prev) => prev.filter((v) => v.id !== itemId));
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 bg-white/[0.04] rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'channel', label: 'Channels', icon: Television, count: channels.length },
    { id: 'vod', label: 'Movies', icon: FilmStrip, count: vod.length },
    { id: 'series', label: 'Series', icon: FilmSlate, count: series.length },
  ] as const;

  return (
    <motion.div className="p-8" {...staggerContainer}>
      <motion.div className="mb-6" {...fadeInUp}>
        <h1 className="text-2xl font-display font-bold tracking-tight">Favorites</h1>
        <p className="text-text-secondary text-sm mt-1">Your saved channels and content</p>
      </motion.div>

      <motion.div className="flex gap-2 mb-6" {...fadeInUp}>
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
            <span className="text-[10px] opacity-60">{tab.count}</span>
          </button>
        ))}
      </motion.div>

      {activeTab === 'channel' && (
        channels.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <Television size={40} className="text-text-tertiary mb-3" />
            <p className="text-text-secondary text-sm">No favorite channels yet</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <VirtualGrid
              items={channels}
              itemHeight={100}
              minItemWidth={170}
              renderItem={(ch) => (
                <div className="bg-bg-elevated border border-border-subtle rounded-xl p-3 cursor-pointer hover:border-white/20 transition-colors group"
                  onClick={() => setCurrentChannel(ch)}>
                  <div className="w-full h-10 flex items-center justify-center mb-2">
                    {ch.tvg_logo ? (
                      <img src={ch.tvg_logo} alt="" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Television size={20} className="text-text-tertiary" />
                    )}
                  </div>
                  <h4 className="text-sm text-white font-medium truncate">{ch.tvg_name}</h4>
                  <button onClick={(e) => { e.stopPropagation(); removeFavorite('channel', ch.id); }}
                    className="mt-2 text-xs text-text-tertiary hover:text-state-error transition-colors">
                    Remove
                  </button>
                </div>
              )}
            />
          </div>
        )
      )}

      {activeTab === 'vod' && (
        vod.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <FilmStrip size={40} className="text-text-tertiary mb-3" />
            <p className="text-text-secondary text-sm">No favorite movies yet</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <VirtualGrid
              items={vod}
              itemHeight={340}
              minItemWidth={160}
              renderItem={(item) => (
                <div className="group cursor-pointer">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle relative">
                    {item.icon ? <img src={item.icon} alt="" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center"><FilmStrip size={28} className="text-text-tertiary" /></div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeFavorite('vod', item.id); }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <Heart size={14} className="text-state-error fill-state-error" />
                    </button>
                  </div>
                  <p className="text-sm mt-2 truncate font-medium">{item.name}</p>
                </div>
              )}
            />
          </div>
        )
      )}

      {activeTab === 'series' && (
        <div className="flex flex-col items-center py-20">
          <FilmSlate size={40} className="text-text-tertiary mb-3" />
          <p className="text-text-secondary text-sm">No favorite series yet</p>
        </div>
      )}
    </motion.div>
  );
};

export default Favorites;
