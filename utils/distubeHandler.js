const { configurarAmbiente, binarioValido, prepararCookies, garantirBinario } = require('./ytdlpSetup');
// Precisa vir antes do require do plugin, que lê YTDLP_DIR/YTDLP_FILENAME ao carregar.
configurarAmbiente();
const { garantirCookies, detectarNavegadorCookies } = require('./cookiesNavegador');
const { liberarParaMusica, pararEspera, tocarSaudacaoEntrada } = require('./somEspera');
const { DisTube } = require('distube');
const { criarPluginYtDlp, prefetchSong } = require('./ytdlpPlugin');
const { ATIVO: CACHE_AUDIO_ATIVO, DIR: CACHE_AUDIO_DIR } = require('./audioCache');
const { SpotifyPlugin } = require('@distube/spotify');
const { criarEmbed, THEME } = require('./theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ffmpegPath = require('ffmpeg-static');

// Detecção/validação de cookies vive em utils/cookiesNavegador.js: lá o
// yt-dlp é sondado de verdade para cada navegador (Brave, Edge, Zen, ...) em
// vez de adivinhar por pasta existente, e o resultado é guardado num snapshot
// que continua válido mesmo com o navegador aberto ou fechado depois.

const IDLE_TIMEOUT = 10 * 60 * 1000;
const DECORACOES_MUSICA = [
  ['🌈', '✦ ｡ﾟ･ ｡ﾟ･ ✦'], ['🍓', '♡  ·  ♡  ·  ♡'], ['🪩', '✧ ･ﾟ: *✧ ･ﾟ:*'], ['🍋', '· ｡ﾟ✧ ｡ﾟ· ｡ﾟ✧ ｡ﾟ·'], ['💿', '✦ ･ﾟ✧ ･ﾟ✦ ･ﾟ✧'],
  ['🌙', '━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━'], ['🍬', '✦ ｡ﾟ･ ｡ﾟ･ ✦'], ['🫧', '♡  ·  ♡  ·  ♡'], ['🎀', '✧ ･ﾟ: *✧ ･ﾟ:*'], ['🌸', '· ｡ﾟ✧ ｡ﾟ· ｡ﾟ✧ ｡ﾟ·'],
];

function decoracaoDaMusica(song) {
  const chave = `${song.id || ''}${song.url || ''}`;
  const indice = [...chave].reduce((total, caractere) => total + caractere.charCodeAt(0), 0) % DECORACOES_MUSICA.length;
  return DECORACOES_MUSICA[indice];
}

function limparTemporizadorOcioso(client, guildId) {
  const timer = client.musicIdleTimers?.get(guildId);
  if (timer) clearTimeout(timer);
  client.musicIdleTimers?.delete(guildId);
}

function agendarSaidaOciosa(client, queue) {
  const guildId = queue.id;
  limparTemporizadorOcioso(client, guildId);
  const timer = setTimeout(() => {
    client.musicIdleTimers.delete(guildId);
    const atual = client.distube.getQueue(guildId);
    if (atual) return;
    client.distube.voices.leave(guildId);
  }, IDLE_TIMEOUT);
  client.musicIdleTimers.set(guildId, timer);
}

function getPlayerButtons(isPaused = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('player_previous').setEmoji('⏮️').setLabel('Anterior').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('player_pause').setEmoji(isPaused ? '▶️' : '⏸️').setLabel(isPaused ? 'Retomar' : 'Pausar').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('player_skip').setEmoji('⏭️').setLabel('Próxima').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('player_stop').setEmoji('⏹️').setLabel('Parar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('player_queue').setEmoji('📜').setLabel('Fila').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('player_clear').setEmoji('🧹').setLabel('Limpar fila').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('player_lyrics').setEmoji('🎤').setLabel('Letra').setStyle(ButtonStyle.Primary)
    )
  ];
}

function barraProgresso(queue) {
  const duracao = Number(queue.songs[0]?.duration || 0);
  if (!duracao) return '🔴 Ao vivo';
  const progresso = Math.min(12, Math.floor((queue.currentTime / duracao) * 12));
  return `${'▰'.repeat(progresso)}${'▱'.repeat(12 - progresso)} ${queue.formattedCurrentTime} / ${queue.songs[0].formattedDuration}`;
}

