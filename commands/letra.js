const { buscarLetra, dividirLetra } = require('../utils/lyrics');
const { criarEmbed, THEME } = require('../utils/theme');

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'letra',
    description: 'Mostra a letra pública da música atual ou pesquisada',
    options: [{ name: 'busca', description: 'Artista e título, opcional', type: 3, required: false }],
  },
  async execute(interaction, client) {
    const busca = interaction.options?.getString('busca');
    const queue = client.distube.getQueue(interaction.guildId);
    if (!busca && !queue?.songs?.[0]) return interaction.reply({ content: '❌ Não há música tocando agora.', ephemeral: true });
    await interaction.deferReply({ ephemeral: false });
    try {
      const resultado = await buscarLetra(busca ? { name: busca } : queue.songs[0]);
      const partes = dividirLetra(resultado.lyrics);
      await interaction.editReply({ embeds: [criarEmbed({ titulo: `🎤 ${resultado.songName}`, descricao: partes[0], cor: THEME.corPrincipal, rodape: `Fonte: ${resultado.source}${partes.length > 1 ? ` · Parte 1/${partes.length}` : ''}` })] });
      for (let indice = 1; indice < partes.length; indice += 1) {
        await interaction.followUp({ embeds: [criarEmbed({ titulo: `🎤 ${resultado.songName} · continuação`, descricao: partes[indice], cor: THEME.corPrincipal, rodape: `Fonte: ${resultado.source} · Parte ${indice + 1}/${partes.length}` })] });
      }
    } catch (erro) {
      await interaction.editReply(`❌ ${erro.message}`);
    }
  },
};
