const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');

function embedGirando(opcoes, indice) {
  return arcade.embedArcade({
    titulo: '🎡 A roleta está girando...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${arcade.setaRoleta(opcoes, indice)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `> O destino está escolhendo...\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corRoleta,
    rodape: 'Mila Roleta · sem viés, só caos organizado',
  });
}

function embedFinal(opcoes, indice) {
  return arcade.embedArcade({
    titulo: '🎡 A roleta parou!',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${arcade.setaRoleta(opcoes, indice)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `**✦ Escolhida: \`${opcoes[indice]}\`**\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corRoleta,
    rodape: `Mila Roleta · ${opcoes.length} opções giraram`,
  });
}

function botoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('roleta_reroll').setLabel('Girar de novo').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

async function animarGiro(msg, opcoes, indiceFinal) {
  await arcade.sleep(350);
  try { await msg.edit({ embeds: [embedGirando(opcoes, 1 % opcoes.length)], components: [] }); } catch {}
  await arcade.sleep(350);
  try { await msg.edit({ embeds: [embedGirando(opcoes, 2 % opcoes.length)], components: [] }); } catch {}
  await arcade.sleep(350);
  try { await msg.edit({ embeds: [embedGirando(opcoes, indiceFinal)], components: [] }); } catch {}
  await arcade.sleep(400);
  try { await msg.edit({ embeds: [embedFinal(opcoes, indiceFinal)], components: [botoes()] }); } catch {}
}

module.exports = {
  data: {
    name: 'roleta',
    description: 'Sorteia uma opção entre várias, com animação de roleta',
    options: [{ name: 'opcoes', description: 'Duas ou mais opções separadas por vírgula', type: 3, required: true, max_length: 1000 }],
  },

  async execute(interaction) {
    const bruto = interaction.options?.getString('opcoes') || '';
    const opcoes = bruto
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (opcoes.length < 2) {
      return interaction.reply({
        embeds: [
          arcade.embedArcade({
            titulo: '🎡 Opções insuficientes',
            descricao:
              'Preciso de **pelo menos duas opções**, separadas por vírgula.\n\n' +
              'Exemplo: `/roleta opcoes: pizza, sushi, hambúrguer`',
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }

    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    const autor = interaction.user;
    const indiceFinal = Math.floor(Math.random() * opcoes.length);

    const msg = await interaction.reply({
      embeds: [embedGirando(opcoes, 0)],
      components: [],
      fetchReply: true,
    });
    if (!msg || !msg.edit) return;
    await animarGiro(msg, opcoes, indiceFinal);

    while (true) {
      let i;
      try {
        i = await msg.awaitMessageComponent({ time: 60_000 });
      } catch {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }

      if (i.user.id !== autor.id) {
        await i.reply({ content: `🎡 Essa roleta é do **${autor.username}**. Use \`/roleta\` para girar a sua.`, ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId === 'roleta_reroll') {
        const novoIndice = Math.floor(Math.random() * opcoes.length);
        await i.update({ embeds: [embedGirando(opcoes, 0)], components: [] }).catch(() => {});
        await animarGiro(msg, opcoes, novoIndice);
      }
    }
  },
};
