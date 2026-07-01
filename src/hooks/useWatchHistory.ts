// src/hooks/useWatchHistory.ts
import { useRef, useCallback } from 'react';

interface HistoryEntry {
  item_type: 'channel' | 'vod' | 'series_episode';
  item_id: string;
  playlist_id?: string;
  title?: string;
  icon?: string;
  url?: string;
}

export function useWatchHistory(entry: HistoryEntry | null) {
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 10000; // 10 seconds

  const updatePosition = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!entry) return;
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) return;
      lastUpdateRef.current = now;

      window.electronAPI.updateHistory({
        item_type: entry.item_type,
        item_id: entry.item_id,
        playlist_id: entry.playlist_id,
        title: entry.title,
        icon: entry.icon,
        url: entry.url,
        position_seconds: Math.floor(positionSeconds),
        duration_seconds: Math.floor(durationSeconds),
      }).catch(() => {
      });
    },
    [entry],
  );

  const getPosition = useCallback(async () => {
    if (!entry) return null;
    try {
      return await window.electronAPI.getWatchPosition({
        item_type: entry.item_type,
        item_id: entry.item_id,
      });
    } catch {
      return null;
    }
  }, [entry]);

  return { updatePosition, getPosition };
}
