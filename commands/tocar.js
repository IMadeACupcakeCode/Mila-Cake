const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Song } = require('distube');
const { criarEmbed, THEME } = require('../utils/theme');

const execFileAsync = promisify(execFile);
const YTDLP_PATH = path.join(__dirname, '..', 'node_modules', '@distube', 'yt-dlp', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const RESULTADOS_POR_PAGINA = 5;
const SUNO_HOSTS = new Set(['suno.com', 'www.suno.com', 'app.suno.ai', 'suno.ai', 'www.suno.ai']);

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
  const resposta = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
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
      const respostaAudio = await fetch(candidato, { method: 'HEAD' });
      if (respostaAudio.ok) {
        audioUrl = candidato;
        break;
      }
    } catch {}
  }
  if (!audioUrl) throw new Error('Não encontrei um áudio público nesse link do Suno. Verifique se a música está publicada.');
  return {
    url: audioUrl,
    name: valorJson(html, 'title') || valorMeta(html, 'og:title') || valorMeta(html, 'twitter:title') || (id ? `Música do Suno (${id.slice(0, 8)})` : 'Música do Suno'),
    thumbnail: valorJson(html, 'image_url') || valorJson(html, 'image_large_url') || valorMeta(html, 'og:image') || valorMeta(html, 'twitter:image'),
    duration: Number(valorJson(html, 'duration')) || 0,
  };
}

function resumirErro(erro) {
  const mensagem = erro?.message || String(erro);
  return mensagem.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function ehUrl(valor) {
  return /^https?:\/\//i.test(valor);
}

function fonteDaUrl(url) {
  if (/soundcloud\.com/i.test(url)) return 'SoundCloud';
  if (/spotify\.com/i.test(url)) return 'Spotify';
  return 'YouTube';
}

function obterUrlResultado(item) {
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
  ], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  const info = extrairJson(stdout);
  return (info.entries || []).filter((item) => obterUrlResultado(item)).slice(0, 5).map((item) => ({ ...item, fonte: prefixo.startsWith('yt') ? 'YouTube' : 'SoundCloud' }));
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
  return ['YouTube', 'SoundCloud'].map((fonte) => {
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
  const musica = typeof query === 'string' ? query : new Song({
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
         const urlParaTocar = ehUrlSuno(query) ? await resolverUrlSuno(query) : query;
         await tocar(client, interaction, voiceChannel, member, urlParaTocar);
         await interaction.editReply({ content: `✔️ Pedido do **${ehUrlSuno(query) ? 'Suno' : fonteDaUrl(query)}** engatado com sucesso!`, components: [] });
         return;
       }

      const resultadosPorFonte = await Promise.allSettled([
        buscarFonte('ytsearch5:', query),
        buscarFonte('scsearch5:', query),
      ]);
      const resultados = resultadosPorFonte.flatMap((resultado) => resultado.status === 'fulfilled' ? resultado.value : []);
      if (!resultados.length) throw new Error('Nenhum resultado encontrado no YouTube ou SoundCloud. Para Spotify, cole o link da música, álbum ou playlist.');

      const estado = { pagina: 0, resultados, query };
      const totalPaginas = Math.ceil(resultados.length / RESULTADOS_POR_PAGINA);
      const resposta = await interaction.editReply({
        content: `🔎 Resultados para **${query}**\n${formatarResultados(estado)}\n\nOs resultados estão separados por fonte. Clique no número da música que deseja tocar. Página 1/${totalPaginas}.`,
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
              content: `🔎 Resultados para **${estado.query}**\n${formatarResultados(estado)}\n\nOs resultados estão separados por fonte. Clique no número da música que deseja tocar. Página ${estado.pagina + 1}/${totalPaginas}.`,
              components: componentesBusca(estado),
            });
            return;
          }
           const indice = Number(botao.customId.replace('music_pick_', ''));
           const resultado = estado.resultados[indice];
           if (botao.user.id !== interaction.user.id) return botao.reply({ content: '❌ Apenas quem iniciou a busca pode escolher a música.', ephemeral: true });
          if (!resultado) return botao.reply({ content: '❌ Esse resultado expirou.', ephemeral: true });
           await botao.update({ embeds: [criarLoading(resultado.title || resultado.name, resultado.thumbnail, 1)], content: '', components: [] });
           let passo = 1;
           const loading = setInterval(() => {
             passo += 1;
             botao.message.edit({ embeds: [criarLoading(resultado.title || resultado.name, resultado.thumbnail, passo)] }).catch(() => {});
           }, 700);
           try {
             const urlResultado = obterUrlResultado(resultado);
           const urlParaTocar = ehUrlSuno(urlResultado) ? await resolverUrlSuno(urlResultado) : urlResultado;
           await tocar(client, interaction, voiceChannel, member, urlParaTocar);
             coletor.stop('selecionado');
             await botao.message.delete().catch(() => {});
           } finally {
             clearInterval(loading);
           }
        } catch (erro) {
          console.error('Erro ao selecionar música:', erro);
          await botao.followUp({ content: `❌ Não consegui tocar esse resultado.\n\`${resumirErro(erro)}\``, ephemeral: true }).catch(() => {});
        }
      });
      coletor.on('end', async () => interaction.editReply({ components: [] }).catch(() => {}));
    } catch (erro) {
      console.error('Erro ao buscar música:', erro);
      await interaction.editReply({ content: `❌ Não consegui encontrar ou tocar essa música.\n\`${resumirErro(erro)}\`` }).catch(() => {});
    }
  },
};
