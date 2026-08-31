const { ActionRowBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { botao } = require('../utils/ui');
const { mostrarDigitando } = require('../utils/milaDecoracao');

const RESPOSTAS = [
  'Sim, meu favorito~ ♡',
  'Claro que sim! ✨',
  'Com certeza, pode contar com isso.',
  'A Mila disse sim! 💕',
  'Tudo indica que sim~',
  'Provavelmente. ⋆｡°✩',
  'As estrelas tão a seu favor~',
  'Não posso prever agora... pergunta depois~',
  'Melhor não te dizer agora. 🌫️',
  'Não, meu favorito... 💔',
  'A Mila disse não. 😿',
  'Absolutamente não! 🚫',
  'Nem pensar, bb~',
  'As chances são mínimas... 🌑',
  'Não conte com isso. 💫',
];

function embed8(pergunta, autor) {
  const resposta = RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)];
  return criarEmbed({
    titulo: '🔮 A Mila consultou a bolinha mágica',
    descricao: `${THEME.div.bolinhas}\n\n> ${pergunta}\n\n${THEME.div.linha}\n\n**${resposta}**\n\n${THEME.div.estrelado}`,
    cor: THEME.corPrincipal,
    rodape: rodapeAleatorio(),
  });
}

module.exports = {
  data: { name: '8ball', description: 'A bola mágica responde sua pergunta' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 1000);
    const pergunta = interaction.options.getString('pergunta');
    const row = new ActionRowBuilder().addComponents(
      botao('🔄 Perguntar de novo', '8ball_reroll', ButtonStyle.Primary, '🔄')
    );
    const resposta = await interaction.reply({
      embeds: [embed8(pergunta, interaction.user.username)],
      components: [row],
      fetchReply: true,
    });
    const coletor = resposta.createMessageComponentCollector({ time: 60000, filter: () => true });
    coletor.on('collect', async (i) => {
      if (i.customId === '8ball_reroll') {
        await i.update({ embeds: [embed8(pergunta, interaction.user.username)], components: [row] });
      }
    });
    coletor.on('end', async () => {
      try {
        await resposta.edit({ components: [] });
      } catch {}
    });
  },
};
