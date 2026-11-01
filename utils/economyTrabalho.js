// utils/economyTrabalho.js
// ── Minigame de trabalho ──────────────────────────────────────────────
// Compartilhado entre /trabalhar e o botão "Trabalhar" do painel, então o
// comportamento é idêntico nos dois caminhos.

const { EmbedBuilder } = require('discord.js');
const service = require('./economyService');
const UI = require('./economyUI');
const theme = require('./economyTheme');
const criador = require('./criador');

const PALAVRAS = [
  'chocolate', 'baunilha', 'morango', 'brigadeiro', 'macaron',
  'ganache', 'caramelo', 'cupcake', 'chantilly', 'açúcar',
  'confeiteiro', 'marzipã', 'croissant', 'sorvete', 'pudim',
];

const SEGUNDOS = 20;
const sessoes = new Set();

async function iniciar(interaction, client) {
  const usuario = interaction.user;
  const tema = theme.temaDe(interaction);

  if (sessoes.has(usuario.id)) {
    return interaction.reply({
      embeds: [
        theme.janelaAviso(
          tema,
          'Turno em andamento',
          'Você já tem um pedido na cozinha!\nTermine o atual antes de pegar outro.',
          { rodape: 'Mila Trabalho · um pedido por vez' }
        ),
      ],
      ephemeral: true,
    });
  }

  const status = service.statusTrabalho(usuario.id);
  if (!status.pronto) {
    return interaction.reply({
      embeds: [
        theme.janelaAviso(
          tema,
          'Cozinha em pausa',
          `Você precisa descansar um pouco.\n\n${tema.marcador} Próximo turno em \`${theme.formatarTempo(status.restante)}\``,
          { cor: tema.cor2, rodape: 'Mila Trabalho · intervalo' }
        ),
      ],
      ephemeral: true,
    });
  }

  const palavra = PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)];
  sessoes.add(usuario.id);

  const embed = UI.embedTrabalhoDesafio({
    tema,
    client,
    membro: usuario,
    palavra,
    segundos: SEGUNDOS,
  });

  await interaction.reply({ embeds: [embed] });

  try {
    const coletado = await interaction.channel.awaitMessages({
      filter: (m) => m.author.id === usuario.id && m.content.trim().toLowerCase() === palavra,
      max: 1,
      time: SEGUNDOS * 1000,
      errors: ['time'],
    });

    if (coletado.size > 0) {
      const resultado = service.concluirTrabalho(usuario.id, { acertou: true });
      if (!resultado.ok) {
        await interaction.followUp({
          embeds: [
            theme.janelaAviso(tema, 'Turno encerrado', 'Não foi possível concluir o pedido agora. Tente novamente mais tarde.', { cor: tema.cor2 }),
          ],
        });
        return;
      }
      await interaction.followUp({
        embeds: [
          UI.embedTrabalhoResultado({ tema, client, membro: usuario, resultado }),
        ],
      });
    }
  } catch {
    const resultado = service.concluirTrabalho(usuario.id, { acertou: false });
    const embedFalha = resultado.ok
      ? UI.embedTrabalhoResultado({ tema, client, membro: usuario, resultado })
      : theme.janelaAviso(tema, 'Tempo esgotado', 'O cliente foi embora. Na próxima, tente ser mais rápido!', { cor: tema.cor2 });
    await interaction.followUp({ embeds: [embedFalha] }).catch(() => {});
  } finally {
    sessoes.delete(usuario.id);
  }
}

module.exports = { PALAVRAS, SEGUNDOS, sessoes, iniciar };
