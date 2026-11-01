const pokemon = require('../utils/pokemon');
const db = require('../utils/db');
const theme = require('../utils/economyTheme');
const { THEME } = require('../utils/theme');
const { criarEmbed } = require('../utils/theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function embedSelecao() {
  return criarEmbed({
    titulo: '⚠️ Reset de Pokémon',
    descricao: 'Selecione o que deseja resetar no **servidor atual** (não afeta outros servidores).\n\n• 🧹 Coleções · 🎒 Itens Pokémon · ⚙️ Preferências · 💰 Economia (se incluir)\n\nReaja com ✅ para confirmar após escolher, ou ❌ para cancelar.',
    cor: THEME.corErro,
  });
}

module.exports = {
  data: { name: 'reset-pokemon', description: 'Reseta dados de Pokémon no servidor (seleção interativa)' },
  async execute(interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    const membro = interaction.member;
    const isAdmin = membro?.permissions?.has('Administrator') || interaction.user.id === '475057239485317150';
    if (!isAdmin) {
      return interaction.reply({ embeds: [criarEmbed({ titulo: 'Acesso restrito', descricao: 'Apenas administradores podem resetar Pokémon.', cor: THEME.corErro })], ephemeral: true });
    }

    const opcoes = {
      colecoes: false,
      itens: false,
      preferencias: false,
      economia: false,
    };

    const embed = criarEmbed({
      titulo: '⚙️ Reset Pokémon',
      descricao: `Selecione via botões o que resetar no servidor.\n\n${Object.entries(opcoes).map(([k]) => `• ${k === 'colecoes' ? '🧹' : k === 'itens' ? '🎒' : k === 'preferencias' ? '⚙️' : '💰'} ${k}`).join('\n')}`,
      cor: THEME.corPrincipal,
    });

    const btnColecoes = new ButtonBuilder().setCustomId('rp_col').setLabel('Coleções').setEmoji('🧹').setStyle(ButtonStyle.Danger);
    const btnItens = new ButtonBuilder().setCustomId('rp_it').setLabel('Itens').setEmoji('🎒').setStyle(ButtonStyle.Danger);
    const btnPrefs = new ButtonBuilder().setCustomId('rp_pref').setLabel('Preferências').setEmoji('⚙️').setStyle(ButtonStyle.Danger);
    const btnEco = new ButtonBuilder().setCustomId('rp_eco').setLabel('Economia').setEmoji('💰').setStyle(ButtonStyle.Danger);
    const btnConfirma = new ButtonBuilder().setCustomId('rp_ok').setLabel('Confirmar').setEmoji('✅').setStyle(ButtonStyle.Success);
    const btnCancela = new ButtonBuilder().setCustomId('rp_no').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary);

    const msg = await interaction.reply({ embeds: [embed], components: [
      new ActionRowBuilder().addComponents(btnColecoes, btnItens, btnPrefs, btnEco),
      new ActionRowBuilder().addComponents(btnConfirma, btnCancela),
    ], fetchReply: true });

    const coletor = msg.createMessageComponentCollector({ time: 60_000, filter: (i) => i.user.id === interaction.user.id });
    coletor.on('collect', async (i) => {
      const id = i.customId;
      if (id === 'rp_col') opcoes.colecoes = !opcoes.colecoes;
      if (id === 'rp_it') opcoes.itens = !opcoes.itens;
      if (id === 'rp_pref') opcoes.preferencias = !opcoes.preferencias;
      if (id === 'rp_eco') opcoes.economia = !opcoes.economia;
      if (id === 'rp_ok') {
        coletor.stop('confirmado');
        const resultados = [];
        if (opcoes.colecoes) {
          db.db.prepare('DELETE FROM pokemon_collection WHERE user_id IN (SELECT id FROM usuarios)').run();
          resultados.push('Coleções');
        }
        if (opcoes.itens) {
          db.db.prepare('DELETE FROM pokemon_inventory').run();
          resultados.push('Itens Pokémon');
        }
        if (opcoes.preferencias) {
          db.db.prepare('DELETE FROM pokemon_user_preferences').run();
          resultados.push('Preferências');
        }
        if (opcoes.economia) {
          db.db.prepare('UPDATE usuarios SET acucares = 0').run();
          db.db.prepare('DELETE FROM inventario').run();
          resultados.push('Economia');
        }
        await msg.edit({ embeds: [criarEmbed({ titulo: 'Reset concluído', descricao: `Servidor: ${guildId ? `<#${guildId}>` : 'DM'}\nResetados: ${resultados.length ? resultados.join(' · ') : 'nenhum'}`, cor: THEME.corSucesso })], components: [] });
        return;
      }
      if (id === 'rp_no') {
        coletor.stop('cancelado');
        await msg.edit({ embeds: [criarEmbed({ titulo: 'Cancelado', descricao: 'Nenhum dado foi resetado.', cor: THEME.corSecundario })], components: [] });
        return;
      }
      await i.update({ embeds: [embed], components: [
        new ActionRowBuilder().addComponents(
          btnColecoes.setStyle(opcoes.colecoes ? ButtonStyle.Success : ButtonStyle.Danger),
          btnItens.setStyle(opcoes.itens ? ButtonStyle.Success : ButtonStyle.Danger),
          btnPrefs.setStyle(opcoes.preferencias ? ButtonStyle.Success : ButtonStyle.Danger),
          btnEco.setStyle(opcoes.economia ? ButtonStyle.Success : ButtonStyle.Danger)
        ),
        new ActionRowBuilder().addComponents(btnConfirma, btnCancela),
      ] }).catch(() => {});
    });
  }
};
