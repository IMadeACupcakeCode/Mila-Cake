const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'ping', description: '🏓 Testa a latência da Mila Bot' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);
    const ping = Date.now() - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;
    const embed = criarEmbed({
      titulo: '🏓 Pong!',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**Latência:** \`${ping}ms\`\n` +
        `**WebSocket:** \`${ws}ms\`\n\n` +
        `${THEME.div.estrelado}`,
      cor: THEME.corSucesso,
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
