const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');
const store = require('../utils/arcadeStore');

const JOGO = 'roleta_russa';
const CAMARAS = 6;
const cooldowns = new Map();
const COOLDOWN_MS = 5000;

function tambor(estado, revelar = false) {
  const partes = [];
  for (let i = 1; i <= CAMARAS; i++) {
    if (revelar) {
      partes.push(i === estado.bala ? '🔴' : '⚪');
    } else if (i < estado.atual) {
      partes.push(i === estado.bala ? '🔴' : '⚪');
    } else if (i === estado.atual) {
      partes.push('🎯');
    } else {
      partes.push('⚫');
    }
  }
  return partes.join('');
}

function embedInicio(autor, estado) {
  return arcade.embedArcade({
    titulo: '🔫 Roleta Russa · 6 câmaras',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**${autor.username}**, o tambor está fechado.\n` +
      `Uma bala. Seis câmaras. Você puxa ou para?\n\n` +
      `${tambor(estado)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `💀 **Uma câmara carregada**\n` +
      `🛡️ **Parar** guarda as sobrevivências da rodada\n` +
      `🔥 **Continuar** aumenta a sequência e o risco\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corErro,
    thumbnail: autor.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Russian Roulette · respire fundo',
  });
}

function embedGirando(estado) {
  const giros = ['🎯⚫⚫⚫⚫⚫', '⚫🎯⚫⚫⚫⚫', '⚫⚫🎯⚫⚫⚫', '⚫⚫⚫🎯⚫⚫'];
  return arcade.embedArcade({
    titulo: '🔫 Girando o tambor...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${giros[Math.floor(Math.random() * giros.length)]}\n\n` +
      `**${estado.atual}ª câmara...**\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corSecundario,
    rodape: 'Mila Russian Roulette · o coração acelera',
  });
}

function embedClique(autor, estado) {
  const camara = estado.atual;
  const restantes = Math.max(0, CAMARAS - camara);
  return arcade.embedArcade({
    titulo: '💨 *click* ... câmara vazia!',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**${autor.username}** sobreviveu à **${camara}ª** câmara.\n\n` +
      `${tambor({ ...estado, atual: camara + 1 })}\n\n` +
      `${THEME.div.linha}\n\n` +
      `🔥 Sobrevivências nesta rodada: **${camara}**\n` +
      `😰 Próxima câmara: **${restantes === 0 ? 'morte certa' : `${restantes} restante(s)`}**\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corSucesso,
    thumbnail: autor.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Russian Roulette · a sorte está do seu lado... por enquanto',
  });
}

function embedFim(autor, estado, sobreviveu, stats) {
  const winrate = stats.partidas ? Math.round((stats.sobrevivencias / (stats.sobrevivencias + stats.mortes || 1)) * 100) : 0;
  return arcade.embedArcade({
    titulo: sobreviveu ? '🛡️ Você parou a tempo!' : '💥 BANG! A câmara estava carregada.',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      (sobreviveu
        ? `**${autor.username}** saiu vivo com **${estado.atual - 1}** sobrevivência(s).\n\n`
        : `**${autor.username}** não sobreviveu à **${estado.atual}ª** câmara.\n\n`) +
      `${tambor(estado, true)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `💀 Mortes: **${stats.mortes}** · 🛡️ Sobrevivências: **${stats.sobrevivencias}**\n` +
      `🔥 Sequência: **${stats.sequencia}** · 🏅 Melhor: **${stats.melhorSequencia}**\n` +
      `📊 Aproveitamento: **${winrate}%**\n\n` +
      `${THEME.div.estrelado}`,
    cor: sobreviveu ? THEME.corSucesso : THEME.corErro,
    thumbnail: autor.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Russian Roulette · não tente isso em casa',
  });
}

function botoesInicio() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rr_puxar').setLabel('Puxar o gatilho').setEmoji('🔫').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rr_placar').setLabel('Placar').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
}

function botoesClique() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rr_puxar').setLabel('Puxar de novo').setEmoji('🔫').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rr_parar').setLabel('Parar e sair').setEmoji('🛡️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rr_placar').setLabel('Placar').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
}

function botoesFim() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rr_denovo').setLabel('Jogar de novo').setEmoji('🔄').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('rr_placar').setLabel('Placar').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
}

