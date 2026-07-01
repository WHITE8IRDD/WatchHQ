// src/pages/Settings.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Playlist,
  Broadcast,
  Monitor,
  Sun,
  Database,
  Info,
  TrashSimple,
  DownloadSimple,
  UploadSimple,
  FolderOpen,
  ArrowClockwise,
  CheckCircle,
  XCircle,
  GearSix,
} from '@phosphor-icons/react';
import { usePreferencesStore } from '../store/preferencesStore';
import { toast } from '../components/common/Toast';
import { Skeleton } from '../components/common/Skeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { staggerContainer, fadeInUp } from '../lib/motion';

function flattenPrefs(prefs: any): Record<string, any> {
  if (!prefs) return {};
  const { id, updated_at, ...rest } = prefs as any;
  return rest;
}

const Settings: React.FC = () => {
  const { prefs, loadPreferences, updatePreference } = usePreferencesStore();
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [epgUrl, setEpgUrl] = useState('');
  const [epgSources, setEpgSources] = useState<any[]>([]);
  const [epgStats, setEpgStats] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<{ mpv: any; vlc: any }>({ mpv: null, vlc: null });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locatingMpv, setLocatingMpv] = useState(false);
  const [locatingVlc, setLocatingVlc] = useState(false);

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
      toast.success('Preferences saved');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
  };

  const discardChanges = () => {
    setPendingChanges({});
    toast.info('Changes discarded');
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [lists, settings] = await Promise.all([
          window.electronAPI.getPlaylists(),
          window.electronAPI.getSettings(),
        ]);
        setPlaylists(lists);
        if (settings.epgUrl) setEpgUrl(settings.epgUrl);

        const [sources, stats] = await Promise.all([
          window.electronAPI.getEpgSources().catch(() => []),
          window.electronAPI.getEpgStats().catch(() => null),
        ]);
        setEpgSources(sources);
        setEpgStats(stats);

        const [mpv, vlc] = await Promise.all([
          window.electronAPI.checkPlayerAvailability('mpv').catch(() => ({ available: false })),
          window.electronAPI.checkPlayerAvailability('vlc').catch(() => ({ available: false })),
        ]);
        setPlayerStatus({ mpv, vlc });
      } catch (error: any) {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleEpgSync = async () => {
    if (!epgUrl) return;
    setSyncing(true);
    try {
      const result = await window.electronAPI.importEpg(epgUrl);
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-elevated border border-border-subtle rounded-2xl p-6">
              <Skeleton className="w-10 h-10 rounded-xl mb-4" />
              <Skeleton className="w-1/3 h-4 mb-1" />
              <Skeleton className="w-1/2 h-3 mb-4" />
              <Skeleton className="w-full h-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="p-8 pt-8 h-full overflow-y-auto pb-20" {...staggerContainer}>
      <motion.div className="mb-8" {...fadeInUp}>
        <h1 className="text-2xl font-display font-bold tracking-tight">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your IPTV configuration</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Playlists */}
        <Card icon={Playlist} title="Playlists" subtitle={`${playlists.length} source(s) configured`}>
          {playlists.length === 0 ? (
            <p className="text-text-secondary text-sm">No playlists added yet.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {playlists.map((p) => (
                <ContextMenu.Root key={p.id}>
                  <ContextMenu.Trigger asChild>
                    <div className="flex items-center justify-between bg-bg-base border border-border-subtle rounded-xl px-4 py-3 cursor-context-menu">
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
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Content className="min-w-[180px] bg-bg-elevated border border-border-subtle rounded-xl p-1.5 shadow-2xl z-50">
                      <ContextMenu.Item
                        onSelect={() => handleRefreshPlaylist(p.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-white rounded-lg hover:bg-white/5 cursor-pointer outline-none"
                      >
                        <ArrowClockwise size={14} /> Refresh
                      </ContextMenu.Item>
                      <ContextMenu.Separator className="h-px bg-border-subtle mx-2 my-1" />
                      <ContextMenu.Item
                        onSelect={() => setConfirmDelete(p.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-state-error rounded-lg hover:bg-white/5 cursor-pointer outline-none"
                      >
                        <TrashSimple size={14} /> Remove
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              ))}
            </div>
          )}
        </Card>

        {/* EPG */}
        <Card icon={Broadcast} title="EPG (XMLTV)" subtitle="Electronic Program Guide data">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                placeholder="https://example.com/xmltv.xml.gz"
                className="flex-1 bg-bg-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/20 transition-colors"
              />
              <button
                onClick={handleEpgSync}
                disabled={syncing || !epgUrl}
                className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {syncing ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : 'Import'}
              </button>
            </div>
            {epgStats && (
              <div className="flex items-center gap-4 text-xs text-text-tertiary">
                <span>{epgStats.totalPrograms?.toLocaleString()} programs</span>
                <span>{epgStats.uniqueChannels} channels</span>
              </div>
            )}
            {epgSources.length > 0 && (
              <div className="space-y-1">
                {epgSources.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between bg-bg-base rounded-lg px-3 py-2 text-xs">
                    <span className="truncate text-text-tertiary">{s.url}</span>
                    <button onClick={async () => {
                      await window.electronAPI.removeEpgSource(s.id);
                      setEpgSources(await window.electronAPI.getEpgSources().catch(() => []));
                    }} className="p-1 text-text-tertiary hover:text-state-error transition-colors ml-2">
                      <TrashSimple size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Player */}
        <Card icon={Monitor} title="Player" subtitle="Playback engine configuration">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1.5 block">Default Player</label>
              <select
                value={prefValue('player_type') || 'internal'}
                onChange={(e) => stagePreference('player_type', e.target.value)}
                className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-full max-w-xs focus:outline-none focus:border-white/20"
              >
                <option value="internal">Internal (HLS.js)</option>
                <option value="mpv">MPV</option>
                <option value="vlc">VLC</option>
              </select>
            </div>

            {/* MPV */}
            <div className="flex items-center justify-between bg-bg-base rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                {playerStatus.mpv?.available ? (
                  <CheckCircle size={14} className="text-state-success" weight="fill" />
                ) : (
                  <XCircle size={14} className="text-state-error" weight="fill" />
                )}
                <span className="text-sm text-text-secondary">
                  MPV: {playerStatus.mpv?.available ? `Detected at ${prefValue('mpv_path') || 'default path'}` : 'Not found'}
                </span>
              </div>
              <button
                onClick={() => locateBinary('mpv')}
                disabled={locatingMpv}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {locatingMpv ? '...' : 'Locate binary'}
              </button>
            </div>

            {/* VLC */}
            <div className="flex items-center justify-between bg-bg-base rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                {playerStatus.vlc?.available ? (
                  <CheckCircle size={14} className="text-state-success" weight="fill" />
                ) : (
                  <XCircle size={14} className="text-state-error" weight="fill" />
                )}
                <span className="text-sm text-text-secondary">
                  VLC: {playerStatus.vlc?.available ? `Detected at ${prefValue('vlc_path') || 'default path'}` : 'Not found'}
                </span>
              </div>
              <button
                onClick={() => locateBinary('vlc')}
                disabled={locatingVlc}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {locatingVlc ? '...' : 'Locate binary'}
              </button>
            </div>

            <ToggleSetting
              label="Hardware Acceleration"
              description="Use GPU for video decoding"
              checked={prefValue('hardware_acceleration') === 1}
              onChange={(v) => stagePreference('hardware_acceleration', v ? 1 : 0)}
            />
            <ToggleSetting
              label="Remember Playback Position"
              description="Resume from where you left off"
              checked={prefValue('remember_position') === 1}
              onChange={(v) => stagePreference('remember_position', v ? 1 : 0)}
            />
            <ToggleSetting
              label="Auto-Play Next Episode"
              description="Automatically play next episode in series"
              checked={prefValue('auto_play_next') === 1}
              onChange={(v) => stagePreference('auto_play_next', v ? 1 : 0)}
            />
          </div>
        </Card>

        {/* Display */}
        <Card icon={Sun} title="Display" subtitle="Visual preferences">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1.5 block">Grid Size</label>
              <select
                value={prefValue('grid_size') || 'medium'}
                onChange={(e) => stagePreference('grid_size', e.target.value)}
                className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-full max-w-xs focus:outline-none focus:border-white/20"
              >
                <option value="small">Small (140px)</option>
                <option value="medium">Medium (180px)</option>
                <option value="large">Large (220px)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1.5 block">Sort Channels By</label>
              <select
                value={prefValue('sort_channels_by') || 'name'}
                onChange={(e) => stagePreference('sort_channels_by', e.target.value)}
                className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-full max-w-xs focus:outline-none focus:border-white/20"
              >
                <option value="name">Name</option>
                <option value="number">Channel Number</option>
                <option value="group">Category</option>
                <option value="recent">Recently Watched</option>
              </select>
            </div>
            <ToggleSetting
              label="Show Channel Numbers"
              checked={prefValue('show_channel_numbers') === 1}
              onChange={(v) => stagePreference('show_channel_numbers', v ? 1 : 0)}
            />
            <ToggleSetting
              label="Show Channel Logos"
              checked={prefValue('show_channel_logos') === 1}
              onChange={(v) => stagePreference('show_channel_logos', v ? 1 : 0)}
            />
          </div>
        </Card>

        {/* Data */}
        <Card icon={Database} title="Data Management" subtitle="Backup, restore, and maintenance">
          <div className="space-y-2">
            <button onClick={() => window.electronAPI.openDataFolder()}
              className="flex items-center gap-3 w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-xl text-sm hover:bg-white/[0.02] transition-colors">
              <FolderOpen size={16} className="text-text-tertiary" />
              <span>Open Data Folder</span>
            </button>
            <button onClick={handleExportBackup}
              className="flex items-center gap-3 w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-xl text-sm hover:bg-white/[0.02] transition-colors">
              <DownloadSimple size={16} className="text-text-tertiary" />
              <span>Export Database Backup</span>
            </button>
            <button onClick={handleImportBackup}
              className="flex items-center gap-3 w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-xl text-sm hover:bg-white/[0.02] transition-colors">
              <UploadSimple size={16} className="text-text-tertiary" />
              <span>Import Database Backup</span>
            </button>
            <button onClick={async () => {
              await window.electronAPI.clearHistory();
              toast.success('Watch history cleared');
              await loadPreferences();
            }}
              className="flex items-center gap-3 w-full px-4 py-3 bg-bg-base border border-border-subtle rounded-xl text-sm hover:bg-white/[0.02] transition-colors">
              <TrashSimple size={16} className="text-text-tertiary" />
              <span>Clear Watch History</span>
            </button>
            <button onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-3 w-full px-4 py-3 bg-state-error/5 border border-state-error/20 rounded-xl text-sm text-state-error hover:bg-state-error/10 transition-colors">
              <TrashSimple size={16} />
              <span>Clear All Data</span>
            </button>
          </div>
        </Card>

        {/* About */}
        <Card icon={Info} title="About" subtitle="WatchHQ IPTV Player">
          <div className="flex flex-col items-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center mb-3">
              <span className="text-black font-bold text-2xl">W</span>
            </div>
            <h3 className="font-display font-bold text-xl tracking-tight">WatchHQ</h3>
            <p className="text-text-tertiary text-sm mt-0.5">v1.0.0</p>
            <p className="text-text-tertiary text-xs mt-3">Built with Electron</p>
            <button onClick={() => window.electronAPI.openDataFolder()}
              className="mt-2 text-xs text-text-tertiary hover:text-white underline underline-offset-2 transition-colors">
              Open data folder →
            </button>
          </div>
        </Card>
      </div>

      {/* Confirm Delete */}
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

      {/* Confirm Clear All */}
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

      {/* Sticky Save/Discard bar */}
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
              <button
                onClick={discardChanges}
                className="px-5 py-2.5 text-sm border border-border-subtle rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={savePreferences}
                className="px-5 py-2.5 text-sm bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Card: React.FC<{
  icon: React.FC<any>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, children }) => (
  <motion.div
    className="bg-bg-elevated border border-border-subtle rounded-2xl p-6"
    {...fadeInUp}
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-display font-semibold text-sm">{title}</h3>
        <p className="text-text-tertiary text-xs">{subtitle}</p>
      </div>
    </div>
    {children}
  </motion.div>
);

const ToggleSetting: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <div>
      <p className="text-sm text-text-primary">{label}</p>
      {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ml-3 ${
        checked ? 'bg-white' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-black transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export default Settings;
