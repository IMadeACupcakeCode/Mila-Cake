const { criarEmbed, THEME } = require('../utils/theme');
const ajuda = require('../utils/ajudaComando');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: {
    name: 'ajuda',
    description: '📚 Explica qualquer comando da Mila, com busca e páginas',
    options: [
      {
        name: 'comando',
        description: 'Nome ou termo do comando que você quer entender',
        type: 3,
        required: false,
        max_length: 100,
      },
    ],
  },

  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 400);
    let termo = interaction.options.getString('comando');
    if (termo && ['?', 'ajuda', 'help', '--help', '-h'].includes(termo.toLowerCase())) termo = null;

    if (termo) {
      const entrada = ajuda.buscar(termo);
      if (!entrada) {
        const sugestoes = ajuda
          .todas()
          .filter((e) => e.nome.includes(String(termo).toLowerCase()))
          .slice(0, 8)
          .map((e) => `\`${e.nome}\``)
          .join(' · ');
        return interaction.reply({
          embeds: [
            criarEmbed({
              titulo: 'Não encontrei esse comando',
              descricao:
                `${THEME.div.bolinhas}\n\n` +
                `Nada parecido com \`${termo}\`.\n\n` +
                (sugestoes ? `**Talvez você queira:** ${sugestoes}\n\n` : '') +
                'Use `/ajuda` sem nada para ver as categorias.\n\n' +
                `${THEME.div.coracao}`,
              cor: THEME.corErro,
            }),
          ],
          ephemeral: true,
        });
      }
      return interaction.reply({ embeds: [ajuda.paginaComando(entrada)] });
    }

    const paginas = ajuda.paginasAjuda();
    let indice = 0;

    const row = ajuda.montarBotoesNav(indice, paginas.length, 'ajuda');
    await interaction.reply({ embeds: [paginas[indice].embed], components: [row] });
    const mensagem = await interaction.fetchReply().catch(() => null);
    if (!mensagem) return;

    const coletor = mensagem.createMessageComponentCollector({
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    coletor.on('collect', async (i) => {
      if (i.customId === 'ajuda_first') indice = 0;
      else if (i.customId === 'ajuda_prev') indice = Math.max(0, indice - 1);
      else if (i.customId === 'ajuda_next') indice = Math.min(paginas.length - 1, indice + 1);
      else if (i.customId === 'ajuda_last') indice = paginas.length - 1;
      const novaRow = ajuda.montarBotoesNav(indice, paginas.length, 'ajuda');
      await i.update({ embeds: [paginas[indice].embed], components: [novaRow] }).catch(() => {});
    });

    coletor.on('end', async () => {
      try {
        await mensagem.edit({ components: [] });
      } catch {}
    });
  },
};
