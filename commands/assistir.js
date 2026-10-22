const { ActionRowBuilder, ButtonBuilder, ButtonStyle, InviteTargetType, escapeMarkdown } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { parseYouTubeUrl } = require('../utils/youtube');
const logger = require('../utils/logger');

const ROOM_TIMEOUT_MS = 1400;
const OEMBED_TIMEOUT_MS = 600;

function normalizarApiBase() {
  const raw = String(process.env.ACTIVITY_API_URL || '').trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('ACTIVITY_API_URL não é uma URL válida.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('ACTIVITY_API_URL precisa usar https:// (ou http:// apenas em localhost).');
  }
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('ACTIVITY_API_URL só pode usar http:// em localhost.');
  }

  // O Worker aceita /api/* e também as rotas diretas. Guardamos apenas a origem
  // (e um eventual subcaminho), sem /api no final, para não duplicar o prefixo.
  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

async function requestJson(url, options = {}, timeout = ROOM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    const raw = await response.text();
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = null; }
    }
    if (!response.ok) {
      const detail = data && (data.error || data.message) ? String(data.error || data.message) : `HTTP ${response.status}`;
      throw new Error(detail.slice(0, 180));
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('O Worker da Activity demorou demais para responder.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function buscarTitulo(base, secret, videoId) {
  const data = await requestJson(
    `${base}/api/oembed?videoId=${encodeURIComponent(videoId)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } },
    OEMBED_TIMEOUT_MS
  );
  return data && typeof data.title === 'string' ? data.title.slice(0, 120) : null;
}

async function criarSalas(base, secret, channelIds, payload) {
  const results = await Promise.allSettled(channelIds.map((channelId) => requestJson(
    `${base}/api/rooms`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(Object.assign({}, payload, { channelId })),
    },
    ROOM_TIMEOUT_MS
  )));

  const salas = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value && result.value.room) {
      salas.push({ channelId: channelIds[index], room: result.value.room });
    } else {
      const motivo = result.status === 'rejected' ? result.reason?.message : 'resposta vazia';
      logger.aviso(`MilaTube: não consegui preparar a sala ${channelIds[index]}: ${motivo || 'erro desconhecido'}`);
    }
  });

  if (!salas.length) {
    throw new Error('O Worker não conseguiu preparar a sala da Activity.');
  }
  return salas;
}

async function responderErro(interaction, descricao) {
  const payload = {
    embeds: [criarEmbed({
      titulo: 'O cartucho não entrou',
      descricao: `${THEME.div.bolinhas}\n\n${descricao}\n\n${THEME.div.bolinhas}`,
      cor: THEME.corErro,
    })],
    ephemeral: true,
    allowedMentions: { parse: [] },
  };

  try {
    if (interaction.deferred) return await interaction.editReply(payload);
    if (interaction.replied) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch {
    return null;
  }
}

async function enviarConvite(interaction, invite, meta, voiceChannel) {
  const titulo = escapeMarkdown(String((meta && meta.title) || 'Vídeo do YouTube')).slice(0, 120);
  const callName = escapeMarkdown(String(voiceChannel.name || 'call')).slice(0, 100);
  const embed = criarEmbed({
    titulo: 'MilaTube: sessão pronta',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**Cartucho:** ${titulo}\n` +
      `**Call:** ${callName}\n\n` +
      `Clique no botão para abrir a Activity. Quem estiver na call pode entrar junto; ` +
      `o host controla o play por padrão.\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corSucesso,
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Abrir MilaTube')
      .setStyle(ButtonStyle.Link)
      .setURL(invite.url)
  );

  return interaction.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
}

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'assistir',
    description: '🎬 Abre uma sessão do MilaTube com um vídeo do YouTube na sua call',
    options: [
      {
        name: 'url',
        description: 'Link ou ID do vídeo do YouTube',
        type: 3,
        required: true,
      },
    ],
  },
  async execute(interaction) {
    const entrada = interaction.options.getString('url', true);
    const videoId = parseYouTubeUrl(entrada);
    if (!videoId) {
      return responderErro(interaction, 'Isso não parece um link de vídeo do YouTube. Cole `https://youtu.be/ID` ou `https://www.youtube.com/watch?v=ID`.');
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return responderErro(interaction, 'Entre em um canal de voz primeiro. A sessão do MilaTube acontece junto com a call.');
    }

    const appId = String(
      process.env.ACTIVITY_APPLICATION_ID ||
      interaction.client?.application?.id ||
      process.env.CLIENT_ID ||
      ''
    ).trim();
    if (!/^\d{17,20}$/.test(appId)) {
      return responderErro(interaction, 'A aplicação do Discord não foi identificada. Confira `CLIENT_ID` / `ACTIVITY_APPLICATION_ID` no `.env`.');
    }

    let base;
    try {
      base = normalizarApiBase();
    } catch (error) {
      return responderErro(interaction, error.message);
    }
    if (!base) {
      return responderErro(interaction, 'A Activity ainda não foi conectada. Configure `ACTIVITY_API_URL` com a URL pública do Worker do MilaTube.');
    }

    const secret = String(process.env.ACTIVITY_API_SECRET || '').trim();
    if (!secret) {
      return responderErro(interaction, 'Falta `ACTIVITY_API_SECRET` no `.env`. Sem ele o bot não consegue preparar a sala com segurança.');
    }

    // O título é opcional: se o oEmbed demorar, a sala abre com um fallback e o
    // player do YouTube mostra o vídeo normalmente.
    const meta = await Promise.race([
      buscarTitulo(base, secret, videoId).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), OEMBED_TIMEOUT_MS)),
    ]).catch(() => null);

    const hostId = interaction.user?.id || interaction.member?.id;
    if (!hostId) {
      return responderErro(interaction, 'Não consegui identificar quem está abrindo a sessão.');
    }

    const channelIds = Array.from(new Set([
      interaction.channelId,
      interaction.channel?.parentId,
      voiceChannel.id,
    ].filter((id) => typeof id === 'string' && /^\d{17,20}$/.test(id))));

    if (!channelIds.length) {
      return responderErro(interaction, 'Não consegui identificar o canal da Activity.');
    }

    let salas;
    try {
      salas = await criarSalas(base, secret, channelIds, {
        guildId: interaction.guildId,
        hostId,
        videoId,
        title: (meta && meta.title) || 'Vídeo do YouTube',
        duration: 0,
        hostMode: 'self',
      });
    } catch (error) {
      return responderErro(interaction, error.message || 'Não consegui preparar a sala da Activity.');
    }

    // O caminho por prefixo não tem uma interação real para responder com
    // LAUNCH_ACTIVITY. Nesse caso, criamos um convite de Activity no canal.
    if (typeof interaction.launchActivity !== 'function') {
      const channel = interaction.channel;
      if (!channel || typeof channel.createInvite !== 'function') {
        return responderErro(interaction, 'Use `/assistir` no Discord: o convite da Activity precisa ser criado em um canal do servidor.');
      }

      let invite;
      try {
        invite = await channel.createInvite({
          maxAge: 3600,
          maxUses: 0,
          unique: true,
          targetType: InviteTargetType.EmbeddedApplication,
          targetApplication: appId,
          reason: 'MilaTube: sessão criada por $assistir',
        });
      } catch (error) {
        logger.erro(`MilaTube: falha ao criar convite de Activity: ${error?.message || error}`);
        return responderErro(interaction, 'Não consegui criar o convite da Activity. Use `/assistir` ou verifique a permissão **Criar convite** da Mila.');
      }

      logger.sucesso(`MilaTube: sessão preparada em ${voiceChannel.name} (${videoId}); convite ${invite.code}`);
      return enviarConvite(interaction, invite, meta, voiceChannel);
    }

    try {
      await interaction.launchActivity();
      logger.sucesso(`MilaTube: Activity aberta em ${voiceChannel.name} (${videoId}); sala(s) ${salas.map((sala) => sala.channelId).join(', ')}`);
    } catch (error) {
      logger.erro(`MilaTube: falha ao abrir a Activity: ${error?.message || error}`);
      return responderErro(
        interaction,
        'O Discord recusou abrir a Activity. Confira se **Activities** está habilitado no Developer Portal e se a URL está mapeada. Detalhe: ' +
        String(error?.message || 'erro desconhecido').slice(0, 160)
      );
    }

    return undefined;
  },
};
