const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client, GatewayIntentBits, ActivityType, Partials } = require('discord.js');
const { THEME } = require('./utils/theme');
const { reagendarTodosLembretes } = require('./utils/agendador');
const { handlePrefix } = require('./utils/prefix');
const { handleReaction } = require('./utils/guerraManager');
const logger = require('./utils/logger');
const { registrar, tratar } = require('./utils/slash');

const { DISCORD_TOKEN } = process.env;

async function sairDeTodasAsCalls(client) {
  try {
    const guildIds = new Set([
      ...client.guilds.cache.keys(),
      ...(client.distube?.voices?.collection?.keys?.() || []),
      ...(client.distube?.queues?.collection?.keys?.() || []),
    ]);
    for (const guildId of guildIds) {
      const queue = client.distube?.getQueue(guildId);
      try {
        const canal = queue?.textChannel;
        if (canal?.send) {
          const embed = require('./utils/theme').criarEmbed({
            titulo: '👋 Mila saiu da call',
            descricao: 'A Mila foi desligada e saiu do canal de voz. Até logo~ ♡',
            cor: THEME.corErro,
          });
          await canal.send({ embeds: [embed] });
        }
      } catch {}
      try {
        if (queue) await queue.stop();
      } catch {}
      try { client.distube?.voices?.leave(guildId); } catch {}
    }
  } catch (erro) {
    console.error('Erro ao sair das calls durante o desligamento:', erro);
  }
}

async function avisarShutdown(client) {
  try {
    const { obterConfig } = require('./utils/servidorStore');
    const { THEME } = require('./utils/theme');
    const { criarEmbed } = require('./utils/theme');
    const { removerEmbedTicketFixo } = require('./utils/fixedTicketEmbed');

    // Remove o embed fixo de ticket antes de desligar
    await removerEmbedTicketFixo(client);

    // Aviso offline no canal configurado (canalOnOff)
    for (const guild of client.guilds.cache.values()) {
      const cfg = obterConfig(guild.id);
      const canalOnOffId = cfg?.canalOnOff;
      if (canalOnOffId) {
        try {
          const canal = await guild.channels.fetch(canalOnOffId).catch(() => null);
          if (canal) {
            const embedOff = criarEmbed({
              titulo: '🔌 Mila Bot está offline!',
              descricao: 'Estou indo embora... Mas volto logo, meu favorito~ ♡',
              cor: THEME.corErro,
            });
            await canal.send({ embeds: [embedOff] });
          }
        } catch {}
      }
    }

    for (const guild of client.guilds.cache.values()) {
      const cfg = obterConfig(guild.id);
      const canalId = cfg?.canalShutdown;
      if (!canalId) continue;

      try {
        const canal = await guild.channels.fetch(canalId).catch(() => null);
        if (!canal) continue;

        const embed = criarEmbed({
          titulo: '🔌 Desligamento da Mila Bot',
          descricao: 'Estou sendo desligada agora. Não vou esquecer de você~ ♡',
          cor: THEME.corErro,
        });

        await canal.send({ embeds: [embed] });
      } catch (erro) {
        console.error(`Erro ao avisar shutdown no canal ${canalId}:`, erro);
      }
    }
  } catch (erro) {
    console.error('Erro geral no aviso de shutdown:', erro);
  }
}

async function avisarOnline(client) {
  try {
    const { obterConfig } = require('./utils/servidorStore');
    const { criarEmbed } = require('./utils/theme');
    for (const guild of client.guilds.cache.values()) {
      const cfg = obterConfig(guild.id);
      const canalId = cfg?.canalOnOff;
      if (!canalId) continue;
      try {
        const canal = await guild.channels.fetch(canalId).catch(() => null);
        if (!canal) continue;
        const embed = criarEmbed({
          titulo: '⋆｡°✩ Mila Bot está online!',
          descricao: 'Voltei, meu favorito! Tô aqui de novo por você~ ♡',
          cor: THEME.corSucesso,
        });
        await canal.send({ embeds: [embed] });
      } catch {}
    }
  } catch {}
}

if (!DISCORD_TOKEN) {
  console.error('⋆｡°✩ DISCORD_TOKEN não encontrado no .env. Confira o arquivo .env.example.');
  process.exit(1);
}

