// electron/services/epg-parser.ts
import { XMLParser } from 'fast-xml-parser';

export interface EpgProgram {
  tvg_id: string;
  title: string;
  description?: string;
  start_time: number; // unix seconds
  end_time: number;
  category?: string;
}

function parseXmltvTime(t: string): number {
  const match = t.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return Math.floor(Date.now() / 1000);
  const [, y, mo, d, h, mi, s, tz] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz ? tz.replace(/(\d{2})(\d{2})$/, '$1:$2') : 'Z'}`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function parseXMLTV(xml: string): EpgProgram[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const result = parser.parse(xml);
  const programmes = result?.tv?.programme;
  if (!programmes) return [];

  const list = Array.isArray(programmes) ? programmes : [programmes];
  return list.map((p: any) => ({
    tvg_id: p['@_channel'],
    title: typeof p.title === 'object' ? p.title['#text'] ?? '' : p.title ?? '',
    description: typeof p.desc === 'object' ? p.desc['#text'] : p.desc,
    start_time: parseXmltvTime(p['@_start']),
    end_time: parseXmltvTime(p['@_stop']),
    category: typeof p.category === 'object' ? p.category['#text'] : p.category,
  }));
}
