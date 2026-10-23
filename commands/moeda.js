const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');
const store = require('../utils/arcadeStore');

const JOGO = 'moeda';

function embedEscolha(autor) {
  return arcade.embedArcade({
    titulo: '🪙 Mila Casino · Cara ou Coroa',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**${autor.username}**, escolha seu lado.\n` +
      'A moeda gira, o destino decide e a sequência cresce.\n\n' +
      `${THEME.div.linha}\n\n` +
      '🙂 **Cara** · 👑 **Coroa**\n\n' +
      `${THEME.div.estrelado}`,
    cor: THEME.corSecundario,
    thumbnail: autor.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Casino · aposta sem açúcar, só diversão',
  });
}

function embedGirando(escolha, frame) {
  const caras = ['🪙', '🌀', '🪙', '✨'];
  return arcade.embedArcade({
    titulo: '🪙 A moeda está no ar...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${caras[frame % caras.length]}  **Girando...**  ${caras[(frame + 1) % caras.length]}\n\n` +
      `> Você apostou em **${escolha}**.\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corRoleta,
    rodape: 'Mila Casino · não pisca',
  });
}

function embedResultado(autor, escolha, resultado, acertou, stats) {
  const winrate = stats.partidas ? Math.round((stats.vitorias / stats.partidas) * 100) : 0;
  return arcade.embedArcade({
    titulo: acertou ? '🎉 Você acertou!' : '💫 Não foi dessa vez...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `A moeda caiu em **${resultado}** ${resultado === 'Cara' ? '🙂' : '👑'}.\n` +
      `Você apostou em **${escolha}**.\n\n` +
      `${THEME.div.linha}\n\n` +
      `${acertou ? '✅ **Acerto!**' : '❌ **Erro!**'}  ·  🔥 Sequência: **${stats.sequencia}**\n` +
      `📊 Placar: \`${stats.vitorias}V\` · \`${stats.derrotas}D\` · \`${winrate}%\`\n` +
      `🏅 Melhor sequência: **${stats.melhorSequencia}**\n\n` +
      `${THEME.div.estrelado}`,
    cor: acertou ? 0x22C55E : 0xEF4444,
    thumbnail: autor.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Casino · a casa sempre gira de novo',
  });
}

function botoesEscolha() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('moeda_cara').setLabel('Cara').setEmoji('🙂').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('moeda_coroa').setLabel('Coroa').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('moeda_placar').setLabel('Placar').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
}

function botoesResultado() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('moeda_denovo').setLabel('Jogar de novo').setEmoji('🔄').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('moeda_placar').setLabel('Placar').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
}

function embedPlacar() {
  const top = store.top(JOGO, 5, 'vitorias');
  if (!top.length) {
    return arcade.embedArcade({
      titulo: '📊 Placar do Cara ou Coroa',
      descricao: `${THEME.div.bolinhas}\n\nAinda ninguém apostou. Use \`$moeda\` para inaugurar o cassino.\n\n${THEME.div.coracao}`,
      cor: THEME.corSecundario,
    });
  }
  const linhas = top.map((jogador, indice) => {
    const medalha = ['🥇', '🥈', '🥉'][indice] || `**#${indice + 1}**`;
    const winrate = jogador.partidas ? Math.round((jogador.vitorias / jogador.partidas) * 100) : 0;
    return `${medalha} **${arcade.truncar(jogador.nome, 20)}** — \`${jogador.vitorias}V\` · \`${jogador.derrotas}D\` · \`${winrate}%\` · 🔥 ${jogador.melhorSequencia || 0}`;
  });
  return arcade.embedArcade({
    titulo: '📊 Placar do Cara ou Coroa',
    descricao: `${THEME.div.bolinhas}\n\n${linhas.join('\n')}\n\n${THEME.div.coracao}`,
    cor: THEME.corSecundario,
    rodape: 'Mila Casino · top 5',
  });
}

module.exports = {
  data: { name: 'moeda', description: 'Cara ou coroa com aposta, animação e sequência persistente' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    const autor = interaction.user;
    const msg = await interaction.reply({
      embeds: [embedEscolha(autor)],
      components: [botoesEscolha()],
      fetchReply: true,
    });
    if (!msg || !msg.awaitMessageComponent) return;

    while (true) {
      let i;
      try {
        i = await msg.awaitMessageComponent({ time: 60_000 });
      } catch {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }

      if (i.user.id !== autor.id) {
        await i.reply({ content: `🪙 Essa moeda é do **${autor.username}**. Use \`$moeda\` para jogar a sua.`, ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId === 'moeda_placar') {
        await i.reply({ embeds: [embedPlacar()], ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId === 'moeda_denovo') {
        await i.update({ embeds: [embedEscolha(autor)], components: [botoesEscolha()] }).catch(() => {});
        continue;
      }

      if (i.customId === 'moeda_cara' || i.customId === 'moeda_coroa') {
        const escolha = i.customId === 'moeda_cara' ? 'Cara' : 'Coroa';
        await i.update({ embeds: [embedGirando(escolha, 0)], components: [] }).catch(() => {});
        await arcade.sleep(420);
        try { await msg.edit({ embeds: [embedGirando(escolha, 1)], components: [] }); } catch {}
        await arcade.sleep(420);
        try { await msg.edit({ embeds: [embedGirando(escolha, 2)], components: [] }); } catch {}
        await arcade.sleep(420);

        const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
        const acertou = escolha === resultado;
        const stats = store.atualizar(JOGO, autor.id, autor.username, (atual) => {
          atual.partidas = (atual.partidas || 0) + 1;
          if (acertou) {
            atual.vitorias = (atual.vitorias || 0) + 1;
            atual.sequencia = (atual.sequencia || 0) + 1;
            atual.melhorSequencia = Math.max(atual.melhorSequencia || 0, atual.sequencia);
          } else {
            atual.derrotas = (atual.derrotas || 0) + 1;
            atual.sequencia = 0;
          }
          return atual;
        });
        try {
          await msg.edit({
            embeds: [embedResultado(autor, escolha, resultado, acertou, stats)],
            components: [botoesResultado()],
          });
        } catch {}
      }
    }
  },
};
