import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryChipsProps {
  categories: { name: string; count?: number }[];
  activeCategory: string;
  onSelect: (category: string) => void;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({ categories, activeCategory, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [categories]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <div className="relative flex items-center">
      {canScrollLeft && (
        <button onClick={() => scroll(-1)} className="absolute left-0 z-10 w-8 h-8 rounded-full bg-bg-base/90 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-white transition-colors">
          <ChevronLeft size={14} />
        </button>
      )}
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-0.5" style={{ scrollbarWidth: 'none' }}>
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onSelect(cat.name)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeCategory === cat.name
                ? 'bg-white text-black'
                : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'
            }`}
          >
            {cat.name}
            {cat.count != null && (
              <span className={`text-[11px] ${activeCategory === cat.name ? 'opacity-60' : 'text-text-tertiary'}`}>
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button onClick={() => scroll(1)} className="absolute right-0 z-10 w-8 h-8 rounded-full bg-bg-base/90 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-white transition-colors">
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

export default CategoryChips;
