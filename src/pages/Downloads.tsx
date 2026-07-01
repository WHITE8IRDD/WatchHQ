import React from 'react';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Downloads: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-border-subtle">
        <h1 className="text-2xl font-display font-bold">Downloads</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span>Not set</span>
          </div>
          <button className="px-4 py-2 border border-border-subtle rounded-lg text-sm hover:bg-white/5 transition-colors">Change Folder</button>
          <button className="px-4 py-2 border border-border-subtle rounded-lg text-sm hover:bg-white/5 transition-colors">Clear Completed</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-5">
          <Download size={32} className="text-text-tertiary/40" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No downloads yet</h3>
        <p className="text-sm text-text-tertiary text-center max-w-md mb-6">
          Once you add a playlist, you can save movies and episodes here for offline playback.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/playlists')}
            className="px-5 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors">
            Add Your First Playlist
          </button>
          <button onClick={() => navigate('/playlists')}
            className="text-sm text-text-secondary hover:text-white transition-colors">
            Go to Sources
          </button>
        </div>
      </div>
    </div>
  );
};

export default Downloads;
