const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const arcade = require('../utils/arcade');
const db = require('../utils/db');
const criador = require('../utils/criador');

const CASA = '000000000000000000';
function escrow(u, v) { if (criador.ehCriador(u)) return true; return db.transferirAcucares(u, CASA, v); }
function pagar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }
function reembolsar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }

function botoesNumeros(prefix) {
  const row = new (require('discord.js').ActionRowBuilder)();
  for (let n = 1; n <= 5; n++) row.addComponents(new (require('discord.js').ButtonBuilder)().setCustomId(`${prefix}_${n}`).setLabel(String(n)).setStyle(require('discord.js').ButtonStyle.Primary));
  return row;
}

module.exports = {
  data: { name: 'parouimpar', description: '✋ Par ou Ímpar com aposta entre dois jogadores', options: [
    { name: 'oponente', description: 'Quem você desafia', type: 6, required: true },
    { name: 'aposta', description: 'Açúcares em jogo', type: 4, required: true, min_value: 1 },
  ]},
  async execute(interaction) {
    const desafiante = interaction.user;
    const oponente = interaction.options.getUser('oponente');
    const aposta = Number(interaction.options.getInteger('aposta'));
    if (!oponente || oponente.bot) return interaction.reply({ content: 'Oponente inválido.\nUso: `/parouimpar @oponente <aposta>`', ephemeral: true });
    if (oponente.id === desafiante.id) return interaction.reply({ content: 'Não pode se desafiar.\nUso: `/parouimpar @oponente <aposta>`', ephemeral: true });
    if (!Number.isInteger(aposta) || aposta < 1) return interaction.reply({ content: 'Aposta inválida.\nUso: `/parouimpar @oponente <aposta>`', ephemeral: true });
    const sd = criador.ehCriador(desafiante.id) ? Infinity : db.getUsuario(desafiante.id).acucares;
    const so = criador.ehCriador(oponente.id) ? Infinity : db.getUsuario(oponente.id).acucares;
    if (sd < aposta || so < aposta) return interaction.reply({ content: 'Saldo insuficiente.\nUso: `/parouimpar @oponente <aposta>`', ephemeral: true });

    // desafiante escolhe par/ímpar
    const row = new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)().setCustomId('pi_par').setLabel('Par').setStyle(require('discord.js').ButtonStyle.Primary),
      new (require('discord.js').ButtonBuilder)().setCustomId('pi_impar').setLabel('Ímpar').setStyle(require('discord.js').ButtonStyle.Secondary),
    );
    const msg = await interaction.reply({ embeds: [arcade.embedArcade({ titulo: '✋ Par ou Ímpar', descricao: `${desafiante}, escolha Par ou Ímpar (30s).`, cor: THEME.corSecundario })], components: [row], fetchReply: true });

    let paridade;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === desafiante.id, time: 30000 });
      paridade = btn.customId === 'pi_par' ? 'par' : 'impar';
      await btn.update({ components: [] });
    } catch { await msg.edit({ components: [] }).catch(() => {}); return; }

    const row2 = new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)().setCustomId('pi_aceitar').setLabel('Aceitar').setStyle(require('discord.js').ButtonStyle.Success),
      new (require('discord.js').ButtonBuilder)().setCustomId('pi_recusar').setLabel('Recusar').setStyle(require('discord.js').ButtonStyle.Danger),
    );
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✋ Desafio', descricao: `${desafiante} escolheu **${paridade}**.\n${oponente}, aceite a aposta de ${aposta} Açúcares.`, cor: THEME.corSecundario })], components: [row2] });

    let ok = false;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === oponente.id, time: 60000 });
      if (btn.customId === 'pi_aceitar') { ok = true; await btn.update({ components: [] }); }
      else { await btn.update({ components: [] }); return; }
    } catch { await msg.edit({ components: [] }).catch(() => {}); return; }
    if (!ok) { await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✋ Recusado', descricao: `${oponente} recusou.`, cor: THEME.corErro })], components: [] }); return; }

    escrow(desafiante.id, aposta);
    escrow(oponente.id, aposta);

    // desafiante escolhe número
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✋ Escolha um número', descricao: `${desafiante}, escolha 1-5.`, cor: THEME.corRoleta })], components: [botoesNumeros('pn_d')] }).catch(() => {});
    let n1;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === desafiante.id, time: 30000 });
      n1 = Number(btn.customId.split('_').pop());
      await btn.update({ components: [] });
    } catch { reembolsar(desafiante.id, aposta); reembolsar(oponente.id, aposta); await msg.edit({ components: [] }).catch(() => {}); return; }

    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✋ Escolha um número', descricao: `${oponente}, escolha 1-5.`, cor: THEME.corRoleta })], components: [botoesNumeros('pn_o')] }).catch(() => {});
    let n2;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === oponente.id, time: 30000 });
      n2 = Number(btn.customId.split('_').pop());
      await btn.update({ components: [] });
    } catch { reembolsar(desafiante.id, aposta); reembolsar(oponente.id, aposta); await msg.edit({ components: [] }).catch(() => {}); return; }

    const soma = n1 + n2;
    const somaPar = soma % 2 === 0;
    const desafianteGanhou = (paridade === 'par') === somaPar;
    let res;
    if (desafianteGanhou) { pagar(desafiante.id, aposta * 2); res = `${desafiante} venceu! (+${aposta * 2})`; }
    else { pagar(oponente.id, aposta * 2); res = `${oponente} venceu! (+${aposta * 2})`; }

    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '✋ Resultado', descricao: `${desafiante}: ${n1}\n${oponente}: ${n2}\nSoma: ${soma} (${somaPar ? 'Par' : 'Ímpar'})\n\n${res}`, cor: THEME.corSucesso })], components: [] }).catch(() => {});
  },
};
