// electron/services/m3u-parser.ts
export type ContentType = 'live' | 'movie' | 'series';

export interface M3UChannel {
  tvg_id?: string;
  tvg_name?: string;
  tvg_logo?: string;
  tvg_chno?: string;
  group_title?: string;
  url: string;
  name: string;
  content_type: ContentType;
  series_name?: string;
  season?: number;
  episode?: number;
  year?: number;
}

const MOVIE_KEYWORDS = [
  'film', 'films', 'movie', 'movies', 'vod', 'cinema', 'cinéma',
  'فيلم', 'افلام', 'أفلام', 'موفي', 'مووفي',
  'netflix films', 'paramount', 'epic movies', 'horror', 'thriller',
  'drama', 'comedy', 'action', 'sci-fi', 'fantasy', 'animation',
  'documentary', 'documentaire', 'war movies', 'martial arts',
  'حرب', 'رعب', 'اكشن',
];

const SERIES_KEYWORDS = [
  'series', 'serie', 'séries', 'show', 'shows', 'tv show',
  'netflix series', 'prime video', 'disney+ series', 'apple tv',
  'مسلسل', 'مسلسلات', 'سيريز',
  'episodes', 'season',
];

const VOD_URL_PATTERNS = [
  /\/movie\//i, /\/movies\//i, /\/vod\//i, /\/films?\//i,
  /\.(mp4|mkv|avi|mov|webm)(\?|$)/i,
];

const SERIES_URL_PATTERNS = [
  /\/series\//i, /\/serie\//i, /\/show\//i,
  /s\d{1,2}e\d{1,2}/i,
];

const SERIES_TITLE_REGEX = /^(.+?)[\s._-]+S(\d{1,2})E(\d{1,3})/i;
const SERIES_TITLE_REGEX_ALT = /^(.+?)[\s._-]+(\d{1,2})x(\d{1,3})/i;
const YEAR_REGEX = /\((\d{4})\)/;

function classifyChannel(name: string, groupTitle: string, url: string): {
  type: ContentType;
  series_name?: string;
  season?: number;
  episode?: number;
  year?: number;
} {
  const lowerGroup = (groupTitle || '').toLowerCase();
  const lowerUrl = (url || '').toLowerCase();
  const yearMatch = name.match(YEAR_REGEX);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  // Series pattern in title
  const seriesMatch = name.match(SERIES_TITLE_REGEX) || name.match(SERIES_TITLE_REGEX_ALT);
  if (seriesMatch) {
    return {
      type: 'series',
      series_name: seriesMatch[1].trim(),
      season: parseInt(seriesMatch[2], 10),
      episode: parseInt(seriesMatch[3], 10),
      year,
    };
  }

  // URL patterns
  if (SERIES_URL_PATTERNS.some((re) => re.test(lowerUrl))) return { type: 'series', year };
  if (VOD_URL_PATTERNS.some((re) => re.test(lowerUrl))) return { type: 'movie', year };

  // Group title keywords
  if (SERIES_KEYWORDS.some((kw) => lowerGroup.includes(kw))) return { type: 'series', year };
  if (MOVIE_KEYWORDS.some((kw) => lowerGroup.includes(kw))) return { type: 'movie', year };

  // Year in title → likely movie
  if (year && year > 1900 && year <= new Date().getFullYear() + 2) return { type: 'movie', year };

  return { type: 'live' };
}

export function parseM3U(content: string): M3UChannel[] {
  const lines = content.split('\n');
  const channels: M3UChannel[] = [];
  let currentChannel: Partial<M3UChannel> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#EXTINF')) {
      currentChannel = {};
      const attributesMatch = trimmed.match(/([\w-]+)="([^"]*)"/g);
      if (attributesMatch) {
        attributesMatch.forEach((attr) => {
          const [key, value] = attr.split('=');
          const cleanKey = key.replace(/-/g, '_').toLowerCase();
          (currentChannel as any)[cleanKey] = value.replace(/"/g, '');
        });
      }
      const nameMatch = trimmed.split(',').pop();
      if (nameMatch) {
        currentChannel.name = nameMatch.trim();
        if (!currentChannel.tvg_name) currentChannel.tvg_name = currentChannel.name;
      }
    } else if (trimmed.startsWith('#EXTGRP')) {
      currentChannel.group_title = trimmed.split(':')[1].trim();
    } else if (!trimmed.startsWith('#')) {
      currentChannel.url = trimmed;
      if (currentChannel.url && currentChannel.name) {
        const cls = classifyChannel(currentChannel.name, currentChannel.group_title || '', currentChannel.url);
        channels.push({
          ...currentChannel,
          content_type: cls.type,
          series_name: cls.series_name,
          season: cls.season,
          episode: cls.episode,
          year: cls.year,
        } as M3UChannel);
      }
      currentChannel = {};
    }
  }
  return channels;
}

function extractExtension(url: string): string | null {
  const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : null;
}

export { extractExtension };
