export function normalizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\b(hd|fhd|uhd|4k|8k|sd|hevc|h265|h264)\b/gi, '')
    .replace(/\b(vip|premium|plus)\b/gi, '')
    .replace(/[^\w\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findSimilarChannels(target: any, allChannels: any[], excludeIds: Set<string>): any[] {
  const targetKey = normalizeChannelName(target.tvg_name);
  if (!targetKey) return [];

  return allChannels.filter(ch => {
    if (excludeIds.has(ch.id)) return false;
    if (ch.id === target.id) return false;
    const key = normalizeChannelName(ch.tvg_name);
    return key === targetKey;
  });
}
