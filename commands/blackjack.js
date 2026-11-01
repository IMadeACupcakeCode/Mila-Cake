const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { THEME } = require('../utils/theme');
const arcade = require('../utils/arcade');
const db = require('../utils/db');
const criador = require('../utils/criador');

const CASA = '000000000000000000';
function escrow(u, v) { if (criador.ehCriador(u)) return true; return db.transferirAcucares(u, CASA, v); }
function pagar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }
function reembolsar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }

const SUITS = ['♠️','♥️','♦️','♣️'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function draw() { return { rank: RANKS[Math.floor(Math.random()*13)], suit: SUITS[Math.floor(Math.random()*4)] }; }
function value(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else if (['J','Q','K'].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function fmt(cards) { return cards.map(c => `${c.rank}${c.suit}`).join(' '); }

const USO = 'Uso: `/blackjack <aposta>`';

async function partida(msg, jogador, aposta) {
  if (!escrow(jogador.id, aposta)) {
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Erro', descricao: 'Saldo insuficiente para a revanche.', cor: THEME.corErro })], components: [] }).catch(() => {});
    return;
  }

  let player = [draw(), draw()];
  let dealer = [draw(), draw()];

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('Pedir').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('Parar').setStyle(ButtonStyle.Secondary),
  );

  await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Blackjack', descricao: `Suas cartas: ${fmt(player)} = **${value(player)}**\nMila: ${fmt([dealer[0]])} + ?\nAposta: ${aposta}`, cor: THEME.corSecundario })], components: [row] }).catch(() => {});

  let bust = false;
  while (true) {
    let i;
    try { i = await msg.awaitMessageComponent({ filter: (x) => x.user.id === jogador.id, time: 60000 }); }
    catch { bust = false; break; }
    if (i.customId === 'bj_hit') {
      player.push(draw());
      const v = value(player);
      if (v > 21) {
        await i.update({ embeds: [arcade.embedArcade({ titulo: '🃏 Estourou!', descricao: `Suas cartas: ${fmt(player)} = **${v}**\nMila: ${fmt(dealer)} = **${value(dealer)}**`, cor: THEME.corErro })], components: [] }).catch(() => {});
        bust = true;
        break;
      }
      await i.update({ embeds: [arcade.embedArcade({ titulo: '🃏 Blackjack', descricao: `Suas cartas: ${fmt(player)} = **${v}**\nMila: ${fmt([dealer[0]])} + ?\nAposta: ${aposta}`, cor: THEME.corSecundario })], components: [row] }).catch(() => {});
    } else {
      await i.update({ components: [] }).catch(() => {});
      break;
    }
  }

  if (bust) {
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Derrota', descricao: `Você estourou. Perdeu **${aposta}** Açúcares.`, cor: THEME.corErro })], components: [] }).catch(() => {});
    return;
  }

  while (value(dealer) < 17) dealer.push(draw());

  const pv = value(player);
  const dv = value(dealer);
  let push = false;
  if (dv > 21 || pv > dv) {
    pagar(jogador.id, aposta * 2);
  } else if (pv < dv) {
    // loss
  } else {
    push = true;
    reembolsar(jogador.id, aposta);
  }

  const res = (dv > 21 || pv > dv) ? `Você venceu! (+${aposta * 2})` :
              pv < dv ? `Mila venceu. Você perdeu ${aposta} Açúcares.` :
              'Empate (push). Aposta devolvida.';

  const row2 = push ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bj_revanche').setLabel('Ir de Novo').setEmoji('🔁').setStyle(ButtonStyle.Primary)) : null;
  await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🃏 Resultado', descricao: `Você: ${fmt(player)} = **${pv}**\nMila: ${fmt(dealer)} = **${dv}**\n\n${res}`, cor: THEME.corSucesso })], components: row2 ? [row2] : [] }).catch(() => {});

  if (push && row2) {
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
    collector.on('collect', async (i) => {
      if (i.customId !== 'bj_revanche') return;
      if (i.user.id !== jogador.id) { await i.reply({ content: 'Apenas o jogador pode pedir revanche.', ephemeral: true }).catch(() => {}); return; }
      await i.update({ components: [] }).catch(() => {});
      await partida(msg, jogador, aposta);
    });
  }
}

module.exports = {
  data: { name: 'blackjack', description: '🃏 Blackjack contra a Mila (dealer) com aposta', options: [
    { name: 'aposta', description: 'Açúcares em jogo', type: 4, required: true, min_value: 1 },
  ]},
  async execute(interaction) {
    const jogador = interaction.user;
    const aposta = Number(interaction.options.getInteger('aposta'));
    if (!Number.isInteger(aposta) || aposta < 1) return interaction.reply({ content: `Aposta inválida.\n${USO}`, ephemeral: true });
    const saldo = criador.ehCriador(jogador.id) ? Infinity : db.getUsuario(jogador.id).acucares;
    if (saldo < aposta) return interaction.reply({ content: `Saldo insuficiente.\n${USO}`, ephemeral: true });

    const msg = await interaction.reply({ embeds: [arcade.embedArcade({ titulo: '🃏 Blackjack', descricao: 'Preparando a mesa...', cor: THEME.corSecundario })], fetchReply: true });
    await partida(msg, jogador, aposta);
  },
};
