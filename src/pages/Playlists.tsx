import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, RefreshCw, Trash2, Edit2, Plus, Search, FileText, Cloud, Radio, Layers, ChevronDown } from 'lucide-react';
import { toast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import AddPlaylistModal from '../components/playlist/AddPlaylistModal';

type SortMode = 'date_new' | 'date_old' | 'name' | 'size';
type FilterType = 'all' | 'm3u' | 'xtream' | 'stalker';

interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream' | 'stalker';
  url?: string;
  channel_count: number;
  vod_count: number;
  series_count: number;
  created_at: number;
  last_synced?: number;
}

const SortDropdown: React.FC<{
  value: SortMode;
  label: string;
  onChange: (mode: SortMode) => void;
}> = ({ value, label, onChange }) => {
  const [open, setOpen] = useState(false);
  const options: { key: SortMode; label: string }[] = [
    { key: 'date_new', label: 'Date added (Newest first)' },
    { key: 'date_old', label: 'Date added (Oldest first)' },
    { key: 'name', label: 'Name (A → Z)' },
    { key: 'size', label: 'Size (Largest first)' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-sm hover:bg-white/5 transition-colors"
      >
        <span className="text-text-secondary text-xs">{label}</span>
        <ChevronDown size={14} className="text-text-tertiary" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-bg-overlay border border-border-strong rounded-xl p-1.5 shadow-2xl z-20">
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  value === opt.key ? 'bg-accent/15 text-accent' : 'hover:bg-white/5 text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Playlists: React.FC = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date_new');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Playlist | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [search, setSearch] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = async () => {
    const list = await window.electronAPI.getPlaylists();
    setPlaylists(list);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    all: playlists.length,
    m3u: playlists.filter(p => p.type === 'm3u').length,
    xtream: playlists.filter(p => p.type === 'xtream').length,
    stalker: playlists.filter(p => p.type === 'stalker').length,
  }), [playlists]);

  const filtered = useMemo(() => {
    let items = playlists;
    if (filterType !== 'all') items = items.filter(p => p.type === filterType);
    if (search) items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return [...items].sort((a, b) => {
      switch (sortMode) {
        case 'date_new': return (b.created_at || 0) - (a.created_at || 0);
        case 'date_old': return (a.created_at || 0) - (b.created_at || 0);
        case 'name': return a.name.localeCompare(b.name);
        case 'size': return (b.channel_count || 0) - (a.channel_count || 0);
        default: return 0;
      }
    });
  }, [playlists, filterType, search, sortMode]);

  const handleRefresh = async (p: Playlist) => {
    setRefreshingId(p.id);
    toast.info(`Refreshing ${p.name}…`);
    const result = await window.electronAPI.refreshPlaylist(p.id);
    setRefreshingId(null);
    if (result.success) {
      toast.success(`Refreshed — ${result.count} items`);
      load();
    } else {
      toast.error(result.error || 'Refresh failed');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await window.electronAPI.deletePlaylist(confirmDelete.id);
    if (result.success) {
      toast.success(`Deleted "${confirmDelete.name}" and all its data`);
      setConfirmDelete(null);
      load();
    } else {
      toast.error(result.error || 'Delete failed');
    }
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    const result = await window.electronAPI.updatePlaylist({ id, data: { name: renameValue.trim() } });
    if (result.success) {
      toast.success('Playlist renamed');
      setEditingId(null);
      load();
    } else {
      toast.error('Rename failed');
    }
  };

  const filterItems: { key: FilterType; label: string; icon: any; count: number }[] = [
    { key: 'all', label: 'All', icon: Layers, count: counts.all },
    { key: 'm3u', label: 'M3U (URL / File)', icon: FileText, count: counts.m3u },
    { key: 'xtream', label: 'Xtream Codes', icon: Cloud, count: counts.xtream },
    { key: 'stalker', label: 'Stalker Portal', icon: Radio, count: counts.stalker },
  ];

  const sortLabel: Record<SortMode, string> = {
    date_new: 'Newest first',
    date_old: 'Oldest first',
    name: 'Name A–Z',
    size: 'Largest first',
  };

  return (
    <div className="flex h-full">
      {/* Sidebar filter */}
      <div className="w-[240px] border-r border-border-subtle bg-bg-base/50 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-border-subtle">
          <h2 className="text-xl font-display font-bold">Sources</h2>
          <p className="text-xs text-text-tertiary mt-1">{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary font-semibold px-3 mb-2">Type</p>
          {filterItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilterType(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                filterType === item.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={16} />
              <span className="flex-1 text-left truncate">{item.label}</span>
              <span className="text-xs text-text-tertiary">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <div>
            <h1 className="text-2xl font-display font-bold">
              {filterType === 'all' ? 'All Playlists' : filterItems.find(f => f.key === filterType)?.label}
            </h1>
            <p className="text-sm text-text-secondary mt-1">{filtered.length} playlist{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search playlists…"
                className="pl-9 pr-4 py-2 bg-bg-elevated border border-border-subtle rounded-lg text-sm w-56 focus:outline-none focus:border-border-strong"
              />
            </div>
            <SortDropdown value={sortMode} label={sortLabel[sortMode]} onChange={setSortMode} />
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 transition-colors"
            >
              <Plus size={16} />
              Add Playlist
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Folder}
              title={playlists.length === 0 ? 'No playlists yet' : 'No matches'}
              description={playlists.length === 0
                ? 'Add your first M3U, Xtream Codes, or Stalker Portal source to get started.'
                : 'Try a different filter or search term.'}
              action={playlists.length === 0 ? { label: 'Add Playlist', onClick: () => setShowAddModal(true) } : undefined}
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="group flex items-center gap-4 bg-bg-elevated border border-border-subtle hover:border-border-strong rounded-xl p-4 transition-colors"
                  >
                    {/* Type icon */}
                    <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      {p.type === 'm3u' ? <FileText size={20} className="text-accent" /> :
                       p.type === 'xtream' ? <Cloud size={20} className="text-accent" /> :
                       <Radio size={20} className="text-accent" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {editingId === p.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRename(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(p.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="bg-bg-base border border-accent/50 rounded px-2 py-1 text-sm font-medium w-full max-w-sm focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="font-medium truncate">{p.name}</p>
                      )}
                      <p className="text-xs text-text-tertiary mt-1">
                        <span className="uppercase text-[10px] font-mono tracking-wider mr-2 opacity-70">{p.type}</span>
                        {p.channel_count?.toLocaleString() || 0} channels
                        {p.vod_count > 0 && ` · ${p.vod_count.toLocaleString()} movies`}
                        {p.series_count > 0 && ` · ${p.series_count.toLocaleString()} series`}
                        {p.created_at ? ` · Added ${new Date(p.created_at * 1000).toLocaleDateString()}` : ''}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRefresh(p)}
                        disabled={refreshingId === p.id}
                        title="Refresh playlist"
                        className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-text-secondary hover:text-white transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={15} className={refreshingId === p.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => { setEditingId(p.id); setRenameValue(p.name); }}
                        title="Rename"
                        className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center text-text-secondary hover:text-white transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p)}
                        title="Delete playlist"
                        className="w-9 h-9 rounded-lg hover:bg-state-error/10 flex items-center justify-center text-text-secondary hover:text-state-error transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddPlaylistModal onClose={() => { setShowAddModal(false); load(); }} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}"?`}
          message={`This will permanently delete this playlist and ALL associated data: ${confirmDelete.channel_count} channels, ${confirmDelete.vod_count} movies, ${confirmDelete.series_count} series, plus all favorites and watch history entries. This cannot be undone.`}
          confirmLabel="Delete Permanently"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default Playlists;
