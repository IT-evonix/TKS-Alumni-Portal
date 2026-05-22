/**
 * Virtual List Component
 * Efficiently renders large lists using virtualization
 * Uses Intersection Observer for performance
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number; // Number of items to render outside viewport
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight = 60,
  containerHeight = 600,
  overscan = 3,
  className = '',
  onScroll,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange.start, visibleRange.end]);

  // Total height
  const totalHeight = items.length * itemHeight;

  // Offset for visible items
  const offsetY = visibleRange.start * itemHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Scroll to item
  const scrollToItem = useCallback((index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [itemHeight]);

  // Expose scroll method
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).scrollToItem = scrollToItem;
    }
  }, [scrollToItem]);

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
      role="list"
      aria-label="Virtual list"
    >
      <div
        ref={scrollRef}
        style={{
          height: totalHeight,
          position: 'relative',
        }}
        role="presentation"
      >
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = visibleRange.start + index;
            return (
              <div
                key={actualIndex}
                role="listitem"
                aria-posinset={actualIndex + 1}
                aria-setsize={items.length}
                style={{
                  height: itemHeight,
                }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for virtual list with dynamic item heights
 */
export function useVirtualList<T>(
  items: T[],
  options: {
    itemHeight?: number | ((item: T, index: number) => number);
    containerHeight?: number;
    overscan?: number;
  } = {}
) {
  const { itemHeight = 60, containerHeight = 600, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());

  const getItemHeight = useCallback((index: number): number => {
    if (typeof itemHeight === 'function') {
      return itemHeight(items[index], index);
    }
    return itemHeight;
  }, [itemHeight, items]);

  const visibleRange = useMemo(() => {
    let start = 0;
    let currentTop = 0;
    
    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      if (currentTop + height > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      currentTop += height;
    }

    // Find end index
    let end = start;
    let visibleHeight = 0;
    while (end < items.length && visibleHeight < containerHeight + getItemHeight(end)) {
      visibleHeight += getItemHeight(end);
      end++;
    }
    end = Math.min(items.length, end + overscan);

    return { start, end };
  }, [scrollTop, containerHeight, items.length, getItemHeight, overscan]);

  return {
    visibleRange,
    scrollTop,
    setScrollTop,
    totalHeight: items.reduce((sum, _, i) => sum + getItemHeight(i), 0),
  };
}
