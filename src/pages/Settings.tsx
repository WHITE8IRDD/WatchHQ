import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2, Play, Calendar, Database, Trash2, Info, Sun, Moon, Monitor, Save } from 'lucide-react';
import { usePreferencesStore } from '../store/preferencesStore';
import { toast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

type SettingsTab = 'general' | 'playback' | 'epg' | 'backup' | 'reset' | 'about';

const tabs = [
  { id: 'general' as SettingsTab, label: 'General', icon: Settings2 },
  { id: 'playback' as SettingsTab, label: 'Playback', icon: Play },
  { id: 'epg' as SettingsTab, label: 'EPG', icon: Calendar },
  { id: 'backup' as SettingsTab, label: 'Backup', icon: Database },
  { id: 'reset' as SettingsTab, label: 'Reset', icon: Trash2 },
  { id: 'about' as SettingsTab, label: 'About', icon: Info },
];

const Settings: React.FC = () => {
  const { prefs, loadPreferences, updatePreference } = usePreferencesStore();
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  const [epgUrl, setEpgUrl] = useState('');
  const [epgSources, setEpgSources] = useState<any[]>([]);
  const [epgStats, setEpgStats] = useState<any>(null);
  const [epgLoading, setEpgLoading] = useState(true);

  const [playerStatus, setPlayerStatus] = useState<{ mpv: any; vlc: any }>({ mpv: null, vlc: null });
  const [playerLoading, setPlayerLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

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
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(pendingChanges)) {
        await updatePreference(key, value);
      }
      setPendingChanges({});
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
    setSaving(false);
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

  const handleExportBackup = async () => {
    const result = await window.electronAPI.exportBackup();
    if (result.success) toast.success('Backup exported successfully');
  };

  const handleImportBackup = async () => {
    const result = await window.electronAPI.importBackup();
    if (result.success) toast.info('Backup imported. Please restart the app.');
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <SettingSection icon={Settings2} title="General" description="Application preferences">
            <SettingRow label="Language" description="Interface language">
              <select value={prefValue('language') || 'en'} onChange={(e) => stagePreference('language', e.target.value)}
                className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-40 focus:outline-none focus:border-white/20">
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
              </select>
            </SettingRow>
            <SettingRow label="Visual Theme" description="Choose your preferred appearance">
              <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                {[
                  { value: 'light', icon: Sun },
                  { value: 'dark', icon: Moon },
                  { value: 'system', icon: Monitor },
                ].map(({ value, icon: Icon }) => (
                  <button key={value} onClick={() => stagePreference('theme', value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      (prefValue('theme') || 'dark') === value ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-white'
                    }`}>
                    <Icon size={14} />
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Show Dashboard" description="Show dashboard on home page">
              <Toggle value={prefValue('show_dashboard') === 1} onChange={(v) => stagePreference('show_dashboard', v ? 1 : 0)} />
            </SettingRow>
            <SettingRow label="Startup View" description="What to show on startup">
              <select value={prefValue('startup_view') || 'first'} onChange={(e) => stagePreference('startup_view', e.target.value)}
                className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-44 focus:outline-none focus:border-white/20">
                <option value="first">First available view</option>
                <option value="last">Restore last view</option>
              </select>
            </SettingRow>
            <SettingRow label="Show Subtitles" description="Display subtitles when available">
              <Toggle value={prefValue('show_subtitles') === 1} onChange={(v) => stagePreference('show_subtitles', v ? 1 : 0)} />
            </SettingRow>
          </SettingSection>
        );

      case 'playback':
        return (
          <SettingSection icon={Play} title="Playback" description="Configure video playback settings">
            <SettingRow label="Default Player" description="Which player to use for video playback">
              <select value={prefValue('player_type') || 'internal'} onChange={(e) => stagePreference('player_type', e.target.value)}
                className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-40 focus:outline-none focus:border-white/20">
                <option value="internal">Internal</option>
                <option value="mpv">MPV</option>
                <option value="vlc">VLC</option>
              </select>
            </SettingRow>
            <SettingRow label="Hardware Acceleration" description="Use GPU for video decoding">
              <Toggle value={prefValue('hardware_acceleration') === 1} onChange={(v) => stagePreference('hardware_acceleration', v ? 1 : 0)} />
            </SettingRow>
            <SettingRow label="Remember Playback Position" description="Resume from where you left off">
              <Toggle value={prefValue('remember_position') === 1} onChange={(v) => stagePreference('remember_position', v ? 1 : 0)} />
            </SettingRow>
            <SettingRow label="Auto-play Next Episode" description="Automatically play next episode in series">
              <Toggle value={prefValue('auto_play_next') === 1} onChange={(v) => stagePreference('auto_play_next', v ? 1 : 0)} />
            </SettingRow>
          </SettingSection>
        );

      case 'epg':
        return (
          <SettingSection icon={Calendar} title="EPG" description="Electronic Program Guide">
            <SettingRow label="EPG URL" description="URL to XMLTV data">
              <div className="flex gap-2">
                <input value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)}
                  placeholder="https://example.com/xmltv.xml.gz"
                  className="bg-bg-base border border-border-subtle rounded-xl px-3 py-2 text-sm text-white w-64 placeholder-text-tertiary focus:outline-none focus:border-white/20" />
                <button onClick={handleEpgSync} disabled={syncing || !epgUrl}
                  className="px-4 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40 flex items-center gap-2">
                  {syncing ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : 'Import'}
                </button>
              </div>
            </SettingRow>
            {epgLoading ? (
              <p className="text-xs text-text-tertiary">Loading EPG info...</p>
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
                      <div key={s.id} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-text-tertiary truncate">{s.url}</span>
                        <button onClick={async () => { await window.electronAPI.removeEpgSource(s.id); setEpgSources(await window.electronAPI.getEpgSources().catch(() => [])); }}
                          className="p-1 text-text-tertiary hover:text-state-error transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </SettingSection>
        );

      case 'backup':
        return (
          <SettingSection icon={Database} title="Backup" description="Export or import your data">
            <SettingRow label="Open Data Folder" description="Browse application data files">
              <button onClick={() => window.electronAPI.openDataFolder()}
                className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/20 transition-colors">Open</button>
            </SettingRow>
            <SettingRow label="Export Database Backup" description="Save a backup of your data">
              <button onClick={handleExportBackup}
                className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/20 transition-colors">Export</button>
            </SettingRow>
            <SettingRow label="Import Database Backup" description="Restore from a backup file">
              <button onClick={handleImportBackup}
                className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/20 transition-colors">Import</button>
            </SettingRow>
            <SettingRow label="Clear Watch History" description="Remove all watch history records">
              <button onClick={async () => { await window.electronAPI.clearHistory(); toast.success('Watch history cleared'); }}
                className="px-4 py-2 bg-state-error/10 text-state-error rounded-xl text-sm hover:bg-state-error/20 transition-colors">Clear</button>
            </SettingRow>
          </SettingSection>
        );

      case 'reset':
        return (
          <SettingSection icon={Trash2} title="Reset" description="Dangerous actions — proceed with caution">
            <button onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-2 w-full px-4 py-3 bg-state-error/10 border border-state-error/20 rounded-xl text-sm text-state-error hover:bg-state-error/20 transition-colors justify-center">
              <Trash2 size={16} />
              Clear All Data
            </button>
          </SettingSection>
        );

      case 'about':
        return (
          <div className="border border-border-subtle rounded-2xl p-6">
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
      <div className="w-[280px] border-r border-border-subtle p-6 flex-shrink-0">
        <h1 className="text-2xl font-display font-bold mb-2">Settings</h1>
        <p className="text-sm text-text-secondary mb-6">Change the configuration of the application</p>
        <nav className="space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors ${
                  activeTab === tab.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-white/5'
                }`}>
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-8 pb-24">
          {renderTabContent()}
        </div>
      </div>

      {hasChanges && (
        <motion.button initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={savePreferences} disabled={saving}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-2 px-5 py-3 bg-white text-black rounded-xl font-medium shadow-xl hover:bg-white/90">
          <Save size={16} /> {saving ? 'Saving\u2026' : 'Save changes'}
        </motion.button>
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
    </div>
  );
};

const SettingSection: React.FC<{ icon: any; title: string; description: string; children: React.ReactNode }> = ({ icon: Icon, title, description, children }) => (
  <div className="border border-border-subtle rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-6">
      <Icon size={20} className="text-accent" />
      <div>
        <h2 className="font-display font-semibold">{title}</h2>
        <p className="text-xs text-text-tertiary">{description}</p>
      </div>
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-8 py-2 border-b border-border-subtle last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} className={`w-10 h-6 rounded-full relative transition-colors ${value ? 'bg-accent' : 'bg-white/10'}`}>
    <span className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${value ? 'bg-black translate-x-5' : 'bg-white translate-x-1'}`} />
  </button>
);

export default Settings;
