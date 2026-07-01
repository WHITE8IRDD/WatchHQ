// electron/services/xtream.ts
import axios from 'axios';

export interface XtreamConfig {
  host: string;       // e.g. http://example.com:8080
  username: string;
  password: string;
}

function baseUrl(cfg: XtreamConfig) {
  return cfg.host.replace(/\/+$/, '');
}

function apiUrl(cfg: XtreamConfig, action?: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    username: cfg.username,
    password: cfg.password,
    ...(action ? { action } : {}),
    ...extra,
  });
  return `${baseUrl(cfg)}/player_api.php?${params.toString()}`;
}

export async function authenticate(cfg: XtreamConfig) {
  const { data } = await axios.get(apiUrl(cfg));
  if (!data?.user_info || data.user_info.auth !== 1) {
    throw new Error('Xtream authentication failed. Check host/username/password.');
  }
  return data;
}

export async function getLiveCategories(cfg: XtreamConfig) {
  const { data } = await axios.get(apiUrl(cfg, 'get_live_categories'));
  return data as { category_id: string; category_name: string }[];
}

export async function getLiveStreams(cfg: XtreamConfig, categoryId?: string) {
  const { data } = await axios.get(
    apiUrl(cfg, 'get_live_streams', categoryId ? { category_id: categoryId } : {})
  );
  return data as any[];
}

export async function getVodCategories(cfg: XtreamConfig) {
  const { data } = await axios.get(apiUrl(cfg, 'get_vod_categories'));
  return data as { category_id: string; category_name: string }[];
}

export async function getVodStreams(cfg: XtreamConfig, categoryId?: string) {
  const { data } = await axios.get(
    apiUrl(cfg, 'get_vod_streams', categoryId ? { category_id: categoryId } : {})
  );
  return data as any[];
}

export async function getSeriesCategories(cfg: XtreamConfig) {
  const { data } = await axios.get(apiUrl(cfg, 'get_series_categories'));
  return data as { category_id: string; category_name: string }[];
}

export async function getSeriesList(cfg: XtreamConfig, categoryId?: string) {
  const { data } = await axios.get(
    apiUrl(cfg, 'get_series', categoryId ? { category_id: categoryId } : {})
  );
  return data as any[];
}

export async function getSeriesInfo(cfg: XtreamConfig, seriesId: string) {
  const { data } = await axios.get(apiUrl(cfg, 'get_series_info', { series_id: seriesId }));
  return data as { episodes: Record<string, any[]>; info: any };
}

export function buildLiveStreamUrl(cfg: XtreamConfig, streamId: string, ext = 'ts') {
  return `${baseUrl(cfg)}/live/${cfg.username}/${cfg.password}/${streamId}.${ext}`;
}

export function buildVodStreamUrl(cfg: XtreamConfig, streamId: string, ext: string) {
  return `${baseUrl(cfg)}/movie/${cfg.username}/${cfg.password}/${streamId}.${ext}`;
}

export function buildSeriesEpisodeUrl(cfg: XtreamConfig, episodeId: string, ext: string) {
  return `${baseUrl(cfg)}/series/${cfg.username}/${cfg.password}/${episodeId}.${ext}`;
}

export function buildEpgUrl(cfg: XtreamConfig) {
  return `${baseUrl(cfg)}/xmltv.php?username=${cfg.username}&password=${cfg.password}`;
}
