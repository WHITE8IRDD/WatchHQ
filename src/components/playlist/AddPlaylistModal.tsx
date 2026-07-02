// src/components/playlist/AddPlaylistModal.tsx
import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileArrowDown, Upload } from '@phosphor-icons/react';
import { usePlaylistStore } from '../../store/playlistStore';
import { toast } from '../common/Toast';
import { modalOverlay, modalContent } from '../../lib/motion';

interface AddPlaylistModalProps {
  onClose: () => void;
}

type Tab = 'm3u' | 'xtream' | 'stalker';

const AddPlaylistModal: React.FC<AddPlaylistModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('m3u');
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // M3U
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Xtream
  const [xtHost, setXtHost] = useState('');
  const [xtUser, setXtUser] = useState('');
  const [xtPass, setXtPass] = useState('');

  // Stalker
  const [stPortal, setStPortal] = useState('');
  const [stMac, setStMac] = useState('');

  const { addPlaylist, loadPlaylists, loadChannels } = usePlaylistStore();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(m3u8?|txt)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setFileContent(content);
        setFileName(file.name);
        if (!m3uName) setM3uName(file.name.replace(/\.[^.]+$/, ''));
      };
      reader.readAsText(file);
    } else {
      toast.error('Please drop a valid .m3u or .m3u8 file');
    }
  }, [m3uName]);

  const handleBrowse = async () => {
    try {
      const result = await window.electronAPI.selectFile();
      if (result) {
        setFileContent(result.content);
        const name = result.path.split(/[\\/]/).pop() || 'playlist.m3u';
        setFileName(name);
        if (!m3uName) setM3uName(name.replace(/\.[^.]+$/, ''));
      }
    } catch (error: any) {
      toast.error('Failed to read file: ' + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let payload: any = { type: activeTab };

      if (activeTab === 'm3u') {
        if (fileContent) {
          payload = { ...payload, name: m3uName, rawContent: fileContent };
        } else if (m3uUrl) {
          payload = { ...payload, name: m3uName, url: m3uUrl };
        } else {
          toast.error('Provide a file or URL for the M3U playlist');
          setSubmitting(false);
          return;
        }
      } else if (activeTab === 'xtream') {
        if (!xtHost || !xtUser || !xtPass) {
          toast.error('Fill in host, username, and password');
          setSubmitting(false);
          return;
        }
        payload = {
          ...payload,
          name: m3uName || xtHost,
          url: xtHost,
          username: xtUser,
          password: xtPass,
        };
      } else if (activeTab === 'stalker') {
        if (!stPortal || !stMac) {
          toast.error('Fill in portal URL and MAC address');
          setSubmitting(false);
          return;
        }
        payload = {
          ...payload,
          name: m3uName || stPortal,
          url: stPortal,
          mac_address: stMac,
        };
      }

      const result = await addPlaylist(payload);

      if (result.success) {
        toast.success(`Playlist added — ${result.count?.toLocaleString() || ''} channels imported`);
        onClose();
        await loadPlaylists();
        if (result.id) {
          await loadChannels(result.id);
        }
      } else {
        toast.error(result.error || 'Failed to add playlist');
      }
    } catch (error: any) {
      toast.error(error.message || 'Unexpected error adding playlist');
    } finally {
      setSubmitting(false);
    }
  };

  const hasM3uInput = !!fileContent || !!m3uUrl;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        {...modalOverlay}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="w-full max-w-lg bg-bg-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
          {...modalContent}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Add a Source</h2>
              <p className="text-text-secondary text-sm mt-0.5">Connect your IPTV provider</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-6 pb-4">
            {(['m3u', 'xtream', 'stalker'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab === 'm3u' ? 'M3U' : tab === 'xtream' ? 'Xtream' : 'Stalker'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
            {activeTab === 'm3u' && (
              <>
                {/* Drop zone */}
                <div
                  ref={dropRef}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={handleBrowse}
                  className={`h-[160px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    dragOver
                      ? 'border-white bg-white/5'
                      : fileContent
                        ? 'border-state-success bg-state-success/5'
                        : 'border-border hover:border-white/30 hover:bg-white/[0.02]'
                  }`}
                >
                  {fileContent ? (
                    <>
                      <Upload size={28} className="text-state-success" />
                      <p className="text-sm text-white font-medium">{fileName}</p>
                      <p className="text-xs text-text-tertiary">{(fileContent.length / 1024).toFixed(0)} KB loaded</p>
                    </>
                  ) : (
                    <>
                      <FileArrowDown size={28} className="text-text-tertiary" />
                      <p className="text-sm text-text-secondary">
                        Drop your <span className="text-white font-medium">.m3u</span> file here
                      </p>
                      <p className="text-xs text-text-tertiary">or click to browse — supports .m3u, .m3u8</p>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border-subtle" />
                  <span className="text-xs text-text-tertiary uppercase tracking-wider">or use a URL</span>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>

                {/* URL input */}
                <input
                  type="url"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="http://example.com/playlist.m3u"
                />
              </>
            )}

            {activeTab === 'xtream' && (
              <>
                <input
                  value={xtHost}
                  onChange={(e) => setXtHost(e.target.value)}
                  className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30"
                  placeholder="http://example.com:8080"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={xtUser}
                    onChange={(e) => setXtUser(e.target.value)}
                    className="bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30"
                    placeholder="Username"
                  />
                  <input
                    type="password"
                    value={xtPass}
                    onChange={(e) => setXtPass(e.target.value)}
                    className="bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30"
                    placeholder="Password"
                  />
                </div>
              </>
            )}

            {activeTab === 'stalker' && (
              <>
                <input
                  value={stPortal}
                  onChange={(e) => setStPortal(e.target.value)}
                  className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30"
                  placeholder="http://example.com:8080/c/"
                />
                <input
                  value={stMac}
                  onChange={(e) => setStMac(e.target.value)}
                  className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30"
                  placeholder="00:1A:79:XX:XX:XX"
                />
              </>
            )}

            {/* Playlist name */}
            <div className="pt-2">
              <p className="text-xs text-text-tertiary mb-1.5">Playlist Name</p>
              <input
                value={m3uName}
                onChange={(e) => setM3uName(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-white/30"
                placeholder="Auto-detected if blank"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-border text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (!hasM3uInput && activeTab === 'm3u')}
                className="flex-1 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  'Add Source'
                )}
                {!submitting && <span className="text-base">→</span>}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddPlaylistModal;
