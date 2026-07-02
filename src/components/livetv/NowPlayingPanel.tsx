import React from 'react';
import { Star, ArrowsOut, MagnifyingGlass, Television } from '@phosphor-icons/react';
import ChannelLogo from '../common/ChannelLogo';

interface NowPlayingPanelProps {
  channel: any;
  epg: { now: any; next?: any; progress?: number } | null;
  onToggleFavorite: () => void;
}

function formatEpgTime(t: string): string {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d.getTime())) {
    const m = t.match(/(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    return '';
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getNextDate(day: number, hour: number, minute: number): Date {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() + ((day + 7 - d.getDay()) % 7));
  d.setHours(hour, minute, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}

const NowPlayingPanel: React.FC<NowPlayingPanelProps> = ({ channel, epg, onToggleFavorite }) => {
  return (
    <div className="flex-1 px-5 py-4 bg-bg-base overflow-y-auto">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-bg-elevated">
          <ChannelLogo name={channel.tvg_name} logo={channel.tvg_logo} size={48} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {channel.tvg_chno && (
              <span className="text-[11px] text-text-tertiary font-mono tabular-nums">#{channel.tvg_chno}</span>
            )}
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Now Playing</span>
          </div>
          <h3 className="text-base font-semibold leading-snug break-words">{channel.tvg_name}</h3>
        </div>
      </div>

      {/* EPG Progress */}
      {epg?.now ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-white">{epg.now.title}</span>
            <span className="text-[11px] text-text-tertiary tabular-nums">
              {formatEpgTime(epg.now.start_time)} - {formatEpgTime(epg.now.end_time)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, epg.progress || 0)}%` }}
            />
          </div>
          {epg.now.description && (
            <p className="text-xs text-text-tertiary mt-2 line-clamp-2 leading-relaxed">{epg.now.description}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center mb-4">
          <Television size={24} className="text-text-tertiary/40 mb-2" />
          <p className="text-xs text-text-tertiary">No guide data for this channel</p>
        </div>
      )}

      {/* Up Next */}
      {epg?.next && (
        <div className="mb-4 pt-3 border-t border-border-subtle">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold mb-2">Up Next</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-2 rounded-lg bg-white/[0.03]">
              <div className="w-1 h-full min-h-[2rem] bg-white/20 rounded-full flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary leading-snug">{epg.next.title}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5 tabular-nums">
                  {formatEpgTime(epg.next.start_time)} - {formatEpgTime(epg.next.end_time)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
        <button
          onClick={onToggleFavorite}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            channel.is_favorite
              ? 'bg-gold-muted text-gold'
              : 'text-text-tertiary hover:text-white hover:bg-white/5'
          }`}
        >
          <Star size={12} weight={channel.is_favorite ? 'fill' : 'regular'} />
          {channel.is_favorite ? 'Favorited' : 'Add to Favorites'}
        </button>
      </div>
    </div>
  );
};

export default NowPlayingPanel;
