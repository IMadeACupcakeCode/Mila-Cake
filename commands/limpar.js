const { PermissionFlagsBits, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { botao } = require('../utils/ui');

module.exports = {
  data: { name: 'limpar', description: '🧹 Apaga mensagens recentes do canal' },
  async execute(interaction) {
    const qtd = interaction.options.getInteger('quantidade');
    const row = new ActionRowBuilder().addComponents(
      botao('✅ Confirmar', 'limpar_sim', ButtonStyle.Danger, '🧹'),
      botao('❌ Cancelar', 'limpar_nao', ButtonStyle.Secondary, '❌')
    );
    const embed = criarEmbed({
      titulo: '🧹 Confirmar limpeza',
      descricao: `Vou apagar **${qtd}** mensagens deste canal. Confirma?`,
      cor: THEME.corErro,
    });
    const resposta = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const coletor = resposta.createMessageComponentCollector({ time: 30000, filter: (i) => i.user.id === interaction.user.id });
    coletor.on('collect', async (i) => {
      if (i.customId === 'limpar_nao') {
        try {
          await i.update({ embeds: [criarEmbed({ titulo: 'Cancelado', descricao: 'Nada foi apagado.', cor: THEME.corSucesso })], components: [] });
        } catch {
          // Ignora se a mensagem já foi deletada
        }
        return;
      }
      try {
        const apagadas = await interaction.channel.bulkDelete(qtd, true);
        const motivos = [];
        if (apagadas.size < qtd) {
          motivos.push('Algumas mensagens não puderam ser apagadas (muito antigas, do sistema ou já removidas).');
        }
        const descricao = [
          `Apaguei **${apagadas.size}** de **${qtd}** mensagens.`,
          ...(motivos.length ? [`\n⚠️ ${motivos.join(' ')}`] : []),
        ].join('\n');
        await i.update({
          embeds: [criarEmbed({ titulo: '🧹 Limpeza feita', descricao, cor: THEME.corSucesso })],
          components: [],
        });
      } catch (erro) {
        try {
          const texto = erro && erro.code === 10008
            ? 'A mensagem de confirmação sumiu. Tente novamente.'
            : erro.message;
          await i.update({ embeds: [criarEmbed({ titulo: 'Erro', descricao: texto, cor: THEME.corErro })], components: [] });
        } catch {
          // Silêncio — não conseguimos nem responder o erro
        }
      }
    });
    coletor.on('end', async () => {
      try {
        await resposta.edit({ components: [] });
      } catch (erro) {
        // Ignora "Unknown Message" — geralmente já foi apagada
        if (!(erro && erro.code === 10008)) {
          console.error('Erro ao limpar componentes do limpar:', erro);
        }
      }
    });
  },
};