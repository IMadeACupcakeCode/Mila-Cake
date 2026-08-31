const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { obterConfig, salvarConfig, TIPOS_ANUNCIO } = require('../utils/servidorStore');
const { isStaff } = require('../utils/perms');

function mencionarCanais(ids, client) {
  if (!ids || ids.length === 0) return '`nenhum definido`';
  return ids.map((id) => `<#${id}>`).join('  ·  ');
}

module.exports = {
  data: { name: 'configurar', description: 'Define onde a bot fala e organiza os canais de anúncio (requer gerir servidor)' },

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

    if (sub === 'ver') {
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
        `**🔛 Canal on/off:** ${cfg.canalOnOff ? `<#${cfg.canalOnOff}>` : '`não definido`'}\n\n` +
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