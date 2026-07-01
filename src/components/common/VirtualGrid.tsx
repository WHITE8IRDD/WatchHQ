// src/components/common/VirtualGrid.tsx
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  minItemWidth?: number;
  itemHeight?: number;
  overscan?: number;
  className?: string;
  gap?: number;
}

const BREAKPOINTS = [
  { minWidth: 1600, columns: 7 },
  { minWidth: 1280, columns: 6 },
  { minWidth: 1024, columns: 5 },
  { minWidth: 768, columns: 4 },
  { minWidth: 640, columns: 3 },
  { minWidth: 0, columns: 2 },
];

function VirtualGrid<T>({
  items,
  renderItem,
  minItemWidth = 180,
  itemHeight = 120,
  overscan = 4,
  className = '',
  gap: gapPx = 12,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (containerWidth === 0) return 5;
    const maxCols = Math.max(1, Math.floor(containerWidth / (minItemWidth + gapPx)));
    const bp = BREAKPOINTS.find((b) => containerWidth >= b.minWidth);
    return Math.min(maxCols, bp?.columns ?? 5);
  }, [containerWidth, minItemWidth, gapPx]);

  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
    gap: gapPx,
  });

  const totalHeight = virtualizer.getTotalSize();

  return (
    <div ref={parentRef} className={`overflow-y-auto ${className}`}>
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const startIdx = rowIndex * columns;
          const rowItems = items.slice(startIdx, startIdx + columns);

          return (
            <div
              key={rowIndex}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: `${gapPx}px`,
              }}
            >
              {Array.from({ length: columns }).map((_, colIdx) => {
                const item = rowItems[colIdx];
                return item !== undefined ? (
                  <div key={colIdx}>{renderItem(item, startIdx + colIdx)}</div>
                ) : (
                  <div key={colIdx} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualGrid;
