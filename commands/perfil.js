const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

module.exports = {
  data: {
    name: 'perfil',
    description: 'Veja o seu perfil da doceria (ou de um amigo)! 🧁',
    options: [
      {
        name: 'usuario',
        description: 'Perfil de um amigo',
        type: 6, // USER
        required: false
      }
    ]
  },
  async execute(interaction) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) {
      return interaction.reply({ content: '❌ Bots não podem colecionar doces e ter níveis!', ephemeral: true });
    }

    const { acucares, level, xp, titulo_personalizado } = db.getUsuario(alvo.id);
    const xpProxLevel = level * 1000;

    // Cálculo de progresso de barra
    const percent = Math.floor((xp / xpProxLevel) * 10);
    const barra = '🟩'.repeat(percent) + '⬜'.repeat(10 - percent);

    const embed = criarEmbed({
      titulo: `Perfil de ${alvo.username}`,
      descricao: `**${titulo_personalizado}**\n\n${THEME.div.pontos}`,
      cor: THEME.corLogo || THEME.corSecundario,
      thumbnail: alvo.displayAvatarURL({ dynamic: true, size: 256 })
    });

    embed.addFields([
      { name: 'Nível (Level)', value: `📈 Nível **${level}**`, inline: true },
      { name: 'Conta Corrente', value: `🍬 **${acucares.toLocaleString('pt-BR')}** Açúcares`, inline: true },
      { name: 'Experiência (XP)', value: `✨ ${xp} / ${xpProxLevel}\n[${barra}]`, inline: false }
    ]);

    await interaction.reply({ embeds: [embed] });
  }
};
