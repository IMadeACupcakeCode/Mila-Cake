const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { enviarPainel, configurarTicket } = require('../utils/ticketManager');
const { obterConfig, salvarConfig } = require('../utils/ticketStore');

module.exports = {
  data: {
    name: 'ticket',
    description: '🎫 Sistema de Tickets da Mila Bot',
    options: [
      {
        name: 'acao',
        description: 'O que deseja fazer?',
        type: 3,
        required: true,
        choices: [
          { name: '🎫 Enviar Painel', value: 'enviar' },
          { name: '📂 Configurar Categoria Padrão', value: 'config' },
          { name: '📌 Configurar Categoria por Tipo', value: 'categoria' },
          { name: '👥 Adicionar Staff', value: 'staff_add' },
          { name: '👥 Remover Staff', value: 'staff_remove' },
          { name: '👁️ Ver Config', value: 'ver' },
          { name: '📬 Convidar Usuário', value: 'invite' },
          { name: '🚫 Remover Usuário', value: 'remove' }
        ],
      },
      {
        name: 'canal_ou_cargo',
        description: 'Canal, categoria ou cargo',
        type: 8,
        required: false,
      },
      {
        name: 'tipo',
        description: 'Tipo do ticket',
        type: 3,
        required: false,
        choices: [
          { name: '⚠️ Denúncias', value: 'denuncias' },
          { name: '🤝 Parcerias', value: 'parcerias' },
          { name: '❓ Outro', value: 'outro' },
        ],
      },
      {
        name: 'user',
        description: 'Usuário para convidar ao ticket',
        type: 6,
        required: false,
      },
    ],
  },

  async execute(interaction, client) {
    const acao = interaction.options.getString('acao');
    const alvo = interaction.options.get('canal_ou_cargo')?.value;
    const tipo = interaction.options.getString('tipo');
    const user = interaction.options.getUser('user');
    const guildId = interaction.guildId;

    const cfg = obterConfig(guildId);

    if (acao === 'enviar') {
      const { criarEmbedPainel, criarBotoesPainel } = require('../utils/ticketManager');
      const path = require('path');

      const { embed, arquivo } = criarEmbedPainel();
      const botoes = criarBotoesPainel();

      await interaction.channel.send({
        embeds: [embed],
        components: botoes,
        files: [{ attachment: arquivo, name: 'Ticket.gif' }],
      });

      return interaction.reply({ content: '✅ **Painel de Tickets** enviado!', ephemeral: true });
    }

    if (acao === 'config') {
      if (!alvo) return interaction.reply({ content: '❌ Especifique uma categoria!', ephemeral: true });

      const canal = interaction.guild.channels.cache.get(alvo);
      if (!canal || canal.type !== ChannelType.GuildCategory) {
        return interaction.reply({ content: '❌ Isso não é uma categoria válida.', ephemeral: true });
      }

      cfg.categoriaId = alvo;
      salvarConfig(guildId, cfg);

      return interaction.reply({ content: `✅ **Categoria padrão definida:** ${canal.name}`, ephemeral: false });
    }

    if (acao === 'categoria') {
      if (!tipo || !alvo) {
        return interaction.reply({
          content: '❌ Especifique um tipo e uma categoria!\nEx: `/ticket acao:categoria tipo:denuncias canal_ou_cargo:#categoria`',
          ephemeral: true,
        });
      }

      const { CATEGORIA_POR_VALOR, CATEGORIAS } = require('../utils/ticketManager');
      const tipoCompleto = `ticket_${tipo}`;
      if (!CATEGORIA_POR_VALOR[tipoCompleto]) {
        return interaction.reply({
          content: '❌ Tipo inválido. Use: denuncias, parcerias, ou outro.',
          ephemeral: true,
        });
      }

      const canal = interaction.guild.channels.cache.get(alvo);
      if (!canal || canal.type !== ChannelType.GuildCategory) {
        return interaction.reply({ content: '❌ Isso não é uma categoria válida.', ephemeral: true });
      }

      cfg.categoriasPorTipo = cfg.categoriasPorTipo || {};
      cfg.categoriasPorTipo[tipoCompleto] = alvo;
      salvarConfig(guildId, cfg);

      return interaction.reply({ content: `✅ **Categoria para ${tipo} definida:** ${canal.name}`, ephemeral: false });
    }

    if (acao === 'staff_add') {
      if (!alvo) return interaction.reply({ content: '❌ Especifique um cargo!', ephemeral: true });

      const role = interaction.guild.roles.cache.get(alvo);
      if (!role) return interaction.reply({ content: '❌ Cargo não encontrado.', ephemeral: true });

      if (!cfg.cargosStaff.includes(alvo)) {
        cfg.cargosStaff.push(alvo);
        salvarConfig(guildId, cfg);
      }

      return interaction.reply({ content: `✅ **Staff adicionado:** ${role}`, ephemeral: false });
    }

    if (acao === 'staff_remove') {
      if (!alvo) return interaction.reply({ content: '❌ Especifique um cargo!', ephemeral: true });

      cfg.cargosStaff = cfg.cargosStaff.filter((id) => id !== alvo);
      salvarConfig(guildId, cfg);

      return interaction.reply({ content: `✅ Cargo removido da staff.`, ephemeral: false });
    }

    if (acao === 'remove') {
      if (!user) {
        const { removerInterativo } = require('../utils/ticketManager');
        return removerInterativo(interaction, client);
      }

      const ticketChannel = interaction.channel;

      if (ticketChannel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Este comando só pode ser usado em canais de texto.', ephemeral: true });
      }

      if (!ticketChannel.topic) {
        return interaction.reply({ content: '❌ Este canal não parece ser um ticket válido.', ephemeral: true });
      }

      let ticketInfo;
      try {
        ticketInfo = JSON.parse(ticketChannel.topic);
      } catch {
        return interaction.reply({ content: '❌ Erro ao ler informações do ticket.', ephemeral: true });
      }

      if (!ticketInfo.userId && !ticketInfo.contador) {
        return interaction.reply({ content: '❌ Este canal não é um ticket válido.', ephemeral: true });
      }

      if (user.id === ticketInfo.userId) {
        return interaction.reply({ content: '❌ Não é possível remover o **dono do ticket**.', ephemeral: true });
      }

      const overwrite = ticketChannel.permissionOverwrites.cache?.get(user.id);
      const hasAccess = overwrite?.allow?.has(PermissionFlagsBits.ViewChannel);

      if (!hasAccess) {
        return interaction.reply({ content: `❌ ${user} não tem acesso a este ticket.`, ephemeral: true });
      }

      try {
        await ticketChannel.permissionOverwrites.edit(user.id, {
          ViewChannel: false,
          SendMessages: false,
          ReadMessageHistory: false,
        });
      } catch (err) {
        return interaction.reply({ content: `❌ Erro ao remover: ${err.message}`, ephemeral: true });
      }

      await interaction.reply(`🚫 ${user} foi removido do ticket.`);

      try {
        await user.send(`🚫 Você foi removido do ticket **#${String(ticketInfo.contador).padStart(4, '0')}** no servidor **${interaction.guild.name}**.`);
      } catch {}
      return;
    }

    if (acao === 'ver') {
      const { CATEGORIAS, CATEGORIAS_POR_ID } = require('../utils/ticketManager');
      const categoriaPadrao = cfg.categoriaId ? interaction.guild.channels.cache.get(cfg.categoriaId) : null;
      const cargos = cfg.cargosStaff.map((id) => {
        const role = interaction.guild.roles.cache.get(id);
        return role ? `${role}` : `\`${id}\``;
      }).join(', ') || '`Nenhum`';

      const linhas = CATEGORIAS.map((cat) => {
        const id = cfg.categoriasPorTipo?.[cat.valor] || CATEGORIAS_POR_ID[cat.valor];
        const canal = id ? interaction.guild.channels.cache.get(id) : null;
        return `${cat.emoji} **${cat.nome}:** ${canal ? canal.name : '`Não definida`'}`;
      }).join('\n');

      const embed = criarEmbed({
        titulo: '🎫 Configuração dos Tickets',
        descricao: [
          `**📂 Categoria padrão:** ${categoriaPadrao ? categoriaPadrao.name : '`Não definida`'}`,
          '',
          linhas,
          '',
          `**👥 Cargos Staff:** ${cargos}`,
          `**🔢 Tickets criados:** ${cfg.contador || 0}`,
        ].join('\n'),
        cor: THEME.corPrincipal,
        rodape: rodapeAleatorio(),
        semTimestamp: false,
      });

      return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    if (acao === 'invite') {
      if (!user) {
        const { convidarInterativo } = require('../utils/ticketManager');
        return convidarInterativo(interaction, client);
      }

      const ticketChannel = interaction.channel;

      if (ticketChannel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: '❌ Este comando só pode ser usado em canais de texto.', ephemeral: true });
      }

      if (!ticketChannel.topic) {
        return interaction.reply({ content: '❌ Este canal não parece ser um ticket válido.', ephemeral: true });
      }

      let ticketInfo;
      try {
        ticketInfo = JSON.parse(ticketChannel.topic);
      } catch (error) {
        return interaction.reply({ content: '❌ Erro ao ler informações do ticket.', ephemeral: true });
      }

      if (!ticketInfo.userId && !ticketInfo.contador) {
        return interaction.reply({ content: '❌ Este canal não é um ticket válido.', ephemeral: true });
      }

      try {
        await ticketChannel.permissionOverwrites.create(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      } catch (err) {
        const existingOverwrite = ticketChannel.permissionOverwrites.cache?.get(user.id);
        if (existingOverwrite) {
          await existingOverwrite.edit({
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
        }
      }

      await interaction.reply(`✅ ${user} foi convidado para visualizar o ticket.`);

      try {
        await user.send(`📬 Você foi convidado para visualizar um ticket no servidor **${interaction.guild.name}**. Canal: ${ticketChannel}`);
      } catch (error) {
        console.log(`Não foi possível enviar DM para ${user.tag}:`, error.message);
      }
    }
  }
};
