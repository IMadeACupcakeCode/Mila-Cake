const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { THEME } = require('../utils/theme');
const arcade = require('../utils/arcade');
const db = require('../utils/db');
const criador = require('../utils/criador');

const CASA = '000000000000000000';
function escrow(u, v) { if (criador.ehCriador(u)) return true; return db.transferirAcucares(u, CASA, v); }
function pagar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }
function reembolsar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }

const OPCOES = {
  pedra: { emoji: '🪨', bate: ['tesoura'] },
  papel: { emoji: '📄', bate: ['pedra'] },
  tesoura: { emoji: '✂️', bate: ['papel'] },
};

const USO = 'Use: `/jokenpo @oponente <aposta>` ou `$jokenpo @oponente <aposta>`';

async function pedirEscolha(jogador, channel) {
  const r = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`jk_${jogador.id}_pedra`).setLabel('Pedra').setEmoji('🪨').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`jk_${jogador.id}_papel`).setLabel('Papel').setEmoji('📄').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`jk_${jogador.id}_tesoura`).setLabel('Tesoura').setEmoji('✂️').setStyle(ButtonStyle.Primary),
  );
  const m = await channel.send({ content: `${jogador}, escolha sua jogada (30s).`, components: [r] });
  try {
    const i = await m.awaitMessageComponent({ filter: (x) => x.user.id === jogador.id, time: 30000 });
    await i.update({ components: [] }).catch(() => {});
    return i.customId.split('_').pop();
  } catch {
    await m.edit({ components: [] }).catch(() => {});
    return null;
  }
}

async function partida(msg, desafiante, oponente, aposta, client) {
  // escrow
  if (!escrow(desafiante.id, aposta) || !escrow(oponente.id, aposta)) {
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✊ Erro', descricao: 'Saldo insuficiente para a revanche.', cor: THEME.corErro })], components: [] }).catch(() => {});
    return;
  }

  const e1 = await pedirEscolha(desafiante, msg.channel);
  const e2 = await pedirEscolha(oponente, msg.channel);
  if (!e1 || !e2) {
    reembolsar(desafiante.id, aposta);
    reembolsar(oponente.id, aposta);
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✊ Tempo esgotado', descricao: 'Um dos jogadores não escolheu a tempo. Apostas devolvidas.', cor: THEME.corErro })], components: [] }).catch(() => {});
    return;
  }

  await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✊ Jokenpô!', descricao: '🪨 ✂️ 📄\n\nRevelando...', cor: THEME.corRoleta })], components: [] }).catch(() => {});
  await arcade.sleep(1200);

  const ganhouD = OPCOES[e1].bate.includes(e2);
  const ganhouO = OPCOES[e2].bate.includes(e1);
  let empate = false;
  if (ganhouD && !ganhouO) {
    pagar(desafiante.id, aposta * 2);
  } else if (ganhouO && !ganhouD) {
    pagar(oponente.id, aposta * 2);
  } else {
    empate = true;
    reembolsar(desafiante.id, aposta);
    reembolsar(oponente.id, aposta);
  }

  const resultadoTexto = empate
    ? 'Empate! Apostas devolvidas.'
    : ganhouD
      ? `${desafiante} venceu! Ganhou **${aposta * 2}** Açúcares.`
      : `${oponente} venceu! Ganhou **${aposta * 2}** Açúcares.`;

  const row = empate ? new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('jk_revanche').setLabel('Revanche').setEmoji('🔁').setStyle(ButtonStyle.Primary),
  ) : null;

  await msg.edit({
    embeds: [arcade.embedArcade({
      titulo: '✊ Resultado',
      descricao: `${THEME.div.bolinhas}\n\n${desafiante}: ${OPCOES[e1].emoji} **${e1}**\n${oponente}: ${OPCOES[e2].emoji} **${e2}**\n\n${resultadoTexto}\n\n${THEME.div.estrelado}`,
      cor: THEME.corSucesso,
    })],
    components: row ? [row] : [],
  }).catch(() => {});

  if (empate && row) {
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
    collector.on('collect', async (i) => {
      if (i.customId !== 'jk_revanche') return;
      if (i.user.id !== desafiante.id && i.user.id !== oponente.id) {
        await i.reply({ content: 'Apenas os jogadores podem pedir revanche.', ephemeral: true }).catch(() => {});
        return;
      }
      await i.update({ components: [] }).catch(() => {});
      await partida(msg, desafiante, oponente, aposta, client);
    });
  }
}

module.exports = {
  data: {
    name: 'jokenpo',
    description: '✊ Jokenpô (Pedra/Papel/Tesoura) com aposta entre dois jogadores',
    options: [
      { name: 'oponente', description: 'Quem você desafia', type: 6, required: true },
      { name: 'aposta', description: 'Açúcares em jogo', type: 4, required: true, min_value: 1 },
    ],
  },
  async execute(interaction, client) {
    const desafiante = interaction.user;
    const oponente = interaction.options.getUser('oponente');
    const aposta = Number(interaction.options.getInteger('aposta'));
    if (!oponente || oponente.bot) {
      return interaction.reply({ content: `Oponente inválido.\n${USO}`, ephemeral: true });
    }
    if (oponente.id === desafiante.id) {
      return interaction.reply({ content: `Você não pode se desafiar.\n${USO}`, ephemeral: true });
    }
    if (!Number.isInteger(aposta) || aposta < 1) {
      return interaction.reply({ content: `Aposta inválida.\n${USO}`, ephemeral: true });
    }

    const sd = criador.ehCriador(desafiante.id) ? Infinity : db.getUsuario(desafiante.id).acucares;
    const so = criador.ehCriador(oponente.id) ? Infinity : db.getUsuario(oponente.id).acucares;
    if (sd < aposta || so < aposta) {
      return interaction.reply({ content: `Saldo insuficiente.\n${USO}`, ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('jk_aceitar').setLabel('Aceitar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('jk_recusar').setLabel('Recusar').setStyle(ButtonStyle.Danger),
    );
    const msg = await interaction.reply({ embeds: [arcade.embedArcade({ titulo: '✊ Jokenpô — Desafio', descricao: `${THEME.div.bolinhas}\n\n${desafiante} desafiou ${oponente} para Jokenpô!\nAposta: **${aposta}** Açúcares.\n\n${oponente}, aceite o desafio.`, cor: THEME.corSecundario, rodape: 'Mila Casino — jokenpô' })], components: [row], fetchReply: true });

    let aceitou = false;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === oponente.id, time: 60000 });
      if (btn.customId === 'jk_aceitar') { aceitou = true; await btn.update({ components: [] }); }
      else { await btn.update({ components: [] }); return; }
    } catch {
      await msg.edit({ components: [] }).catch(() => {});
      return;
    }
    if (!aceitou) {
      await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✊ Recusado', descricao: `${oponente} recusou o desafio.`, cor: THEME.corErro })], components: [] }).catch(() => {});
      return;
    }

    await partida(msg, desafiante, oponente, aposta, client);
  },
};
