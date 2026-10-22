module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'join',
    description: '🔊 Entra no seu canal de voz (com a saudação da Mila)',
  },
  async execute(interaction, client) {
    if (!client.distube) {
      return interaction.reply({
        content: '⏳ O player está iniciando. Tente novamente em alguns segundos.',
        ephemeral: true,
      });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Entre em um canal de voz primeiro.', ephemeral: true });
    }

    const atual = client.distube.voices.get(interaction.guildId);
    if (atual?.channel?.id === voiceChannel.id && atual?.connection) {
      return interaction.reply({
        content: `🔊 Já estou em **${voiceChannel.name}**~`,
        ephemeral: true,
      });
    }

    const fila = client.distube.getQueue(interaction.guildId);
    if (atual?.connection && fila?.songs?.length) {
      return interaction.reply({
        content: `❌ Estou tocando música em **${atual.channel?.name || 'outro canal'}**. Use \`/sair\` antes de me chamar para outro canal.`,
        ephemeral: true,
      });
    }

    // Entrar (e tocar a saudação de entrada) pode levar alguns segundos.
    await interaction.deferReply({ ephemeral: false });

    try {
      if (atual?.connection) {
        await Promise.resolve(client.distube.voices.leave(interaction.guildId)).catch(() => {});
      }
      await client.distube.voices.join(voiceChannel);
      return interaction.editReply({ content: `🔊 Entrei em **${voiceChannel.name}**~ ♡` });
    } catch (erro) {
      console.error(`[Música] Falha no /join: ${erro?.message || erro}`);
      return interaction.editReply({
        content: `❌ Não consegui entrar em **${voiceChannel.name}**. Confira minhas permissões de voz.`,
      });
    }
  },
};
