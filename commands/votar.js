const { ActionRowBuilder, ButtonStyle } = require('discord.js');

const { THEME } = require('../utils/theme');
const { botao } = require('../utils/ui');
const { parseTempo, formatarDuracao, formatarDataAbsoluta } = require('../utils/tempo');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const DEFAULT_DURATION_MS = 5 * 60 * 1000;

function totalVotos(votos) {
  return Object.values(votos).reduce((soma, valor) => soma + (Number(valor) || 0), 0);
}

function formatOptionLines(opcoes, votos) {
  const total = totalVotos(votos);
  return opcoes
    .map((opcao, index) => {
      const count = votos[opcao] || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return (
        `${EMOJIS[index]} **${opcao}** — \`${count}\` voto(s) · \`${pct}%\`\n` +
        `${arcade.barraPorcentagem(pct, 10)}`
      );
    })
    .join('\n');
}

function buildButtons(opcoes, disabled = false) {
  const row = new ActionRowBuilder();
  opcoes.forEach((opcao, index) => {
    row.addComponents(
      botao(opcao.slice(0, 80), `votar_${index}`, ButtonStyle.Primary, EMOJIS[index]).setDisabled(disabled)
    );
  });
  return row;
}

function buildControls(disabled = false) {
  return new ActionRowBuilder().addComponents(
    botao('Encerrar votação', 'votar_encerrar', ButtonStyle.Danger, '🔒').setDisabled(disabled)
  );
}

function buildEmbed(pergunta, opcoes, votos, author, endsAt, durationMs, closed = false, motivo = null) {
  const total = totalVotos(votos);
  const statusText = closed
    ? motivo === 'manual'
      ? '🔒 A votação foi encerrada pelo autor.'
      : '🛑 O tempo da votação acabou.'
    : `⏳ Termina em ${formatarDuracao(durationMs)} (${formatarDataAbsoluta(endsAt)})`;

  return arcade.embedArcade({
    titulo: `🗳️ ${pergunta}`,
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${formatOptionLines(opcoes, votos)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `**${statusText}**\n` +
      `📊 Total: **${total}** voto(s)\n\n` +
      `${THEME.div.estrelado}`,
    cor: closed ? 0x8B80FF : THEME.corPrincipal,
    rodape: `Enquete por ${author}`,
  });
}

function parsePollInput(pergunta, opcoesRaw, duracaoRaw) {
  if (!pergunta || !opcoesRaw) return null;
  const opcoes = opcoesRaw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length)
    .slice(0, 5);

  if (opcoes.length < 2) return null;

  let durationMs = DEFAULT_DURATION_MS;
  if (duracaoRaw) {
    const low = String(duracaoRaw).trim().toLowerCase();
    if (low === 'nada' || low === 'nulo' || low === 'null') {
      // explicit request to use default duration
    } else {
      const parsed = parseTempo(duracaoRaw);
      if (!parsed) return { error: true };
      durationMs = parsed;
    }
  }

  return { opcoes, durationMs };
}

