const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const arcade = require('../utils/arcade');
const db = require('../utils/db');
const criador = require('../utils/criador');

const CASA = '000000000000000000';
function escrow(u, v) { if (criador.ehCriador(u)) return true; return db.transferirAcucares(u, CASA, v); }
function pagar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }
function reembolsar(u, v) { if (criador.ehCriador(u)) return; db.transferirAcucares(CASA, u, v); }

module.exports = {
  data: { name: 'coinflipduelo', description: '🪙 Duelo de cara ou coroa com aposta', options: [
    { name: 'oponente', description: 'Quem você desafia', type: 6, required: true },
    { name: 'aposta', description: 'Açúcares em jogo', type: 4, required: true, min_value: 1 },
  ]},
  async execute(interaction) {
    const desafiante = interaction.user;
    const oponente = interaction.options.getUser('oponente');
    const aposta = Number(interaction.options.getInteger('aposta'));
    if (!oponente || oponente.bot) return interaction.reply({ content: 'Oponente inválido.\nUso: `/coinflipduelo @oponente <aposta>`', ephemeral: true });
    if (oponente.id === desafiante.id) return interaction.reply({ content: 'Não pode se desafiar.\nUso: `/coinflipduelo @oponente <aposta>`', ephemeral: true });
    if (!Number.isInteger(aposta) || aposta < 1) return interaction.reply({ content: 'Aposta inválida.\nUso: `/coinflipduelo @oponente <aposta>`', ephemeral: true });
    const sd = criador.ehCriador(desafiante.id) ? Infinity : db.getUsuario(desafiante.id).acucares;
    const so = criador.ehCriador(oponente.id) ? Infinity : db.getUsuario(oponente.id).acucares;
    if (sd < aposta || so < aposta) return interaction.reply({ content: 'Saldo insuficiente.\nUso: `/coinflipduelo @oponente <aposta>`', ephemeral: true });

    // desafiante escolhe lado
    const row = new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)().setCustomId('cf_cara').setLabel('Cara').setStyle(require('discord.js').ButtonStyle.Primary),
      new (require('discord.js').ButtonBuilder)().setCustomId('cf_coroa').setLabel('Coroa').setStyle(require('discord.js').ButtonStyle.Secondary),
    );
    const msg = await interaction.reply({ embeds: [arcade.embedArcade({ titulo: '🪙 Coinflip Duelo', descricao: `${desafiante}, escolha seu lado (30s).`, cor: THEME.corSecundario })], components: [row], fetchReply: true });

    let escolha;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === desafiante.id, time: 30000 });
      escolha = btn.customId === 'cf_cara' ? 'Cara' : 'Coroa';
      await btn.update({ components: [] });
    } catch { await msg.edit({ components: [] }).catch(() => {}); return; }

    const row2 = new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)().setCustomId('cf_aceitar').setLabel('Aceitar aposta').setStyle(require('discord.js').ButtonStyle.Success),
      new (require('discord.js').ButtonBuilder)().setCustomId('cf_recusar').setLabel('Recusar').setStyle(require('discord.js').ButtonStyle.Danger),
    );
    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🪙 Desafio', descricao: `${desafiante} escolheu **${escolha}**.\n${oponente}, aceite a aposta de ${aposta} Açúcares.`, cor: THEME.corSecundario })], components: [row2] });

    let ok = false;
    try {
      const btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === oponente.id, time: 60000 });
      if (btn.customId === 'cf_aceitar') { ok = true; await btn.update({ components: [] }); }
      else { await btn.update({ components: [] }); return; }
    } catch { await msg.edit({ components: [] }).catch(() => {}); return; }
    if (!ok) { await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🪙 Recusado', descricao: `${oponente} recusou.`, cor: THEME.corErro })], components: [] }); return; }

    escrow(desafiante.id, aposta);
    escrow(oponente.id, aposta);

    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🪙 Girando...', descricao: '🪙 🪙', cor: THEME.corRoleta })], components: [] }).catch(() => {});
    await arcade.sleep(1500);
    const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
    const desafianteGanhou = escolha === resultado;
    let res;
    if (desafianteGanhou) { pagar(desafiante.id, aposta * 2); res = `${desafiante} venceu! (+${aposta * 2})`; }
    else { pagar(oponente.id, aposta * 2); res = `${oponente} venceu! (+${aposta * 2})`; }

    await msg.edit({ embeds: [arcade.embedArcade({ titulo: '🪙 Resultado', descricao: `Caiu **${resultado}**.\n${res}`, cor: THEME.corSucesso })], components: [] }).catch(() => {});
  },
};
