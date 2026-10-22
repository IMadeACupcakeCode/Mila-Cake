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

    if (queue) {
      await Promise.resolve(queue.stop()).catch(() => {});
    }
    client.musicIdleTimers?.get(interaction.guildId)?.unref?.();
    const timer = client.musicIdleTimers?.get(interaction.guildId);
    if (timer) clearTimeout(timer);
    client.musicIdleTimers?.delete(interaction.guildId);
    await Promise.resolve(client.distube.voices.leave(interaction.guildId)).catch(() => {});

    return interaction.reply({ content: '🚪 Saí do canal de voz.', ephemeral: true });
  },
};
