const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { THEME, criarEmbed } = require('./theme');

// ⋆｡°✩ UI helpers da Mila Bot
function botao(label, customId, style = ButtonStyle.Secondary, emoji) {
  const b = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
}

// Linha de navegação de "livro" (primeira / anterior / próxima / última)
function linhaNavegacao(prefixo, desabilitar = {}) {
  const row = new ActionRowBuilder().addComponents(
    botao('⏮️', `${prefixo}_first`, ButtonStyle.Secondary).setDisabled(!!desabilitar.first),
    botao('◀️', `${prefixo}_prev`, ButtonStyle.Primary).setDisabled(!!desabilitar.prev),
    botao('▶️', `${prefixo}_next`, ButtonStyle.Primary).setDisabled(!!desabilitar.next),
    botao('⏭️', `${prefixo}_last`, ButtonStyle.Secondary).setDisabled(!!desabilitar.last)
  );
  return row;
}

// Menu de seleção para "pular" para uma página/comando
function menuPular(prefixo, placeholder, opcoes) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${prefixo}_jump`)
    .setPlaceholder(placeholder)
    .addOptions(
      opcoes.slice(0, 25).map((o) => ({
        label: o.label.length > 100 ? o.label.slice(0, 100) : o.label,
        value: o.value,
        description: o.description ? o.description.slice(0, 100) : undefined,
        emoji: o.emoji,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

// Distância de Levenshtein simples para busca "mais parecido"
function distancia(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo);
    }
  }
  return dp[m][n];
}

// Encontra o comando mais próximo do termo digitado
function aproximar(termo, lista) {
  let melhor = null;
  let menor = Infinity;
  const t = termo.toLowerCase();
  for (const item of lista) {
    const alvos = [item.nome, ...(item.alias || []), item.categoria].map((x) => x.toLowerCase());
    for (const alvo of alvos) {
      const d = distancia(t, alvo);
      // bônus se contém como substring
      const score = alvo.includes(t) ? d - 2 : d;
      if (score < menor) {
        menor = score;
        melhor = item;
      }
    }
  }
  return menor <= Math.max(3, termo.length / 2) ? melhor : null;
}

module.exports = {
  botao,
  linhaNavegacao,
  menuPular,
  distancia,
  aproximar,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  THEME,
  criarEmbed,
};