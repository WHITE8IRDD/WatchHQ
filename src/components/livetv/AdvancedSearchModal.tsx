import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, SlidersHorizontal } from 'lucide-react';

interface AdvancedSearchModalProps {
  open: boolean;
  onClose: () => void;
  playlistId: string;
  onApply: (filters: { category: string; country: string; quality: string }) => void;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({ open, onClose, playlistId, onApply }) => {
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('All');
  const [country, setCountry] = useState('All');
  const [quality, setQuality] = useState('All');
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([
    { value: 'All', label: 'All Categories' },
  ]);

  useEffect(() => {
    if (!playlistId || !open) return;
    window.electronAPI
      .getGroups(playlistId)
      .then((groups) => {
        setCategoryOptions([
          { value: 'All', label: 'All Categories' },
          ...groups.map((g: any) => ({ value: g.group_title, label: `${g.group_title} (${g.count})` })),
        ]);
      })
      .catch(() => {});
  }, [playlistId, open]);

  const handleApply = () => {
    onApply({ category, country, quality });
    onClose();
  };

  const handleClear = () => {
    setCategory('All');
    setCountry('All');
    setQuality('All');
    setSearchText('');
    onApply({ category: 'All', country: 'All', quality: 'All' });
    onClose();
  };

  const countryOptions = [
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
  ];

  const qualityOptions = [
    { value: 'All', label: 'All Qualities' },
    { value: 'FHD', label: 'FHD' },
    { value: 'HD', label: 'HD' },
    { value: 'SD', label: 'SD' },
  ];

  const renderDropdown = (
    label: string,
    options: { value: string; label: string }[],
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div>
      <label className="block text-xs text-text-tertiary mb-1.5 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md bg-bg-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-text-secondary" />
                <h2 className="font-display font-bold text-lg">Advanced Search</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full bg-bg-base border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-text-tertiary focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>
            </div>

            <div className="px-5 pb-4 space-y-3">
              {renderDropdown('Category', categoryOptions, category, setCategory)}
              {renderDropdown('Country', countryOptions, country, setCountry)}
              {renderDropdown('Quality', qualityOptions, quality, setQuality)}
            </div>

            <div className="px-5 pb-5 flex items-center gap-3">
              <button
                onClick={handleClear}
                className="text-xs text-text-tertiary hover:text-white transition-colors underline underline-offset-2"
              >
                Clear all
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border-subtle text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Apply filters
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdvancedSearchModal;
