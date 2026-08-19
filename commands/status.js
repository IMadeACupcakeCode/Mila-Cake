const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');

module.exports = {
  data: { name: 'status', description: '📡 Mostra o status da Mila Bot' },
  async execute(interaction, client) {
    const ping = Math.round(client.ws.ping);
    const embed = criarEmbed({
      titulo: '📡 Status da Mila Bot',
      descricao:
        `**Latência:** \`${ping}ms\`\n` +
        `**Servidores:** \`${client.guilds.cache.size}\`\n` +
        `**Usuários:** \`${client.users.cache.size}\`\n` +
        `${THEME.div.linha}\n` +
        `**Status:** ♡ Online e cuidando de você~`,
      cor: THEME.corSucesso,
      rodape: rodapeAleatorio(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};