function criarPainelEmbed(queue) {
  const atual = queue.songs[0];
  const proximas = queue.songs.slice(1, 7).map((song, indice) => `**${indice + 1}.** [${song.name}](${song.url}) · ${song.formattedDuration}`).join('\n');
  const restantes = queue.songs.length > 7 ? `\n*+${queue.songs.length - 7} músicas na fila*` : '';
  const [icone, divisor] = decoracaoDaMusica(atual);
  return criarEmbed({
    titulo: `${icone} ${queue.paused ? 'Pausado agora' : 'Tocando agora'}`,
    descricao: `**[${atual.name}](${atual.url})**\n${barraProgresso(queue)}\n\n${divisor}\n\n**Próximas músicas**\n${proximas || '_A fila está vazia_'}${restantes}`,
    cor: queue.paused ? THEME.corSecundario : THEME.corPrincipal,
    thumbnail: atual.thumbnail,
    rodape: `Mila Music Party · volume ${queue.volume}%`
  });
}

async function atualizarPainel(client, queue) {
  const message = client.playerMessages.get(queue.id);
  if (!message || !queue.songs[0]) return;
  await message.edit({ embeds: [criarPainelEmbed(queue)], components: getPlayerButtons(queue.paused) }).catch(() => {});
}

function iniciarAtualizacaoPainel(client, queue) {
  const anterior = client.playerIntervals.get(queue.id);
  if (anterior) clearInterval(anterior);
  const intervalo = setInterval(() => {
    const atual = client.distube.getQueue(queue.id);
    if (!atual || !atual.songs[0]) {
      clearInterval(intervalo);
      client.playerIntervals.delete(queue.id);
      return;
    }
    atualizarPainel(client, atual);
  }, 10000);
  client.playerIntervals.set(queue.id, intervalo);
}

function limparFila(queue) {
  const removidas = Math.max(0, queue.songs.length - 1);
  queue.songs.splice(1);
  return removidas;
}

function responderBotao(interaction, content) {
  return interaction.reply({ content, ephemeral: true });
}

