const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'status', description: '📡 Mostra o status da Mila Bot' },
  async execute(interaction, client) {
    await mostrarDigitando(interaction.channel, 700);
    const ping = Math.round(client.ws.ping);
    const embed = criarEmbed({
      titulo: '📡 Status da Mila Bot',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**Latência:** \`${ping}ms\`\n` +
        `**Servidores:** \`${client.guilds.cache.size}\`\n` +
        `**Usuários:** \`${client.users.cache.size}\`\n` +
        `${THEME.div.linha}\n` +
        `**Status:** ♡ Online e cuidando de você~\n\n` +
        `${THEME.div.estrelado}`,
      cor: THEME.corSucesso,
      rodape: rodapeAleatorio(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};