// Build intents dynamically so privileged intents can be toggled via env.
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
];

// Privileged intents (GuildMembers, GuildPresences) require explicit enablement
// in the Discord Developer Portal. Toggle them with ENABLE_PRIVILEGED_INTENTS=true
if ((process.env.ENABLE_PRIVILEGED_INTENTS || '').toLowerCase() === 'true') {
  intents.push(GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences);
}

const partials = [Partials.Message, Partials.Channel, Partials.Reaction];
if (intents.includes(GatewayIntentBits.GuildMembers)) partials.push(Partials.GuildMember);

const client = new Client({ intents, partials });

// ── Mila Music / Distube ──
const { inicializarDistube, handlePlayerInteraction } = require('./utils/distubeHandler');
inicializarDistube(client);

const { enviarEmbedTicketFixo } = require('./utils/fixedTicketEmbed');

client.once('clientReady', () => {
  console.log(`Mila online — PID ${process.pid}, sessão gateway ${client.ws.sessionId || 'indisponível'}.`);
  const banner = [
    '',
    `${'='.repeat(58)}`,
    `${' '.repeat(16)}⋆｡°✩  MILA  ♡`,
    `${'='.repeat(58)}`,
    '',
    '   ╔═══╗╔╗ ╔╗╔═══╗╔╗   ╔═══╗',
    '   ║╔═╗║║║ ║║║╔══╝║║   ║╔═╗║',
    '   ║╚═╝║║╚═╝║║╚══╗║║   ║╚═╝║',
    '   ║╔╗╔╝║╔═╗║║╔══╝║║ ╔╗║╔╗╔╝',
    '   ║║║╚╗║║ ║║║╚══╗║╚═╝║║║║╚╗',
    '   ╚╝╚═╝╚╝ ╚╝╚═══╝╚═══╝╚╝╚═╝',
    '',
    '   ╔═══╗╔══╗╔═══╗╔═══╗',
    '   ║╔══╝║╔╗║║╔══╝║╔═╗║',
    '   ║╚══╗║╚╝║║╚══╗║╚═╝║',
    '   ║╔══╝║╔╗║║╔══╝║╔╗╔╝',
    '   ║║   ║║║║║╚══╗║║║╚╗',
    '   ╚╝   ╚╝╚╝╚═══╝╚╝╚═╝',
    '',
  ].join('\n');
  console.log(banner);

  // ⋆｡°✩ Log decorado do startup
  logger.logInicio(THEME.nome, client.user.tag, client.guilds.cache.size);

  client.user.setPresence({
    activities: [{ name: 'você, meu favorito~ ♡', type: ActivityType.Watching }],
    status: 'online',
  });

  reagendarTodosLembretes(client);

  // Embed fixo de ticket — aparece online, some offline
  enviarEmbedTicketFixo(client);

  // Registro dos comandos slash (guild-scoped quando GUILD_ID existe).
  // Falhas de registro não impedem o bot de continuar online via prefixo.
  registrar().catch((erro) => console.error('Erro inesperado no registro slash:', erro));

  // Aviso online no canal configurado
  avisarOnline(client);

  // ── Mila Tela (serviço externo g.nemtudo.me) — sem app local nem túnel ──
  // O comando $tela já usa o endereço fixo https://g.nemtudo.me/w/priv.
  // Não há monitoramento de endereço local nem túnel para gerenciar.
  console.log(
    `${THEME.iconeFooter} Compartilhamento de tela: serviço externo em https://g.nemtudo.me`
  );
});

client.on('messageCreate', async (message) => {
  const db = require('./utils/db');
  if (!db.reivindicarMensagem(message.id)) {
    console.log(`↩️ Mensagem ${message.id} ignorada: já processada por outra instância (PID ${process.pid}).`);
    return;
  }

  // Processa sistema de economia/XP primeiro para nao depender de ser ou n comando
  if (!message.author.bot && message.guild) {
    if (db.podeGanharXp(message.author.id)) {
      const xpGanho = Math.floor(Math.random() * 11) + 15; // Ganha entre 15 e 25 XP
      const { subiu, level } = db.addXp(message.author.id, xpGanho);
      if (subiu) {
        // Envia parabéns pela subida de nível e paga uma gorgetinha
        db.addAcucares(message.author.id, level * 50);
        try {
          message.channel.send(`🎉 Parabéns ${message.author.toString()}, você alcançou o **Nível ${level}**! (Bônus: ${level * 50} 🍬)`).catch(() => {});
        } catch {}
      }
    }
  }

  await handlePrefix(message, client);
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    await handleReaction(reaction, user);
  } catch (error) {
    console.error('Erro ao processar reação de guerra:', error);
  }
});

