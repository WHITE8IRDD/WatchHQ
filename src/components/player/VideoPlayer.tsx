import React, { useEffect, useRef, useState, useCallback } from 'react';
import mpegts from 'mpegts.js';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaylistStore } from '../../store/playlistStore';
import { useEpgNowNext } from '../../hooks/useEpg';
import { useWatchHistory } from '../../hooks/useWatchHistory';
import { toast } from '../common/Toast';
import ChannelLogo from '../common/ChannelLogo';
import {
  Play, Pause, Volume2, VolumeX, Volume1,
  Maximize, Minimize, PictureInPicture2,
  SkipForward, SkipBack, Settings, X,
  ExternalLink, Heart, Info, Loader, Tv,
} from 'lucide-react';

function calcBuffered(video: HTMLVideoElement): number {
  try {
    const buf = video.buffered;
    if (buf.length > 0) {
      const ct = video.currentTime;
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= ct && ct <= buf.end(i)) return buf.end(i) - ct;
      }
    }
  } catch {}
  return 0;
}

const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackAttemptedRef = useRef(false);

  const currentChannel = usePlaylistStore((s) => s.currentChannel);
  const channels = usePlaylistStore((s) => s.channels);
  const setCurrentChannel = usePlaylistStore((s) => s.setCurrentChannel);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [videoStats, setVideoStats] = useState({ width: 0, height: 0, bitrate: 0, buffered: 0, droppedFrames: 0, bandwidth: 0 });

  const epg = useEpgNowNext(currentChannel?.tvg_id);
  const { updatePosition } = useWatchHistory(
    currentChannel
      ? { item_type: 'channel', item_id: currentChannel.id, playlist_id: currentChannel.playlist_id, title: currentChannel.tvg_name, icon: currentChannel.tvg_logo, url: currentChannel.url }
      : null,
  );

  const supportedMse = mpegts.getFeatureList().mseLivePlayback;

  const destroyEngines = useCallback(() => {
    if (fallbackTimeoutRef.current) { clearTimeout(fallbackTimeoutRef.current); fallbackTimeoutRef.current = null; }
    if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
  }, []);

  // ── Engine: load a URL with fallback ──
  const loadStream = useCallback(async (urlToTry: string, isRetry: boolean, attemptFallback: () => void) => {
    const video = videoRef.current;
    if (!video) return;

    const log = console.log.bind(console);
    log('[PLAY] Loading:', urlToTry.substring(0, 100), 'retry:', isRetry);

    setError(null);
    setIsBuffering(true);
    destroyEngines();

    let cancelled = false;
    let firstFrame = false;

    // 8s timeout: if no frame, try alt URL first, then MPV
    fallbackTimeoutRef.current = setTimeout(() => {
      if (firstFrame || cancelled) return;
      log('[PLAY] 8s timeout — no first frame');
      if (!fallbackAttemptedRef.current) {
        fallbackAttemptedRef.current = true;
        const url = currentChannel!.url;
        if (url.endsWith('.ts')) {
          const alt = url.replace(/\.ts$/, '.m3u8');
          log('[PLAY] Timeout: trying .m3u8 alt');
          loadStream(alt, true, () => {
            log('[PLAY] Alt also failed → MPV');
            window.electronAPI.launchMPV(currentChannel!.url);
            setError('Stream unsupported — playing in MPV');
          });
        } else if (url.endsWith('.m3u8')) {
          const alt = url.replace(/\.m3u8$/, '.ts');
          log('[PLAY] Timeout: trying .ts alt');
          loadStream(alt, true, () => {
            log('[PLAY] Alt also failed → MPV');
            window.electronAPI.launchMPV(currentChannel!.url);
            setError('Stream unsupported — playing in MPV');
          });
        } else {
          log('[PLAY] Timeout: no alt format → MPV');
          window.electronAPI.launchMPV(currentChannel!.url);
          setError('Stream unsupported — playing in MPV');
        }
      }
    }, 8000);

    const markPlaying = () => {
      if (firstFrame || cancelled) return;
      firstFrame = true;
      if (fallbackTimeoutRef.current) { clearTimeout(fallbackTimeoutRef.current); fallbackTimeoutRef.current = null; }
      setIsBuffering(false);
      log('[PLAY] First frame ✅');
    };

    video.addEventListener('playing', markPlaying, { once: true });
    video.addEventListener('loadeddata', markPlaying, { once: true });

    try {
      const proxyPort = await window.electronAPI.getStreamProxyPort();
      if (!proxyPort) { setError('Proxy not available'); return; }

      const proxied = `http://127.0.0.1:${proxyPort}/${encodeURIComponent(urlToTry)}`;
      const lower = urlToTry.toLowerCase();
      const isHls = lower.includes('.m3u8');

      if (isHls) {
        log('[PLAY] Using native HLS (URL is .m3u8)');
        video.src = proxied;
        await video.play().catch(() => {});
        return;
      }

      // MPEG-TS via mpegts.js
      if (!supportedMse) {
        log('[PLAY] MSE not supported, native fallback');
        video.src = proxied;
        await video.play().catch(() => {});
        return;
      }

      const player = mpegts.createPlayer(
        { type: 'mpegts', isLive: true, url: proxied, cors: true },
        { enableWorker: true, enableStashBuffer: true, stashInitialSize: 384, liveBufferLatencyChasing: false, autoCleanupSourceBuffer: true, fixAudioTimestampGap: true, reuseRedirectedURL: true },
      );

      player.on(mpegts.Events.ERROR, (type: string, detail: string, info: any) => {
        log('[PLAY-MSE-ERR]', type, detail);
        if (!firstFrame && !cancelled) {
          log('[PLAY] Error before first frame, attempting fallback');
          attemptFallback();
        }
      });

      player.on(mpegts.Events.MEDIA_INFO, (info: any) => {
        log('[PLAY-MSE-INFO]', info);
        const codec = (info?.videoCodec || '').toLowerCase();
        log('[PLAY] Detected codec:', codec);
        if (/^hev1|^hvc1|^hevc$/i.test(codec)) {
          log('[PLAY] HEVC on MEDIA_INFO → MPV');
          try { player.destroy(); } catch {}
          window.electronAPI.launchMPV(currentChannel!.url);
          setError('HEVC codec — playing in MPV');
        }
      });

      player.attachMediaElement(video);
      player.load();
      mpegtsRef.current = player;
      setTimeout(() => { if (!cancelled) try { player.play(); } catch {} }, 100);
    } catch (err: any) {
      log('[PLAY-SETUP-ERR]', err.message);
      if (!cancelled) { clearTimeout(fallbackTimeoutRef.current!); setError(err.message); }
    }

    return () => { cancelled = true; };
  }, [currentChannel, destroyEngines, supportedMse]);

  // ── Playback effect ──
  useEffect(() => {
    const log = console.log.bind(console);
    const video = videoRef.current;
    if (!video || !currentChannel) return;

    log('[PLAY] Channel:', currentChannel.tvg_name);
    setError(null);
    setIsBuffering(true);
    destroyEngines();

    let cancelled = false;
    fallbackAttemptedRef.current = false;

    const tryFallback = () => {
      if (cancelled || fallbackAttemptedRef.current) return;
      fallbackAttemptedRef.current = true;
      const url = currentChannel.url;
      const urlFallback = (currentChannel as any).url_fallback;

      if (urlFallback) {
        log('[PLAY] Fallback to url_fallback:', urlFallback.substring(0, 80));
        loadStream(urlFallback, true, () => {
          log('[PLAY] Both URLs failed → MPV');
          window.electronAPI.launchMPV(currentChannel.url);
          setError('Stream unsupported — playing in MPV');
        });
      } else if (url.endsWith('.ts')) {
        const alt = url.replace(/\.ts$/, '.m3u8');
        log('[PLAY] Fallback .ts→.m3u8:', alt.substring(0, 80));
        if (!fallbackAttemptedRef.current) {
          fallbackAttemptedRef.current = true;
          loadStream(alt, true, () => {
            log('[PLAY] Both formats failed → MPV');
            window.electronAPI.launchMPV(currentChannel.url);
            setError('Stream unsupported — playing in MPV');
          });
        }
      } else if (url.endsWith('.m3u8')) {
        const alt = url.replace(/\.m3u8$/, '.ts');
        log('[PLAY] Fallback .m3u8→.ts:', alt.substring(0, 80));
        if (!fallbackAttemptedRef.current) {
          fallbackAttemptedRef.current = true;
          loadStream(alt, true, () => {
            log('[PLAY] Both formats failed → MPV');
            window.electronAPI.launchMPV(currentChannel.url);
            setError('Stream unsupported — playing in MPV');
          });
        }
      } else {
        log('[PLAY] No fallback available → MPV');
        window.electronAPI.launchMPV(currentChannel.url);
        setError('Stream unsupported — playing in MPV');
      }
    };

    loadStream(currentChannel.url, false, tryFallback);

    window.electronAPI.checkFavorite({ item_type: 'channel', item_id: currentChannel.id })
      .then((res) => setIsFavorite(res.isFavorite)).catch(() => {});

    return () => {
      cancelled = true;
      destroyEngines();
      try { video.removeAttribute('src'); video.load(); } catch {}
    };
  }, [currentChannel, destroyEngines, loadStream]);

  // ── Stats interval ──
  useEffect(() => {
    if (!showStats || !videoRef.current) return;
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const q = v.getVideoPlaybackQuality?.();
      setVideoStats(prev => ({ ...prev, width: v.videoWidth || prev.width, height: v.videoHeight || prev.height, buffered: calcBuffered(v), droppedFrames: q?.droppedVideoFrames || 0 }));
    }, 1000);
    return () => clearInterval(iv);
  }, [showStats]);

  // ── Video events ──
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    const onError = () => { if (!error) setError('Failed to play stream'); };
    const onTimeUpdate = () => updatePosition(v.currentTime, v.duration || 0);
    const onVol = () => { setVolume(v.volume); setIsMuted(v.muted); };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onError);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('volumechange', onVol);
    return () => {
      v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting); v.removeEventListener('playing', onPlaying);
      v.removeEventListener('canplay', onCanPlay); v.removeEventListener('error', onError);
      v.removeEventListener('timeupdate', onTimeUpdate); v.removeEventListener('volumechange', onVol);
    };
  }, [updatePosition, error]);

  // ── Fullscreen ──
  useEffect(() => {
    const f = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  // ── Media keys ──
  useEffect(() => {
    const c1 = window.electronAPI.onMediaPlayPause(() => togglePlay());
    const c2 = window.electronAPI.onMediaStop(() => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } });
    return () => { c1(); c2(); };
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => { if (isPlaying && !showSettings) setControlsVisible(false); }, 3000);
  }, [isPlaying, showSettings]);

  const togglePlay = () => { const v = videoRef.current; v?.paused ? v.play().catch(() => {}) : v?.pause(); };
  const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted; };
  const changeVolume = (d: number) => { const v = videoRef.current; if (v) v.volume = Math.max(0, Math.min(1, v.volume + d)); };
  const toggleFullscreen = () => { const c = containerRef.current; if (!c) return; document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen(); };
  const togglePiP = async () => { const v = videoRef.current; if (!v) return; try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await v.requestPictureInPicture(); } catch {} };
  const navigateChannel = (dir: number) => {
    if (!currentChannel || channels.length === 0) return;
    const idx = channels.findIndex(c => c.id === currentChannel.id);
    if (idx === -1) return;
    setCurrentChannel(channels[(idx + dir + channels.length) % channels.length]);
  };

  const openInMPV = async () => {
    if (!currentChannel) return;
    try {
      const r = await window.electronAPI.launchMPV(currentChannel.url, { fullscreen: true });
      if (!r.success) toast.error(r.error || 'Failed to launch MPV');
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleFavoriteChannel = async () => {
    if (!currentChannel) return;
    try {
      const r = await window.electronAPI.toggleFavorite({ item_type: 'channel', item_id: currentChannel.id, playlist_id: currentChannel.playlist_id });
      setIsFavorite(r.isFavorite);
      if (r.isFavorite) toast.success('Added to favorites');
    } catch (err: any) { toast.error(err.message); }
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!currentChannel) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'm': toggleMute(); break;
        case 'f': toggleFullscreen(); break;
        case 'p': togglePiP(); break;
        case 'i': e.preventDefault(); setShowStats(s => !s); break;
        case '?': setShowShortcuts(v => !v); break;
        case 'ArrowRight': e.preventDefault(); navigateChannel(1); break;
        case 'ArrowLeft': e.preventDefault(); navigateChannel(-1); break;
        case 'ArrowUp': e.preventDefault(); changeVolume(0.05); break;
        case 'ArrowDown': e.preventDefault(); changeVolume(-0.05); break;
        case 'Escape': if (isFullscreen) document.exitFullscreen(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentChannel, isFullscreen]);

  const handleVideoClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current); clickTimerRef.current = null;
      toggleFullscreen();
    } else {
      clickTimerRef.current = setTimeout(() => { togglePlay(); clickTimerRef.current = null; }, 200);
    }
  };

  if (!currentChannel) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-text-tertiary rounded-2xl">
        <Tv size={48} className="mb-3 opacity-40" />
        <p className="text-sm">Select a channel to start watching</p>
      </div>
    );
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden group rounded-2xl"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && !showSettings && setControlsVisible(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div key={currentChannel.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer" playsInline onClick={handleVideoClick} onDoubleClick={toggleFullscreen} />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>{isBuffering && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"><Loader size={28} className="text-white animate-spin" /></div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{!isPlaying && !isBuffering && !error && (
        <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
          onClick={togglePlay} className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white/95 flex items-center justify-center z-10 shadow-2xl">
          <Play size={36} className="text-black ml-1.5" fill="currentColor" />
        </motion.button>
      )}</AnimatePresence>

      <AnimatePresence>{error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-state-error/20 flex items-center justify-center"><X size={28} className="text-state-error" /></div>
          <p className="text-state-error text-sm font-medium">{error}</p>
          <div className="flex gap-2">
            <button onClick={() => { setError(null); destroyEngines(); videoRef.current?.load(); }} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium">Retry</button>
            <button onClick={openInMPV} className="px-4 py-2 border border-white/20 rounded-lg text-sm">Open in MPV</button>
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* Top info */}
      <AnimatePresence>{controlsVisible && !error && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-4 pb-16 px-6 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5"><ChannelLogo name={currentChannel.tvg_name} logo={currentChannel.tvg_logo} size={48} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-state-error rounded text-white text-[10px] font-bold uppercase tracking-wider leading-none"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Live</span>
                <h2 className="text-white font-semibold text-lg truncate">{currentChannel.tvg_name}</h2>
              </div>
              {epg?.now && <p className="text-white/70 text-sm truncate">Now: {epg.now.title}{epg.next && <> · Next: {epg.next.title}</>}</p>}
            </div>
            <button onClick={toggleFavoriteChannel} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isFavorite ? 'bg-state-error/20 text-state-error' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* Bottom controls */}
      <AnimatePresence>{controlsVisible && !error && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-4 px-6 z-10">
          {epg?.now && (
            <div className="w-full h-0.5 bg-white/20 rounded-full mb-4 overflow-hidden">
              <motion.div className="h-full bg-white" style={{ width: `${epg.progress}%` }} transition={{ duration: 1 }} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => navigateChannel(-1)} className="w-10 h-10 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0" title="Previous (←)"><SkipBack size={20} /></button>
            <button onClick={() => navigateChannel(1)} className="w-10 h-10 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0" title="Next (→)"><SkipForward size={20} /></button>
            <div className="flex items-center gap-2 ml-2 group/vol">
              <button onClick={toggleMute} className="w-10 h-10 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0"><VolumeIcon size={20} /></button>
              <div className="w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-24">
                <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume}
                  onChange={(e) => { const v = videoRef.current; if (v) { v.volume = +e.target.value; v.muted = +e.target.value === 0; } }}
                  className="w-24 accent-white cursor-pointer h-1" />
              </div>
            </div>
            <div className="flex-1" />
            {showStats && <div className="text-[10px] font-mono text-white/50 mr-2 leading-tight text-right"><div>{videoStats.width}×{videoStats.height}</div><div>{videoStats.bitrate ? (videoStats.bitrate / 1000).toFixed(0) + 'k' : '—'}</div></div>}
            <button onClick={() => setShowStats(s => !s)} className="w-10 h-10 rounded-full text-white/50 hover:bg-white/10 flex items-center justify-center flex-shrink-0" title="Stats (I)"><Info size={16} /></button>
            <button onClick={togglePiP} className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isPiP ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="PiP (P)"><PictureInPicture2 size={18} /></button>
            <button onClick={openInMPV} className="w-10 h-10 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0" title="Open in MPV"><ExternalLink size={18} /></button>
            <button onClick={() => setShowSettings(v => !v)} className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${showSettings ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`} title="Settings"><Settings size={18} /></button>
            <button onClick={toggleFullscreen} className="w-10 h-10 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0" title="Fullscreen (F)">{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
          </div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{showSettings && (
        <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute bottom-24 right-6 w-64 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 z-20">
          <div className="space-y-1">
            <p className="text-white/40 text-xs text-center py-4">Quality settings only for HLS streams</p>
            <div className="text-[10px] uppercase text-white/30 px-3 py-1 tracking-wider font-semibold">Speed</div>
            {['0.5','0.75','1','1.25','1.5','2'].map(s => (
              <button key={s} onClick={() => { const v = document.querySelector('video'); if (v) v.playbackRate = parseFloat(s); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${s === '1' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}>
                {s === '1' ? 'Normal' : s + '×'}
              </button>
            ))}
          </div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{showShortcuts && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-30" onClick={() => setShowShortcuts(false)}>
          <div className="bg-bg-overlay border border-white/10 rounded-2xl p-8 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-text-tertiary hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-sm">
              {[['Space / K','Play / Pause'],['F','Fullscreen'],['M','Mute'],['P','PiP'],['↑ / ↓','Volume'],['← / →','Channels'],['?','Shortcuts'],['I','Stats'],['Esc','Exit fullscreen']].map(([k,d]) => (
                <div key={k} className="flex items-center justify-between"><span className="text-white/70">{d}</span><kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">{k}</kbd></div>
              ))}
            </div>
          </div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};

export default VideoPlayer;
