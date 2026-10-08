const { PermissionFlagsBits } = require('discord.js');
const { falarInterativo, falarDireto } = require('../utils/sayManager');

module.exports = {
  meta: { guildOnly: true, permissions: ['Administrator'] },
  data: {
    name: 'say',
    description: '💬 Faz a Mila falar neste canal ou abre o painel de fala',
    options: [{ name: 'mensagem', description: 'Mensagem para enviar diretamente neste canal', type: 3, required: false, max_length: 2000 }],
  },
  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Apenas administradores podem usar este comando.', ephemeral: true });
    }
    const mensagem = interaction.options.getString('mensagem');
    if (mensagem) {
      const canal = interaction.channel;
      await canal.send({ content: mensagem, allowedMentions: { parse: [], repliedUser: false } });
      return interaction.reply({ content: '✅ Mensagem enviada.', ephemeral: true });
    }
    return falarInterativo(interaction);
  },
};
