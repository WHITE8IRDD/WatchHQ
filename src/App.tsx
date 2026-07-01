// src/App.tsx
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import LiveTV from './pages/LiveTV';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Favorites from './pages/Favorites';
import Playlists from './pages/Playlists';
import Settings from './pages/Settings';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/Toast';
import { usePreferencesStore } from './store/preferencesStore';

const App: React.FC = () => {
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <div className="flex h-screen w-screen bg-bg-base text-text-primary overflow-hidden antialiased">
          <Sidebar />
          <main className="flex-1 ml-[240px] h-full overflow-y-auto">
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
        <ToastContainer />
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
