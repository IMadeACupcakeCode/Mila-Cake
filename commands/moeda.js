const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { botao } = require('../utils/ui');
const { mostrarDigitando } = require('../utils/milaDecoracao');

function caraOuCoroa() {
  return Math.random() < 0.5 ? 'Cara' : 'Coroa';
}

function embedMoeda(resultado, autor) {
  return criarEmbed({
    titulo: '🪙 A moeda girou...',
    descricao: `${THEME.div.bolinhas}\n\n**${resultado}**! ${resultado === 'Cara' ? '🙂' : '♡'}\n\n${THEME.div.linha}`,
    cor: THEME.corSecundario,
    rodape: rodapeAleatorio(),
  });
}

module.exports = {
  data: { name: 'moeda', description: 'Cara ou coroa, com botão para jogar de novo' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 800);
    const resultado = caraOuCoroa();
    const row = new (require('discord.js').ActionRowBuilder)().addComponents(
      botao('🔄 Jogar de novo', 'moeda_reroll', require('discord.js').ButtonStyle.Primary, '🔄')
    );
    const resposta = await interaction.reply({
      embeds: [embedMoeda(resultado, interaction.user.username)],
      components: [row],
      fetchReply: true,
    });

    const coletor = resposta.createMessageComponentCollector({ time: 60000, filter: () => true });
    coletor.on('collect', async (i) => {
      if (i.customId === 'moeda_reroll') {
        await i.update({ embeds: [embedMoeda(caraOuCoroa(), interaction.user.username)], components: [row] });
      }
    });
    coletor.on('end', async () => {
      try {
        await resposta.edit({ components: [] });
      } catch {}
    });
  },
};
