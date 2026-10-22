const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  meta: { guildOnly: true, permissions: ['ManageChannels'] },
  data: { name: 'lentidao', description: '🐌 Define o modo lento (slowmode) do canal', options: [{ name: 'segundos', description: 'Duração entre 0 e 21600 segundos', type: 4, required: true, min_value: 0, max_value: 21600 }] },
  async execute(interaction) {
    // Checagem explícita: o `meta.permissions` cobre o slash e o roteador de
    // prefixo, mas esta guarda impede chamadas diretas de burlarem o limite.
    if (!interaction.member?.permissions?.has?.('ManageChannels')) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Sem permissão', descricao: `${THEME.div.bolinhas}\n\nPreciso que você tenha **Gerenciar Canais** para ajustar o modo lento.\n\n${THEME.div.bolinhas}`, cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    const seg = Number(interaction.options.getInteger('segundos'));
    if (!Number.isFinite(seg) || seg < 0 || seg > 21600) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Valor inválido', descricao: `${THEME.div.bolinhas}\n\nUse um valor entre **0** e **21600** segundos.\n\n${THEME.div.bolinhas}`, cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    await mostrarDigitando(interaction.channel, 600);
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