// ── Comandos slash e autocomplete ──
// Componentes (botões, menus e modais) continuam nos handlers abaixo.
client.on('interactionCreate', async (interaction) => {
  // Passa clicks do painel de música
  if (interaction.isButton() && interaction.customId.startsWith('player_')) {
    await handlePlayerInteraction(interaction, client);
    return;
  }

  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    await tratar(interaction, client);
    return;
  }

  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const codex = require('./commands/codex');
    if (await codex.tratarComponente(interaction)) return;
  }
});

// ── Mila Boas-Vindas — chegada em servidor novo ──
// 1. Manda um recado de apresentação no canal de boas-vindas nativo (ou no
//    primeiro canal de texto onde a Mila possa falar).
// 2. Garante permissão de compartilhar tela (Stream) em todos os canais de voz.
client.on('guildCreate', async (guild) => {
  try {
    const { enviarBoasVindas, garantirPermissaoTela } = require('./utils/guildWelcome');

    // Garante o self-member e os canais no cache antes de mexer em permissões.
    await guild.members.fetch(client.user.id).catch(() => {});
    await guild.channels.fetch().catch(() => {});

    const boas = await enviarBoasVindas(guild, client);
    const perms = await garantirPermissaoTela(guild);
    console.log(
      `⋆｡°✩ Entrei no servidor ${guild.name} (${guild.id}) — ` +
        (boas.ok ? `boas-vindas em #${boas.canal}` : `boas-vindas: ${boas.motivo}`) +
        ` · permissão de tela: ${perms.aplicados}/${perms.total} canais de voz`
    );
  } catch (erro) {
    console.error(`⋆｡°✩ Erro na chegada ao servidor ${guild.id}:`, erro?.message || erro);
  }
});

// ── Mila Stream — limpeza na mudança de canal de voz ──
client.on('voiceStateUpdate', async (antigo, novo) => {
  try {
    const { getSessao, pararStream } = require('./utils/milaStream');
    // Se a Mila saiu do canal de voz (tinha canal, agora não tem), e havia
    // stream ativo na guild, para (evita "stream órfão").
    if (novo.id === client.user.id && antigo.channelId && !novo.channelId) {
      await pararStream(novo.guild.id);
    }
  } catch (erro) {
    console.error('Erro no voiceStateUpdate (Mila Stream):', erro);
  }
});

