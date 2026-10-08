const { fecharTicket } = require('../utils/ticketManager');

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'fechar',
    description: '🔒 Inicia o fechamento do ticket atual',
  },
  async execute(interaction, client) {
    if (!interaction.guild || !interaction.channel?.name?.startsWith('ticket-')) {
      return interaction.reply({ content: '❌ Este comando só funciona em canais de ticket.', ephemeral: true });
    }
    return fecharTicket(interaction, client);
  },
};
