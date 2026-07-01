// electron/services/stalker.ts
import axios from 'axios';

export interface StalkerConfig {
  portalUrl: string; // e.g. http://example.com:8080/c/
  macAddress: string;
}

function headers(cfg: StalkerConfig, token?: string) {
  return {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Mobile Safari/533.3',
    'Cookie': `mac=${encodeURIComponent(cfg.macAddress)}; stb_lang=en; timezone=Europe/London`,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function portalBase(cfg: StalkerConfig) {
  return cfg.portalUrl.replace(/\/+$/, '') + '/';
}

export async function handshake(cfg: StalkerConfig): Promise<string> {
  const url = `${portalBase(cfg)}portal.php?type=stb&action=handshake&JsHttpRequest=1-xml`;
  const { data } = await axios.get(url, { headers: headers(cfg) });
  const token = data?.js?.token;
  if (!token) throw new Error('Stalker handshake failed — check portal URL and MAC address.');
  return token;
}

export async function getProfile(cfg: StalkerConfig, token: string) {
  const url = `${portalBase(cfg)}portal.php?type=stb&action=get_profile&JsHttpRequest=1-xml`;
  const { data } = await axios.get(url, { headers: headers(cfg, token) });
  return data?.js;
}

export async function getGenres(cfg: StalkerConfig, token: string) {
  const url = `${portalBase(cfg)}portal.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const { data } = await axios.get(url, { headers: headers(cfg, token) });
  return data?.js as { id: string; title: string }[];
}

export async function getAllChannels(cfg: StalkerConfig, token: string) {
  const url = `${portalBase(cfg)}portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
  const { data } = await axios.get(url, { headers: headers(cfg, token) });
  return data?.js?.data as any[];
}

export async function createLink(cfg: StalkerConfig, token: string, cmd: string) {
  const url = `${portalBase(cfg)}portal.php?type=itv&action=create_link&cmd=${encodeURIComponent(
    cmd
  )}&JsHttpRequest=1-xml`;
  const { data } = await axios.get(url, { headers: headers(cfg, token) });
  const raw: string = data?.js?.cmd || '';
  return raw.replace(/^ffmpeg\s+/, '').trim();
}
