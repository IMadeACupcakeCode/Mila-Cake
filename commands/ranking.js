const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'ranking',
    description: '🏆 Acompanhe os líderes de açúcares e de nível',
    options: [
      {
        name: 'categoria',
        description: 'Ranking de açúcares ou de nível',
        type: 3,
        required: false,
        choices: [
          { name: '🍬 Açúcares (dinheiro)', value: 'money' },
          { name: '🏆 Nível (XP)', value: 'xp' },
        ],
      },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const categoria = interaction.options?.getString('categoria') || 'money';
    const entradas = service.ranking(categoria, 10);

    const embed = UI.embedRanking({
      tema,
      client,
      categoria,
      entradas,
      membro: interaction.user,
    });

    await interaction.reply(UI.comMascote(embed));
  },
};
