// src/hooks/useVirtualList.ts
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
  containerRef: React.RefObject<HTMLElement>;
}

interface VirtualListResult {
  visibleItems: { index: number; offsetTop: number }[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
}

export function useVirtualList({
  itemCount,
  itemHeight,
  overscan = 5,
  containerRef,
}: VirtualListOptions): VirtualListResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => setScrollTop(container.scrollTop);
    const onResize = () => setContainerHeight(container.clientHeight);

    container.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    onResize();

    return () => {
      container.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [containerRef]);

  const totalHeight = itemCount * itemHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );

  const visibleItems = useMemo(() => {
    const items: { index: number; offsetTop: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({ index: i, offsetTop: i * itemHeight });
    }
    return items;
  }, [startIndex, endIndex, itemHeight]);

  return { visibleItems, totalHeight, startIndex, endIndex };
}
