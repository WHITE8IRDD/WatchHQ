import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface AdvancedSearchBarProps {
  playlistId: string;
  onResults: (channels: any[]) => void;
}

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({ playlistId, onResults }) => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    (async () => {
      if (!playlistId) return;
      try {
        const results = await window.electronAPI.searchChannels({
          playlistId,
          query: debouncedQuery || '',
        });
        onResults(results || []);
      } catch {
        onResults([]);
      }
    })();
  }, [playlistId, debouncedQuery, onResults]);

  return (
    <div className="px-3 py-2.5 border-b border-border-subtle flex-shrink-0">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
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
    </div>
  );
};

export default AdvancedSearchBar;
