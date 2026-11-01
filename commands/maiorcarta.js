const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { THEME } = require('../utils/theme');
const arcade = require('../utils/arcade');
const db = require('../utils/db');
const criador = require('../utils/criador');

const CASA = '000000000000000000';
function escrow(u, v) { if (criador.ehCriador(u)) return true; return db.transferirAcucares(u, CASA, v); }
function pagar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }
function reembolsar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function carta() { return Math.floor(Math.random() * 13) + 1; }

const USO = 'Uso: `/maiorcarta @oponente <aposta>`';

async function partida(msg, desafiante, oponente, aposta) {
  if (!escrow(desafiante.id, aposta) || !escrow(oponente.id, aposta)) {
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Erro', descricao: 'Saldo insuficiente para a revanche.', cor: THEME.corErro })], components: [] }).catch(() => {});
    return;
  }
  await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Sorteando cartas...', descricao: '🃏 🃏', cor: THEME.corRoleta })], components: [] }).catch(() => {});
  await arcade.sleep(1500);
  const c1 = carta();
  const c2 = carta();
  let empate = false;
  if (c1 > c2) pagar(desafiante.id, aposta * 2);
  else if (c2 > c1) pagar(oponente.id, aposta * 2);
  else { empate = true; reembolsar(desafiante.id, aposta); reembolsar(oponente.id, aposta); }

  const res = c1 > c2 ? `${desafiante} venceu! (+${aposta * 2})` :
              c2 > c1 ? `${oponente} venceu! (+${aposta * 2})` :
              'Empate! Apostas devolvidas.';

  const row = empate ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('mc_revanche').setLabel('Revanche').setEmoji('🔁').setStyle(ButtonStyle.Primary)) : null;
  await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Resultado', descricao: `${desafiante}: **${RANKS[c1-1]}**\n${oponente}: **${RANKS[c2-1]}**\n\n${res}`, cor: THEME.corSucesso })], components: row ? [row] : [] }).catch(() => {});

  if (empate && row) {
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
    collector.on('collect', async (i) => {
      if (i.customId !== 'mc_revanche') return;
      if (i.user.id !== desafiante.id && i.user.id !== oponente.id) { await i.reply({ content: 'Apenas os jogadores podem pedir revanche.', ephemeral: true }).catch(() => {}); return; }
      await i.update({ components: [] }).catch(() => {});
      await partida(msg, desafiante, oponente, aposta);
    });
  }
}

module.exports = {
  data: { name: 'maiorcarta', description: '🃏 Duelo de maior carta com aposta', options: [
    { name: 'oponente', description: 'Quem você desafia', type: 6, required: true },
    { name: 'aposta', description: 'Açúcares em jogo', type: 4, required: true, min_value: 1 },
  ]},
  async execute(interaction) {
    const desafiante = interaction.user;
    const oponente = interaction.options.getUser('oponente');
    const aposta = Number(interaction.options.getInteger('aposta'));
    if (!oponente || oponente.bot) return interaction.reply({ content: `Oponente inválido.\n${USO}`, ephemeral: true });
    if (oponente.id === desafiante.id) return interaction.reply({ content: `Você não pode se desafiar.\n${USO}`, ephemeral: true });
    if (!Number.isInteger(aposta) || aposta < 1) return interaction.reply({ content: `Aposta inválida.\n${USO}`, ephemeral: true });
    const sd = criador.ehCriador(desafiante.id) ? Infinity : db.getUsuario(desafiante.id).acucares;
    const so = criador.ehCriador(oponente.id) ? Infinity : db.getUsuario(oponente.id).acucares;
    if (sd < aposta || so < aposta) return interaction.reply({ content: `Saldo insuficiente.\n${USO}`, ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mc_aceitar').setLabel('Aceitar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mc_recusar').setLabel('Recusar').setStyle(ButtonStyle.Danger),
    );
    const msg = await interaction.reply({ embeds: [arcade.embedArcade({ titulo: '🃏 Maior Carta', descricao: `${desafiante} desafiou ${oponente}!\nAposta: **${aposta}** Açúcares.`, cor: THEME.corSecundario })], components: [row], fetchReply: true });

    let ok = false;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === oponente.id, time: 60000 });
      if (btn.customId === 'mc_aceitar') { ok = true; await btn.update({ components: [] }); }
      else { await btn.update({ components: [] }); return; }
    } catch { await msg.edit({ components: [] }).catch(() => {}); return; }
    if (!ok) { await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Recusado', descricao: `${oponente} recusou.`, cor: THEME.corErro })], components: [] }); return; }

    escrow(desafiante.id, aposta);
    escrow(oponente.id, aposta);
    await partida(msg, desafiante, oponente, aposta);
  },
};
