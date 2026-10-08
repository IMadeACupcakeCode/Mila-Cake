const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'playlist',
    description: 'Reproduz uma playlist por URL',
    options: [{ name: 'url', description: 'URL da playlist do YouTube, Spotify ou SoundCloud', type: 3, required: true }],
  },
  async execute(interaction, client) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) return interaction.reply({ content: '❌ Entre em um canal de voz primeiro.', ephemeral: true });
    const url = interaction.options?.getString('url') || (interaction.content || '').replace(/^[$/]playlist\s*/i, '').trim();
    if (!url) return interaction.reply({ content: '❌ Informe a URL da playlist.', ephemeral: true });
    if (interaction.replied || interaction.deferred) return;
    await interaction.deferReply({ ephemeral: true });
    try {
      await client.distube.play(voiceChannel, url, { member: interaction.member, textChannel: interaction.channel, message: interaction.message });
      await interaction.editReply({ content: '✔️ Playlist adicionada à fila.', components: [] });
    } catch (erro) {
      console.error('Erro ao tocar playlist:', erro);
      await interaction.editReply({ content: `❌ Não consegui tocar essa playlist.\n\`${(erro?.message || erro).toString().replace(/\s+/g, ' ').slice(0, 180)}\`` }).catch(() => {});
    }
  },
};
