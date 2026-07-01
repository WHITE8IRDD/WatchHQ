// src/pages/History.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Play, X, Tv, Film, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { staggerContainer, fadeInUp } from '../lib/motion';

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

interface HistoryEntry {
  item_type: 'live' | 'vod' | 'series';
  item_id: string;
  title: string;
  icon?: string;
  url: string;
  position_seconds: number;
  duration_seconds: number;
  progress_percent: number;
  last_watched: string;
}

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return 'today';
  if (d.getTime() === yesterday.getTime()) return 'yesterday';
  if (d >= weekAgo) return 'thisWeek';
  return 'older';
}

const groupLabels: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  older: 'Older',
};

const groupOrder: DateGroup[] = ['today', 'yesterday', 'thisWeek', 'older'];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const History: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await withTimeout(window.electronAPI.getRecentHistory(50));
      setEntries(data || []);
    } catch {
      // timeout or failure
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await window.electronAPI.clearHistory();
      setEntries([]);
      toast.success('History cleared');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear history');
    }
    setShowConfirm(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <motion.div {...fadeInUp}>
          <h1 className="text-2xl font-display font-bold tracking-tight">History</h1>
        </motion.div>
        <div className="mt-8 text-text-secondary text-sm">Loading...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-8">
        <motion.div {...fadeInUp} className="mb-6">
          <h1 className="text-2xl font-display font-bold tracking-tight">History</h1>
        </motion.div>
        <motion.div className="flex flex-col items-center justify-center py-20 text-center" {...fadeInUp}>
          <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
            <Clock size={28} className="text-text-tertiary" />
          </div>
          <h3 className="font-display font-semibold text-lg mb-1">No watch history yet</h3>
          <p className="text-text-secondary text-sm max-w-sm mb-4">
            Start watching channels or movies and they'll appear here.
          </p>
          <Link
            to="/live"
            className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all"
          >
            Start watching
          </Link>
        </motion.div>
      </div>
    );
  }

  const grouped = new Map<DateGroup, HistoryEntry[]>();
  for (const g of groupOrder) grouped.set(g, []);
  for (const e of entries) {
    const g = getDateGroup(new Date(e.last_watched));
    grouped.get(g)!.push(e);
  }

  return (
    <motion.div className="p-8 max-w-3xl" {...staggerContainer}>
      <motion.div className="flex items-center justify-between mb-6" {...fadeInUp}>
        <h1 className="text-2xl font-display font-bold tracking-tight">History</h1>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-state-error hover:bg-white/5 transition-colors"
        >
          <Trash2 size={14} />
          Clear all
        </button>
      </motion.div>

      {groupOrder.map((group) => {
        const items = grouped.get(group)!;
        if (items.length === 0) return null;
        return (
          <motion.div key={group} className="mb-8" {...fadeInUp}>
            <h2 className="text-sm font-display font-semibold text-text-secondary uppercase tracking-wider mb-3">
              {groupLabels[group]}
            </h2>
            <div className="space-y-2">
              {items.map((entry) => (
                <div
                  key={`${entry.item_type}-${entry.item_id}`}
                  className="flex items-center gap-3 bg-bg-elevated border border-border-subtle rounded-xl p-3 group"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0">
                    {entry.icon ? (
                      <img src={entry.icon} alt="" className="w-full h-full object-cover" />
                    ) : entry.item_type === 'live' ? (
                      <Tv size={18} className="text-text-tertiary" />
                    ) : (
                      <Film size={18} className="text-text-tertiary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{entry.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-text-tertiary">
                        {formatDateTime(entry.last_watched)}
                      </span>
                      {entry.progress_percent > 0 && (
                        <span className="text-[11px] text-text-tertiary">
                          {formatTime(entry.position_seconds)} / {formatTime(entry.duration_seconds)}
                        </span>
                      )}
                    </div>
                    {entry.progress_percent > 0 && (
                      <div className="mt-1.5 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/40 rounded-full transition-all"
                          style={{ width: `${Math.min(entry.progress_percent, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={entry.item_type === 'live' ? '/live' : '/movies'}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      title="Resume"
                    >
                      <Play size={14} className="text-white" />
                    </Link>
                    <button
                      onClick={async () => {
                        try {
                          await window.electronAPI.clearHistoryItem({ item_type: entry.item_type, item_id: entry.item_id });
                          loadHistory();
                          toast.success('Removed from history');
                        } catch { toast.error('Failed to remove'); }
                      }}
                      className="p-2 rounded-lg hover:bg-white/5 text-text-tertiary hover:text-state-error transition-colors"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      {showConfirm && (
        <ConfirmDialog
          title="Clear history"
          message="Are you sure you want to clear all watch history? This cannot be undone."
          confirmLabel="Clear all"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleClearAll}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </motion.div>
  );
};

export default History;
