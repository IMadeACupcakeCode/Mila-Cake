const { PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');

module.exports = {
  data: { name: 'aviso', description: '📢 Atalho de aviso em destaque no canal atual' },
  async execute(interaction) {
    const msg = interaction.options.getString('mensagem');
    const embed = criarEmbed({
      titulo: '📢 Aviso',
      descricao: msg,
      cor: THEME.corPrincipal,
      rodape: `Aviso por ${interaction.user.username}`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};