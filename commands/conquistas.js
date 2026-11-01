const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'conquistas',
    description: '🏆 Veja as conquistas da Economia que você já desbloqueou',
    options: [
      {
        name: 'usuario',
        description: 'Ver as conquistas de outra pessoa',
        type: 6,
        required: false,
      },
    ],
  },
  async execute(interaction, client) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) {
      return interaction.reply({ content: '❌ Bots não colecionam conquistas.', ephemeral: true });
    }

    const tema = theme.temaDe(interaction);
    const conquistas = service.listarConquistas(alvo.id);
    const embed = UI.embedConquistas({ tema, client, membro: alvo, conquistas });

    await interaction.reply(UI.comMascote(embed));
  },
};
