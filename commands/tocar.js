const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const SpotifyWebApi = require('spotify-web-api-node');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Song } = require('distube');
const { criarEmbed, THEME } = require('../utils/theme');
const { obterTokenAplicacao } = require('../utils/spotifyAuth');

const execFileAsync = promisify(execFile);
const YTDLP_PATH = path.join(__dirname, '..', 'node_modules', '@distube', 'yt-dlp', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const RESULTADOS_POR_PAGINA = 5;
const SUNO_HOSTS = new Set(['suno.com', 'www.suno.com', 'app.suno.ai', 'suno.ai', 'www.suno.ai']);
const spotifyApi = process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET ? new SpotifyWebApi({ clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET }) : null;
let spotifyTokenPromise;

async function obterSpotifyToken() {
  if (!spotifyApi) return null;
  if (!spotifyTokenPromise) spotifyTokenPromise = obterTokenAplicacao().then((token) => {
    if (!token) throw new Error('Spotify sem credenciais configuradas.');
    spotifyApi.setAccessToken(token);
    return token;
  }).catch((erro) => {
    spotifyTokenPromise = null;
    throw erro;
  });
  return spotifyTokenPromise;
}

function normalizarTexto(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()[\]{}]/g, ' ').replace(/\b(official|official video|lyrics?|audio|video|music video|hd|hq|remastered)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function pontuacaoCorrespondencia(candidato, alvo) {
  const a = normalizarTexto(`${candidato.title || candidato.name || ''} ${candidato.uploader || candidato.artist || ''}`);
  const b = normalizarTexto(`${alvo.title || alvo.name || ''} ${alvo.uploader || alvo.artist || ''}`);
  const palavras = new Set(b.split(' ').filter((palavra) => palavra.length > 2));
  return palavras.size ? [...palavras].filter((palavra) => a.includes(palavra)).length / palavras.size : 0;
}

async function buscarSpotify(query) {
  if (!spotifyApi) return [];
  await obterSpotifyToken();
  const resposta = await spotifyApi.searchTracks(query, { limit: 10, market: process.env.SPOTIFY_MARKET || 'BR' });
  return (resposta.body.tracks?.items || []).map((item) => ({
    id: item.id,
    title: item.name,
    name: item.name,
    artist: item.artists.map((artista) => artista.name).join(', '),
    duration: Math.round(item.duration_ms / 1000),
    thumbnail: item.album?.images?.[0]?.url,
    webpage_url: item.external_urls?.spotify,
    fonte: 'Spotify',
  }));
}

async function metadadosYouTube(url) {
  const { stdout } = await execFileAsync(YTDLP_PATH, ['--', url, '--dump-single-json', '--no-warnings', '--no-update', '--skip-download'], { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 20000 });
  return extrairJson(stdout);
}

async function substituirYouTubePorSpotify(url) {
  if (!spotifyApi) return null;
  const metadados = await metadadosYouTube(url);
  const consulta = `${metadados.artist || metadados.uploader || ''} ${metadados.track || metadados.title || ''}`.trim();
  const candidatos = await buscarSpotify(consulta);
  const melhor = candidatos.sort((a, b) => pontuacaoCorrespondencia(b, metadados) - pontuacaoCorrespondencia(a, metadados))[0];
  if (!melhor || pontuacaoCorrespondencia(melhor, metadados) < 0.75) return null;
  return melhor;
}

async function prepararUrlParaTocar(query) {
  if (!ehUrl(query)) return query;
  if (!urlPublicaPermitida(query)) {
    throw new Error('Esse endereço não é permitido. Use links públicos de música (YouTube, SoundCloud ou Spotify).');
  }
  return ehUrlSuno(query) ? await resolverUrlSuno(query) : query;
}

async function tocarComFallbackSpotify(client, interaction, voiceChannel, member, resultado) {
  const url = obterUrlResultado(resultado);
  try {
    await tocar(client, interaction, voiceChannel, member, resultado);
    return { fonte: resultado.fonte };
  } catch (erro) {
    if (resultado.fonte !== 'YouTube') throw erro;
    const spotify = await substituirYouTubePorSpotify(url);
    if (!spotify) throw erro;
    await tocar(client, interaction, voiceChannel, member, spotify);
    return { fonte: 'Spotify', substituida: true };
  }
}

function ehUrlSuno(valor) {
  try {
    return SUNO_HOSTS.has(new URL(valor).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function urlPublicaDeAudio(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && /\.(mp4|mp3|m4a|aac|ogg|wav|webm)(?:$|\?)/i.test(url.pathname);
  } catch {
    return false;
  }
}

function valorMeta(html, propriedade) {
  const padrao = new RegExp(`<meta[^>]+(?:property|name)=["']${propriedade}["'][^>]+content=["']([^"']+)["']`, 'i');
  return html.match(padrao)?.[1]?.replace(/&amp;/g, '&').trim() || null;
}

function valorJson(html, propriedade) {
  const padrao = new RegExp(`"${propriedade}"\\s*:\\s*(?:"([^"]+)"|([\\d.]+))`, 'i');
  const resultado = html.match(padrao);
  return resultado?.[1] || resultado?.[2] || null;
}

async function resolverUrlSuno(url) {
  const resposta = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
  if (!resposta.ok) throw new Error(`Suno respondeu HTTP ${resposta.status}.`);
  const html = await resposta.text();
  const urlCanonica = resposta.url || url;
  const ids = [...`${urlCanonica}\n${url}\n${html}`.matchAll(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi)].map((resultado) => resultado[0]);
  const id = ids[0] || null;
  const candidatos = [
    ...(id ? [`https://cdn1.suno.ai/${id}.mp4`] : []),
    ...(valorJson(html, 'video_url') ? [valorJson(html, 'video_url')] : []),
    ...(valorJson(html, 'audio_url') ? [valorJson(html, 'audio_url')] : []),
    ...html.matchAll(/(?:video_url|videoUrl)["'\s:=]+["'](https?:\/\/[^"']+\.(?:mp4|webm)(?:\?[^"']*)?)["']/gi),
    ...html.matchAll(/(?:audio_url|audioUrl|download_url|downloadUrl|contentUrl|"url")["'\s:=]+["'](https?:\/\/[^"']+)["']/gi),
    ...html.matchAll(/https?:\\?\/\\?\/[^"'\\s]+\.(?:mp4|webm|mp3|m4a|aac|ogg|wav)(?:\?[^"'\\s]*)?/gi),
  ]
    .map((resultado) => (typeof resultado === 'string' ? resultado : (resultado[1] || resultado[0])).replace(/\\u0026/g, '&').replace(/\\\//g, '/'))
    .filter((valor) => /^https:\/\//i.test(valor) && /\.(mp4|webm|mp3|m4a|aac|ogg|wav)(?:$|\?)/i.test(valor));
  let audioUrl = null;
  for (const candidato of candidatos) {
    try {
      const respostaAudio = await fetch(candidato, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      if (respostaAudio.ok) {
        audioUrl = candidato;
        break;
      }
    } catch {}
  }
  if (!audioUrl) throw new Error('Não encontrei um áudio público nesse link do Suno. Verifique se a música está publicada.');
  const letra = valorJson(html, 'lyrics') || valorJson(html, 'lyric') || valorJson(html, 'prompt');
  return {
    url: audioUrl,
    pageUrl: url,
    lyrics: letra,
    name: valorJson(html, 'title') || valorMeta(html, 'og:title') || valorMeta(html, 'twitter:title') || (id ? `Música do Suno (${id.slice(0, 8)})` : 'Música do Suno'),
    thumbnail: valorJson(html, 'image_url') || valorJson(html, 'image_large_url') || valorMeta(html, 'og:image') || valorMeta(html, 'twitter:image'),
    duration: Number(valorJson(html, 'duration')) || 0,
  };
}

function resumirErro(erro) {
  const status = erro?.statusCode || erro?.status ? `HTTP ${erro.statusCode || erro.status}` : '';
  const detalhe = erro?.body?.error?.message || erro?.body?.error_description || erro?.response?.body?.error?.message || '';
  const mensagem = detalhe || erro?.message || String(erro);
  return `${status}${status && mensagem ? ': ' : ''}${mensagem}`.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function ehUrl(valor) {
  return /^https?:\/\//i.test(valor);
}

/**
 * Bloqueia SSRF: o yt-dlp/ffmpeg não podem ser apontados para localhost,
 * rede privada, link-local ou protocolos não-HTTP. Sem isso, `$tocar` virava
 * um leitor de serviços internos da máquina que hospeda o bot.
 */
function urlPublicaPermitida(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;
  if (['localhost', '0.0.0.0', '::1', '::', 'metadata.google.internal'].includes(host)) return false;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return false;
  // IPv4 privado / loopback / link-local / CGNAT
  if (/^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return false;
  // IPv6 loopback, ULA (fc00::/7) e link-local (fe80::/10)
  if (/^(?:fc|fd|fe[89ab])[0-9a-f]{2}:/i.test(host)) return false;
  return true;
}

function fonteDaUrl(url) {
  if (/soundcloud\.com/i.test(url)) return 'SoundCloud';
  if (/spotify\.com/i.test(url)) return 'Spotify';
  return 'YouTube';
}

function obterUrlResultado(item) {
  if (item.fonte === 'Spotify' && item.id) return `https://open.spotify.com/track/${item.id}`;
  if (item.webpage_url) return item.webpage_url;
  if (item.url && /^https?:\/\//i.test(item.url)) return item.url;
  if (item.id && item.ie_key === 'Youtube') return `https://www.youtube.com/watch?v=${item.id}`;
  return null;
}

function extrairJson(stdout) {
  const inicio = stdout.indexOf('{');
  const fim = stdout.lastIndexOf('}');
  if (inicio < 0 || fim < inicio) throw new Error('Resposta inválida do yt-dlp.');
  return JSON.parse(stdout.slice(inicio, fim + 1));
}

async function buscarFonte(prefixo, query) {
  const { stdout } = await execFileAsync(YTDLP_PATH, [
    `${prefixo}${query}`,
    '--flat-playlist',
    '--dump-single-json',
    '--no-warnings',
    '--no-update',
    '--skip-download',
  ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 20000 });
  const info = extrairJson(stdout);
  const entradas = info.entries || (info.webpage_url ? [info] : []);
  return entradas.filter((item) => obterUrlResultado(item)).slice(0, 5).map((item) => ({ ...item, fonte: prefixo.startsWith('yt') ? 'YouTube' : 'SoundCloud' }));
}

function formatarDuracao(segundos) {
  if (!Number.isFinite(Number(segundos))) return '';
  const total = Math.round(Number(segundos));
  const minutos = Math.floor(total / 60);
  const segundosRestantes = total % 60;
  return ` — ${minutos}:${String(segundosRestantes).padStart(2, '0')}`;
}

function formatarResultados(estado) {
  const inicio = estado.pagina * RESULTADOS_POR_PAGINA;
  const itens = estado.resultados.slice(inicio, inicio + RESULTADOS_POR_PAGINA);
  return ['Spotify', 'SoundCloud', 'YouTube'].map((fonte) => {
    const linhas = itens.map((item, indice) => ({ item, numero: inicio + indice + 1 })).filter(({ item }) => item.fonte === fonte).map(({ item, numero }) => (
      `**${numero}.** ${item.title || item.name || 'Sem título'}${formatarDuracao(item.duration)}`
    ));
    return linhas.length ? `**${fonte}**\n${linhas.join('\n')}` : null;
  }).filter(Boolean).join('\n\n');
}

const VARIACOES_CARREGAMENTO = [
  ['🔮', 'Sintonizando a frequência'], ['🍓', 'Misturando as batidas'], ['🌈', 'Ajustando o arco-íris'], ['🫧', 'Polindo o som'], ['✨', 'Chamando a música'],
  ['🍋', 'Espremendo o refrão'], ['🪩', 'Acendendo a pista'], ['🌙', 'Abrindo a jukebox'], ['💿', 'Girando o disco'], ['🎀', 'Preparando o palco'],
];

function criarLoading(query, thumbnail, passo = 1) {
  const variacao = VARIACOES_CARREGAMENTO[passo % VARIACOES_CARREGAMENTO.length];
  const porcentagem = Math.min(95, 18 + passo * 17);
  return criarEmbed({
    titulo: `${variacao[0]} ${variacao[1]} · ${porcentagem}%`,
    descricao: `**${query}**\n\n${'▰'.repeat(Math.floor(porcentagem / 10))}${'▱'.repeat(10 - Math.floor(porcentagem / 10))}\n\nA Mila está preparando o áudio para o canal de voz.`,
    cor: THEME.corPrincipal,
    thumbnail,
    rodape: 'Mila Music Party · carregando'
  });
}

function componentesBusca(estado) {
  const inicio = estado.pagina * RESULTADOS_POR_PAGINA;
  const totalPaginas = Math.ceil(estado.resultados.length / RESULTADOS_POR_PAGINA);
  const selecao = estado.resultados.slice(inicio, inicio + RESULTADOS_POR_PAGINA).map((item, indice) => (
    new ButtonBuilder()
      .setCustomId(`music_pick_${inicio + indice}`)
      .setLabel(String(inicio + indice + 1))
      .setStyle(ButtonStyle.Success)
      .setDisabled(!obterUrlResultado(item))
  ));
  const navegacao = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_prev').setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(estado.pagina <= 0),
    new ButtonBuilder().setCustomId('music_next').setLabel('Próxima').setStyle(ButtonStyle.Primary).setDisabled(estado.pagina >= totalPaginas - 1),
    new ButtonBuilder().setCustomId('music_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger),
  );
  return [new ActionRowBuilder().addComponents(selecao), navegacao];
}

async function tocar(client, interaction, voiceChannel, member, query) {
  const musica = typeof query === 'string' || query.fonte === 'Spotify' ? (typeof query === 'string' ? query : obterUrlResultado(query)) : new Song({
    source: 'suno',
    id: query.url,
    name: query.name,
    duration: query.duration,
    url: query.url,
    thumbnail: query.thumbnail,
    playFromSource: true,
    plugin: null,
  }, { member });
  if (typeof musica !== 'string') musica.stream.url = query.url;
  return client.distube.play(voiceChannel, musica, {
    member,
    textChannel: interaction.channel,
    message: interaction.message,
  });
}

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'tocar',
    description: '🎵 Toca uma música por nome ou URL do YouTube/Spotify/SoundCloud',
    options: [{
      name: 'musica',
      description: 'Nome da música ou URL do YouTube, Spotify ou SoundCloud',
      type: 3,
      required: true,
    }],
  },
  async execute(interaction, client) {
    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) return interaction.reply({ content: '❌ Entre em um canal de voz primeiro.', ephemeral: true });

    const query = interaction.options?.getString('musica') || (interaction.content ? interaction.content.replace(/^[$/]tocar\s*/i, '').trim() : '');
    if (!query) return interaction.reply({ content: '❌ Informe o nome ou URL da música.', ephemeral: true });
    if (interaction.replied || interaction.deferred) return;
     await interaction.deferReply({ ephemeral: false });

    try {
       if (ehUrl(query)) {
          const urlParaTocar = await prepararUrlParaTocar(query);
          await tocar(client, interaction, voiceChannel, member, urlParaTocar);
          await interaction.editReply({ content: `✔️ Pedido do **${ehUrlSuno(query) ? 'Suno' : fonteDaUrl(query)}** engatado com sucesso!`, components: [] });
         return;
       }

      const resultadosSpotify = await buscarSpotify(query).catch((erro) => {
        console.warn(`[Música] Busca do Spotify indisponível: ${resumirErro(erro)}`);
        return [];
      });
      const resultadosSoundCloud = await buscarFonte('scsearch10:', query).catch(() => []);
      const resultadosYouTube = await buscarFonte('ytsearch5:', query).catch(() => []);
      const prioridadeFonte = { Spotify: 0, SoundCloud: 1, YouTube: 2 };
      const resultados = [...resultadosSpotify, ...resultadosSoundCloud, ...resultadosYouTube].sort((a, b) => {
        const diferenca = prioridadeFonte[a.fonte] - prioridadeFonte[b.fonte];
        return diferenca || pontuacaoCorrespondencia(b, { title: query, name: query }) - pontuacaoCorrespondencia(a, { title: query, name: query });
      });
      if (!resultados.length) throw new Error('Nenhum resultado encontrado no Spotify, SoundCloud ou YouTube. Cole um link direto do SoundCloud, Suno ou Spotify.');

      const estado = { pagina: 0, resultados, query };
      const totalPaginas = Math.ceil(resultados.length / RESULTADOS_POR_PAGINA);
      const resposta = await interaction.editReply({
        content: `🔎 Resultados por prioridade (Spotify → SoundCloud → YouTube) para **${query}**\n${formatarResultados(estado)}\n\nClique no número da música que deseja tocar. Página 1/${totalPaginas}.`,
        components: componentesBusca(estado),
      });
      const coletor = resposta.createMessageComponentCollector({
        time: 60_000,
        filter: (botao) => true,
      });

      coletor.on('collect', async (botao) => {
        try {
           if (botao.customId === 'music_cancel') {
             if (botao.user.id !== interaction.user.id) return botao.reply({ content: '❌ Apenas quem iniciou a busca pode cancelá-la.', ephemeral: true });
             coletor.stop('cancelado');
             await botao.message.delete().catch(() => {});
             return;
           }
           if (botao.customId === 'music_prev' || botao.customId === 'music_next') {
             if (botao.user.id !== interaction.user.id) return botao.reply({ content: '❌ Apenas quem iniciou a busca pode navegar pelos resultados.', ephemeral: true });
             estado.pagina += botao.customId === 'music_next' ? 1 : -1;
            await botao.update({
               content: `🔎 Resultados por prioridade (Spotify → SoundCloud → YouTube) para **${estado.query}**\n${formatarResultados(estado)}\n\nClique no número da música que deseja tocar. Página ${estado.pagina + 1}/${totalPaginas}.`,
              components: componentesBusca(estado),
            });
            return;
          }
           const indice = Number(botao.customId.replace('music_pick_', ''));
           const resultado = estado.resultados[indice];
           if (botao.user.id !== interaction.user.id) return botao.reply({ content: '❌ Apenas quem iniciou a busca pode escolher a música.', ephemeral: true });
          if (!resultado) return botao.reply({ content: '❌ Esse resultado expirou.', ephemeral: true });
            if (estado.selecionando) return botao.reply({ content: '⏳ Já estou carregando uma música.', ephemeral: true });
            estado.selecionando = true;
            await botao.update({ embeds: [criarLoading(resultado.title || resultado.name, resultado.thumbnail, 1)], content: '', components: [] });
           let passo = 1;
           const loading = setInterval(() => {
             passo += 1;
             botao.message.edit({ embeds: [criarLoading(resultado.title || resultado.name, resultado.thumbnail, passo)] }).catch(() => {});
           }, 700);
           try {
             const resultadoExecucao = resultado.fonte === 'YouTube'
              ? await tocarComFallbackSpotify(client, interaction, voiceChannel, member, resultado)
              : { fonte: resultado.fonte, tocou: await tocar(client, interaction, voiceChannel, member, resultado.fonte === 'Spotify' ? resultado : (ehUrlSuno(obterUrlResultado(resultado)) ? await resolverUrlSuno(obterUrlResultado(resultado)) : obterUrlResultado(resultado))) };
            if (resultadoExecucao?.substituida) await botao.message.edit({ embeds: [criarLoading(`${resultado.title || resultado.name} · Spotify`, resultado.thumbnail, passo)] }).catch(() => {});
             coletor.stop('selecionado');
             await botao.message.delete().catch(() => {});
           } finally {
             clearInterval(loading);
           }
         } catch (erro) {
           console.error('Erro ao selecionar música:', erro);
           await botao.followUp({ content: '❌ Não consegui tocar esse resultado. Tente novamente em instantes.', ephemeral: true }).catch(() => {});
         } finally {
           estado.selecionando = false;
         }
      });
      coletor.on('end', async () => interaction.editReply({ components: [] }).catch(() => {}));
    } catch (erro) {
      console.error('Erro ao buscar música:', erro);
      await interaction.editReply({ content: '❌ Não consegui encontrar ou tocar essa música. Tente novamente em instantes.' }).catch(() => {});
    }
  },
};
