import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Home, List, Heart, Clock, Film, Tv, Clapperboard, Search, Settings } from 'lucide-react';

interface SidebarItem {
  path?: string;
  icon: React.ElementType;
  label: string;
}

const items: SidebarItem[] = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/playlists', icon: List, label: 'Playlists' },
  { path: '/favorites', icon: Heart, label: 'Favorites' },
  { path: '/', icon: Clock, label: 'Recently Viewed' },
  { path: '/movies', icon: Film, label: 'Movies' },
  { path: '/live', icon: Tv, label: 'Live TV' },
  { path: '/series', icon: Clapperboard, label: 'Series' },
  { icon: Search, label: 'Search' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Tooltip.Provider delayDuration={300}>
      <aside className="fixed left-0 top-0 h-full w-[60px] bg-bg-elevated border-r border-border-subtle z-50 flex flex-col items-center py-3 gap-3">
        <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center flex-shrink-0">
          <span className="text-black font-bold text-base">W</span>
        </div>
        <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
          {items.map((item) => {
            const isActive = item.path ? location.pathname === item.path : false;
            const Icon = item.icon;
            const isSearch = item.label === 'Search';
            const cls = `w-full aspect-square rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-text-tertiary hover:text-white hover:bg-white/5'
            }`;
            return (
              <Tooltip.Root key={item.label}>
                <Tooltip.Trigger asChild>
                  {isSearch ? (
                    <button
                      className={cls}
                      onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                    >
                      <Icon size={20} />
                    </button>
                  ) : (
                    <Link to={item.path!} className={cls}>
                      <Icon size={20} />
                    </Link>
                  )}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    sideOffset={8}
                    className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]"
                  >
                    {item.label}
                    <Tooltip.Arrow className="fill-bg-overlay" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </nav>
      </aside>
    </Tooltip.Provider>
  );
};

export default Sidebar;
