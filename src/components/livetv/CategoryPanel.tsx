import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play } from 'lucide-react';
import { Heart } from '@phosphor-icons/react';
import ChannelLogo from '../common/ChannelLogo';

interface CategoryPanelProps {
  category: string | null;
  channels: any[];
  onClose: () => void;
  onPlay: (ch: any) => void;
}

const CategoryPanel: React.FC<CategoryPanelProps> = ({ category, channels, onClose, onPlay }) => {
  return (
    <AnimatePresence>
      {category && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed left-[240px] top-0 bottom-0 w-[420px] bg-bg-elevated border-r border-border-strong z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border-subtle">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Category</p>
                <h2 className="text-xl font-display font-bold">{category}</h2>
                <p className="text-xs text-text-secondary mt-1">{channels.length} channels</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {channels.map((ch, idx) => (
                <div key={ch.id}
                  onClick={() => onPlay(ch)}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
                >
                  <span className="text-text-tertiary text-xs w-6 font-mono flex-shrink-0 mt-1">{idx + 1}</span>
                  <ChannelLogo name={ch.tvg_name} logo={ch.tvg_logo} size={48} className="rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p title={ch.tvg_name} className="text-sm font-medium leading-snug break-words group-hover:text-white">{ch.tvg_name}</p>
                    <p className="text-xs text-text-tertiary leading-snug break-words mt-0.5">{ch.group_title}</p>
                  </div>
                  {ch.is_favorite === 1 && <Heart size={14} weight="fill" className="text-state-error flex-shrink-0 mt-1" />}
                  <Play size={16} className="text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:text-white flex-shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CategoryPanel;
