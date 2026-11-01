const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'economia',
    description: '🪟 Abre o painel da Economia da Mila (diário, trabalho, loja e mais)',
  },
  async execute(interaction, client) {
    const dependente = interaction.user;
    const tema = theme.temaDe(interaction);
    const dados = service.carteira(dependente.id);

    const embed = UI.embedHub({
      tema,
      client,
      membro: dependente,
      dados,
    });

    await interaction.reply({
      ...UI.comIcone(embed),
      components: [UI.botoesEconomia('eco')],
    });
  },
};
