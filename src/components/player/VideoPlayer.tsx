import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { usePlaylistStore } from '../../store/playlistStore';
import ChannelLogo from '../common/ChannelLogo';
import { Play, Pause, SpeakerHigh, SpeakerX, ArrowsOut, ArrowsIn, PictureInPicture, GearSix, Heart, SkipBack, SkipForward, ArrowClockwise } from '@phosphor-icons/react';
import { toast } from '../common/Toast';
import { findSimilarChannels } from '../../lib/channelSimilarity';
import { Fmp4Player } from '../../lib/fmp4Player';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getBufferedRanges(video: HTMLVideoElement): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  try {
    for (let i = 0; i < video.buffered.length; i++) {
      ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
    }
  } catch {}
  return ranges;
}

function getBufferHealth(video: HTMLVideoElement): number {
  try {
    const buf = video.buffered;
    if (buf.length === 0) return 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf.start(i) <= video.currentTime && video.currentTime <= buf.end(i)) {
        return buf.end(i) - video.currentTime;
      }
    }
  } catch {}
  return 0;
}

const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const fmp4PlayerRef = useRef<Fmp4Player | null>(null);
  const firstFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstFrameRef = useRef(false);
  const cancelledRef = useRef(false);
  const userPausedRef = useRef(false);
  const failedChannelsRef = useRef<Set<string>>(new Set());
  const failoverAttemptsRef = useRef(0);
  const streamStartedAtRef = useRef(0);
  const MAX_FAILOVER_ATTEMPTS = 3;
  const lastFailoverAtRef = useRef(0);

  const currentChannel = usePlaylistStore((s) => s.currentChannel);
  const channels = usePlaylistStore((s) => s.channels);
  const setCurrentChannel = usePlaylistStore((s) => s.setCurrentChannel);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [stats, setStats] = useState({
    width: 0,
    height: 0,
    bitrate: 0,
    codec: '',
    bufferHealth: 0,
    droppedFrames: 0,
    bandwidth: 0,
  });

  const urlLower = (currentChannel?.url || '').toLowerCase();
  const isVod = urlLower.endsWith('.mp4') || urlLower.endsWith('.mkv') || urlLower.endsWith('.webm');
  const isLive = !isVod;

  const destroyEngines = useCallback(() => {
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try { mpegtsRef.current.destroy(); } catch {}
      mpegtsRef.current = null;
    }
    if (fmp4PlayerRef.current) {
      try { fmp4PlayerRef.current.destroy(); } catch {}
      fmp4PlayerRef.current = null;
    }
    if (firstFrameTimerRef.current) {
      clearTimeout(firstFrameTimerRef.current);
      firstFrameTimerRef.current = null;
    }
    firstFrameRef.current = false;
  }, []);

  const cancelPending = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const detectEngine = useCallback((url: string): 'hls' | 'mpegts' | 'native' => {
    const lower = url.toLowerCase();
    if (lower.includes('.m3u8')) return 'hls';
    if (lower.includes('.ts') || lower.includes('/live/')) return 'mpegts';
    return 'native';
  }, []);

  const startFirstFrameTimer = useCallback((onTimeout: () => void) => {
    if (firstFrameTimerRef.current) clearTimeout(firstFrameTimerRef.current);
    firstFrameTimerRef.current = setTimeout(() => {
      if (!firstFrameRef.current && !cancelledRef.current) {
        onTimeout();
      }
    }, 8000);
  }, []);

  const markFirstFrame = useCallback(() => {
    if (firstFrameRef.current || cancelledRef.current) return;
    firstFrameRef.current = true;
    streamStartedAtRef.current = Date.now();
    if (firstFrameTimerRef.current) {
      clearTimeout(firstFrameTimerRef.current);
      firstFrameTimerRef.current = null;
    }
    setIsBuffering(false);
    setError(null);
  }, []);

  const initPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !currentChannel) return;

    // Check player preference (P7)
    try {
      if ((window as any).electronAPI?.getPreferences) {
        const prefs = await (window as any).electronAPI.getPreferences();
        const engine = prefs?.player_type || 'internal';
        if (engine === 'mpv') {
          await (window as any).electronAPI.launchMPV?.(currentChannel.url);
          setError('Playing in MPV');
          setIsBuffering(false);
          return;
        }
        if (engine === 'vlc') {
          await (window as any).electronAPI.launchVLC?.(currentChannel.url);
          setError('Playing in VLC');
          setIsBuffering(false);
          return;
        }
      }
    } catch {}

    cancelledRef.current = false;
    setError(null);
    setIsBuffering(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);

    destroyEngines();

    const url = currentChannel.url;
    const engine = detectEngine(url);

    const handleFirstFrame = () => markFirstFrame();
    video.addEventListener('playing', handleFirstFrame, { once: true });
    video.addEventListener('loadeddata', handleFirstFrame, { once: true });

    let streamUrl = url;
    try {
      if ((window as any).electronAPI?.getStreamProxyPort) {
        const proxyPort = await (window as any).electronAPI.getStreamProxyPort();
        if (proxyPort) {
          streamUrl = `http://127.0.0.1:${proxyPort}/${encodeURIComponent(url)}`;
        }
      }
    } catch {}

    startFirstFrameTimer(async () => {
      if (cancelledRef.current) return;
      const switched = await tryFailover();
      if (!switched) {
        setError('Playback failed');
        setIsBuffering(false);
        destroyEngines();
      }
    });

    try {
      if (engine === 'hls') {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            liveSyncDurationCount: 3,
            liveDurationInfinity: true,
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 4,
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 6,
            xhrSetup: (xhr) => xhr.setRequestHeader('User-Agent', 'VLC/3.0.20 LibVLC/3.0.20'),
          });
          hls.on(Hls.Events.ERROR, async (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                const switched = await tryFailover();
                if (switched) return;
              }
              try { hls.startLoad(); } catch {}
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              try { hls.recoverMediaError(); } catch {}
              return;
            }
            if (!cancelledRef.current) {
              const switched = await tryFailover();
              if (!switched) {
                setError('Playback failed');
                setIsBuffering(false);
                destroyEngines();
              }
            }
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
            console.log('[HLS] Level loaded — live sync:', hls.liveSyncPosition?.toFixed(2), 'current:', video.currentTime.toFixed(2), 'details:', data.details.live, 'totalduration:', data.details.totalduration);
          });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
          video.play().catch(() => {});
        } else {
          setError('HLS not supported in this browser');
          setIsBuffering(false);
        }
      } else if (engine === 'mpegts') {
        // Try fMP4 remux first (ffmpeg rewrites timestamps → no rewind)
        try {
          const proxyPort = await (window as any).electronAPI?.getStreamProxyPort();
          if (proxyPort) {
            const remuxUrl = `http://127.0.0.1:${proxyPort}/remux/${encodeURIComponent(url)}`;
            console.log('[Player] Using fMP4 remux for:', url.substring(0, 80));
            const fmp4 = new Fmp4Player(video, remuxUrl, {
              onFirstFrame: () => {
                markFirstFrame();
                video.play().catch(() => {});
              },
              onError: (err) => {
                console.error('[Player] fMP4 error, falling back to mpegts.js:', err.message);
                fmp4PlayerRef.current = null;
                fallbackToMpegts();
              },
            });
            fmp4PlayerRef.current = fmp4;
            await fmp4.load().catch((err) => {
              console.error('[Player] fMP4 load failed, falling back:', err.message);
              fmp4PlayerRef.current = null;
              fallbackToMpegts();
            });
          } else {
            fallbackToMpegts();
          }
        } catch {
          fallbackToMpegts();
        }

        function fallbackToMpegts() {
          if (cancelledRef.current || !video) return;
          if (mpegts.getFeatureList().mseLivePlayback) {
            console.log('[Player] Falling back to mpegts.js for:', url.substring(0, 80));
            const player = mpegts.createPlayer(
              { type: 'mpegts', isLive: true, url: streamUrl },
              {
                enableWorker: false,
                enableStashBuffer: false,
                liveBufferLatencyChasing: false,
                liveBufferLatencyChasingOnPaused: false,
                autoCleanupSourceBuffer: true,
                autoCleanupMaxBackwardDuration: 30,
                autoCleanupMinBackwardDuration: 20,
                fixAudioTimestampGap: false,
                reuseRedirectedURL: true,
                lazyLoad: false,
              },
            );
            player.on(mpegts.Events.ERROR, async (type: string, detail: string) => {
              if (cancelledRef.current) return;
              if (!firstFrameRef.current && failoverAttemptsRef.current < MAX_FAILOVER_ATTEMPTS) {
                const switched = await tryFailover();
                if (switched) return;
              }
              if (detail?.includes('codec') || detail?.includes('MediaSource')) {
                const switched = await tryFailover();
                if (switched) return;
              }
              if (!cancelledRef.current) {
                setError('Playback failed');
                setIsBuffering(false);
                destroyEngines();
              }
            });
            player.attachMediaElement(video);
            player.load();
            player.play();
            mpegtsRef.current = player;
          } else {
            video.src = streamUrl;
            video.play().catch(() => {});
          }
        }
      } else {
        video.src = streamUrl;
        video.play().catch(() => {});
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setError(err.message || 'Playback failed');
        setIsBuffering(false);
      }
    }

    // Check favorite status
    try {
      if ((window as any).electronAPI?.checkFavorite) {
        const res = await (window as any).electronAPI.checkFavorite({
          item_type: 'channel',
          item_id: currentChannel.id,
        });
        setIsFavorite(res.isFavorite);
      }
    } catch {}
  }, [currentChannel, destroyEngines, detectEngine, startFirstFrameTimer, markFirstFrame]);

  useEffect(() => {
    if (!currentChannel) return;
    initPlayback();
    return () => {
      cancelledRef.current = true;
      destroyEngines();
      const video = videoRef.current;
      if (video) {
        try { video.removeAttribute('src'); video.load(); } catch {}
      }
    };
  }, [currentChannel?.id, currentChannel?.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => { setIsBuffering(false); markFirstFrame(); };
    const onCanPlay = () => setIsBuffering(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
    };
    const onProgress = () => {
      const ranges = getBufferedRanges(video);
      if (ranges.length > 0) {
        for (const r of ranges) {
          if (r.start <= video.currentTime && video.currentTime <= r.end) {
            setBufferedEnd(r.end);
            break;
          }
        }
      }
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const onError = () => {
      if (!cancelledRef.current) {
        setError('Playback failed');
        setIsBuffering(false);
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('error', onError);
    };
  }, [markFirstFrame]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    document.addEventListener('enterpictureinpicture', onEnter);
    document.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      document.removeEventListener('enterpictureinpicture', onEnter);
      document.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  useEffect(() => {
    if (!showStats || !videoRef.current) return;
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const q = v.getVideoPlaybackQuality?.();
      let bandwidth = 0;
      let bitrate = 0;
      let codec = '';
      if (hlsRef.current) {
        const hls = hlsRef.current;
        const levels = hls.levels;
        const level = hls.currentLevel;
        if (level >= 0 && levels[level]) {
          bitrate = levels[level].bitrate;
          codec = levels[level].videoCodec || '';
          bandwidth = hls.bandwidthEstimate;
        }
      }
      setStats({
        width: v.videoWidth || stats.width,
        height: v.videoHeight || stats.height,
        bitrate,
        codec,
        bufferHealth: getBufferHealth(v),
        droppedFrames: q?.droppedVideoFrames || 0,
        bandwidth,
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [showStats, stats.width, stats.height]);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    setShowSpeedMenu(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying && !showStats) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, showStats]);

  const keepControlsVisible = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPausedRef.current = false;
      v.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  }, []);

  const changeVolume = useCallback((delta: number) => {
    const v = videoRef.current;
    if (v) {
      v.volume = Math.max(0, Math.min(1, v.volume + delta));
    }
  }, []);

  const handleVolumeSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (v) {
      const val = parseFloat(e.target.value) / 100;
      v.volume = val;
      v.muted = val === 0;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen();
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {}
  }, []);

  const navigateChannel = useCallback((dir: number) => {
    if (!currentChannel || channels.length === 0) return;
    const idx = channels.findIndex((c) => c.id === currentChannel.id);
    if (idx === -1) return;
    const next = channels[(idx + dir + channels.length) % channels.length];
    setCurrentChannel(next);
  }, [currentChannel, channels, setCurrentChannel]);

  const seek = useCallback((time: number) => {
    const v = videoRef.current;
    if (v && isVod) v.currentTime = Math.max(0, Math.min(time, v.duration || 0));
  }, [isVod]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isVod || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const v = videoRef.current;
    if (v) v.currentTime = fraction * (v.duration || 0);
  }, [isVod]);

  const changeSpeed = useCallback((speed: number) => {
    const v = videoRef.current;
    if (v) {
      v.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
    setShowSpeedMenu(false);
  }, []);

  const toggleFavorite = useCallback(async () => {
    if (!currentChannel) return;
    try {
      if ((window as any).electronAPI?.toggleFavorite) {
        const res = await (window as any).electronAPI.toggleFavorite({
          item_type: 'channel',
          item_id: currentChannel.id,
          playlist_id: currentChannel.playlist_id,
        });
        setIsFavorite(res.isFavorite);
      }
    } catch {}
  }, [currentChannel]);

  const openInMPV = useCallback(async () => {
    if (!currentChannel) return;
    try {
      await (window as any).electronAPI?.launchMPV?.(currentChannel.url);
    } catch {}
  }, [currentChannel]);

  const retry = useCallback(() => {
    if (currentChannel) {
      cancelledRef.current = false;
      initPlayback();
    }
  }, [currentChannel, initPlayback]);

  const tryFailover = useCallback(async () => {
    if (!currentChannel) return false;
    if (failoverAttemptsRef.current >= MAX_FAILOVER_ATTEMPTS) return false;

    const sinceLast = Date.now() - lastFailoverAtRef.current;
    if (sinceLast < 30000) return false;

    const uptime = Date.now() - streamStartedAtRef.current;
    if (uptime < 30000) return false;

    const prefs = await (window as any).electronAPI?.getPreferences().catch(() => null);
    if (prefs?.auto_failover === 0) return false;

    lastFailoverAtRef.current = Date.now();
    failedChannelsRef.current.add(currentChannel.id);
    failoverAttemptsRef.current++;

    const allChannels = usePlaylistStore.getState().channels;
    const similar = findSimilarChannels(currentChannel, allChannels, failedChannelsRef.current);
    if (similar.length === 0) return false;

    const nextChannel = similar[0];
    toast.info(`Stream failed — switching to ${nextChannel.tvg_name}`);
    setCurrentChannel(nextChannel);
    return true;
  }, [currentChannel, setCurrentChannel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!currentChannel) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isVod) seek((videoRef.current?.currentTime || 0) - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isVod) seek((videoRef.current?.currentTime || 0) + 10);
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePiP();
          break;
        case 'Escape':
          if (isFullscreen) document.exitFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentChannel, togglePlay, toggleFullscreen, toggleMute, changeVolume, togglePiP, isFullscreen, isVod, seek]);

  // Stall recovery (P1) — soft only, no destroy/reload
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentChannel) return;

    let lastTime = 0;
    let stallCount = 0;
    const checker = setInterval(() => {
      if (video.paused || video.readyState < 3) return;
      if (video.currentTime === lastTime) {
        stallCount++;
        if (stallCount >= 3) {
          stallCount = 0;
          if (hlsRef.current) {
            try { hlsRef.current.startLoad(-1); } catch {}
          }
          // Do NOT unload/load mpegts mid-playback — causes freeze/repeat
        }
      } else {
        stallCount = 0;
        lastTime = video.currentTime;
      }
    }, 2000);

    return () => clearInterval(checker);
  }, [currentChannel]);



  // Reset failover state when user picks a new channel
  useEffect(() => {
    failoverAttemptsRef.current = 0;
  }, [currentChannel?.id]);

  // Diagnostic video event logging
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentChannel) return;
    const log = (event: string) => () => {
      console.log(`[video-event] ${event}`, {
        currentTime: v.currentTime.toFixed(2),
        buffered: v.buffered.length ? `${v.buffered.start(0).toFixed(1)}-${v.buffered.end(v.buffered.length - 1).toFixed(1)}` : 'none',
        readyState: v.readyState,
        networkState: v.networkState,
        paused: v.paused,
      });
    };
    const events = ['play', 'pause', 'playing', 'waiting', 'stalled', 'seeking', 'seeked', 'ratechange', 'ended', 'error'] as const;
    const handlers = events.map(e => { const h = log(e); v.addEventListener(e, h); return [e, h] as const; });
    return () => handlers.forEach(([e, h]) => v.removeEventListener(e, h));
  }, [currentChannel]);

  // Mount-time reset for failover tracking
  useEffect(() => {
    failedChannelsRef.current = new Set();
    failoverAttemptsRef.current = 0;
  }, []);

  // Passive rewind detector — reads only, never writes, never patches
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentChannel) return;

    let lastCurrentTime = 0;
    let lastMediaTime = 0;
    let rewindCount = 0;
    const startAt = Date.now();

    const iv = setInterval(() => {
      const t = v.currentTime;
      if (lastCurrentTime > 0 && t < lastCurrentTime - 0.05) {
        rewindCount++;
        console.error(`\uD83D\uDD34 REWIND #${rewindCount}: currentTime ${lastCurrentTime.toFixed(3)} \u2192 ${t.toFixed(3)} (elapsed ${((Date.now()-startAt)/1000).toFixed(1)}s)`);
      }
      lastCurrentTime = t;
    }, 50);

    if ('requestVideoFrameCallback' in v) {
      const monitor = (_now: number, metadata: any) => {
        const mt = metadata.mediaTime;
        if (lastMediaTime > 0 && mt < lastMediaTime - 0.05) {
          rewindCount++;
          console.error(`\uD83D\uDD34 FRAME REWIND #${rewindCount}: mediaTime ${lastMediaTime.toFixed(3)} \u2192 ${mt.toFixed(3)} (frame ${metadata.presentedFrames})`);
        }
        lastMediaTime = mt;
        (v as any).requestVideoFrameCallback(monitor);
      };
      (v as any).requestVideoFrameCallback(monitor);
    }

    return () => clearInterval(iv);
  }, [currentChannel?.id]);

  if (!currentChannel) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-text-tertiary rounded-2xl">
        <svg className="w-12 h-12 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="16 21 16 2 8 2 8 21" />
        </svg>
        <p className="text-sm">Select a channel to start watching</p>
      </div>
    );
  }

  const VolumeIcon = isMuted || volume === 0 ? SpeakerX : SpeakerHigh;
  const FullscreenIcon = isFullscreen ? ArrowsIn : ArrowsOut;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden select-none rounded-2xl"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => {
        if (isPlaying && !showStats) setControlsVisible(false);
      }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Buffering spinner */}
      {isBuffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Center play button (paused, not buffering, no error) */}
      {!isPlaying && !isBuffering && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white flex items-center justify-center z-10 shadow-2xl hover:scale-105 transition-transform"
        >
          <Play size={32} className="text-black ml-1" weight="fill" />
        </button>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-5 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-state-error/20 flex items-center justify-center">
            <span className="text-state-error text-2xl font-bold">!</span>
          </div>
          <p className="text-white text-base font-medium">Playback failed</p>
          <p className="text-text-secondary text-sm -mt-3">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={retry}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
            >
              <ArrowClockwise size={16} weight="bold" />
              Retry
            </button>
            <button
              onClick={openInMPV}
              className="px-5 py-2.5 border border-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Open in MPV
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 transition-opacity duration-300 ${
          controlsVisible && !error ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-b from-black/70 via-black/40 to-transparent pt-4 pb-16 px-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
              <ChannelLogo name={currentChannel.tvg_name} logo={currentChannel.tvg_logo} size={44} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-state-error rounded text-white text-[10px] font-bold uppercase tracking-wider leading-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live
                  </span>
                )}
                <h2 className="text-white font-semibold text-base truncate">{currentChannel.tvg_name}</h2>
              </div>
            </div>
            <button
              onClick={toggleFavorite}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                isFavorite
                  ? 'bg-state-error/20 text-state-error'
                  : 'bg-black/40 text-white/60 hover:bg-black/60 hover:text-white'
              }`}
            >
              <Heart size={16} weight={isFavorite ? 'fill' : 'regular'} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        ref={controlsRef}
        onMouseEnter={keepControlsVisible}
        className={`absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${
          controlsVisible && !error ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-16 pb-3 px-5">
          {/* Progress bar (VOD only) */}
          {isVod && (
            <div
              ref={progressRef}
              className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group/progress hover:h-1.5 transition-all"
              onClick={handleProgressClick}
            >
              <div className="relative h-full w-full">
                <div
                  className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                  style={{ width: `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-white rounded-full"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0"
            >
              {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" className="ml-0.5" />}
            </button>

            {/* Previous channel */}
            <button
              onClick={() => navigateChannel(-1)}
              className="w-9 h-9 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0"
              title="Previous channel"
            >
              <SkipBack size={18} weight="bold" />
            </button>

            {/* Next channel */}
            <button
              onClick={() => navigateChannel(1)}
              className="w-9 h-9 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0"
              title="Next channel"
            >
              <SkipForward size={18} weight="bold" />
            </button>

            {/* Volume */}
            <div
              className="flex items-center gap-1 group/vol"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={toggleMute}
                className="w-9 h-9 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0"
              >
                <VolumeIcon size={18} weight="bold" />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  showVolumeSlider ? 'w-24 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={isMuted ? 0 : Math.round(volume * 100)}
                  onChange={handleVolumeSlider}
                  className="w-24 h-1 accent-white cursor-pointer"
                />
              </div>
            </div>

            {/* Time display */}
            <div className="text-xs text-white/70 font-mono whitespace-nowrap min-w-[60px]">
              {isLive ? (
                <span className="text-state-error font-bold text-[11px] uppercase tracking-wider">LIVE</span>
              ) : (
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              )}
            </div>

            <div className="flex-1" />

            {/* Speed dropdown (VOD only) */}
            {isVod && (
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu((v) => !v)}
                  className="w-9 h-9 rounded-full text-white/70 hover:bg-white/10 flex items-center justify-center flex-shrink-0 text-xs font-mono"
                  title="Playback speed"
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSpeedMenu(false)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 z-20 min-w-[100px]">
                      {PLAYBACK_SPEEDS.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changeSpeed(speed)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            speed === playbackSpeed
                              ? 'bg-white/15 text-white'
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {speed === 1 ? 'Normal' : `${speed}x`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Picture-in-Picture */}
            <button
              onClick={togglePiP}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isPiP
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture size={16} weight="bold" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 rounded-full text-white/60 hover:bg-white/10 flex items-center justify-center flex-shrink-0 hover:text-white transition-colors"
              title="Fullscreen (F)"
            >
              <FullscreenIcon size={16} weight="bold" />
            </button>

            {/* Settings gear (toggles stats) */}
            <button
              onClick={() => setShowStats((v) => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                showStats
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title="Stream stats"
            >
              <GearSix size={16} weight={showStats ? 'fill' : 'regular'} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats overlay */}
      {showStats && !error && (
        <div className="absolute top-16 right-4 z-20 bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-3.5 min-w-[180px] text-[11px] font-mono leading-relaxed">
          <div className="text-white/40 uppercase tracking-wider font-semibold mb-2 text-[10px]">Stream Stats</div>
          <div className="space-y-1 text-white/70">
            <div className="flex justify-between">
              <span className="text-white/40">Resolution</span>
              <span>{stats.width > 0 ? `${stats.width}×${stats.height}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Bitrate</span>
              <span>{stats.bitrate > 0 ? `${(stats.bitrate / 1000).toFixed(0)} kbps` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Codec</span>
              <span className="truncate max-w-[100px] text-right">{stats.codec || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Buffer</span>
              <span className={stats.bufferHealth > 2 ? 'text-state-success' : stats.bufferHealth > 0 ? 'text-gold' : 'text-state-error'}>
                {stats.bufferHealth > 0 ? `${stats.bufferHealth.toFixed(1)}s` : '0s'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Dropped</span>
              <span>{stats.droppedFrames > 0 ? stats.droppedFrames : '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Bandwidth</span>
              <span>{stats.bandwidth > 0 ? `${(stats.bandwidth / 1000).toFixed(0)} kbps` : '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VideoPlayer);
