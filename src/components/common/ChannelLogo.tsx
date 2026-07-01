import React, { useState, useRef, useEffect, useMemo } from 'react';

const AVATAR_GRADIENTS: [string, string][] = [
  ['#FF6B6B', '#EE5A6F'], ['#4ECDC4', '#44A3AA'], ['#95E1D3', '#3FC1C9'],
  ['#F38181', '#FCE38A'], ['#AA96DA', '#FCBAD3'], ['#A8E6CF', '#3EACE0'],
  ['#FFD93D', '#FF6B6B'], ['#6BCF7F', '#4D9078'], ['#845EC2', '#D65DB1'],
  ['#FF9671', '#FFC75F'], ['#00C9A7', '#00B4D8'], ['#F15BB5', '#9B5DE5'],
  ['#FB8500', '#FFB703'], ['#06D6A0', '#118AB2'], ['#E63946', '#F4A261'],
  ['#2A9D8F', '#264653'],
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function extractInitials(name: string): string {
  const clean = name.replace(/[^\w\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface ChannelLogoProps {
  name: string;
  logo?: string;
  size?: number;
  className?: string;
}

const ChannelLogo: React.FC<ChannelLogoProps> = React.memo(({ name, logo, size = 40, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const objUrlRef = useRef<string>('');

  useEffect(() => {
    if (!logo) { setImgSrc(''); return; }
    setFailed(false);
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.electronAPI.fetchImage(logo).then((res) => {
          if (res && res.dataUrl) {
            objUrlRef.current = res.dataUrl;
            setImgSrc(res.dataUrl);
          } else {
            setFailed(true);
          }
        });
        obs.disconnect();
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => { obs.disconnect(); if (objUrlRef.current) { URL.revokeObjectURL(objUrlRef.current); objUrlRef.current = ''; } };
  }, [logo]);

  const hash = useMemo(() => hashCode(name || '?'), [name]);
  const [c1, c2] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  const initials = useMemo(() => extractInitials(name), [name]);

  if (!logo || failed) {
    return (
      <div ref={ref}
        className={`flex items-center justify-center font-bold text-white select-none ${className}`}
        style={{
          width: size, height: size,
          borderRadius: Math.max(4, size * 0.22),
          background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
          fontSize: Math.max(10, size * 0.42),
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div ref={ref}
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: Math.max(4, size * 0.22), background: 'var(--bg-elevated)' }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={name}
          className="max-w-full max-h-full object-contain"
          style={{ width: size * 0.85, height: size * 0.85 }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
});

export default ChannelLogo;
