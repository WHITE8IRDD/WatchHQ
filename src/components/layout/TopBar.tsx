import React, { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { usePlaylistStore } from '../../store/playlistStore';
import { ChevronDown, Plus, Download, RefreshCw, Info, Trash2, Search, SlidersHorizontal, Bell } from 'lucide-react';
import { toast } from '../common/Toast';
import ConfirmDialog from '../common/ConfirmDialog';

interface TopBarProps {
  onOpenPalette: () => void;
  onOpenAddPlaylist: () => void;
  onOpenAdvancedSearch: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onOpenPalette, onOpenAddPlaylist, onOpenAdvancedSearch }) => {
  const { playlists, activePlaylistId, activePlaylist, setActivePlaylist, loadPlaylists, refreshPlaylist, deletePlaylist, loadChannels } = usePlaylistStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [infoTarget, setInfoTarget] = useState<string | null>(null);

  useEffect(() => { loadPlaylists(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenPalette]);

  const handleRefresh = async () => {
    if (!activePlaylistId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshPlaylist(activePlaylistId);
      toast.success('Playlist refreshed');
    } catch {
      toast.error('Failed to refresh playlist');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deletePlaylist(deleteTarget);
      toast.success('Playlist deleted');
    } catch {
      toast.error('Failed to delete playlist');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSwitchPlaylist = (id: string) => {
    setActivePlaylist(id);
    loadChannels(id);
  };

  const infoPlaylist = infoTarget ? playlists.find((p) => p.id === infoTarget) : null;

  const typeColors: Record<string, string> = {
    m3u: 'bg-blue-500/20 text-blue-400',
    xtream: 'bg-green-500/20 text-green-400',
    stalker: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="h-14 flex-shrink-0 border-b border-border-subtle bg-bg-base flex items-center gap-3 px-4">
      {/* Left: Playlist selector */}
      {playlists.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-elevated border border-border-subtle hover:bg-bg-hover transition-colors text-sm min-w-0 max-w-[200px]">
              <span className="w-2 h-2 rounded-full bg-state-success flex-shrink-0" />
              <span className="text-white font-medium truncate">
                {activePlaylist?.name || 'Select playlist'}
              </span>
              {activePlaylist && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[activePlaylist.type]}`}>
                  {activePlaylist.type.toUpperCase()}
                </span>
              )}
              <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              className="bg-bg-overlay border border-border-subtle rounded-xl p-1.5 min-w-[220px] shadow-2xl z-50"
            >
              {playlists.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => handleSwitchPlaylist(p.id)}
                >
                  <span className="w-2 h-2 rounded-full bg-state-success flex-shrink-0" />
                  <span className="text-white flex-1 truncate">{p.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[p.type]}`}>
                    {p.type.toUpperCase()}
                  </span>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="text-text-tertiary hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-lg leading-none">⋯</span>
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        sideOffset={-4}
                        className="bg-bg-overlay border border-border-subtle rounded-xl p-1.5 min-w-[160px] shadow-2xl z-[60]"
                      >
                        <DropdownMenu.Item
                          onClick={() => setInfoTarget(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-text-secondary hover:text-white"
                        >
                          <Info size={14} /> Playlist Info
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={async () => {
                            try {
                              await refreshPlaylist(p.id);
                              toast.success('Playlist refreshed');
                            } catch {
                              toast.error('Failed to refresh playlist');
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-text-secondary hover:text-white"
                        >
                          <RefreshCw size={14} /> Refresh
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => setDeleteTarget(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-state-error hover:text-state-error"
                        >
                          <Trash2 size={14} /> Remove
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              ))}

              <DropdownMenu.Separator className="h-px bg-white/10 my-1.5 mx-1" />

              <DropdownMenu.Item
                onClick={onOpenAddPlaylist}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-text-secondary hover:text-white"
              >
                <Plus size={14} /> Add playlist
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      {/* Refresh */}
      {activePlaylistId && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-9 h-9 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      )}

      {/* Center: Advanced search + search input */}
      <div className="flex-1 flex items-center gap-2 justify-center max-w-[600px] mx-auto">
        <button
          onClick={onOpenAdvancedSearch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-elevated border border-border-subtle text-xs text-text-secondary hover:text-white hover:bg-bg-hover transition-colors whitespace-nowrap"
        >
          <SlidersHorizontal size={14} />
          Advanced search
        </button>
        <div className="relative flex-1 max-w-[400px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            readOnly
            onFocus={onOpenPalette}
            placeholder="Search in this playlist…"
            className="w-full bg-bg-elevated border border-border-subtle rounded-xl pl-10 pr-16 py-1.5 text-sm text-white placeholder:text-text-tertiary focus:outline-none focus:border-white/20 transition-colors cursor-pointer"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-text-tertiary font-mono pointer-events-none">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right: action buttons */}
      <button
        onClick={onOpenAddPlaylist}
        className="w-9 h-9 rounded-xl bg-white/5 border border-border-subtle text-text-secondary hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
        title="Add playlist"
      >
        <Plus size={18} />
      </button>
      <button
        className="w-9 h-9 rounded-xl bg-white/5 border border-border-subtle text-text-secondary hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
        title="Download"
      >
        <Download size={18} />
      </button>
      <button
        className="w-9 h-9 rounded-xl bg-white/5 border border-border-subtle text-text-secondary hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
      </button>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete playlist"
          message="Are you sure you want to delete this playlist? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Playlist Info modal */}
      {infoPlaylist && (
        <div
          className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInfoTarget(null)}
        >
          <div
            className="w-full max-w-md bg-bg-elevated border border-border-subtle rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-semibold text-lg mb-4">{infoPlaylist.name}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Type</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${typeColors[infoPlaylist.type]}`}>
                  {infoPlaylist.type.toUpperCase()}
                </span>
              </div>
              {infoPlaylist.url && (
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">URL</span>
                  <span className="text-white text-right max-w-[250px] truncate" title={infoPlaylist.url}>
                    {infoPlaylist.url}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">Channels</span>
                <span className="text-white">{infoPlaylist.channel_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">VOD</span>
                <span className="text-white">{infoPlaylist.vod_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Series</span>
                <span className="text-white">{infoPlaylist.series_count}</span>
              </div>
              {infoPlaylist.username && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Username</span>
                  <span className="text-white">{infoPlaylist.username}</span>
                </div>
              )}
              {infoPlaylist.mac_address && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">MAC Address</span>
                  <span className="text-white">{infoPlaylist.mac_address}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setInfoTarget(null)}
              className="mt-6 w-full py-2.5 rounded-xl border border-border text-white hover:bg-white/5 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
