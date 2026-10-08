const { SlashCommandBuilder } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { criarSelectModo, criarSelectDificuldade, criarBotoesJogo, criarEmbedRanking, criarBotoesRanking, JOGOS } = require('../utils/forcaManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forca')
    .setDescription('🎪 Abre o jogo da Forca da Mila')
    .addStringOption((option) => option
      .setName('acao')
      .setDescription('Abrir painel ou ver ranking')
      .setRequired(false)
      .addChoices({ name: 'painel', value: 'painel' }, { name: 'ranking', value: 'ranking' })),
  async execute(interaction) {
    const acao = interaction.options.getString('acao') || 'painel';
    if (acao === 'ranking') {
      return interaction.reply({ embeds: [criarEmbedRanking('total')], components: [criarBotoesRanking()] });
    }
    const embed = criarEmbed({
      titulo: '🎪 Jogo da Forca',
      descricao: 'Escolha o modo e a dificuldade para começar.',
      cor: 0xD4A017,
      rodape: `${THEME.nome} • Jogo da Forca`,
    });
    const resposta = await interaction.reply({
      embeds: [embed],
      components: [criarSelectModo(), criarSelectDificuldade(), criarBotoesJogo()],
      fetchReply: true,
    });
    JOGOS.set(resposta.id, { userId: interaction.user.id });
    return resposta;
  },
};
