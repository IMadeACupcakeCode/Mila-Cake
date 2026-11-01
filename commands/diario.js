const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'diario',
    description: '🧁 Resgate seus açúcares diários e mantenha a sequência',
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const resultado = service.resgatarDiario(interaction.user.id);
    const status = service.statusDiario(interaction.user.id);

    const embed = UI.embedDiario({
      tema,
      client,
      membro: interaction.user,
      resultado,
      status,
    });

    const payload = UI.comMascote(embed);
    if (!resultado.ok) payload.ephemeral = true;
    await interaction.reply(payload);
  },
};
