module.exports = {
  data: { name: 'ping', description: '🏓 Testa a latência da Mila Bot' },
  async execute(interaction) {
    return interaction.reply({ content: 'Pong! ⋆｡°✩', ephemeral: true });
  },
};
