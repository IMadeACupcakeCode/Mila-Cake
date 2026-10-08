const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

// Cooldown de 24 horas (em ms)
const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  data: {
    name: 'diario',
    description: 'Resgate sua quantidade de açúcares todos os dias!',
  },
  async execute(interaction) {
    const user = db.getUsuario(interaction.user.id);
    const agora = Date.now();

    if (user.cooldown_diario && agora - user.cooldown_diario < COOLDOWN) {
      const restam = COOLDOWN - (agora - user.cooldown_diario);
      const horas = Math.floor(restam / (1000 * 60 * 60));
      const minutos = Math.floor((restam % (1000 * 60 * 60)) / (1000 * 60));

      return interaction.reply({
        content: `❌ Você já resgatou seus biscoitos diários hoje! Volte daqui a **${horas}h e ${minutos}m**! ⏱️`,
        ephemeral: true
      });
    }

    // Ganhar entre 200 e 800 doces
    const quantidade = Math.floor(Math.random() * 600) + 200;

    // Atualizar no banco
    db.addAcucares(interaction.user.id, quantidade);
    db.db.prepare('UPDATE usuarios SET cooldown_diario = ? WHERE id = ?').run(agora, interaction.user.id);

    const embed = criarEmbed({
      titulo: '🧁 Resgate Diário',
      descricao: `Parabéns confeiteiro! Você acabou de receber:\n\n**+${quantidade} 🍬 Açúcares!**\n\n${THEME.div.coracao}\nNão se esqueça de voltar amanhã!`,
      cor: THEME.corSucesso,
      thumbnail: interaction.user.displayAvatarURL()
    });

    await interaction.reply({ embeds: [embed] });
  }
};
