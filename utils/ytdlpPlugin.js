const { YtDlpPlugin, json } = require('@distube/yt-dlp');
const { Song, Playlist, DisTubeError } = require('distube');
const { ATIVO: CACHE_ATIVO, obterUrlLocal, prefetch } = require('./audioCache');

// ─────────────────────────────────────────────────────────────────────────────
// Plugin do DisTube para yt-dlp com os argumentos que o YouTube exige hoje.
//
// O YtDlpPlugin 2.x não aceita opções extras de linha de comando (o
// `ytdlpOptions` é ignorado), então `--js-runtimes` e `--remote-components`
// nunca chegavam ao binário. Sem eles o yt-dlp não resolve as assinaturas dos
// formatos e o DisTube falha com "Requested format is not available".
//
// Aqui o plugin é reutilizado apenas como "casca" (tipo, init, validate); as
// duas chamadas ao yt-dlp são refeitas com os flags corretos, usando o helper
// `json` exportado pelo próprio pacote (que já injeta os cookies do ambiente).
// ─────────────────────────────────────────────────────────────────────────────

const FLAGS = {
  dumpSingleJson: true,
  noWarnings: true,
  preferFreeFormats: true,
  skipDownload: true,
  simulate: true,
  jsRuntimes: process.env.YTDLP_JS_RUNTIME || 'node',
  remoteComponents: process.env.YTDLP_REMOTE_COMPONENTS || 'ejs:github',
  retries: 3,
  fragmentRetries: 3,
  extractorRetries: 2,
  socketTimeout: 20,
};

function mensagemDeErro(erro) {
  return `${erro?.stderr || erro?.message || erro}`.trim();
}

function criarSong(plugin, info, options = {}) {
  const url = info.webpage_url || info.original_url
    || (/^https?:\/\//i.test(String(info.url || '')) ? info.url : undefined);
  return new Song({
    plugin,
    source: info.extractor || info.ie_key || 'youtube',
    playFromSource: true,
    id: String(info.id ?? url ?? ''),
    name: info.title || info.fulltitle || 'Sem título',
    url,
    isLive: Boolean(info.is_live),
    thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
    duration: info.is_live ? 0 : info.duration,
    uploader: { name: info.uploader, url: info.uploader_url },
    views: info.view_count,
    likes: info.like_count,
    dislikes: info.dislike_count,
    reposts: info.repost_count,
    ageRestricted: Boolean(info.age_limit) && info.age_limit >= 18,
  }, options);
}

// `ba/b` = melhor áudio disponível; se o site só tiver arquivo com vídeo
// junto, o ffmpeg do DisTube extrai a faixa de áudio normalmente.
const FORMATO_AUDIO = 'ba/b';

async function buscarInfo(url, flags) {
  try {
    return await json(url, flags);
  } catch (erro) {
    throw new DisTubeError('YTDLP_ERROR', mensagemDeErro(erro));
  }
}

function criarPluginYtDlp() {
  const plugin = new YtDlpPlugin({ update: false });

  plugin.resolve = async (url, options) => {
    const info = await buscarInfo(url, FLAGS);

    if (Array.isArray(info.entries)) {
      if (!info.entries.length) throw new DisTubeError('YTDLP_ERROR', 'A playlist está vazia.');
      return new Playlist({
        source: info.extractor,
        songs: info.entries.map((item) => criarSong(plugin, item, options)),
        id: String(info.id ?? ''),
        name: info.title || 'Playlist',
        url: info.webpage_url,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
      }, options);
    }

    return criarSong(plugin, info, options);
  };

  plugin.getStreamURL = async (song) => {
    if (!song.url) {
      throw new DisTubeError('YTDLP_PLUGIN_INVALID_SONG', 'Não foi possível obter uma URL válida para esta música.');
    }

    // O CDN do YouTube responde 403 ao ffmpeg mesmo quando a URL funciona para
    // o yt-dlp (redirect/assinatura só aceitos pelo cliente dele). Baixar pelo
    // yt-dlp e servir por HTTP local evita o FFMPEG_EXITED de vez.
    // Lives ficam de fora: não têm fim para baixar.
    if (CACHE_ATIVO && !song.isLive) {
      try {
        return await obterUrlLocal(song);
      } catch (erro) {
        throw new DisTubeError('YTDLP_ERROR', mensagemDeErro(erro));
      }
    }

    const info = await buscarInfo(song.url, { ...FLAGS, format: FORMATO_AUDIO });
    if (Array.isArray(info.entries)) {
      throw new DisTubeError('YTDLP_ERROR', 'Não é possível obter o áudio de uma playlist inteira.');
    }
    if (!info.url) {
      throw new DisTubeError('YTDLP_ERROR', 'O yt-dlp não devolveu uma URL de áudio.');
    }
    return info.url;
  };

  plugin.getRelatedSongs = () => [];

  return plugin;
}

// Pré-baixa em segundo plano a próxima música da fila (chamado pelo addSong).
function prefetchSong(song) {
  if (!CACHE_ATIVO || song?.isLive || !song?.url) return;
  prefetch(song);
}

module.exports = { criarPluginYtDlp, prefetchSong, FLAGS };
