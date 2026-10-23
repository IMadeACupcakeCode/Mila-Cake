const { THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');

function formatarUptime(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const dias = Math.floor(s / 86400);
  const horas = Math.floor((s % 86400) / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const partes = [];
  if (dias) partes.push(`${dias}d`);
  if (horas) partes.push(`${horas}h`);
  partes.push(`${minutos}m`);
  return partes.join(' ');
}

module.exports = {
  data: { name: 'status', description: '📡 Mostra o status da Mila Bot' },
  async execute(interaction, client) {
    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    const ping = Math.max(0, Math.round(client.ws.ping));
    const qualidade = Math.max(0, Math.min(100, Math.round(100 - (ping / 500) * 100)));
    const memoria = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const uptime = formatarUptime(process.uptime());
    const cor = qualidade >= 70 ? THEME.corSucesso : qualidade >= 35 ? 0xFACC15 : THEME.corErro;

    const embed = arcade.embedArcade({
      titulo: '📡 Status da Mila Bot',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**Latência:** \`${ping}ms\`\n` +
        `${arcade.barra(qualidade, 100, 12, '🟩', '⬛')}  \`${qualidade}%\` de resposta\n\n` +
        `${THEME.div.linha}\n\n` +
        `🌐 **Servidores:** \`${client.guilds.cache.size}\`\n` +
        `👥 **Usuários em cache:** \`${client.users.cache.size}\`\n` +
        `⏱️ **Uptime:** \`${uptime}\`\n` +
        `🧠 **Memória:** \`${memoria} MB\`\n\n` +
        `**Status:** ♡ Online e cuidando de você~\n\n` +
        `${THEME.div.estrelado}`,
      cor,
      campos: [
        { name: '💓 Latência', value: ping < 150 ? 'Excelente' : ping < 300 ? 'Boa' : 'Instável', inline: true },
        { name: '📡 Conexão', value: qualidade >= 70 ? 'Estável' : qualidade >= 35 ? 'Atenção' : 'Crítica', inline: true },
        { name: '🍰 Versão', value: 'Mila Cake', inline: true },
      ],
      rodape: 'Mila Status · em tempo real',
    });

    await interaction.reply({ embeds: [embed] });
  },
};
