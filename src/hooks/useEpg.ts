// src/hooks/useEpg.ts
import { useState, useEffect, useRef } from 'react';

interface NowNext {
  now: {
    title: string;
    description?: string;
    start_time: number;
    end_time: number;
    category?: string;
  } | null;
  next: {
    title: string;
    start_time: number;
    end_time: number;
  } | null;
  progress: number;
}

export function useEpgNowNext(tvgId: string | undefined | null): NowNext {
  const [data, setData] = useState<NowNext>({ now: null, next: null, progress: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!tvgId) {
      setData({ now: null, next: null, progress: 0 });
      return;
    }

    const fetch = async () => {
      try {
        const result = await window.electronAPI.getNowNext(tvgId);
        const now = Math.floor(Date.now() / 1000);
        let progress = 0;
        if (result.now) {
          const total = result.now.end_time - result.now.start_time;
          const elapsed = now - result.now.start_time;
          progress = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
        }
        setData({ now: result.now, next: result.next, progress });
      } catch {
      }
    };

    fetch();
    intervalRef.current = setInterval(fetch, 30000); // Refresh every 30s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tvgId]);

  return data;
}