module.exports = {
  data: {
    name: 'votar',
    description: '🗳️ Cria uma enquete rápida com botões, barras e tempo customizável',
    options: [
      { name: 'pergunta', description: 'Pergunta da enquete', type: 3, required: true, max_length: 500 },
      { name: 'opcoes', description: 'Opções separadas por vírgula', type: 3, required: true, max_length: 1000 },
      { name: 'duracao', description: 'Duração como 10m, 1h ou 1d', type: 3, required: false, max_length: 20 },
    ],
  },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    let pergunta = interaction.options?.getString('pergunta');
    let opcoesRaw = interaction.options?.getString('opcoes');
    let duracaoRaw = interaction.options?.getString('duracao');

    // Se o usuário não passou argumentos, tenta aproveitar o último embed dele.
    if ((!pergunta || !opcoesRaw) && interaction.channel) {
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 12 });
        const last = msgs.find((m) => m.author && m.author.id === interaction.user.id && m.embeds && m.embeds.length);
        if (last) {
          const emb = last.embeds[0];
          const contentParts = [];
          if (emb.title) contentParts.push(String(emb.title));
          if (emb.description) contentParts.push(String(emb.description));
          if (emb.fields && emb.fields.length) contentParts.push(emb.fields.map((f) => f.value).join('\n'));
          const text = contentParts.join('\n').trim();
          const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          if (!pergunta && lines[0]) pergunta = lines[0];
          if (!opcoesRaw && lines.length >= 2) {
            if (lines[1].includes(',')) {
              opcoesRaw = lines[1];
            } else if (lines.length > 2) {
              const lastLine = lines[lines.length - 1];
              const maybeDur = String(lastLine).trim();
              const parsedDur = parseTempo(maybeDur);
              if (parsedDur || ['nada', 'nulo', 'null'].includes(maybeDur.toLowerCase())) {
                opcoesRaw = lines.slice(1, -1).join(', ');
                duracaoRaw = duracaoRaw || maybeDur;
              } else {
                opcoesRaw = lines.slice(1).join(', ');
              }
            } else {
              opcoesRaw = lines[1];
            }
          }
          if (!duracaoRaw && lines.length >= 3) {
            duracaoRaw = lines[2];
          }
        }
      } catch {
        // ignore fetch errors
      }
    }

    const parsed = parsePollInput(pergunta, opcoesRaw, duracaoRaw);
    if (!parsed || parsed.error) {
      return interaction.reply({
        embeds: [
          arcade.embedArcade({
            titulo: '🗳️ Uso do comando `$votar`',
            descricao:
              'Use o formato:\n' +
              '`$votar pergunta | opção 1, opção 2, opção 3 | 10m`\n\n' +
              '**Exemplos:**\n' +
              '`$votar Qual jogo jogar? | Minecraft, Valorant, Genshin | 1h`\n' +
              '`$votar Qual tema? | Claro, Escuro | amanhã 18:00`\n\n' +
              'O tempo é opcional e aceita `s`, `m`, `h`, `d`, `hoje 20:00`, `amanhã 14:00`, etc.',
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }

    const { opcoes, durationMs } = parsed;
    const endsAt = Date.now() + durationMs;
    const votos = Object.fromEntries(opcoes.map((opcao) => [opcao, 0]));
    const voters = new Set();
    let row = buildButtons(opcoes);
    let controls = buildControls();
    const embed = buildEmbed(pergunta, opcoes, votos, interaction.user.username, endsAt, durationMs);
    const resposta = await interaction.reply({
      embeds: [embed],
      components: [row, controls],
      fetchReply: true,
    });
    if (!resposta || !resposta.createMessageComponentCollector) return;

    const collector = resposta.createMessageComponentCollector({
      time: durationMs,
      filter: (i) => i.customId.startsWith('votar_'),
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'votar_encerrar') {
        if (buttonInteraction.user.id !== interaction.user.id) {
          return buttonInteraction
            .reply({ content: '🔒 Só quem criou a enquete pode encerrá-la.', ephemeral: true })
            .catch(() => {});
        }
        await buttonInteraction.deferUpdate().catch(() => {});
        collector.stop('manual');
        return;
      }

      const index = Number(buttonInteraction.customId.replace('votar_', ''));
      if (!Number.isInteger(index) || !opcoes[index]) {
        return buttonInteraction.reply({ content: '❌ Opção inválida.', ephemeral: true }).catch(() => {});
      }

      const userId = buttonInteraction.user.id;
      if (voters.has(userId)) {
        return buttonInteraction.reply({ content: 'Você já votou nesta enquete. 🌙', ephemeral: true }).catch(() => {});
      }

      voters.add(userId);
      votos[opcoes[index]] += 1;
      const updatedEmbed = buildEmbed(
        pergunta,
        opcoes,
        votos,
        interaction.user.username,
        endsAt,
        Math.max(0, endsAt - Date.now())
      );
      await buttonInteraction
        .update({ embeds: [updatedEmbed], components: [row, controls] })
        .catch(() => {});
    });

    collector.on('end', async (collected, reason) => {
      row = buildButtons(opcoes, true);
      controls = buildControls(true);
      const motivo = reason === 'manual' ? 'manual' : 'tempo';

      const frames = ['🔎 Contando votos', '🔎 Contando votos .', '🔎 Contando votos ..', '🔎 Contando votos ...'];
      for (const frame of frames) {
        try {
          const anim = buildEmbed(
            pergunta,
            opcoes,
            votos,
            interaction.user.username,
            endsAt,
            0,
            false,
            null
          );
          anim.setDescription(
            `${THEME.div.bolinhas}\n\n${formatOptionLines(opcoes, votos)}\n\n**${frame}**\n\n${THEME.div.estrelado}`
          );
          await resposta.edit({ embeds: [anim], components: [row, controls] });
          await arcade.sleep(500);
        } catch {}
      }

      const counts = Object.values(votos);
      const max = counts.length ? Math.max(...counts) : 0;
      const winners = opcoes.filter((o) => votos[o] === max);
      let resultText;
      if (winners.length === 1 && max > 0) {
        const idx = opcoes.indexOf(winners[0]);
        resultText = `${EMOJIS[idx]} **${winners[0]}** venceu com \`${max}\` voto(s)!`;
      } else if (winners.length > 1 && max > 0) {
        resultText = `Empate entre ${winners.map((w) => `**${w}**`).join(', ')} com \`${max}\` voto(s).`;
      } else {
        resultText = 'Nenhum voto registrado.';
      }

      const finalEmbed = buildEmbed(
        pergunta,
        opcoes,
        votos,
        interaction.user.username,
        endsAt,
        0,
        true,
        motivo
      );
      finalEmbed.setTitle(`🏁 Resultado — ${winners.length === 1 && max > 0 ? winners[0] : 'Enquete encerrada'}`);
      finalEmbed.setDescription(
        `${THEME.div.bolinhas}\n\n${formatOptionLines(opcoes, votos)}\n\n${THEME.div.linha}\n\n**${resultText}**\n\n${THEME.div.estrelado}`
      );
      finalEmbed.setColor(0x8B80FF);

      try {
        await resposta.edit({ embeds: [finalEmbed], components: [row] });
      } catch {}
    });
  },
};
