import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Search, Settings2 } from 'lucide-react';
import { usePlaylistStore } from '../../store/playlistStore';

interface CategoryEntry {
  id: string;
  group_title: string;
  is_hidden: number;
}

const ManageCategoriesModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const activePlaylist = usePlaylistStore(s => s.activePlaylist);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [changed, setChanged] = useState(false);

  const load = useCallback(async () => {
    if (!activePlaylist) return;
    const cats = await window.electronAPI.getAllCategories(activePlaylist.id);
    setCategories(cats);
    setSearch('');
  }, [activePlaylist]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const toggle = async (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const newHidden = cat.is_hidden ? 0 : 1;
    setCategories(prev => prev.map(c => c.id === id ? { ...c, is_hidden: newHidden } : c));
    setChanged(true);
  };

  const save = async () => {
    const hiddenIds = categories.filter(c => c.is_hidden).map(c => c.id);
    await window.electronAPI.setCategoriesHidden({ ids: hiddenIds, hidden: true });
    const visibleIds = categories.filter(c => !c.is_hidden).map(c => c.id);
    if (visibleIds.length > 0) {
      await window.electronAPI.setCategoriesHidden({ ids: visibleIds, hidden: false });
    }
    setChanged(false);
    onClose();
  };

  const filtered = categories.filter(c =>
    c.group_title.toLowerCase().includes(search.toLowerCase()) ||
    c.group_title === 'Uncategorized'
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="bg-bg-primary border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center"><Settings2 size={16} className="text-text-secondary" /></div>
                <div>
                  <h2 className="text-base font-bold text-white">Manage Categories</h2>
                  <p className="text-xs text-text-tertiary">{categories.length} categories</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-tertiary hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input type="text" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-bg-elevated border border-white/5 rounded-xl text-sm text-white placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
              {filtered.map(cat => (
                <button key={cat.id} onClick={() => toggle(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-elevated transition-colors group"
                >
                  <span className="text-sm text-white truncate">{cat.group_title}</span>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    cat.is_hidden
                      ? 'bg-state-error/10 text-state-error group-hover:bg-state-error/20'
                      : 'bg-bg-surface text-text-tertiary group-hover:bg-bg-elevated group-hover:text-white'
                  }`}>
                    {cat.is_hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-text-tertiary text-sm py-8">No categories found</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-white transition-colors">Cancel</button>
              <button onClick={save}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  changed ? 'bg-accent-blue text-white hover:bg-accent-blue/90 shadow-lg shadow-accent-blue/20' : 'bg-bg-elevated text-text-secondary'
                }`}>
                Apply
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ManageCategoriesModal;
