// Extração estrita de IDs de vídeo do YouTube.
//
// A Activity usa o player oficial, então só precisamos do ID de 11 caracteres.
// Nada aqui baixa, proxya ou contorna restrições do YouTube: links de playlist,
// canais e buscas são rejeitados de propósito.

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtu.be', 'youtube-nocookie.com']);

function isVideoId(value) {
  return typeof value === 'string' && VIDEO_ID_RE.test(value.trim());
}

/**
 * Normaliza um ID ou URL do YouTube para o ID de 11 caracteres.
 * Aceita youtube.com/watch?v=..., youtu.be/..., /shorts/, /embed/, /live/ e /v/.
 * @param {string} value
 * @returns {string|null}
 */
function parseYouTubeUrl(value) {
  let raw = String(value == null ? '' : value).trim();
  if (!raw) return null;

  // Alguns clientes colam o link entre <> (ex.: <https://youtu.be/...>).
  if (raw.startsWith('<') && raw.endsWith('>')) raw = raw.slice(1, -1).trim();
  if (isVideoId(raw)) return raw.trim();

  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '')
    .replace(/^m\./, '')
    .replace(/^music\./, '');
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return isVideoId(id) ? id : null;
  }

  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/watch') {
    const id = url.searchParams.get('v');
    return isVideoId(id) ? id : null;
  }

  const match = path.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  return match ? match[1] : null;
}

function youtubeWatchUrl(videoId) {
  return isVideoId(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

module.exports = {
  VIDEO_ID_RE,
  YOUTUBE_HOSTS,
  isVideoId,
  parseYouTubeUrl,
  youtubeWatchUrl,
};
