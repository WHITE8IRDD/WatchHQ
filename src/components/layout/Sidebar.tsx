import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import {
  Home,
  ListVideo,
  Heart,
  Clock,
  Film,
  Tv,
  Clapperboard,
  Download,
  Search,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  onOpenPalette: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onOpenPalette }) => {
  const iconClass = ({ isActive }: { isActive: boolean }) =>
    `w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-colors ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-text-tertiary hover:text-white hover:bg-white/5'
    }`;

  return (
    <Tooltip.Provider delayDuration={300}>
      <aside className="fixed left-0 top-0 h-full w-[60px] bg-bg-elevated border-r border-border-subtle z-50 flex flex-col items-center py-4 gap-1">
        <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 mb-2">
          <span className="text-white/30 font-display font-bold tracking-tight text-lg">W</span>
        </div>

        {/* Top group: Home, Playlists, Favorites, History */}
        <nav className="flex flex-col items-center gap-2 w-full px-2">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Home size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Home<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/playlists" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <ListVideo size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Playlists<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/favorites" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Heart size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Favorites<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/history" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Clock size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">History<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
        </nav>

        <div className="h-px bg-border-subtle mx-3 my-0.5" />

        {/* Middle group: Movies, Live TV, Series, Downloads */}
        <nav className="flex flex-col items-center gap-2 w-full px-2">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/movies" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Film size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Movies<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/live" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Tv size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Live TV<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/series" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Clapperboard size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Series<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Link to="/downloads" className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/5 transition-colors">
                <Download size={20} />
              </Link>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">
                Downloads
                <Tooltip.Arrow className="fill-bg-overlay" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </nav>

        <div className="flex-1" />

        {/* Bottom: Search, Settings */}
        <div className="flex flex-col items-center gap-2 w-full px-2 pb-2">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={onOpenPalette}
                className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/5 transition-colors"
              >
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                  <Search size={20} />
                </motion.div>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Search<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink to="/settings" className={iconClass}>
                {({ isActive }) => (
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                    <Settings size={20} />
                  </motion.div>
                )}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content side="right" sideOffset={8} className="bg-bg-overlay border border-border-subtle text-white text-xs font-medium px-2.5 py-1.5 rounded-lg z-[100]">Settings<Tooltip.Arrow className="fill-bg-overlay" /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </aside>
    </Tooltip.Provider>
  );
};

export default Sidebar;
