const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { obterConfig, salvarConfig, TIPOS_ANUNCIO } = require('../utils/servidorStore');
const { isStaff } = require('../utils/perms');

function mencionarCanais(ids, client) {
  if (!ids || ids.length === 0) return '`nenhum definido`';
  return ids.map((id) => `<#${id}>`).join('  ·  ');
}

module.exports = {
  meta: { guildOnly: true, permissions: ['ManageGuild', 'Administrator'] },
  data: { name: 'configurar', description: 'Define onde a bot fala e organiza os canais de anúncio (requer gerir servidor)', options: [
    ...['permitir', 'proibir', 'liberar', 'desproibir', 'shutdown', 'ticketcategoria', 'ticketfixo', 'off-on'].map((name) => ({ name, description: `Configurar ${name}`, type: 1, required: false, options: [{ name: 'canal', description: 'Canal ou categoria', type: 7, required: false }] })),
    { name: 'anuncio', description: 'Configurar canal de anúncio', type: 1, required: false, options: [{ name: 'tipo', description: 'Tipo do anúncio', type: 3, required: true, choices: TIPOS_ANUNCIO.map((value) => ({ name: value, value })) }, { name: 'canal', description: 'Canal do anúncio', type: 7, required: true }] },
    { name: 'limparanuncio', description: 'Limpar canal de anúncio', type: 1, required: false, options: [{ name: 'tipo', description: 'Tipo do anúncio', type: 3, required: true, choices: TIPOS_ANUNCIO.map((value) => ({ name: value, value })) }] },
    { name: 'logs', description: 'Define o canal de logs da bot', type: 1, required: false, options: [{ name: 'canal', description: 'Canal de logs', type: 7, required: true }] },
    { name: 'limparlogs', description: 'Remove o canal de logs', type: 1, required: false },
    { name: 'pokemon', description: 'Define o canal dos encontros Pokémon e ativa/desativa', type: 1, required: false, options: [{ name: 'canal', description: 'Canal onde os Pokémon aparecem', type: 7, required: false }, { name: 'ativo', description: 'Ativa ou desativa os encontros', type: 5, required: false }] },
    { name: 'pesquisar', description: 'Pesquisa nas configurações', type: 1, required: false, options: [{ name: 'termo', description: 'Termo de pesquisa', type: 3, required: true }] },
    { name: 'ver', description: 'Ver a configuração atual (painel explicativo)', type: 1, required: false },
  ] },

  async execute(interaction, client) {
    // Risco original: confiava apenas em default_member_permissions do registro
    // do Slash. O comando $configurar no prefix.js já checava isStaff, mas o
    // Slash `execute` não tinha checagem explícito — confiava que o Discord
    // restringia, mas isso não é garantido quando usado via bridge ou integração.
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [
          criarEmbed({ titulo: 'Sem permissão', descricao: 'Você precisa de **Gerir Servidor** ou cargo de staff para usar `/configurar`.', cor: THEME.corErro }),
        ],
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    const cfg = obterConfig(guildId);

    if (sub === 'permitir') {
      const canal = interaction.options.getChannel('canal');
      if (!cfg.canaisPermitidos.includes(canal.id)) cfg.canaisPermitidos.push(canal.id);
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: 'Canal permitido',
        descricao: `Agora falo em ${canal}.`,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'proibir') {
      const canal = interaction.options.getChannel('canal');
      if (!cfg.canaisBloqueados.includes(canal.id)) cfg.canaisBloqueados.push(canal.id);
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: 'Canal proibido',
        descricao: `Parei de falar em ${canal}.`,
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'liberar') {
      const canal = interaction.options.getChannel('canal');
      cfg.canaisPermitidos = cfg.canaisPermitidos.filter((id) => id !== canal.id);
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: 'Canal liberado',
        descricao: `Removi ${canal} dos permitidos.`,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'desproibir') {
      const canal = interaction.options.getChannel('canal');
      cfg.canaisBloqueados = cfg.canaisBloqueados.filter((id) => id !== canal.id);
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: 'Canal desproibido',
        descricao: `Liberei ${canal} para eu falar.`,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'anuncio') {
      const tipo = interaction.options.getString('tipo');
      const canal = interaction.options.getChannel('canal');
      cfg.anuncios[tipo] = canal.id;
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: 'Canal de anúncio definido',
        descricao: `Anúncios do tipo **${tipo}** serão enviados em ${canal}.`,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'limparanuncio') {
      const tipo = interaction.options.getString('tipo');
      cfg.anuncios[tipo] = null;
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: 'Canal de anúncio limpo',
        descricao: `Não há mais canal definido para anúncios do tipo **${tipo}**.`,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'shutdown') {
      const canal = interaction.options.getChannel('canal');
      cfg.canalShutdown = canal?.id || null;
      salvarConfig(guildId, cfg);
      const descricao = canal
        ? `Agora aviso o desligamento em ${canal}.`
        : 'Removi o aviso de shutdown.';
      const embed = criarEmbed({
        titulo: 'Canal de shutdown definido',
        descricao,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ticketcategoria') {
      const canal = interaction.options.getChannel('canal');
      if (canal && canal.type !== ChannelType.GuildCategory) {
        return interaction.reply({
          content: '❌ Isso **não é uma categoria**! Selecione uma categoria (pasta de canais), não um canal de texto.',
          ephemeral: true,
        });
      }
      const categoriaId = canal?.id || null;
      cfg.categoriaTicket = categoriaId;
      salvarConfig(guildId, cfg);
      const descricao = canal
        ? `A categoria de tickets agora é **${canal.name}** (${canal}).`
        : 'Removi a categoria de tickets.';
      const embed = criarEmbed({
        titulo: '🎪 Categoria de Tickets definida',
        descricao,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ticketfixo') {
      const canal = interaction.options.getChannel('canal');
      cfg.canalTicketFixo = canal?.id || null;
      salvarConfig(guildId, cfg);
      const descricao = canal
        ? `O painel fixo de tickets agora aparecerá em ${canal}.`
        : 'Removi o canal do painel fixo de tickets.';
      const embed = criarEmbed({
        titulo: 'Canal do painel fixo de tickets definido',
        descricao,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'off-on') {
      const canal = interaction.options.getChannel('canal');
      cfg.canalOnOff = canal?.id || null;
      salvarConfig(guildId, cfg);
      const descricao = canal
        ? `Agora aviso quando fico **online/offline** em ${canal}.`
        : 'Removi o aviso de online/offline.';
      const embed = criarEmbed({
        titulo: 'Canal de on/off definido',
        descricao,
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'logs') {
      const canal = interaction.options.getChannel('canal');
      if (canal && ![0, 5, 10, 11, 12, 13, 14, 15].includes(canal.type)) {
        return interaction.reply({ content: '❌ Escolha um canal de texto para logs.', ephemeral: true });
      }
      cfg.canalLogs = canal?.id || null;
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: '📜 Canal de logs definido',
        descricao: canal
          ? `Agora registro mensagens apagadas e editadas em ${canal}.`
          : 'Removi o canal de logs.',
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'limparlogs') {
      cfg.canalLogs = null;
      salvarConfig(guildId, cfg);
      const embed = criarEmbed({
        titulo: '📜 Canal de logs removido',
        descricao: 'Não enviarei mais logs para um canal fixo.',
        cor: THEME.corSucesso,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'pokemon') {
      const pokemon = require('../utils/pokemon');
      const canal = interaction.options.getChannel('canal');
      const ativo = interaction.options.getBoolean('ativo');
      const atual = pokemon.obterConfig(guildId);
      const listaCanais = atual.channels.map((id) => `<#${id}>`).join('  ·  ');
      const ativoAgora = atual.enabled && atual.channels.length > 0;

      if (canal && ![0, 5, 10, 11, 12, 13, 14, 15].includes(canal.type)) {
        return interaction.reply({ content: '❌ Escolha um canal de texto para os encontros Pokémon.', ephemeral: true });
      }

      if (!canal && ativo === null) {
        const embed = criarEmbed({
          titulo: '🎮 Encontros Pokémon',
          descricao:
            `${THEME.div.bolinhas}\n\n` +
            `**Status:** ${ativoAgora ? '✅ ativos' : '⛔ desativados'}\n` +
            `**Canal(is):** ${listaCanais || '`nenhum — os encontros ficam desligados até configurar`'}\n` +
            `**Chance por mensagem:** ${atual.spawnChance}%\n` +
            `**Intervalo mínimo:** ${Math.round(atual.cooldownMs / 60000)} min\n\n` +
            `**Como configurar**\n` +
            '˖ `/configurar pokemon canal:#canal` — escolhe o canal e ativa\n' +
            '˖ `/configurar pokemon ativo:false` — pausa os encontros\n' +
            '˖ `$configurar pokemon #canal` — mesmo atalho por prefixo\n\n' +
            `${THEME.div.coracao}`,
          cor: ativoAgora ? THEME.corSucesso : THEME.corSecundario,
        });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const patch = {};
      if (canal) {
        patch.channels = [canal.id];
        patch.muted = false;
        if (ativo === null) patch.enabled = true;
      }
      if (ativo !== null) patch.enabled = ativo;
      const novo = pokemon.salvarConfig(guildId, patch);
      const ativoFinal = novo.enabled && novo.channels.length > 0;
      const embed = criarEmbed({
        titulo: '🎮 Encontros Pokémon atualizados',
        descricao:
          `${THEME.div.bolinhas}\n\n` +
          `**Status:** ${ativoFinal ? '✅ ativos' : '⛔ desativados'}\n` +
          `**Canal(is):** ${novo.channels.map((id) => `<#${id}>`).join('  ·  ') || '`nenhum definido`'}\n\n` +
          (ativoFinal
            ? 'Os Pokémon podem aparecer nos canais acima. Ajuste frequência com `$p intervalo` e `$p chance`.'
            : 'Os encontros ficam pausados até você escolher um canal e reativar.') +
          `\n\n${THEME.div.coracao}`,
        cor: ativoFinal ? THEME.corSucesso : THEME.corSecundario,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'pesquisar') {
      const pokemon = require('../utils/pokemon');
      const poke = pokemon.obterConfig(guildId);
      const termo = String(interaction.options.getString('termo') || '').toLowerCase();
      const secoes = [
        { nome: 'Canais permitidos', valor: (cfg.canaisPermitidos || []).map((id) => `<#${id}>`).join(', ') || 'nenhum', chaves: ['permitir', 'liberar', 'canal'] },
        { nome: 'Canais proibidos', valor: (cfg.canaisBloqueados || []).map((id) => `<#${id}>`).join(', ') || 'nenhum', chaves: ['proibir', 'desproibir'] },
        { nome: 'Anúncios', valor: TIPOS_ANUNCIO.map((t) => `${t}: ${cfg.anuncios?.[t] ? `<#${cfg.anuncios[t]}>` : 'não definido'}`).join(' · '), chaves: ['anuncio', 'limparanuncio'] },
        { nome: 'Tickets', valor: `categoria: ${cfg.categoriaTicket ? `<#${cfg.categoriaTicket}>` : 'não definido'} · fixo: ${cfg.canalTicketFixo ? `<#${cfg.canalTicketFixo}>` : 'não definido'}`, chaves: ['ticketcategoria', 'ticketfixo'] },
        { nome: 'Shutdown', valor: cfg.canalShutdown ? `<#${cfg.canalShutdown}>` : 'não definido', chaves: ['shutdown'] },
        { nome: 'On/Off', valor: cfg.canalOnOff ? `<#${cfg.canalOnOff}>` : 'não definido', chaves: ['off-on'] },
        { nome: 'Logs', valor: cfg.canalLogs ? `<#${cfg.canalLogs}>` : 'não definido', chaves: ['logs', 'limparlogs'] },
        { nome: 'Pokémon', valor: `${poke.channels.map((id) => `<#${id}>`).join(', ') || 'nenhum'} · ${poke.enabled && poke.channels.length ? 'ativos' : 'desativados'}`, chaves: ['pokemon', 'poke', 'encontros'] },
      ];
      const filtradas = secoes.filter((s) => s.nome.toLowerCase().includes(termo) || s.valor.toLowerCase().includes(termo) || s.chaves.some((c) => c.includes(termo)));
      const descricao = filtradas.length
        ? filtradas.map((s) => `**${s.nome}:** ${s.valor}`).join('\n')
        : 'Nenhuma configuração encontrada para esse termo.';
      const embed = criarEmbed({
        titulo: `🔎 Pesquisa: ${termo}`,
        descricao,
        cor: THEME.corPrincipal,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ver') {
      const pokemon = require('../utils/pokemon');
      const poke = pokemon.obterConfig(guildId);
      const anuncios = TIPOS_ANUNCIO.map((t) => {
        const id = cfg.anuncios[t];
        return `˖ **${t}**: ${id ? `<#${id}>` : '`não definido`'}`;
      }).join('\n');

      const ticketCategoria = cfg.categoriaTicket
        ? `<#${cfg.categoriaTicket}>`
        : '`não definido`';

      const descricao =
        `**Canais permitidos:** ${mencionarCanais(cfg.canaisPermitidos, client)}\n` +
        `**Canais proibidos:** ${mencionarCanais(cfg.canaisBloqueados, client)}\n\n` +
        `**Anúncios por tipo:**\n${anuncios}\n\n` +
        `**🎪 Categoria de Tickets:** ${ticketCategoria}\n` +
        `**📌 Canal Ticket Fixo:** ${cfg.canalTicketFixo ? `<#${cfg.canalTicketFixo}>` : '`não definido`'}\n` +
        `**🔌 Canal de shutdown:** ${cfg.canalShutdown ? `<#${cfg.canalShutdown}>` : '`não definido`'}\n` +
        `**🔛 Canal on/off:** ${cfg.canalOnOff ? `<#${cfg.canalOnOff}>` : '`não definido`'}\n` +
        `**📜 Canal de logs:** ${cfg.canalLogs ? `<#${cfg.canalLogs}>` : '`não definido`'}\n` +
        `**🎮 Encontros Pokémon:** ${poke.channels.length ? `${poke.channels.map((id) => `<#${id}>`).join('  ·  ')} · ${poke.enabled ? '✅ ativos' : '⛔ pausados'}` : '`nenhum canal — desativados`'}\n\n` +
        `_Se "permitidos" estiver vazio, falo em qualquer canal (exceto os proibidos)._`;

      const embed = criarEmbed({
        titulo: 'Configuração atual da lua',
        descricao,
        cor: THEME.corPrincipal,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};