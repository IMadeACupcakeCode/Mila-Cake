const { PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'lentidao', description: '🐌 Define o modo lento (slowmode) do canal' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);
    const seg = interaction.options.getInteger('segundos');
    try {
      await interaction.channel.setRateLimitPerUser(seg);
      const embed = criarEmbed({
        titulo: '🐌 Modo lento ajustado',
        descricao: seg === 0
          ? `${THEME.div.bolinhas}\n\nModo lento desativado.\n\n${THEME.div.coracao}`
          : `${THEME.div.bolinhas}\n\nAgora as mensagens precisam de **${seg}s** de intervalo.\n\n${THEME.div.estrelado}`,
        cor: THEME.corSucesso,
      });
      await interaction.reply({ embeds: [embed] });
    } catch (erro) {
      console.error('Erro no lentidao:', erro);
      await interaction.reply({ embeds: [criarEmbed({ titulo: 'Erro', descricao: `${THEME.div.bolinhas}\n\nNão foi possível ajustar o modo lento.\n\n${THEME.div.coracao}`, cor: THEME.corErro })], ephemeral: true });
    }
  },
};