function embedPlacar() {
  const top = store.top(JOGO, 5, 'sobrevivencias');
  if (!top.length) {
    return arcade.embedArcade({
      titulo: '📊 Placar da Roleta Russa',
      descricao: `${THEME.div.bolinhas}\n\nNinguém sobreviveu o suficiente para entrar no placar. Use \`$roleta_russa\`.\n\n${THEME.div.coracao}`,
      cor: THEME.corSecundario,
    });
  }
  const linhas = top.map((jogador, indice) => {
    const medalha = ['🥇', '🥈', '🥉'][indice] || `**#${indice + 1}**`;
    return `${medalha} **${arcade.truncar(jogador.nome, 20)}** — 🛡️ \`${jogador.sobrevivencias || 0}\` · 💀 \`${jogador.mortes || 0}\` · 🔥 \`${jogador.melhorSequencia || 0}\``;
  });
  return arcade.embedArcade({
    titulo: '📊 Placar da Roleta Russa',
    descricao: `${THEME.div.bolinhas}\n\n${linhas.join('\n')}\n\n${THEME.div.coracao}`,
    cor: THEME.corSecundario,
    rodape: 'Mila Russian Roulette · top 5',
  });
}

function novoEstado() {
  return {
    bala: Math.floor(Math.random() * CAMARAS) + 1,
    atual: 1,
  };
}

module.exports = {
  data: { name: 'roleta_russa', description: '🔫 Roleta russa interativa: puxe o gatilho ou pare a tempo' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    const agora = Date.now();
    const ultimoUso = cooldowns.get(interaction.user.id) || 0;
    if (agora - ultimoUso < COOLDOWN_MS) {
      const restante = Math.ceil((COOLDOWN_MS - (agora - ultimoUso)) / 1000);
      return interaction.reply({
        embeds: [
          arcade.embedArcade({
            titulo: '⏱️ Calma!',
            descricao: `${THEME.div.bolinhas}\n\nEspere mais **${restante}s** antes de girar o tambor novamente.\n\n${THEME.div.coracao}`,
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }
    cooldowns.set(interaction.user.id, agora);

    const autor = interaction.user;
    let estado = novoEstado();
    let stats = store.atualizar(JOGO, autor.id, autor.username, (atual) => atual);

    const msg = await interaction.reply({
      embeds: [embedInicio(autor, estado)],
      components: [botoesInicio()],
      fetchReply: true,
    });
    if (!msg || !msg.awaitMessageComponent) return;

    while (true) {
      let i;
      try {
        i = await msg.awaitMessageComponent({ time: 90_000 });
      } catch {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }

      if (i.user.id !== autor.id) {
        await i.reply({ content: `🔫 Essa roleta é do **${autor.username}**. Use \`$roleta_russa\` para jogar a sua.`, ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId === 'rr_placar') {
        await i.reply({ embeds: [embedPlacar()], ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId === 'rr_denovo') {
        estado = novoEstado();
        await i.update({ embeds: [embedInicio(autor, estado)], components: [botoesInicio()] }).catch(() => {});
        continue;
      }

      if (i.customId === 'rr_puxar') {
        await i.update({ embeds: [embedGirando(estado)], components: [] }).catch(() => {});
        await arcade.sleep(550);
        try { await msg.edit({ embeds: [embedGirando(estado)], components: [] }); } catch {}
        await arcade.sleep(550);

        if (estado.atual === estado.bala) {
          stats = store.atualizar(JOGO, autor.id, autor.username, (atual) => {
            atual.partidas = (atual.partidas || 0) + 1;
            atual.mortes = (atual.mortes || 0) + 1;
            atual.sobrevivencias = (atual.sobrevivencias || 0) + (estado.atual - 1);
            atual.melhorSequencia = Math.max(atual.melhorSequencia || 0, estado.atual - 1);
            atual.sequencia = 0;
            return atual;
          });
          try { await msg.edit({ embeds: [embedFim(autor, estado, false, stats)], components: [botoesFim()] }); } catch {}
          continue;
        }

        try { await msg.edit({ embeds: [embedClique(autor, estado)], components: [botoesClique()] }); } catch {}
        estado.atual += 1;
        continue;
      }

      if (i.customId === 'rr_parar') {
        stats = store.atualizar(JOGO, autor.id, autor.username, (atual) => {
          const ganhas = Math.max(0, estado.atual - 1);
          atual.partidas = (atual.partidas || 0) + 1;
          atual.sobrevivencias = (atual.sobrevivencias || 0) + ganhas;
          atual.sequencia = (atual.sequencia || 0) + ganhas;
          atual.melhorSequencia = Math.max(atual.melhorSequencia || 0, atual.sequencia);
          return atual;
        });
        await i.update({ embeds: [embedFim(autor, estado, true, stats)], components: [botoesFim()] }).catch(() => {});
        continue;
      }
    }
  },
};
