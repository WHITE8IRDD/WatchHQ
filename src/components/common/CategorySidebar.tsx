// src/components/common/CategorySidebar.tsx
import React from 'react';

interface CategorySidebarProps {
  categories: { name: string; count?: number }[];
  activeCategory: string;
  onSelect: (category: string) => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  activeCategory,
  onSelect,
}) => {
  return (
    <div className="w-52 pr-6 py-4 hidden lg:block flex-shrink-0">
      <h3 className="text-[10px] uppercase text-text-tertiary mb-3 font-semibold tracking-[0.12em]">
        Categories
      </h3>
      <div className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onSelect(cat.name)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
              activeCategory === cat.name
                ? 'bg-white/10 text-white font-medium'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="truncate">{cat.name}</span>
            {cat.count !== undefined && (
              <span
                className={`text-xs ml-2 flex-shrink-0 ${
                  activeCategory === cat.name ? 'text-text-tertiary' : 'text-text-tertiary/50'
                }`}
              >
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySidebar;
