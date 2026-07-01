import React, { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { usePlaylistStore } from '../../store/playlistStore';
import { ChevronDown, Plus, Download, RefreshCw, Info, Trash2, Search, SlidersHorizontal } from 'lucide-react';

interface TopBarProps {
  onOpenPalette: () => void;
  onOpenAddPlaylist: () => void;
  onOpenAdvancedSearch: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onOpenPalette, onOpenAddPlaylist, onOpenAdvancedSearch }) => {
  const { playlists, activePlaylistId, activePlaylist, setActivePlaylist, loadPlaylists } = usePlaylistStore();
  const [searchValue, setSearchValue] = useState('');

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
    if (!activePlaylistId) return;
    try {
      await usePlaylistStore.getState().refreshPlaylist(activePlaylistId);
    } catch {}
  };

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
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[activePlaylist?.type || 'm3u']}`}>
                {activePlaylist?.type?.toUpperCase() || 'M3U'}
              </span>
              <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              className="bg-bg-overlay border border-border-subtle rounded-xl p-1.5 min-w-[220px] shadow-2xl z-50"
            >
              {playlists.map((p) => (
                <DropdownMenu.Root key={p.id}>
                  <DropdownMenu.Trigger asChild>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-white/5 transition-colors">
                      <span className="w-2 h-2 rounded-full bg-state-success flex-shrink-0" />
                      <span className="text-white flex-1 truncate">{p.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[p.type]}`}>
                        {p.type.toUpperCase()}
                      </span>
                      <button className="text-text-tertiary hover:text-white" onClick={(e) => e.stopPropagation()}>
                        <span className="text-lg leading-none">⋯</span>
                      </button>
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      sideOffset={-4}
                      className="bg-bg-overlay border border-border-subtle rounded-xl p-1.5 min-w-[160px] shadow-2xl z-[60]"
                    >
                      <DropdownMenu.Item
                        onClick={() => setActivePlaylist(p.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-text-secondary hover:text-white"
                      >
                        <Info size={14} /> Playlist Info
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={async () => {
                          try { await usePlaylistStore.getState().refreshPlaylist(p.id); } catch {}
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-text-secondary hover:text-white"
                      >
                        <RefreshCw size={14} /> Refresh
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={async () => {
                          try { await usePlaylistStore.getState().deletePlaylist(p.id); } catch {}
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-white/5 text-state-error hover:text-state-error"
                      >
                        <Trash2 size={14} /> Remove
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      {/* Refresh */}
      {activePlaylistId && (
        <button
          onClick={handleRefresh}
          className="w-8 h-8 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
        >
          <RefreshCw size={16} />
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search in this playlist..."
            className="w-full bg-bg-elevated border border-border-subtle rounded-xl pl-10 pr-16 py-1.5 text-sm text-white placeholder:text-text-tertiary focus:outline-none focus:border-white/20 transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-text-tertiary font-mono">
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
      <button className="w-9 h-9 rounded-xl bg-white/5 border border-border-subtle text-text-secondary hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors" title="Download">
        <Download size={18} />
      </button>
    </div>
  );
};

export default TopBar;