// ── Sistema de Tickets (interação com botões) ──
client.on('interactionCreate', async (interaction) => {
  const { criarTicket, reivindicarTicket, fecharTicket, convidarInterativo, abrirModalBusca, mostrarCargos, mostrarMembrosDoCargo, processarBuscaNome, convidarPorSelecao } = require('./utils/ticketManager');

  try {
    // ── Botões do painel de tickets (categorias) ──
    if (interaction.isButton() && interaction.customId.startsWith('ticket_') && !['ticket_fechar', 'ticket_reivindicar', 'ticket_invite', 'ticket_invite_search', 'ticket_invite_role', 'ticket_invite_fechar', 'ticket_invite_back', 'ticket_invite_back_roles', 'ticket_remove', 'ticket_remove_search', 'ticket_remove_role', 'ticket_remove_fechar', 'ticket_remove_back', 'ticket_remove_back_roles', 'ticket_fechar_confirmar', 'ticket_fechar_motivo', 'ticket_fechar_cancelar'].includes(interaction.customId)) {
      await criarTicket(interaction, client);
      return;
    }

    // ── Botão de reivindicar ──
    if (interaction.isButton() && interaction.customId === 'ticket_reivindicar') {
      await reivindicarTicket(interaction, client);
      return;
    }

    // ── Botão de fechar ──
    if (interaction.isButton() && interaction.customId === 'ticket_fechar') {
      await fecharTicket(interaction, client);
      return;
    }

    // ── Confirmar fechamento (sem motivo) ──
    if (interaction.isButton() && interaction.customId === 'ticket_fechar_confirmar') {
      const { executarFechamento } = require('./utils/ticketManager');
      await executarFechamento(interaction, null);
      return;
    }

    // ── Fechar com motivo (abre modal) ──
    if (interaction.isButton() && interaction.customId === 'ticket_fechar_motivo') {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('ticket_fechar_motivo_modal')
        .setTitle('📝 Motivo do Fechamento');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ticket_fechar_motivo_texto')
            .setLabel('📝 Motivo (opcional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Resolvido, duplicado, sem resposta...')
            .setMaxLength(200)
            .setRequired(true),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    // ── Cancelar fechamento ──
    if (interaction.isButton() && interaction.customId === 'ticket_fechar_cancelar') {
      await interaction.update({ content: '✅ Fechamento cancelado.', components: [], embeds: [] });
      return;
    }

    // ── Modal de motivo de fechamento ──
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_fechar_motivo_modal') {
      const motivo = interaction.fields.getTextInputValue('ticket_fechar_motivo_texto');
      const { executarFechamento } = require('./utils/ticketManager');
      await executarFechamento(interaction, motivo);
      return;
    }

    // ── Painel interativo de convite ──
    if (interaction.isButton() && interaction.customId === 'ticket_invite') {
      await convidarInterativo(interaction, client);
      return;
    }

    // ── Buscar por nome (modal) ──
    if (interaction.isButton() && interaction.customId === 'ticket_invite_search') {
      await abrirModalBusca(interaction);
      return;
    }

    // ── Mostrar cargos ──
    if (interaction.isButton() && interaction.customId === 'ticket_invite_role') {
      await mostrarCargos(interaction);
      return;
    }

    // ── Fechar painel de convite ──
    if (interaction.isButton() && interaction.customId === 'ticket_invite_fechar') {
      await interaction.update({ content: '✅ Painel fechado.', components: [], embeds: [] });
      return;
    }

    // ── Voltar da busca/cargo ──
    if (interaction.isButton() && (interaction.customId === 'ticket_invite_back' || interaction.customId === 'ticket_invite_back_roles')) {
      const ticketChannel = interaction.channel;
      if (!ticketChannel.topic) {
        await interaction.update({ content: '❌ Ticket inválido.', components: [] });
        return;
      }
      let ticketInfo;
      try { ticketInfo = JSON.parse(ticketChannel.topic); } catch {
        await interaction.update({ content: '❌ Erro ao ler ticket.', components: [] });
        return;
      }
      const { criarEmbedConvidar, criarBotoesConvite } = require('./utils/ticketManager');
      const embed = criarEmbedConvidar(ticketInfo, ticketChannel);
      await interaction.update({
        embeds: [embed],
        components: criarBotoesConvite(),
      });
      return;
    }

    // ── Selecionou um cargo → mostra membros ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_invite_role_select') {
      await mostrarMembrosDoCargo(interaction);
      return;
    }

    // ── Selecionou um membro (de cargo) → convida ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_invite_member_select') {
      await convidarPorSelecao(interaction);
      return;
    }

    // ── Modal de busca por nome ──
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_invite_modal_busca') {
      await processarBuscaNome(interaction);
      return;
    }

    // ── Selecionou um usuário da busca → convida ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_invite_user_select') {
      await convidarPorSelecao(interaction);
      return;
    }

    // ════════════════════════════════════════════
    // REMOVER USUÁRIO — Interações
    // ════════════════════════════════════════════

    // ── Botão de remover (no ticket) — abre painel interativo ──
    if (interaction.isButton() && interaction.customId === 'ticket_remove') {
      const { removerInterativo } = require('./utils/ticketManager');
      await removerInterativo(interaction, client);
      return;
    }

    // ── Buscar por nome (modal) ──
    if (interaction.isButton() && interaction.customId === 'ticket_remove_search') {
      const { abrirModalBuscaRemover } = require('./utils/ticketManager');
      await abrirModalBuscaRemover(interaction);
      return;
    }

    // ── Mostrar cargos ──
    if (interaction.isButton() && interaction.customId === 'ticket_remove_role') {
      const { mostrarCargosRemover } = require('./utils/ticketManager');
      await mostrarCargosRemover(interaction);
      return;
    }

    // ── Fechar painel ──
    if (interaction.isButton() && interaction.customId === 'ticket_remove_fechar') {
      await interaction.update({ content: '✅ Painel fechado.', components: [], embeds: [] });
      return;
    }

    // ── Voltar da busca/cargo ──
    if (interaction.isButton() && (interaction.customId === 'ticket_remove_back' || interaction.customId === 'ticket_remove_back_roles')) {
      const ticketChannel = interaction.channel;
      if (!ticketChannel.topic) {
        await interaction.update({ content: '❌ Ticket inválido.', components: [] });
        return;
      }
      let ticketInfo;
      try { ticketInfo = JSON.parse(ticketChannel.topic); } catch {
        await interaction.update({ content: '❌ Erro ao ler ticket.', components: [] });
        return;
      }
      const { criarEmbedRemover, criarBotoesRemover } = require('./utils/ticketManager');
      const embed = criarEmbedRemover(ticketInfo, ticketChannel);
      await interaction.update({
        embeds: [embed],
        components: criarBotoesRemover(),
      });
      return;
    }

    // ── Selecionou um cargo → mostra membros ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_remove_role_select') {
      const { mostrarMembrosDoCargoRemover } = require('./utils/ticketManager');
      await mostrarMembrosDoCargoRemover(interaction);
      return;
    }

    // ── Selecionou um membro (de cargo) → remove ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_remove_member_select') {
      const { removerPorSelecao } = require('./utils/ticketManager');
      await removerPorSelecao(interaction);
      return;
    }

    // ── Modal de busca por nome ──
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_remove_modal_busca') {
      const { processarBuscaNomeRemover } = require('./utils/ticketManager');
      await processarBuscaNomeRemover(interaction);
      return;
    }

    // ── Selecionou um usuário da busca → remove ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_remove_user_select') {
      const { removerPorSelecao } = require('./utils/ticketManager');
      await removerPorSelecao(interaction);
      return;
    }
  } catch (error) {
    console.error('Erro no interactionCreate (ticket):', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar sua ação.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

// ── Sistema de Fala ($say) ──
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  try {
    // Botões principais do painel
    if (interaction.isButton() && ['say_aqui', 'say_canal', 'say_dm', 'say_voltar', 'say_cancelar', 'say_voltar_categorias', 'say_buscar_canal'].includes(interaction.customId)) {
      const { abrirModalAqui, abrirModalDM, mostrarCategorias, abrirBuscaCanal } = require('./utils/sayManager');

      if (interaction.customId === 'say_aqui') {
        await interaction.update({ content: '✍️ Abrindo formulário...', components: [], embeds: [] });
        return abrirModalAqui(interaction);
      }
      if (interaction.customId === 'say_canal') return mostrarCategorias(interaction);
      if (interaction.customId === 'say_dm') {
        await interaction.update({ content: '✍️ Abrindo formulário...', components: [], embeds: [] });
        return abrirModalDM(interaction);
      }
      if (interaction.customId === 'say_voltar') {
        const { criarEmbedFalar, criarBotoesFalar } = require('./utils/sayManager');
        return interaction.update({ embeds: [criarEmbedFalar()], components: criarBotoesFalar() });
      }
      if (interaction.customId === 'say_voltar_categorias') return mostrarCategorias(interaction);
      if (interaction.customId === 'say_buscar_canal') return abrirBuscaCanal(interaction);
      if (interaction.customId === 'say_cancelar') {
        return interaction.update({ content: '✅ Cancelado.', components: [], embeds: [] });
      }
    }

    // Selecionou uma categoria → mostra canais
    if (interaction.isStringSelectMenu() && interaction.customId === 'say_select_categoria') {
      const { mostrarCanaisDaCategoria } = require('./utils/sayManager');
      return mostrarCanaisDaCategoria(interaction);
    }

    // Selecionou um canal → abre modal
    if (interaction.isStringSelectMenu() && interaction.customId === 'say_select_canal') {
      const { abrirModalCanal } = require('./utils/sayManager');
      return abrirModalCanal(interaction);
    }

    // Modal de busca de canal
    if (interaction.isModalSubmit() && interaction.customId === 'say_busca_canal_modal') {
      const { processarBuscaCanal } = require('./utils/sayManager');
      return processarBuscaCanal(interaction);
    }

    // Modal de conteúdo
    if (interaction.isModalSubmit() && (
      interaction.customId === 'say_modal_aqui' ||
      interaction.customId.startsWith('say_modal_canal_') ||
      interaction.customId === 'say_modal_dm'
    )) {
      const { mostrarPreview } = require('./utils/sayManager');
      return mostrarPreview(interaction);
    }

    // Confirmar envio
    if (interaction.isButton() && interaction.customId.startsWith('say_enviar_')) {
      const { confirmarEnvio } = require('./utils/sayManager');
      return confirmarEnvio(interaction);
    }

    // Cancelar preview
    if (interaction.isButton() && interaction.customId === 'say_cancelar_preview') {
      return interaction.update({ content: '✅ Cancelado.', components: [], embeds: [] });
    }
  } catch (error) {
    console.error('Erro no interactionCreate (say):', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Ocorreu um erro ao processar sua ação.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});
// ── Sistema de Jogo da Forca ──
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
  if (!interaction.customId?.startsWith('forca_')) return;

  // Se já foi respondida (pelo collector do $forca no prefix), ignora
  if (interaction.replied || interaction.deferred) return;

  try {
    const forca = require('./utils/forcaManager');

    // ── Ranking ──
    if (interaction.isButton() && interaction.customId.startsWith('forca_rank_')) {
      const tipo = interaction.customId.replace('forca_rank_', '');
      const embed = forca.criarEmbedRanking(tipo);
      return interaction.update({ embeds: [embed], components: [forca.criarBotoesRanking()] });
    }

    // ── Regras ──
    if (interaction.isButton() && interaction.customId === 'forca_ver_regras') {
      const embed = forca.criarEmbedRegras();
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      return interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('forca_voltar').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    // ── Voltar / Cancelar ──
    if (interaction.isButton() && (interaction.customId === 'forca_cancelar')) {
      return interaction.update({ content: '✅ Cancelado.', embeds: [], components: [] });
    }
    if (interaction.isButton() && interaction.customId === 'forca_voltar') {
      const { criarSelectModo, criarSelectDificuldade } = forca;
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const embed = forca.criarEmbedJogo
        ? null
        : require('./utils/theme').criarEmbed({
            titulo: '🎪 Jogo da Forca',
            descricao: '```╔══════════════════════════════╗\n║    🎪 JOGO DA FORCA         ║\n╚══════════════════════════════╝```\n\nBem-vindo ao jogo de palavras! 🎭\n\nEscolha o **modo de jogo** e a **dificuldade**\npara começar.',
            cor: 0xFF69B4,
            rodape: '🎪 Jogo da Forca • Mila Bot',
          });
      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(criarSelectModo()),
          new ActionRowBuilder().addComponents(criarSelectDificuldade()),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('forca_comecar').setLabel('✅ Começar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('forca_ver_regras').setLabel('📖 Regras').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('forca_cancelar').setLabel('✖️ Cancelar').setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    }

    // ── Começar ──
    if (interaction.isButton() && interaction.customId === 'forca_comecar') {
      const sessao = forca.JOGOS.get(interaction.user.id) || forca.JOGOS.get(interaction.message?.id);
      if (!sessao || !sessao.modo || !sessao.dificuldade) {
        return interaction.reply({ content: '❌ Selecione um modo e uma dificuldade primeiro!', ephemeral: true });
      }

      const { modo, dificuldade } = sessao;

      // Salva a config no user.id para o $forca vs usar depois
      forca.JOGOS.set(interaction.user.id, { modo, dificuldade });

      // Remove da mensagem
      forca.JOGOS.delete(interaction.message?.id);

      // Inicia o jogo imediatamente para QUALQUER modo (solo)
      // Para jogar com amigos, usar $forca vs @user
      await interaction.deferUpdate();
      await forca.iniciarJogo(interaction, { dificuldade, modo });
      return;
    }

    // ── Select modo ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'forca_select_modo') {
      const modo = interaction.values[0];
      const chave = interaction.user.id;
      const dados = forca.JOGOS.get(chave) || forca.JOGOS.get(interaction.message?.id) || {};
      dados.modo = modo;
      forca.JOGOS.set(interaction.message?.id || chave, dados);
      return interaction.deferUpdate();
    }

    // ── Select dificuldade ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'forca_select_dificuldade') {
      const dif = interaction.values[0];
      const chave = interaction.user.id;
      const dados = forca.JOGOS.get(chave) || forca.JOGOS.get(interaction.message?.id) || {};
      dados.dificuldade = dif;
      forca.JOGOS.set(interaction.message?.id || chave, dados);
      return interaction.deferUpdate();
    }

    // ── Botão Tentar Letra ──
    if (interaction.isButton() && interaction.customId === 'forca_letra') {
      await forca.abrirModalLetra(interaction);
      return;
    }

    // ── Modal de letra ──
    if (interaction.isModalSubmit() && interaction.customId === 'forca_modal_letra') {
      await forca.processarModalLetra(interaction);
      return;
    }

    // ── Palpite ──
    if (interaction.isButton() && interaction.customId === 'forca_palpite') {
      await forca.abrirModalPalpite(interaction);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === 'forca_modal_palpite') {
      await forca.processarPalpite(interaction);
      return;
    }

    // ── Revelar ──
    if (interaction.isButton() && interaction.customId === 'forca_revelar') {
      await forca.revelarPalavra(interaction);
      return;
    }

    // ── Desistir ──
    if (interaction.isButton() && interaction.customId === 'forca_desistir') {
      await forca.desistir(interaction);
      return;
    }

    // ── Próxima Rodada (competitivo) ──
    if (interaction.isButton() && interaction.customId === 'forca_proxima_rodada') {
      await forca.proximaRodada(interaction);
      return;
    }

    // ── Encerrar Partida (competitivo) ──
    if (interaction.isButton() && interaction.customId === 'forca_encerrar_partida') {
      await forca.encerrarPartida(interaction);
      return;
    }

    // ── Próxima Palavra (cooperativo) ──
    if (interaction.isButton() && interaction.customId === 'forca_proxima_palavra') {
      await forca.proximaPalavraCoop(interaction);
      return;
    }

    // ── Encerrar Coop ──
    if (interaction.isButton() && interaction.customId === 'forca_encerrar_coop') {
      await forca.encerrarPartida(interaction);
      return;
    }

    // ── Convite ──
    if (interaction.isButton() && interaction.customId === 'forca_convite_aceitar') {
      const JOGOS = forca.JOGOS;
      const msgId = interaction.message?.id;
      const sessao = JOGOS.get(msgId);
      if (!sessao || !sessao.dono) {
        return interaction.reply({ content: '❌ Convite expirado.', ephemeral: true });
      }
      if (!sessao.aceitos) sessao.aceitos = [];
      if (sessao.aceitos.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ Você já aceitou o convite!', ephemeral: true });
      }
      sessao.aceitos.push(interaction.user.id);

      const total = sessao.convidados.length + 1; // + dono
      if (sessao.aceitos.length >= total) {
        // Todos aceitaram!
        await interaction.update({
          content: '✅ **Todos aceitaram!** 🎪 Preparando o jogo...',
          components: [],
          embeds: [],
        });
        const criando = await interaction.channel.send('🎪 **Armando o jogo...**');
        JOGOS.delete(msgId);
        await forca.iniciarJogo(
          {
            ...interaction,
            editReply: (o) => criando.edit(o),
            channel: interaction.channel,
            channelId: interaction.channelId,
          },
          {
            dificuldade: sessao.dificuldade,
            modo: sessao.modo,
            jogadores: [sessao.dono, ...sessao.convidados].map(u => ({ id: u.id, tag: u.tag, pontos: 0 })),
          }
        );
      } else {
        await interaction.reply({
          content: `✅ **${interaction.user.tag}** aceitou! (${sessao.aceitos.length}/${total})`,
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === 'forca_convite_recusar') {
      const sessao = forca.JOGOS.get(interaction.message?.id);
      if (sessao) {
        forca.JOGOS.delete(interaction.message?.id);
        await interaction.update({
          content: `❌ **${interaction.user.tag}** recusou o convite. Partida cancelada.`,
          components: [],
          embeds: [],
        });
      }
      return;
    }
  } catch (error) {
    console.error('Erro no interactionCreate (forca):', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Ocorreu um erro no jogo da forca.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

// ── Cache de presença e membros (alimenta $securitybreach em tempo real) ──
// Só faz sentido se as intents privilegiadas estiverem ativas.
if (intents.includes(GatewayIntentBits.GuildMembers) && intents.includes(GatewayIntentBits.GuildPresences)) {
  const { clientCache, presenceMap } = require('./utils/cache');

  // Mantém o presenceMap sempre atualizado (status online/offline/etc.)
  client.on('presenceUpdate', (_oldPresence, newPresence) => {
    if (newPresence && newPresence.userId) {
      presenceMap.set(newPresence.userId, newPresence.status || 'offline');
    }
  });

  // Quando um membro entra, garante que ele esteja no cache de membros
  client.on('guildMemberAdd', (member) => {
    const entry = clientCache.get(member.guild.id);
    if (entry) entry.members.set(member.id, member);
    else clientCache.set(member.guild.id, { members: new Map([[member.id, member]]), timestamp: Date.now() });
  });

  // Quando um membro sai, remove do cache
  client.on('guildMemberRemove', (member) => {
    clientCache.get(member.guild.id)?.members.delete(member.id);
  });

  // Popula o cache de presença já no boot, para o primeiro $securitybreach não depender de fetch
  client.once('clientReady', async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        const members = await guild.members.fetch({ withPresences: true }).catch(() => null);
        if (members) {
          clientCache.set(guild.id, { members, timestamp: Date.now() });
          for (const [, m] of members) {
            if (m.presence) presenceMap.set(m.id, m.presence.status || 'offline');
          }
        }
      }
      console.log(`${THEME.iconeFooter} Cache de membros/presença populado.`);
    } catch (err) {
      console.error('Erro ao popular cache de membros no boot:', err);
    }
  });
} else {
  console.warn(
    '⚠️ ENABLE_PRIVILEGED_INTENTS não está ativo: $securitybreach fará fetch sob demanda (mais lento). Ative no .env para cache em tempo real.'
  );
}

function bannerShutdown() {
  return [
    '',
    '   ╔═══╗╔╗ ╔╗╔═══╗╔╗   ╔═══╗',
    '   ║╔═╗║║║ ║║║╔══╝║║   ║╔═╗║',
    '   ║╚═╝║║╚═╝║║╚══╗║║   ║╚═╝║',
    '   ║╔╗╔╝║╔═╗║║╔══╝║║ ╔╗║╔╗╔╝',
    '   ║║║╚╗║║ ║║║╚══╗║╚═╝║║║║╚╗',
    '   ╚╝╚═╝╚╝ ╚╝╚═══╝╚═══╝╚╝╚═╝',
    '',
  ].join('\n');
}

process.on('SIGINT', async () => {
  console.log(bannerShutdown());
  logger.aviso(`${THEME.nome} desligando — avisando servidores...`);
  await avisarShutdown(client);
  await sairDeTodasAsCalls(client);
  logger.sucesso(`Avisos enviados. Volto logo, meu favorito~ ♡`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(bannerShutdown());
  logger.aviso(`${THEME.nome} desligando — avisando servidores...`);
  await avisarShutdown(client);
  await sairDeTodasAsCalls(client);
  logger.sucesso(`Avisos enviados. Volto logo, meu favorito~ ♡`);
  process.exit(0);
});

// Proteção global: erros não-tratados (ex.: interação inválida) não devem
// derrubar o processo. Logamos e seguimos. (O fluxo já é resiliente por si;
// isto é uma rede de segurança extra para a Mila continuar online.)
process.on('unhandledRejection', (erro) => {
  console.error('⚠️ unhandledRejection (Mila continua online):', erro?.message || erro);
});
process.on('uncaughtException', (erro) => {
  console.error('⚠️ uncaughtException (Mila continua online):', erro?.message || erro);
});

client.login(DISCORD_TOKEN);