function criarDistube(client) {
  console.log(
    `[Música] Cache de áudio local: ${CACHE_AUDIO_ATIVO ? `ATIVO (${CACHE_AUDIO_DIR})` : 'DESATIVADO (AUDIO_CACHE_ATIVO=false)'}`
  );
  client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    plugins: [
      // Credenciais explícitas evitam que o plugin dependa de tokens anônimos
      // raspados do site do Spotify (instáveis e sujeitos a bloqueio).
      new SpotifyPlugin(
        process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
          ? { api: { clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET } }
          : {}
      ),
      // YouTube exige um runtime de JavaScript para resolver as assinaturas dos
      // formatos (EJS). O plugin padrão não aceita flags extras, por isso o
      // wrapper em utils/ytdlpPlugin.js injeta --js-runtimes/--remote-components
      // em todas as chamadas (sem isso: "Requested format is not available").
      criarPluginYtDlp(),
    ],
    customFilters: {},
    ffmpeg: { path: ffmpegPath },
  });

  // Mapa de painéis ativos para não poluir o chat com múltiplos embeds
  // (um embed por guild persistente q atualiza botoes)
  client.playerMessages = new Map();
  client.playerIntervals = new Map();
  client.musicIdleTimers = new Map();

  // Saudação de entrada: sempre que uma conexão NOVA é criada (por /tocar,
  // /playlist ou qualquer outro caminho), toca um dos dois áudios sorteados
  // antes de devolver o canal ao fluxo normal. "await" aqui é proposital: a
  // música só começa depois que a saudação termina.
  const joinOriginal = client.distube.voices.join.bind(client.distube.voices);
  client.distube.voices.join = async (channel) => {
    const guildId = channel?.guild?.id || channel?.guildId;
    const jaConectado = Boolean(guildId && client.distube.voices.get(guildId)?.connection);
    const voice = await joinOriginal(channel);
    if (!jaConectado && voice?.connection) {
      try {
        await tocarSaudacaoEntrada(voice);
      } catch (erro) {
        console.warn(`[Música] Falha na saudação de entrada: ${erro.message}`);
      }
    }
    return voice;
  };

  // Som de espera → música: o DisTube chama queues.playSong imediatamente antes
  // de assumir o canal de voz. É a única janela em que ainda dá para fazer o
  // fade out do elevador sem cortar o áudio no meio.
  const playSongOriginal = client.distube.queues.playSong.bind(client.distube.queues);
  client.distube.queues.playSong = async (queue, ...resto) => {
    try {
      await liberarParaMusica(queue.id);
    } catch (erro) {
      console.warn(`[Música] Falha ao encerrar o som de espera: ${erro.message}`);
    }
    return playSongOriginal(queue, ...resto);
  };

  client.distube.on('debug', (message) => {
    if (/stream|ffmpeg|voice|audio|opus/i.test(String(message))) console.log('[Música]', message);
  });

  client.distube.on('ffmpegDebug', (message) => {
    if (/spawn ffmpeg|ffmpeg version/i.test(String(message))) return;
    console.error('[FFmpeg música]', message);
  });

  client.distube.on('finishSong', (queue, song) => {
    // O próximo play (repetir/voltar) resolve a URL de novo: se o arquivo do
    // cache já tiver sido limpo, ele é baixado outra vez em vez de dar 404.
    try { if (song?.stream) song.stream.url = null; } catch {}
  });

  client.distube.on('playSong', async (queue, song) => {
    limparTemporizadorOcioso(client, queue.id);
    try {
      const payload = {
        embeds: [criarPainelEmbed(queue)],
        components: getPlayerButtons(queue.paused)
      };
      const painelAtual = client.playerMessages.get(queue.id);
      if (painelAtual) {
        await painelAtual.delete().catch(() => {});
        client.playerMessages.delete(queue.id);
      }
      const message = await queue.textChannel.send(payload);
      client.playerMessages.set(queue.id, message);
      iniciarAtualizacaoPainel(client, queue);
    } catch (e) {
      console.error(e);
    }
  });

  client.distube.on('addSong', (queue, song) => {
    // Vai baixando em segundo plano: quando chegar a vez, o áudio já está no
    // cache e a troca de faixa não espera o yt-dlp.
    prefetchSong(song);
    queue.textChannel.send({
      embeds: [criarEmbed({
        descricao: `📋 Adicionado à fila: **${song.name}** (\`${song.formattedDuration}\`) - ${song.user}`,
        cor: THEME.corSecundario
      })]
    }).catch(() => {});
  });

  client.distube.on('finish', queue => {
    const intervalo = client.playerIntervals.get(queue.id);
    if (intervalo) clearInterval(intervalo);
    client.playerIntervals.delete(queue.id);
    const msg = client.playerMessages.get(queue.id);
    if (msg) msg.delete().catch(() => {});
    client.playerMessages.delete(queue.id);
    queue.textChannel.send('A fila acabou! Fui-me do canal de voz~ 💤').catch(() => {});
    agendarSaidaOciosa(client, queue);
  });

  client.distube.on('error', (e, queue) => {
    const mensagem = e?.message || e?.toString?.() || String(e);
    // Erro típico de cookies (banco travado, DPAPI, sessão não reconhecida):
    // vale reprocessar a escolha de navegador — pode ser que outro esteja
    // aberto agora e funcione melhor.
    const suspeitaDeCookies = /cookies?|dpapi|sign in to confirm|not a bot|login required/i.test(mensagem);
    if (suspeitaDeCookies) {
      garantirCookies({ forcar: true, silencioso: true }).catch(() => {});
    }
    // A música não chegou a tocar: tira o elevador do ar imediatamente.
    pararEspera(queue?.id, { fadeMs: 250 }).catch(() => {});
    // Sem limpar o intervalo/painel, o timer de 10s continuava rodando para
    // uma fila morta até o processo terminar.
    const intervalo = queue?.id ? client.playerIntervals.get(queue.id) : null;
    if (intervalo) clearInterval(intervalo);
    if (queue?.id) {
      client.playerIntervals.delete(queue.id);
      const msg = client.playerMessages.get(queue.id);
      if (msg) msg.delete().catch(() => {});
      client.playerMessages.delete(queue.id);
    }
    // Detalhes internos ficam no log; o chat recebe uma mensagem acionável.
    const mensagemPublica = /429|YOUTUBE|FFMPEG_EXITED|Premature close/i.test(mensagem)
      ? 'A fonte recusou ou encerrou o áudio. Escolha um resultado do Spotify ou SoundCloud.'
      : 'Não consegui continuar a reprodução. Tente outro resultado.';
    if (queue?.textChannel?.send) queue.textChannel.send(`❌ Ocorreu um erro musical: \`${mensagemPublica}\``).catch(() => {});
    console.error('Erro do DisTube:', e);
  });
}

// Inicializa o player o quanto antes: a escolha dos cookies é validada com o
// próprio yt-dlp (rápido, sem rede) e depois o binário é conferido. Com tudo
// pronto (caso normal) o player nasce na hora; só na primeira execução — ou
// depois de uma instalação limpa — o download automático adia a criação por
// alguns segundos, sem exigir nenhum comando manual.
async function inicializarDistube(client) {
  prepararCookies();
  try {
    await garantirCookies();
  } catch (erro) {
    console.warn(`[Música] Falha ao escolher cookies do navegador: ${erro.message}`);
  }
  if (binarioValido()) {
    criarDistube(client);
    return;
  }
  try {
    console.warn('[Música] yt-dlp não encontrado. Baixando automaticamente (só na primeira execução)...');
    const dados = await garantirBinario();
    const detalhe = dados.versao ? ` versão ${dados.versao}` : (dados.reaproveitado ? ' (reaproveitado do npm)' : '');
    console.log(`[Música] yt-dlp pronto${detalhe}: ${dados.caminho}`);
  } catch (erro) {
    console.error(`[Música] Não foi possível preparar o yt-dlp: ${erro.message}`);
    console.warn('[Música] YouTube ficará indisponível; Spotify, SoundCloud e links diretos continuam funcionando.');
  }
  criarDistube(client);
}

