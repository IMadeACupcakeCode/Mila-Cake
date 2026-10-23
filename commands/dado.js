const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const { avaliar, formatar } = require('../utils/dice');
const arcade = require('../utils/arcade');

function rolarDados(notacao, rng = Math.random) {
  return avaliar(notacao, rng);
}

function embedRolando(notacao, frame) {
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const a = faces[(frame * 2) % faces.length];
  const b = faces[(frame * 2 + 3) % faces.length];
  return arcade.embedArcade({
    titulo: '🎲 Rolando os dados...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**${a}  ${b}  ${a}**\n\n` +
      `> \`${notacao}\`\n\n` +
      `${['Os dados estão no ar...', 'Quicando na mesa...', 'A lua está decidindo...'][frame % 3]}\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corDado,
    rodape: 'Mila Dice · resultados honestos, prometo',
  });
}

function embedResultado(resultado, detalhado = false) {
  const rolagens = resultado.folhas
    .map((folha) => `\`${folha.texto}\`: ${folha.rolagens.map((v) => `\`${v}\``).join(' · ')} → **${folha.valor}**`)
    .join('\n');
  const embed = arcade.embedArcade({
    titulo: '🎲 Resultado dos dados',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `# ${resultado.total}\n\n` +
      `**Expressão:** \`${resultado.expressao}\`\n\n` +
      `${detalhado ? `**Cálculo:** \`${resultado.normalizada}\` = \`${resultado.total}\`\n\n` : ''}` +
      `${THEME.div.estrelado}`,
    cor: THEME.corDado,
    campos: [
      { name: '🎲 Rolagens', value: arcade.truncar(rolagens || '—', 1024), inline: false },
      { name: '🧮 Termos', value: `\`${resultado.termos}\``, inline: true },
      { name: '🎯 Total', value: `\`${resultado.total}\``, inline: true },
    ],
    rodape: detalhado ? 'Mila Dice · cálculo completo' : 'Mila Dice · use o botão para ver o cálculo',
  });
  return embed;
}

function botoes(detalhado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dado_reroll').setLabel('Rolar de novo').setEmoji('🎲').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('dado_detalhar')
      .setLabel(detalhado ? 'Esconder cálculo' : 'Ver cálculo')
      .setEmoji('🧮')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  data: {
    name: 'dado',
    description: 'Rola dados e calcula expressões (ex: 1d20+2 ou 1d20-5+4x6)',
    options: [
      { name: 'notacao', description: 'Expressão de dados, como 1d20-5+4x6', type: 3, required: true, max_length: 100 },
      { name: 'detalhar', description: 'Mostrar o cálculo completo e a precedência', type: 5, required: false },
    ],
  },

  rolarDados,
  avaliar,
  formatar,

  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    const notacao = interaction.options?.getString('notacao') || '';
    let detalhado = interaction.options?.getBoolean('detalhar') || false;

    const resultado = rolarDados(notacao);
    if (!resultado) {
      return interaction.reply({
        embeds: [
          arcade.embedArcade({
            titulo: '🎲 Notação inválida',
            descricao:
              `Não consegui interpretar **\`${arcade.truncar(notacao, 80)}\`**.\n\n` +
              'Use dados, números e `+`, `-`, `x` ou `*`. Exemplos:\n' +
              '`1d20` · `1d20+2` · `1d20-5+4x6`',
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }

    const autor = interaction.user;
    const msg = await interaction.reply({
      embeds: [embedRolando(notacao, 0)],
      components: [],
      fetchReply: true,
    });
    if (!msg || !msg.edit) return;

    await arcade.sleep(500);
    try { await msg.edit({ embeds: [embedRolando(notacao, 1)], components: [] }); } catch {}
    await arcade.sleep(500);
    try { await msg.edit({ embeds: [embedRolando(notacao, 2)], components: [] }); } catch {}
    await arcade.sleep(450);

    let atual = resultado;
    try {
      await msg.edit({ embeds: [embedResultado(atual, detalhado)], components: [botoes(detalhado)] });
    } catch {
      return;
    }

    while (true) {
      let i;
      try {
        i = await msg.awaitMessageComponent({ time: 90_000 });
      } catch {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }

      if (i.user.id !== autor.id) {
        await i.reply({ content: `🎲 Esses dados são do **${autor.username}**. Use \`$dado\` para rolar os seus.`, ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId === 'dado_detalhar') {
        detalhado = !detalhado;
        await i.update({ embeds: [embedResultado(atual, detalhado)], components: [botoes(detalhado)] }).catch(() => {});
        continue;
      }

      if (i.customId === 'dado_reroll') {
        await i.update({ embeds: [embedRolando(notacao, 0)], components: [] }).catch(() => {});
        await arcade.sleep(450);
        try { await msg.edit({ embeds: [embedRolando(notacao, 1)], components: [] }); } catch {}
        await arcade.sleep(450);
        try { await msg.edit({ embeds: [embedRolando(notacao, 2)], components: [] }); } catch {}
        await arcade.sleep(400);
        atual = rolarDados(notacao) || atual;
        try {
          await msg.edit({ embeds: [embedResultado(atual, detalhado)], components: [botoes(detalhado)] });
        } catch {}
      }
    }
  },
};
