import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlass, X, FunnelSimple, CaretDown } from '@phosphor-icons/react';
import { useDebounce } from '../../hooks/useDebounce';

interface FilterDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 bg-bg-elevated border border-border-subtle rounded-xl text-xs text-text-secondary hover:text-white transition-colors whitespace-nowrap"
      >
        <FunnelSimple size={12} />
        <span>{label}: {options.find(o => o.value === value)?.label || value}</span>
        <CaretDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] bg-bg-elevated border border-border-subtle rounded-xl py-1 shadow-2xl z-50 max-h-[240px] overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                value === opt.value ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface AdvancedSearchBarProps {
  playlistId: string;
  onResults: (channels: any[]) => void;
}

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({ playlistId, onResults }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [country, setCountry] = useState('All');
  const [quality, setQuality] = useState('All');
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([{ value: 'All', label: 'All Categories' }]);
  const [countryOptions] = useState<{ value: string; label: string }[]>([
    { value: 'All', label: 'All Countries' },
    { value: 'US', label: 'United States' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'ES', label: 'Spain' },
    { value: 'FR', label: 'France' },
    { value: 'DE', label: 'Germany' },
    { value: 'IT', label: 'Italy' },
    { value: 'AR', label: 'Argentina' },
    { value: 'BR', label: 'Brazil' },
    { value: 'MX', label: 'Mexico' },
  ]);
  const [qualityOptions] = useState<{ value: string; label: string }[]>([
    { value: 'All', label: 'All Qualities' },
    { value: 'FHD', label: 'FHD' },
    { value: 'HD', label: 'HD' },
    { value: 'SD', label: 'SD' },
  ]);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!playlistId) return;
    window.electronAPI.getGroups(playlistId).then((groups) => {
      setCategoryOptions([
        { value: 'All', label: 'All Categories' },
        ...groups.map((g: any) => ({ value: g.group_title, label: `${g.group_title} (${g.count})` })),
      ]);
    }).catch(() => {});
  }, [playlistId]);

  useEffect(() => {
    (async () => {
      if (!playlistId) return;
      try {
        let results = await window.electronAPI.searchChannels({
          playlistId,
          query: debouncedQuery || '',
          group: category !== 'All' ? category : undefined,
        });
        if (quality !== 'All') {
          const q = quality.toLowerCase();
          results = results.filter((ch: any) => ch.tvg_name.toLowerCase().includes(q));
        }
        onResults(results || []);
      } catch { onResults([]); }
    })();
  }, [playlistId, debouncedQuery, category, quality, onResults]);

  return (
    <div className="px-3 py-2.5 border-b border-border-subtle flex-shrink-0 flex flex-col gap-2">
      <div className="relative">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels..."
          className="w-full bg-bg-elevated border border-border-subtle rounded-xl pl-10 pr-10 py-2 text-sm text-white placeholder:text-text-tertiary focus:outline-none focus:border-white/20 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <FilterDropdown label="Category" options={categoryOptions} value={category} onChange={setCategory} />
        <FilterDropdown label="Country" options={countryOptions} value={country} onChange={setCountry} />
        <FilterDropdown label="Quality" options={qualityOptions} value={quality} onChange={setQuality} />
      </div>
    </div>
  );
};

export default AdvancedSearchBar;
