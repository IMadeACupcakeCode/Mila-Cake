const { PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');

module.exports = {
  data: { name: 'lentidao', description: '🐌 Define o modo lento (slowmode) do canal' },
  async execute(interaction) {
    const seg = interaction.options.getInteger('segundos');
    try {
      await interaction.channel.setRateLimitPerUser(seg);
      const embed = criarEmbed({
        titulo: '🐌 Modo lento ajustado',
        descricao: seg === 0 ? 'Modo lento desativado.' : `Agora as mensagens precisam de **${seg}s** de intervalo.`,
        cor: THEME.corSucesso,
      });
      await interaction.reply({ embeds: [embed] });
    } catch (erro) {
      // Risco original: expunha erro.message (pode conter info interna).
      console.error('Erro no lentidao:', erro);
      await interaction.reply({ embeds: [criarEmbed({ titulo: 'Erro', descricao: 'Não foi possível ajustar o modo lento.', cor: THEME.corErro })], ephemeral: true });
    }
  },
};