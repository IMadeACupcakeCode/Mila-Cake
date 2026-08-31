const { criarEmbed, THEME } = require('../utils/theme');

// Risco original: sem rate limiting, um usuário podia spammar o comando
// roleta_russa, consumindo recursos e enchendo o chat de embeds.
const cooldowns = new Map(); // userId → timestamp do último uso
const COOLDOWN_MS = 5000; // 5 segundos entre usos

module.exports = {
  data: { name: 'roleta_russa', description: '🔫 Uma roleta russa de 6 câmaras. Você sobrevive?' },
  async execute(interaction) {
    // Verifica cooldown
    const agora = Date.now();
    const ultimoUso = cooldowns.get(interaction.user.id) || 0;
    if (agora - ultimoUso < COOLDOWN_MS) {
      const restante = Math.ceil((COOLDOWN_MS - (agora - ultimoUso)) / 1000);
      return interaction.reply({
        embeds: [
          criarEmbed({
            titulo: '⏱️ Calma!',
            descricao: `Espere mais **${restante}s** antes de girar o tambor novamente.`,
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }
    cooldowns.set(interaction.user.id, agora);

    const sobreviveu = Math.random() < 5 / 6;
    const embed = criarEmbed({
      titulo: sobreviveu ? '🔫 *click* ... 💨' : '💥 🔫 *BANG*',
      descricao: sobreviveu
        ? 'A câmara estava vazia. **Você sobreviveu!** 🌙'
        : 'A câmara estava carregada. **Você não sobreviveu...** desta vez. 🌑',
      cor: sobreviveu ? THEME.corSucesso : THEME.corErro,
      rodape: `${THEME.nome} girou o tambor para ${interaction.user.username}`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};