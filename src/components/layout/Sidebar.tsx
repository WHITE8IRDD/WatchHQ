// src/components/layout/Sidebar.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  House,
  Television,
  FilmStrip,
  FilmSlate,
  Heart,
  ListDashes,
  GearSix,
} from '@phosphor-icons/react';

const sections = [
  {
    label: 'BROWSE',
    items: [
      { path: '/', icon: House, label: 'Dashboard' },
      { path: '/live', icon: Television, label: 'Live TV' },
      { path: '/movies', icon: FilmStrip, label: 'Movies' },
      { path: '/series', icon: FilmSlate, label: 'Series' },
    ],
  },
  {
    label: 'LIBRARY',
    items: [
      { path: '/favorites', icon: Heart, label: 'Favorites' },
      { path: '/playlists', icon: ListDashes, label: 'Playlists' },
    ],
  },
  {
    label: 'MANAGE',
    items: [
      { path: '/settings', icon: GearSix, label: 'Settings' },
    ],
  },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-bg-elevated border-r border-border-subtle z-50 flex flex-col">
      {/* Logo */}
      <div className="h-[72px] flex items-center gap-3 px-5 border-b border-border-subtle">
        <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center flex-shrink-0">
          <span className="text-black font-bold text-base">W</span>
        </div>
        <span className="font-display font-bold text-lg text-white tracking-tight">WatchHQ</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-6 px-3 py-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-text-tertiary">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="relative flex items-center gap-3 px-3 h-11 rounded-lg transition-colors duration-150 group"
                    style={{
                      background: isActive
                        ? 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 100%)'
                        : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Icon size={24} weight={isActive ? 'fill' : 'regular'} className="flex-shrink-0 z-10" />
                    <span
                      className={`text-sm z-10 ${
                        isActive ? 'text-white font-medium' : 'text-text-secondary group-hover:text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-border-subtle">
        <p className="text-[10px] text-text-tertiary font-mono">v1.0.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;
