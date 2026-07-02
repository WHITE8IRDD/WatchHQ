import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Playlist, Broadcast, Monitor, Sun, Database, Info, TrashSimple,
  DownloadSimple, UploadSimple, FolderOpen, ArrowClockwise, CheckCircle, XCircle,
  Keyboard, Gear, PlayCircle,
} from '@phosphor-icons/react';
import { usePreferencesStore } from '../store/preferencesStore';
import { toast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

type SettingsTab = 'general' | 'playback' | 'playlists' | 'epg' | 'data' | 'shortcuts' | 'about';

const TABS: { id: SettingsTab; label: string; icon: React.FC<any> }[] = [
  { id: 'general', label: 'General', icon: Gear },
  { id: 'playback', label: 'Playback', icon: PlayCircle },
  { id: 'playlists', label: 'Playlists', icon: Playlist },
  { id: 'epg', label: 'EPG', icon: Broadcast },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
];

const Settings: React.FC = () => {
  const { prefs, loadPreferences, updatePreference } = usePreferencesStore();
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  const [epgUrl, setEpgUrl] = useState('');
  const [epgSources, setEpgSources] = useState<any[]>([]);
  const [epgStats, setEpgStats] = useState<any>(null);
  const [epgLoading, setEpgLoading] = useState(true);

  const [playerStatus, setPlayerStatus] = useState<{ mpv: any; vlc: any }>({ mpv: null, vlc: null });
  const [playerLoading, setPlayerLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [locatingMpv, setLocatingMpv] = useState(false);
  const [locatingVlc, setLocatingVlc] = useState(false);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  useEffect(() => {
    withTimeout(window.electronAPI.getPlaylists()).then(l => { setPlaylists(l); }).catch(() => {}).finally(() => setPlaylistsLoading(false));
    withTimeout(window.electronAPI.getSettings()).then(s => { if (s.epgUrl) setEpgUrl(s.epgUrl); }).catch(() => {});
    withTimeout(window.electronAPI.getEpgSources().catch(() => [])).then(s => setEpgSources(s)).catch(() => {}).finally(() => setEpgLoading(false));
    withTimeout(window.electronAPI.getEpgStats().catch(() => null)).then(s => setEpgStats(s)).catch(() => {});
    withTimeout(Promise.all([
      window.electronAPI.checkPlayerAvailability('mpv').catch(() => ({ available: false })),
      window.electronAPI.checkPlayerAvailability('vlc').catch(() => ({ available: false })),
    ])).then(([mpv, vlc]) => { setPlayerStatus({ mpv, vlc }); }).catch(() => {}).finally(() => setPlayerLoading(false));
  }, []);

  const stagePreference = (key: string, value: any) => {
    setPendingChanges((prev) => ({ ...prev, [key]: value }));
  };

  const prefValue = (key: string): any => {
    if (key in pendingChanges) return pendingChanges[key];
    return (prefs as any)?.[key];
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const savePreferences = async () => {
    try {
      for (const [key, value] of Object.entries(pendingChanges)) {
        await updatePreference(key, value);
      }
      setPendingChanges({});
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
  };

  const discardChanges = () => {
    setPendingChanges({});
    toast.info('Changes discarded');
  };

  const handleEpgSync = async () => {
    if (!epgUrl) return;
    setSyncing(true);
    try {
      const result = await withTimeout(window.electronAPI.importEpg(epgUrl));
      if (result.success) {
        await window.electronAPI.setSetting('epgUrl', epgUrl);
        toast.success(`Imported ${result.count?.toLocaleString()} EPG programs`);
        const [sources, stats] = await Promise.all([
          window.electronAPI.getEpgSources().catch(() => []),
          window.electronAPI.getEpgStats().catch(() => null),
        ]);
        setEpgSources(sources);
        setEpgStats(stats);
      } else {
        toast.error(result.error || 'EPG import failed');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      await window.electronAPI.deletePlaylist(id);
      toast.success('Playlist deleted');
      setConfirmDelete(null);
      setPlaylists(await window.electronAPI.getPlaylists());
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRefreshPlaylist = async (id: string) => {
    toast.info('Refreshing playlist...');
    try {
      const result = await window.electronAPI.refreshPlaylist(id);
      if (result.success) {
        toast.success(`Refreshed — ${result.count} channels`);
        setPlaylists(await window.electronAPI.getPlaylists());
      } else {
        toast.error(result.error || 'Refresh failed');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleClearAllData = async () => {
    try {
      await window.electronAPI.clearAllData();
      toast.success('All data cleared');
      setConfirmClearAll(false);
      setPlaylists([]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleExportBackup = async () => {
    const result = await window.electronAPI.exportBackup();
    if (result.success) toast.success('Backup exported successfully');
  };

  const handleImportBackup = async () => {
    const result = await window.electronAPI.importBackup();
    if (result.success) toast.info('Backup imported. Please restart the app.');
  };

  const locateBinary = async (player: 'mpv' | 'vlc') => {
    const setter = player === 'mpv' ? setLocatingMpv : setLocatingVlc;
    setter(true);
    try {
      const result = await window.electronAPI.selectFile();
      if (result) {
        await updatePreference(player === 'mpv' ? 'mpv_path' : 'vlc_path', result.path);
        toast.success(`${player.toUpperCase()} binary set to ${result.path}`);
        const status = await window.electronAPI.checkPlayerAvailability(player);
        setPlayerStatus((prev) => ({ ...prev, [player]: status }));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setter(false);
    }
  };

  const playlistsToDelete = confirmDelete
    ? playlists.find((p) => p.id === confirmDelete)
    : null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-depth p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm text-text-secondary uppercase tracking-wider">Display</h3>
              <div>
                <label className="text-xs text-text-tertiary mb-1.5 block">Grid Size</label>
                <select value={prefValue('grid_size') || 'medium'} onChange={(e) => stagePreference('grid_size', e.target.value)}
                  className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-white/20">
                  <option value="small">Small (140px)</option>
                  <option value="medium">Medium (180px)</option>
                  <option value="large">Large (220px)</option>
                </select>
              </div>
              <ToggleSetting label="Show Channel Numbers" checked={prefValue('show_channel_numbers') === 1} onChange={(v) => stagePreference('show_channel_numbers', v ? 1 : 0)} />
              <ToggleSetting label="Show Channel Logos" checked={prefValue('show_channel_logos') === 1} onChange={(v) => stagePreference('show_channel_logos', v ? 1 : 0)} />
              <ToggleSetting label="Compact Mode" description="Smaller interface elements" checked={prefValue('compact_mode') === 1} onChange={(v) => stagePreference('compact_mode', v ? 1 : 0)} />
              {/* Live preview */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-2">Preview</p>
                <div className="bg-bg-base rounded-lg p-2 space-y-1">
                  {[
                    { n: 'ESPN HD', logo: prefValue('show_channel_logos') === 1, num: prefValue('show_channel_numbers') === 1 },
                    { n: 'CNN International', logo: prefValue('show_channel_logos') === 1, num: prefValue('show_channel_numbers') === 1 },
                    { n: 'HBO 2', logo: prefValue('show_channel_logos') === 1, num: prefValue('show_channel_numbers') === 1 },
                  ].map((ch, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.03]">
                      {ch.num && <span className="w-6 text-[10px] text-text-tertiary font-mono text-right">{101 + i}</span>}
                      {ch.logo && <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center flex-shrink-0"><span className="text-[7px] font-bold text-accent">{ch.n.substring(0, 2)}</span></div>}
                      <span className={`text-[11px] ${prefValue('compact_mode') === 1 ? 'text-text-tertiary' : 'text-text-secondary'}`}>{ch.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card-depth p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm text-text-secondary uppercase tracking-wider">Behavior</h3>
              <div>
                <label className="text-xs text-text-tertiary mb-1.5 block">Sort Channels By</label>
                <select value={prefValue('sort_channels_by') || 'name'} onChange={(e) => stagePreference('sort_channels_by', e.target.value)}
                  className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-white/20">
                  <option value="name">Name</option>
                  <option value="number">Channel Number</option>
                  <option value="group">Category</option>
                  <option value="recent">Recently Watched</option>
                </select>
              </div>
              <ToggleSetting label="Start Minimized" description="Launch app to system tray" checked={prefValue('start_minimized') === 1} onChange={(v) => stagePreference('start_minimized', v ? 1 : 0)} />
              <ToggleSetting label="Debug Logging" description="Enable verbose console output" checked={prefValue('debug_logging') === 1} onChange={(v) => stagePreference('debug_logging', v ? 1 : 0)} />
            </div>
          </div>
        );

      case 'playback':
        return (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-base">Playback</h3>
            {playerLoading ? (
              <p className="text-text-tertiary text-sm py-4">Loading...</p>
            ) : (
              <>
                <div>
                  <label className="text-xs text-text-tertiary mb-1.5 block">Default Player</label>
                  <select value={prefValue('player_type') || 'internal'} onChange={(e) => stagePreference('player_type', e.target.value)}
                    className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-full max-w-xs focus:outline-none focus:border-white/20">
                    <option value="internal">Internal (HLS.js)</option>
                    <option value="mpv">MPV</option>
                    <option value="vlc">VLC</option>
                  </select>
                </div>
                <ToggleSetting label="Hardware Acceleration" description="Use GPU for video decoding" checked={prefValue('hardware_acceleration') === 1} onChange={(v) => stagePreference('hardware_acceleration', v ? 1 : 0)} />
                <ToggleSetting label="Remember Playback Position" description="Resume from where you left off" checked={prefValue('remember_position') === 1} onChange={(v) => stagePreference('remember_position', v ? 1 : 0)} />
                <ToggleSetting label="Auto-Play Next Episode" description="Automatically play next episode in series" checked={prefValue('auto_play_next') === 1} onChange={(v) => stagePreference('auto_play_next', v ? 1 : 0)} />
                <BinaryStatus name="MPV" available={playerStatus.mpv?.available} path={prefValue('mpv_path')} onLocate={() => locateBinary('mpv')} loading={locatingMpv} />
                <BinaryStatus name="VLC" available={playerStatus.vlc?.available} path={prefValue('vlc_path')} onLocate={() => locateBinary('vlc')} loading={locatingVlc} />
              </>
            )}
          </div>
        );

      case 'playlists':
        return (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-base">Playlists</h3>
            {playlistsLoading ? (
              <p className="text-text-tertiary text-sm py-4">Loading...</p>
            ) : playlists.length === 0 ? (
              <p className="text-text-secondary text-sm">No playlists added yet.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {playlists.map((p) => (
                  <div key={p.id} className="flex items-center justify-between card-depth px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-text-secondary rounded font-medium uppercase">{p.type}</span>
                        <span className="text-xs text-text-tertiary">{p.channel_count || 0} channels</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button onClick={() => handleRefreshPlaylist(p.id)}
                        className="p-1.5 text-text-tertiary hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                        <ArrowClockwise size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(p.id)}
                        className="p-1.5 text-text-tertiary hover:text-state-error rounded-lg hover:bg-white/5 transition-colors">
                        <TrashSimple size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'epg':
        return (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-base">EPG (XMLTV)</h3>
            <p className="text-xs text-text-tertiary">Electronic Program Guide data</p>
            <div className="flex gap-2">
              <input value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)}
                placeholder="https://example.com/xmltv.xml.gz"
                className="flex-1 bg-bg-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/20 transition-colors" />
              <button onClick={handleEpgSync} disabled={syncing || !epgUrl}
                className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40 flex items-center gap-2">
                {syncing ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : 'Import'}
              </button>
            </div>
            {epgLoading ? (
              <p className="text-text-tertiary text-xs py-2">Loading EPG info...</p>
            ) : (
              <>
                {epgStats && (
                  <div className="flex items-center gap-4 text-xs text-text-tertiary">
                    <span>{epgStats.totalPrograms?.toLocaleString()} programs</span>
                    <span>{epgStats.uniqueChannels} channels</span>
                  </div>
                )}
                {epgSources.length > 0 && (
                  <div className="space-y-1">
                    {epgSources.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs">
                        <span className="truncate text-text-tertiary">{s.url}</span>
                        <button onClick={async () => { await window.electronAPI.removeEpgSource(s.id); setEpgSources(await window.electronAPI.getEpgSources().catch(() => [])); }}
                          className="p-1 text-text-tertiary hover:text-state-error transition-colors ml-2">
                          <TrashSimple size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'data':
        return (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-base">Data Management</h3>
            <div className="space-y-2">
              <ActionButton icon={FolderOpen} label="Open Data Folder" onClick={() => window.electronAPI.openDataFolder()} />
              <ActionButton icon={DownloadSimple} label="Export Database Backup" onClick={handleExportBackup} />
              <ActionButton icon={UploadSimple} label="Import Database Backup" onClick={handleImportBackup} />
              <ActionButton icon={TrashSimple} label="Clear Watch History" onClick={async () => { await window.electronAPI.clearHistory(); toast.success('Watch history cleared'); await loadPreferences(); }} />
              <button onClick={() => setConfirmClearAll(true)}
                className="flex items-center gap-3 w-full px-4 py-3 bg-state-error/5 border border-state-error/20 rounded-xl text-sm text-state-error hover:bg-state-error/10 transition-colors">
                <TrashSimple size={16} />
                <span>Clear All Data</span>
              </button>
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-base">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Toggle Sidebar', 'Ctrl + B'],
                ['Search', 'Ctrl + K / Ctrl + F'],
                ['Fullscreen', 'F'],
                ['Reload Channels', 'Ctrl + R'],
                ['Play / Pause', 'Space / K'],
                ['Mute', 'M'],
                ['Volume Up / Down', '↑ / ↓'],
                ['Previous / Next Channel', '← / → (live)'],
                ['Picture-in-Picture', 'P'],
                ['Exit Fullscreen', 'Esc'],
              ].map(([action, key]) => (
                <div key={action} className="flex justify-between py-1.5 border-b border-border-subtle/50">
                  <span className="text-text-secondary">{action}</span>
                  <kbd className="px-2 py-0.5 bg-bg-base rounded text-xs text-text-tertiary font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-5">
            <h3 className="font-display font-semibold text-base">About</h3>
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-gold flex items-center justify-center mb-4">
                <span className="text-black font-bold text-3xl">W</span>
              </div>
              <h3 className="font-display font-bold text-2xl tracking-tight">WatchHQ</h3>
              <p className="text-text-tertiary text-sm mt-0.5">v1.0.0</p>
              <p className="text-text-tertiary text-xs mt-3">Built with Electron</p>
              <button onClick={() => window.electronAPI.openDataFolder()}
                className="mt-3 text-xs text-text-tertiary hover:text-white underline underline-offset-2 transition-colors">
                Open data folder →
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full">
      {/* Left tab rail */}
      <div className="w-[200px] flex-shrink-0 border-r border-border-subtle bg-bg-base/50 flex flex-col py-6 px-3 overflow-y-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right content pane */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-8 py-6 pb-24">
          {renderTabContent()}
        </div>
      </div>

      {confirmDelete && playlistsToDelete && (
        <ConfirmDialog
          title="Delete Playlist"
          message={`This will permanently delete "${playlistsToDelete.name}" and all its channels.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => handleDeletePlaylist(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmClearAll && (
        <ConfirmDialog
          title="Clear All Data"
          message="This will delete all playlists, channels, VOD, series, EPG data, favorites, and watch history."
          confirmLabel="Clear Everything"
          variant="danger"
          onConfirm={handleClearAllData}
          onCancel={() => setConfirmClearAll(false)}
        />
      )}

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-0 left-[72px] right-0 z-50 bg-bg-elevated/95 backdrop-blur-xl border-t border-border-subtle px-8 py-4 flex items-center justify-between"
          >
            <p className="text-sm text-text-secondary">
              <span className="text-white font-medium">{Object.keys(pendingChanges).length}</span> pending change(s)
            </p>
            <div className="flex items-center gap-3">
              <button onClick={discardChanges}
                className="px-5 py-2.5 text-sm border border-border-subtle rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-colors">Discard</button>
              <button onClick={savePreferences}
                className="px-5 py-2.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors">Save Changes</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ToggleSetting: React.FC<{ label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-1">
    {(label || description) && (
      <div>
        {label && <p className="text-sm text-text-primary">{label}</p>}
        {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
      </div>
    )}
    <button onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${label || description ? 'ml-3' : ''} ${checked ? 'bg-accent' : 'bg-white/10'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-black transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  </div>
);

const ActionButton: React.FC<{ icon: React.FC<any>; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-3 w-full px-4 py-3 card-depth-hover text-sm">
    <Icon size={16} className="text-text-tertiary" />
    <span>{label}</span>
  </button>
);

const BinaryStatus: React.FC<{ name: string; available: boolean; path: string; onLocate: () => void; loading: boolean }> = ({ name, available, path, onLocate, loading }) => (
  <div className="flex items-center justify-between card-depth px-4 py-3">
    <div className="flex items-center gap-2">
      {available ? <CheckCircle size={14} className="text-state-success" weight="fill" /> : <XCircle size={14} className="text-state-error" weight="fill" />}
      <span className="text-sm text-text-secondary">{name}: {available ? `Detected at ${path || 'default path'}` : 'Not found'}</span>
    </div>
    <button onClick={onLocate} disabled={loading}
      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40">
      {loading ? '...' : 'Locate'}
    </button>
  </div>
);

export default Settings;
