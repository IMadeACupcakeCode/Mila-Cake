const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

// Permissões mínimas para a Mila funcionar (tickets, música/voz, embeds,
// moderação leve). Antes o convite pedia Administrador (permissions=8),
// o que entregava controle total do servidor sem necessidade.
const PERMISSOES_CONVITE = [
  'ViewChannel',
  'SendMessages',
  'SendMessagesInThreads',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'ManageMessages',
  'AddReactions',
  'UseExternalEmojis',
  'UseExternalStickers',
  'Connect',
  'Speak',
  'UseVAD',
  'ManageChannels',
  'ManageRoles',
  'MoveMembers',
].reduce((total, nome) => total | (PermissionFlagsBits[nome] || 0n), 0n);

module.exports = {
  data: {
    name: 'convite',
    description: '💌 Me convide para o seu servidor!'
  },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);
    // O ID da própria aplicação é a fonte da verdade; não depende de .env.
    const clientId = interaction.client?.application?.id || interaction.client?.user?.id;
    if (!clientId) {
      return interaction.reply({ content: '❌ Não consegui descobrir meu ID de aplicação agora.', ephemeral: true });
    }
    const link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${PERMISSOES_CONVITE.toString()}&scope=bot%20applications.commands`;

    const btn = new ButtonBuilder().setLabel('💌 Adicionar Mila').setURL(link).setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder().addComponents(btn);

    const embed = criarEmbed({
      titulo: '💌 Me convide!',
      descricao: `${THEME.div.bolinhas}\n\nEstou pronta para ajudar seu servidor! Clique no botão abaixo para autorizar minha entrada.\n\n${THEME.div.coracao}`,
      cor: THEME.corPrincipal,
    });

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
