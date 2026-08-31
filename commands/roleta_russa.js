const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

// Risco original: sem rate limiting, um usuário podia spammar o comando
// roleta_russa, consumindo recursos e enchendo o chat de embeds.
const cooldowns = new Map(); // userId → timestamp do último uso
const COOLDOWN_MS = 5000; // 5 segundos entre usos

module.exports = {
  data: { name: 'roleta_russa', description: '🔫 Uma roleta russa de 6 câmaras. Você sobrevive?' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 1200);
    // Verifica cooldown
    const agora = Date.now();
    const ultimoUso = cooldowns.get(interaction.user.id) || 0;
    if (agora - ultimoUso < COOLDOWN_MS) {
      const restante = Math.ceil((COOLDOWN_MS - (agora - ultimoUso)) / 1000);
      return interaction.reply({
        embeds: [
          criarEmbed({
            titulo: '⏱️ Calma!',
            descricao: `${THEME.div.bolinhas}\n\nEspere mais **${restante}s** antes de girar o tambor novamente.\n\n${THEME.div.coracao}`,
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
        ? `${THEME.div.bolinhas}\n\nA câmara estava vazia. **Você sobreviveu!** 🌙\n\n${THEME.div.coracao}`
        : `${THEME.div.bolinhas}\n\nA câmara estava carregada. **Você não sobreviveu...** desta vez. 🌑\n\n${THEME.div.estrelado}`,
      cor: sobreviveu ? THEME.corSucesso : THEME.corErro,
      rodape: `${THEME.nome} girou o tambor para ${interaction.user.username}`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};