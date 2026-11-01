const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'carteira',
    description: '💰 Abre a sua carteira com saldo, nível, posições e histórico',
    options: [
      {
        name: 'usuario',
        description: 'Ver a carteira de outra pessoa',
        type: 6,
        required: false,
      },
    ],
  },
  async execute(interaction, client) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) {
      return interaction.reply({
        content: '❌ Bots não têm carteira — só migalhas de código.',
        ephemeral: true,
      });
    }

    const tema = theme.temaDe(interaction);
    const dados = service.carteira(alvo.id);
    const embed = UI.embedCarteira({ tema, client, membro: alvo, dados });

    await interaction.reply(UI.comMascote(embed));
  },
};
