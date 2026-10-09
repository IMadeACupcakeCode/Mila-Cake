const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { criarEmbed, THEME } = require('./theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function navegadorAberto(tipo) {
  if (process.platform !== 'win32') return false;
  const processos = { brave: 'brave.exe', chrome: 'chrome.exe', edge: 'msedge.exe', chromium: 'chromium.exe', vivaldi: 'vivaldi.exe', opera: 'opera.exe', firefox: 'firefox.exe' };
  try {
    const saida = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${processos[tipo]}`], { encoding: 'utf8', windowsHide: true });
    return new RegExp(`^${processos[tipo].replace('.', '\\.')}`, 'im').test(saida);
  } catch {
    return false;
  }
}

function navegadorTemCookies(tipo, diretorio) {
  if (tipo === 'firefox') {
    try { return fs.readdirSync(diretorio, { withFileTypes: true }).some((entrada) => entrada.isDirectory() && fs.existsSync(path.join(diretorio, entrada.name, 'cookies.sqlite'))); } catch { return false; }
  }
  const perfis = ['Default', 'Profile 1', 'Profile 2', 'Profile 3', 'Profile 4'];
  return perfis.some((perfil) => [
    path.join(diretorio, perfil, 'Network', 'Cookies'),
    path.join(diretorio, perfil, 'Cookies'),
  ].some((arquivo) => fs.existsSync(arquivo)));
}

function detectarNavegadorCookies() {
  if (process.env.YTDLP_COOKIES_FILE) return 'arquivo';
  if (process.platform !== 'win32') return null;
  const local = process.env.LOCALAPPDATA || '';
  const roaming = process.env.APPDATA || '';
  const candidatos = [
    ['brave', path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
    ['chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
    ['edge', path.join(local, 'Microsoft', 'Edge', 'User Data')],
    ['chromium', path.join(local, 'Chromium', 'User Data')],
    ['vivaldi', path.join(local, 'Vivaldi', 'User Data')],
    ['opera', path.join(roaming, 'Opera Software', 'Opera Stable')],
    ['firefox', path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')],
  ];
  const configurado = String(process.env.YTDLP_COOKIES_FROM_BROWSER || '').split(':')[0].toLowerCase();
  const ordem = configurado ? candidatos.sort(([tipo]) => tipo === configurado ? -1 : 1) : candidatos;
  const encontrado = ordem.find(([tipo, diretorio]) => fs.existsSync(diretorio) && navegadorTemCookies(tipo, diretorio) && !navegadorAberto(tipo));
  if (!encontrado) {
    delete process.env.YTDLP_COOKIES_FROM_BROWSER;
    const existentes = ordem.filter(([tipo, diretorio]) => fs.existsSync(diretorio) && navegadorTemCookies(tipo, diretorio)).map(([tipo]) => tipo);
    if (existentes.length) console.warn(`[Música] Cookies encontrados, mas os navegadores estão abertos: ${existentes.join(', ')}. Feche-os antes de iniciar o bot.`);
    else console.warn('[Música] Nenhum perfil de navegador com cookies foi encontrado para o yt-dlp.');
    return null;
  }
  process.env.YTDLP_COOKIES_FROM_BROWSER = encontrado[0];
  return encontrado[0];
}

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

function inicializarDistube(client) {
  const origemCookies = detectarNavegadorCookies();
  if (origemCookies) console.log(`[Música] Cookies do yt-dlp configurados: ${origemCookies}.`);
  else console.warn('[Música] Reprodução do YouTube pode falhar por bloqueio anti-bot; use uma fonte alternativa.');
  client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    plugins: [new SpotifyPlugin(), new YtDlpPlugin({ update: false, ytdlpOptions: { retries: 3, fragmentRetries: 3, extractorRetries: 2, socketTimeout: 15 } })],
    customFilters: {},
    ffmpeg: { path: ffmpegPath },
  });

  // Mapa de painéis ativos para não poluir o chat com múltiplos embeds
  // (um embed por guild persistente q atualiza botoes)
  client.playerMessages = new Map();
  client.playerIntervals = new Map();
  client.musicIdleTimers = new Map();

  client.distube.on('debug', (message) => {
    if (/stream|ffmpeg|voice|audio|opus/i.test(String(message))) console.log('[Música]', message);
  });

  client.distube.on('ffmpegDebug', (message) => {
    if (/spawn ffmpeg|ffmpeg version/i.test(String(message))) return;
    console.error('[FFmpeg música]', message);
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
    const mensagemPublica = /429|YOUTUBE|FFMPEG_EXITED|Premature close/i.test(mensagem)
      ? 'A fonte recusou ou encerrou o áudio. Escolha um resultado do Spotify ou SoundCloud.'
      : mensagem.slice(0, 180);
    if (queue?.textChannel?.send) queue.textChannel.send(`❌ Ocorreu um erro musical: \`${mensagemPublica}\``).catch(() => {});
    console.error('Erro do DisTube:', e);
  });
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
  handlePlayerInteraction,
  limparTemporizadorOcioso,
};
