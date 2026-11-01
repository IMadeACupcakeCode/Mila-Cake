const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'extrato',
    description: '🧾 Veja as últimas movimentações da sua conta',
    options: [
      {
        name: 'quantidade',
        description: 'Quantas linhas mostrar (1–25)',
        type: 4,
        required: false,
        min_value: 1,
        max_value: 25,
      },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const limite = Math.max(1, Math.min(25, Number(interaction.options?.getInteger('quantidade')) || 10));
    const transacoes = service.extrato(interaction.user.id, limite);

    const embed = UI.embedExtrato({
      tema,
      client,
      membro: interaction.user,
      transacoes,
    });

    await interaction.reply(UI.comMascote(embed));
  },
};
