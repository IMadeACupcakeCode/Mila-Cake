const { tocarDespedida } = require('../utils/somEspera');

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'sair',
    description: '🚪 Sai do canal de voz e encerra a música',
  },
  async execute(interaction, client) {
    if (!client.distube) return interaction.reply({ content: '⏳ O player está iniciando. Tente novamente em alguns segundos.', ephemeral: true });
    const queue = client.distube.getQueue(interaction.guildId);
    const voice = client.distube.voices.get(interaction.guildId);

    if (!queue && !voice) {
      return interaction.reply({ content: '❌ Não estou em nenhum canal de voz.', ephemeral: true });
    }

    // A despedida toca antes de desconectar; sem deferir, o áudio (~3s) passaria
    // do prazo de 3 segundos que o Discord dá para responder a interação.
    await interaction.deferReply({ ephemeral: true });

    if (queue) {
      await Promise.resolve(queue.stop()).catch(() => {});
    }

    // "me deixa dormir mita" antes de sair de fato da call.
    await tocarDespedida(client, interaction.guildId).catch(() => {});

    client.musicIdleTimers?.get(interaction.guildId)?.unref?.();
    const timer = client.musicIdleTimers?.get(interaction.guildId);
    if (timer) clearTimeout(timer);
    client.musicIdleTimers?.delete(interaction.guildId);
    await Promise.resolve(client.distube.voices.leave(interaction.guildId)).catch(() => {});

    return interaction.editReply({ content: '🚪 Saí do canal de voz.' });
  },
};
