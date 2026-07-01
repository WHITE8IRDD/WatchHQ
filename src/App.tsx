import React, { useEffect, useState, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './pages/Dashboard';
import LiveTV from './pages/LiveTV';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Favorites from './pages/Favorites';
import Playlists from './pages/Playlists';
import Settings from './pages/Settings';
import CommandPalette from './components/common/CommandPalette';
import AddPlaylistModal from './components/playlist/AddPlaylistModal';
import AdvancedSearchModal from './components/livetv/AdvancedSearchModal';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/Toast';
import { usePreferencesStore } from './store/preferencesStore';
import { usePlaylistStore } from './store/playlistStore';

const App: React.FC = () => {
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const activePlaylistId = usePlaylistStore((s) => s.activePlaylistId);

  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const handleAdvancedSearchApply = useCallback((filters: { category: string; country: string; quality: string }) => {
    window.dispatchEvent(new CustomEvent('advanced-search-apply', { detail: filters }));
  }, []);

  useEffect(() => {
    const handler = () => setShowAddPlaylist(true);
    window.addEventListener('open-add-playlist', handler);
    return () => window.removeEventListener('open-add-playlist', handler);
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <div className="flex h-screen w-screen bg-bg-base text-text-primary overflow-hidden antialiased">
          <Sidebar />
          <div className="flex-1 ml-[60px] flex flex-col h-full min-w-0">
            <TopBar
              onOpenPalette={() => setShowCmdPalette(true)}
              onOpenAddPlaylist={() => setShowAddPlaylist(true)}
              onOpenAdvancedSearch={() => setShowAdvancedSearch(true)}
            />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/live" element={<LiveTV />} />
                <Route path="/movies" element={<Movies />} />
                <Route path="/series" element={<Series />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
        <CommandPalette open={showCmdPalette} onClose={() => setShowCmdPalette(false)} />
        {showAddPlaylist && (
          <AddPlaylistModal onClose={() => setShowAddPlaylist(false)} />
        )}
        <AdvancedSearchModal
          open={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          playlistId={activePlaylistId || ''}
          onApply={handleAdvancedSearchApply}
        />
        <ToastContainer />
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
