const { ActionRowBuilder, ButtonStyle } = require('discord.js');

const { criarEmbed, THEME } = require('../utils/theme');
const { botao } = require('../utils/ui');
const { parseTempo, formatarDuracao, formatarDataAbsoluta } = require('../utils/tempo');
const { mostrarDigitando } = require('../utils/milaDecoracao');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const DEFAULT_DURATION_MS = 5 * 60 * 1000; // 5 minutos (padrão automático)

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function formatOptionLines(opcoes, votos) {
  return opcoes
    .map((opcao, index) => {
      const count = votos[opcao] || 0;
      return `${EMOJIS[index]} **${opcao}** — \`${count}\` voto(s)`;
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

function buildEmbed(pergunta, opcoes, votos, author, endsAt, durationMs, closed = false) {
  const descricao = formatOptionLines(opcoes, votos);
  const statusText = closed
    ? '🛑 A votação acabou.'
    : `⏳ Termina em ${formatarDuracao(durationMs)} (${formatarDataAbsoluta(endsAt)})`;

  return criarEmbed({
    titulo: `🗳️ ${pergunta}`,
    descricao: `${descricao}\n\n**${statusText}**`,
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
  data: { name: 'votar', description: '🗳️ Cria uma enquete rápida com botões e tempo customizável', options: [{ name: 'pergunta', description: 'Pergunta da enquete', type: 3, required: true, max_length: 500 }, { name: 'opcoes', description: 'Opções separadas por vírgula', type: 3, required: true, max_length: 1000 }, { name: 'duracao', description: 'Duração como 10m, 1h ou 1d', type: 3, required: false, max_length: 20 }] },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 800);
    let pergunta = interaction.options.getString('pergunta');
    let opcoesRaw = interaction.options.getString('opcoes');
    let duracaoRaw = interaction.options.getString('duracao');

    // If user didn't pass args, try to parse the most recent embed the user posted
    if ((!pergunta || !opcoesRaw) && interaction.channel) {
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 12 });
        const last = msgs.find((m) => m.author && m.author.id === interaction.user.id && m.embeds && m.embeds.length);
        if (last) {
          const emb = last.embeds[0];
          // prefer title as question, else first line of description
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
              // lines[1..n-1] are options, last line might be duration
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
      } catch (err) {
        // ignore fetch errors
      }
    }

    const parsed = parsePollInput(pergunta, opcoesRaw, duracaoRaw);
    if (!parsed || parsed.error) {
      return interaction.reply({
        embeds: [
          criarEmbed({
            titulo: 'Uso do comando `$votar`',
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
    const row = buildButtons(opcoes);
    const embed = buildEmbed(pergunta, opcoes, votos, interaction.user.username, endsAt, durationMs);
    const resposta = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const voters = new Set();
    const collector = resposta.createMessageComponentCollector({ time: durationMs, filter: () => true });

    collector.on('collect', async (buttonInteraction) => {
      const index = Number(buttonInteraction.customId.replace('votar_', ''));
      const userId = buttonInteraction.user.id;
      if (voters.has(userId)) {
        return buttonInteraction.reply({ content: 'Você já votou nesta enquete. 🌙', ephemeral: true });
      }

      voters.add(userId);
      votos[opcoes[index]] += 1;
      const updatedEmbed = buildEmbed(pergunta, opcoes, votos, interaction.user.username, endsAt, Math.max(0, endsAt - Date.now()));
      await buttonInteraction.update({ embeds: [updatedEmbed], components: [row] });
    });

    collector.on('end', async () => {
      const closedRow = buildButtons(opcoes, true);

      // Animated counting sequence
      const frames = ['🔎 Contando votos', '🔎 Contando votos .', '🔎 Contando votos ..', '🔎 Contando votos ...'];
      for (const f of frames) {
        try {
          const anim = criarEmbed({
            titulo: `🗳️ ${pergunta}`,
            descricao: `${formatOptionLines(opcoes, votos)}\n\n**${f}**`,
            cor: THEME.corPrincipal,
            rodape: `Enquete por ${interaction.user.username}`,
          });
          await resposta.edit({ embeds: [anim], components: [closedRow] });
          // small pause for animation
          // eslint-disable-next-line no-await-in-loop
          await sleep(700);
        } catch {}
      }

      // Determine winner
      const counts = Object.values(votos);
      const max = counts.length ? Math.max(...counts) : 0;
      const winners = opcoes.filter((o) => votos[o] === max);
      let resultText;
      if (winners.length === 1) {
        const idx = opcoes.indexOf(winners[0]);
        resultText = `${EMOJIS[idx]} **${winners[0]}** venceu com \`${max}\` voto(s)!`;
      } else if (winners.length > 1) {
        resultText = `Empate entre ${winners.map((w) => `**${w}**`).join(', ')} com \`${max}\` votos`;
      } else {
        resultText = 'Nenhum voto registrado.';
      }

      const finalEmbed = criarEmbed({
        titulo: `Resultado — ${winners.length === 1 ? winners[0] : 'Resultado'}`,
        descricao: `${formatOptionLines(opcoes, votos)}\n\n**${resultText}**\n\nEnquete encerrada~ ♡`,
        cor: 0x8B80FF,
        rodape: `Enquete por ${interaction.user.username}`,
      });

      try {
        await resposta.edit({ embeds: [finalEmbed], components: [closedRow] });
      } catch {}
    });
  },
};