// Exportar um middleware custom pra ouvir cliques dos botoes no index.js ou algum evento
async function handlePlayerInteraction(interaction, client) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('player_')) return;

  const queue = client.distube.getQueue(interaction.guildId);
  if (!queue) {
    return interaction.reply({ content: '❌ Nenhuma música tocando agora.', ephemeral: true });
  }

  // Verificar se o usuário está num canal de voz
  const memberChannel = interaction.member?.voice?.channel;
  if (!memberChannel || memberChannel.id !== queue.voiceChannel.id) {
    return interaction.reply({ content: '❌ Você precisa estar no mesmo canal de voz que eu!', ephemeral: true });
  }

  try {
    switch (interaction.customId) {
      case 'player_previous':
        if (queue.previousSongs.length === 0) return responderBotao(interaction, '⏮️ Não há música anterior.');
        await queue.previous();
        await interaction.update({ embeds: [criarPainelEmbed(queue)], components: getPlayerButtons(queue.paused) });
        break;

      case 'player_pause':
        if (queue.paused) await queue.resume();
        else await queue.pause();
        await interaction.update({ embeds: [criarPainelEmbed(queue)], components: getPlayerButtons(queue.paused) });
        break;

      case 'player_skip':
        if (queue.songs.length > 1) {
          await queue.skip();
          await interaction.reply({ content: '⏭️ Música pulada!', ephemeral: true });
        } else {
          queue.stop();
          await interaction.reply({ content: '⏹️ Fila encerrada.', ephemeral: true });
        }
        break;

      case 'player_stop':
        await queue.stop();
        await responderBotao(interaction, '⏹️ Parando...');
        break;

      case 'player_clear': {
        const removidas = limparFila(queue);
        await interaction.update({ embeds: [criarPainelEmbed(queue)], components: getPlayerButtons(queue.paused) });
        if (removidas === 0) await interaction.followUp({ content: '📜 A fila já estava vazia.', ephemeral: true });
        else await interaction.followUp({ content: `🧹 ${removidas} música(s) removida(s) da fila.`, ephemeral: true });
        break;
      }

      case 'player_lyrics': {
        await interaction.deferReply({ ephemeral: true });
        try {
          const { buscarLetra, dividirLetra } = require('./lyrics');
          const resultado = await buscarLetra(queue.songs[0]);
          const partes = dividirLetra(resultado.lyrics, 1900);
          await interaction.editReply({ embeds: [criarEmbed({ titulo: `🎤 ${resultado.songName}`, descricao: partes[0], cor: THEME.corPrincipal, rodape: `Fonte: ${resultado.source}${partes.length > 1 ? ` · Parte 1/${partes.length}` : ''}` })] });
          for (let indice = 1; indice < partes.length; indice += 1) {
            await interaction.followUp({ embeds: [criarEmbed({ titulo: `🎤 ${resultado.songName} · continuação`, descricao: partes[indice], cor: THEME.corPrincipal, rodape: `Fonte: ${resultado.source} · Parte ${indice + 1}/${partes.length}` })], ephemeral: true });
          }
        } catch (erro) {
          await interaction.editReply(`❌ ${erro.message}`);
        }
        break;
      }

      case 'player_queue':
        const cur = queue.songs[0];
        const res = queue.songs.slice(1, 11).map((s, i) => `**${i + 1}.** [${s.name}](${s.url}) (\`${s.formattedDuration}\`)`).join('\n');
        const count = queue.songs.length > 11 ? `\n\n*...e mais ${queue.songs.length - 11} músicas nas sombras.*` : '';
        const embed = criarEmbed({
          titulo: '📜 Fila Atual',
          descricao: `**Tocando Agora:**\n[${cur.name}](${cur.url})\n\n**A Seguir:**\n${res || '_Nenhuma adicionada_'}${count}`,
          cor: THEME.corInfo
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
    }
  } catch (e) {
    console.error(e);
    if (!interaction.replied) await interaction.reply({ content: '❌ Deu um problema nos controles.', ephemeral: true }).catch(() => {});
  }
}

module.exports = {
  inicializarDistube,
  detectarNavegadorCookies,
  garantirCookies,
  handlePlayerInteraction,
  limparTemporizadorOcioso,
};
