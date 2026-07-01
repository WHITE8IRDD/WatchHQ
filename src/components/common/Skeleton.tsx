// src/components/common/Skeleton.tsx
import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white/[0.04] rounded-lg animate-pulse ${className}`} />
);

export const ChannelCardSkeleton = () => (
  <div className="bg-bg-elevated border border-border-subtle rounded-xl p-3">
    <Skeleton className="w-full h-10 mb-2" />
    <Skeleton className="w-3/4 h-4 mb-1" />
    <Skeleton className="w-1/2 h-3" />
  </div>
);

export const ChannelGridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <ChannelCardSkeleton key={i} />
    ))}
  </div>
);

export const SettingsCardSkeleton = () => (
  <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-4">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="w-1/3 h-4 mb-1" />
        <Skeleton className="w-1/2 h-3" />
      </div>
    </div>
    <Skeleton className="w-full h-10 mb-2" />
    <Skeleton className="w-3/4 h-8" />
  </div>
);
