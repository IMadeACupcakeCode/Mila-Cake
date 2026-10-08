const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

module.exports = {
  data: {
    name: 'ranking',
    description: 'Acompanhe os top líderes confeiteiros do servidor! 🏆',
    options: [
      {
        name: 'categoria',
        description: 'Ranking de XP (Nível) ou Economia (Açúcares)',
        type: 3, // STRING
        required: false,
        choices: [
          { name: '🏆 Nível (XP)', value: 'xp' },
          { name: '🍬 Dinheiro (Açúcares)', value: 'money' }
        ]
      }
    ]
  },
  async execute(interaction, client) {
    const defaultMode = interaction.options?.getString('categoria') || 'xp';
    const isMoney = defaultMode === 'money';

    // Pega o top 10
    const top = isMoney ? db.getTopAcucares(10) : db.getTopLevel(10);

    if (top.length === 0) {
      return interaction.reply({ content: '💨 Ninguém jogou ou enviou mensagens no ranking ainda...', ephemeral: true });
    }

    let medalhas = ['🥇', '🥈', '🥉'];
    let texto = top.map((entry, index) => {
      // Tenta resolver o usuario para pegar o username (com fallback local se possivel, se nao usar tag)
      // Como o DB compartilha entre a guild/servidores, exibimos apenas o mention
      let tag = index < 3 ? medalhas[index] : `**#${index + 1}**`;

      if (isMoney) {
        return `${tag} <@${entry.id}> — **${entry.acucares.toLocaleString('pt-br')}** Açúcares`;
      } else {
        return `${tag} <@${entry.id}> — **Nível ${entry.level}** (${entry.xp} XP)`;
      }
    }).join('\n');

    const embed = criarEmbed({
      titulo: isMoney ? '🏆 Os Mais Ricos (Açúcares)' : '🏆 Maiores Níveis da Mila',
      descricao: `${THEME.div.estrelado}\n\n${texto}\n\n${THEME.div.bolinhas}`,
      cor: THEME.corRoleta || THEME.corPrincipal,
    });

    await interaction.reply({ embeds: [embed] });
  }
};
