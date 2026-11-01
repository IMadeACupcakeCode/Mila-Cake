// utils/economyUI.js
// ── Cartões da Economia ───────────────────────────────────────────────
// Mesmo padrão visual dos outros comandos da Mila: embed com ✦ no título,
// divisores de utils/theme e barras de utils/arcade. Os temas (Windows 7,
// Hangouts, ...) ficam só no site; no Discord o visual é único.

const fs = require('fs');
const path = require('path');
const { THEME } = require('./theme');
const theme = require('./economyTheme');
const criador = require('./criador');
const site = require('./milaSite');

const ASSETS = path.join(__dirname, '..', 'assets');
const MASCOTE = path.join(ASSETS, 'mila-economia.png');
const ICONE = path.join(ASSETS, 'mila-icone.png');

function arquivoExiste(caminho) {
  try { return fs.existsSync(caminho); } catch { return false; }
}

function icone() {
  return arquivoExiste(ICONE) ? ICONE : null;
}

function mascote() {
  return arquivoExiste(MASCOTE) ? MASCOTE : null;
}

function comIcone(embed, extras = {}) {
  const caminho = icone();
  if (!caminho) return { embeds: [embed], ...extras };
  try { embed.setThumbnail('attachment://mila-icone.png'); } catch {}
  return { embeds: [embed], files: [caminho], ...extras };
}

function comMascote(embed, extras = {}) {
  return { embeds: [embed], ...extras };
}

function autor() {
  return {};
}

function saldoTexto(valor, ehCriador) {
  return ehCriador ? `+${criador.PONTOS_INFINITOS}` : theme.formatarNumero(valor);
}

/**
 * Mantido por compatibilidade: o Discord não anexa mais a mascote.
 * A imagem continua no site (web/public/assets).
 */
function comMascote(embed, extras = {}) {
  return { embeds: [embed], ...extras };
}

// ── Hub ───────────────────────────────────────────────────────────────
function embedHub({ membro, dados }) {
  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `Olá, **${membro.username || 'confeiteiro(a)'}**!\n\n` +
    `${THEME.div.linha}\n\n` +
    `🪟 **Painel principal**\n\n` +
    `🧁 Diário — ${dados.diario.pronto ? '`pronto`' : `\`${theme.formatarTempo(dados.diario.restante)}\``}\n` +
    `👩‍🍳 Trabalho — ${dados.trabalho.pronto ? '`pronto`' : `\`${theme.formatarTempo(dados.trabalho.restante)}\``}\n` +
    `🔥 Sequência — \`${dados.streak} dia(s)\`\n\n` +
    `${THEME.div.linha}\n\n` +
    `**Atalhos**\n` +
    `\`/carteira\` · \`/diario\` · \`/trabalhar\` · \`/loja\`\n` +
    `\`/colecao\` · \`/ranking\` · \`/extrato\` · \`/conquistas\` · \`/tema\`\n\n` +
    `${site.linha()}\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '🪟 Mila Economy · Painel',
    descricao,
    cor: THEME.corPrincipal,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    campos: [
      { name: '🍬 Saldo', value: `\`${saldoTexto(dados.acucares, dados.ehCriador)}\``, inline: true },
      { name: '🏅 Nível', value: `\`${dados.level}\``, inline: true },
      { name: '📦 Itens', value: `\`${dados.itens}\``, inline: true },
    ],
    rodape: 'Mila Economy · sua doceria em um só lugar',
  });
}

// ── Carteira ──────────────────────────────────────────────────────────
function embedCarteira({ membro, dados }) {
  const xpAlvo = Math.max(1, (Number(dados.level) + 1) * 1000);
  const percent = Math.max(0, Math.min(100, Math.floor((dados.xp / xpAlvo) * 100)));
  const xpBarra = require('./arcade').barraPorcentagem(percent, 12);

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**${membro.username || 'Confeiteiro(a)'}**${dados.ehCriador ? ' · 👑 Criador da Mila' : ''}\n\n` +
    `${THEME.div.linha}\n\n` +
    `💰 **Saldo:** \`${saldoTexto(dados.acucares, dados.ehCriador)}\` ${theme.MOEDA}\n` +
    `📊 **Posição:** \`#${dados.posicaoDinheiro}\` em açúcares · \`#${dados.posicaoXp}\` em XP\n` +
    `🔥 **Sequência:** \`${dados.streak} dia(s)\`\n\n` +
    `📈 **Nível ${dados.level}**  ·  ✨ \`${theme.formatarNumero(dados.xp)}/${theme.formatarNumero(xpAlvo)}\` XP\n` +
    `${xpBarra}  \`${percent}%\`\n\n` +
    `${THEME.div.linha}\n\n` +
    `📥 Ganho total: \`${theme.formatarNumero(dados.totalGanho)}\`\n` +
    `📤 Gasto total: \`${theme.formatarNumero(dados.totalGasto)}\`\n` +
    `💝 Doado: \`${theme.formatarNumero(dados.totalDoado)}\`\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '💰 Carteira',
    descricao,
    cor: THEME.corMyspace,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    campos: [
      { name: '🧁 Diários', value: `\`${dados.diarios}\``, inline: true },
      { name: '👩‍🍳 Trabalhos', value: `\`${dados.trabalhos}\``, inline: true },
      { name: '🛍️ Compras', value: `\`${dados.compras}\``, inline: true },
    ],
    rodape: 'Mila Carteira · extrato em /extrato',
  });
}

// ── Diário ────────────────────────────────────────────────────────────
function embedDiario({ membro, resultado, status }) {
  if (!resultado?.ok) {
    const descricao =
      `${THEME.div.bolinhas}\n\n` +
      `**Você já resgatou hoje!**\n\n` +
      `${THEME.div.linha}\n\n` +
      `⏳ Volte em \`${theme.formatarTempo(status.restante)}\`\n` +
      `🔥 Sequência atual: \`${status.streak} dia(s)\`\n\n` +
      `*Manter a sequência rende bônus maiores.*\n\n` +
      `${THEME.div.coracao}`;
    return theme.janela({
      titulo: '🧁 Diário',
      descricao,
      cor: THEME.corSecundario,
      thumbnail: membro.displayAvatarURL?.({ size: 128 }),
      rodape: 'Mila Diário · volte amanhã',
    });
  }

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**Resgate concluído!**\n\n` +
    `🧁 **+${resultado.ehCriador ? criador.PONTOS_INFINITOS : theme.formatarNumero(resultado.quantidade)} ${theme.MOEDA}**\n\n` +
    `${THEME.div.linha}\n\n` +
    `• Base: \`${theme.formatarNumero(resultado.base)}\`\n` +
    `• Bônus de sequência: \`+${theme.formatarNumero(resultado.bonusStreak)}\`\n` +
    `• Sorte extra: \`${resultado.bonusSorte ? `+${theme.formatarNumero(resultado.bonusSorte)}` : '—'}\`\n\n` +
    `🔥 Sequência: \`${resultado.streak} dia(s)\`\n` +
    `🍬 Novo saldo: \`${saldoTexto(resultado.saldo, resultado.ehCriador)}\`\n` +
    (resultado.conquistas?.length
      ? `\n🏆 **Conquistas:** ${resultado.conquistas.map((c) => `${c.emoji} ${c.nome}`).join(' · ')}\n`
      : '') +
    `\n${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '🧁 Diário',
    descricao,
    cor: THEME.corSucesso,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: `Mila Diário · sequência de ${resultado.streak} dia(s)`,
  });
}

// ── Trabalho ──────────────────────────────────────────────────────────
function embedTrabalhoDesafio({ membro, palavra, segundos }) {
  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**Pedido recebido!**\n\n` +
    `Digite a receita abaixo antes do tempo acabar:\n\n` +
    `\`\`\`\n${palavra}\n\`\`\`\n` +
    `${THEME.div.linha}\n\n` +
    `⏱️ Tempo: \`${segundos}s\`\n` +
    `🍬 Recompensa: açúcares + XP de cozinha\n` +
    `⚡ Acerto rápido aumenta a gorjeta\n\n` +
    `*Digite a palavra no canal para entregar o pedido.*\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '👩‍🍳 Trabalho · Pedido Recebido',
    descricao,
    cor: THEME.corDado,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Trabalho · boa sorte',
  });
}

function embedTrabalhoResultado({ membro, resultado }) {
  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**${resultado.acertou ? 'Pedido entregue!' : 'Pedido atrasado...'}**\n\n` +
    `${THEME.div.linha}\n\n` +
    `🍬 Gorjeta: \`+${resultado.ehCriador ? criador.PONTOS_INFINITOS : theme.formatarNumero(resultado.quantidade)}\` ${theme.MOEDA}\n` +
    `✨ Crítico: \`${resultado.critico ? 'sim' : 'não'}\`\n` +
    `💰 Novo saldo: \`${saldoTexto(resultado.saldo, resultado.ehCriador)}\`\n\n` +
    `⏳ Próximo turno em \`15 min\`.\n` +
    (resultado.conquistas?.length
      ? `\n🏆 **Conquistas:** ${resultado.conquistas.map((c) => `${c.emoji} ${c.nome}`).join(' · ')}\n`
      : '') +
    `\n${THEME.div.estrelado}`;

  return theme.janela({
    titulo: resultado.acertou ? '👩‍🍳 Trabalho · Entregue' : '👩‍🍳 Trabalho · Atrasado',
    descricao,
    cor: resultado.acertou ? THEME.corSucesso : THEME.corSecundario,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Trabalho · /trabalhar',
  });
}

// ── Loja ──────────────────────────────────────────────────────────────
function embedLoja({ membro, categorias, saldo, ehCriador, categoria }) {
  const lista = categoria ? categorias.filter((c) => c.id === categoria) : categorias;

  const blocos = lista.map((cat) => {
    const itens = cat.itens
      .map((i) => `${i.emoji} **${i.nome}** · \`${theme.formatarNumero(i.preco)}\` ${theme.MOEDA}\n   *${i.descricao}*`)
      .join('\n');
    return `**${cat.emoji} ${cat.nome}**\n${itens}`;
  });

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `Bem-vindo à lojinha da Mila!\n\n` +
    `💰 Seu saldo: \`${saldoTexto(saldo, ehCriador)}\` ${theme.MOEDA}\n\n` +
    `${THEME.div.linha}\n\n` +
    blocos.join('\n\n') +
    `\n\n${THEME.div.linha}\n\n` +
    `Use \`/loja comprar:<item>\` para levar.\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '🛍️ Loja da Mila',
    descricao,
    cor: THEME.corPrincipal,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: `Mila Loja · catálogo ${new Date().getFullYear()}`,
  });
}

function embedCompra({ membro, resultado, saldo }) {
  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**Compra aprovada!**\n\n` +
    `**${resultado.item.emoji} ${resultado.item.nome}**\n` +
    `${resultado.mensagem}\n\n` +
    `${THEME.div.linha}\n\n` +
    `💸 Pago: \`${theme.formatarNumero(resultado.item.preco)}\` ${theme.MOEDA}\n` +
    `💰 Saldo: \`${saldoTexto(saldo, criador.ehCriador(membro))}\` ${theme.MOEDA}\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '✅ Compra concluída',
    descricao,
    cor: THEME.corSucesso,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Loja · obrigada pela compra',
  });
}

// ── Coleção ───────────────────────────────────────────────────────────
function embedColecao({ membro, itens, total, distintos }) {
  const lista = itens.length
    ? itens.map((i) => `• \`${i.quantidade}x\` ${i.item_id}`).join('\n')
    : '*A mochila está vazia. Use `/loja` ou `/coletar` para começar.*';

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `🎒 **Mochila de ${membro.username || 'confeiteiro(a)'}**\n\n` +
    `${THEME.div.linha}\n\n` +
    `${lista}\n\n` +
    `${THEME.div.linha}\n\n` +
    `📦 Total de itens: \`${total}\`\n` +
    `🧩 Tipos diferentes: \`${distintos}\`\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '🎒 Coleção',
    descricao,
    cor: THEME.corSecundario,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Coleção · /colecao',
  });
}

// ── Ranking ───────────────────────────────────────────────────────────
const MEDALHAS = ['🥇', '🥈', '🥉'];

function embedRanking({ categoria, entradas, membro }) {
  const dinheiro = categoria !== 'xp';
  const linhas = entradas.length
    ? entradas
        .map((e) => {
          const medalha = MEDALHAS[e.posicao - 1] || `\`#${e.posicao}\``;
          const coroa = e.ehCriador ? ` · **${criador.CLASSIFICACAO_RANKING}** 👑` : '';
          const barra = theme.barra(e.valor, e.max, 10);
          const valor = dinheiro
            ? `${e.ehCriador ? criador.VALOR_RANKING : criador.formatarPontos(e.id, e.valor)} ${theme.MOEDA}`
            : `Nível \`${e.level}\` · \`${theme.formatarNumero(e.xp)}\` XP`;
          return `${medalha} <@${e.id}>${coroa}\n${barra} ${valor}`;
        })
        .join('\n\n')
    : '*Ninguém pontuou ainda. Seja o primeiro!*';

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `${linhas}\n\n` +
    `${THEME.div.linha}\n\n` +
    (membro ? `👤 Você: <@${membro.id}>\n\n` : '') +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: dinheiro ? '🏆 Ranking de Açúcares' : '🏆 Ranking de Nível',
    descricao,
    cor: dinheiro ? 0xF59E0B : THEME.corRoleta,
    thumbnail: membro?.displayAvatarURL?.({ size: 128 }),
    rodape: dinheiro ? 'Mila Leaderboard · top 10 de açúcares' : 'Mila Leaderboard · top 10 de nível',
  });
}

// ── Extrato ───────────────────────────────────────────────────────────
const ROTULOS_TRANSACAO = {
  diario: '🧁 Diário',
  trabalho: '👩‍🍳 Trabalho',
  compra: '🛍️ Compra',
  doacao: '💝 Doação',
  coleta: '🎰 Coleta',
  bonus: '🎁 Bônus',
  ajuste: '⚙️ Ajuste',
};

function embedExtrato({ membro, transacoes }) {
  const linhas = transacoes.length
    ? transacoes
        .map((t) => {
          const rotulo = ROTULOS_TRANSACAO[t.tipo] || `• ${t.tipo}`;
          const sinal = t.valor >= 0 ? '+' : '';
          const detalhe = t.detalhe ? ` · *${t.detalhe}*` : '';
          return `${rotulo}  \`${sinal}${theme.formatarNumero(t.valor)}\` ${theme.MOEDA}  \`${theme.dataCurta(t.em)}\`${detalhe}`;
        })
        .join('\n')
    : '*Nenhuma movimentação ainda. Experimente `/diario`.*';

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `${linhas}\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '🧾 Extrato',
    descricao,
    cor: THEME.corLembrete,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Extrato · últimas movimentações',
  });
}

// ── Conquistas ────────────────────────────────────────────────────────
function embedConquistas({ membro, conquistas }) {
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);
  const bloqueadas = conquistas.filter((c) => !c.desbloqueada);
  const linha = (c) =>
    c.desbloqueada
      ? `${c.emoji} **${c.nome}** · \`${theme.dataCurta(c.desbloqueadaEm)}\``
      : `⬜ ${c.nome} · *${c.descricao}*`;

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `🏅 **${desbloqueadas.length}/${conquistas.length} conquistas**\n\n` +
    `${THEME.div.linha}\n\n` +
    `**Desbloqueadas**\n${desbloqueadas.length ? desbloqueadas.map(linha).join('\n') : '*Nenhuma ainda.*'}\n\n` +
    `${THEME.div.linha}\n\n` +
    `**A conquistar**\n${bloqueadas.length ? bloqueadas.map(linha).join('\n') : '*Você completou tudo! 🏆*'}\n\n` +
    `${THEME.div.estrelado}`;

  return theme.janela({
    titulo: '🏅 Conquistas',
    descricao,
    cor: THEME.corSecundario,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Conquistas · /conquistas',
  });
}

// ── Tema (site) ───────────────────────────────────────────────────────
function embedTemas({ atual, temas }) {
  const lista = temas
    .map((t) => `${t.id === atual.id ? '▶' : ' '} ${t.emoji} **${t.nome}** · \`${t.id}\`\n   *${t.descricao}*`)
    .join('\n\n');
  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**Visual do site da Mila**\n\n${lista}\n\n` +
    `${THEME.div.linha}\n\n` +
    `Use \`/tema escolher:<id>\` para aplicar no site deste servidor.\n\n` +
    `${site.linha()}\n\n` +
    `${THEME.div.estrelado}`;
  return theme.janela({
    titulo: '🪟 Temas do Site',
    descricao,
    cor: THEME.corPrincipal,
    rodape: `Tema atual: ${atual.nome}`,
  });
}

// ── Componentes ───────────────────────────────────────────────────────
function botoesEconomia(prefixo = 'eco') {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefixo}:diario`).setLabel('Diário').setEmoji('🧁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${prefixo}:trabalhar`).setLabel('Trabalhar').setEmoji('👩‍🍳').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefixo}:loja`).setLabel('Loja').setEmoji('🛍️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefixo}:carteira`).setLabel('Carteira').setEmoji('💰').setStyle(ButtonStyle.Success)
  );
}

function botoesTema(temas, atual) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder();
  for (const t of temas.slice(0, 5)) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`eco:tema:${t.id}`)
        .setLabel(t.nome)
        .setEmoji(t.emoji)
        .setStyle(t.id === atual.id ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }
  return row;
}

module.exports = {
  icone,
  mascote,
  comIcone,
  comMascote,
  saldoTexto,
  embedHub,
  embedCarteira,
  embedDiario,
  embedTrabalhoDesafio,
  embedTrabalhoResultado,
  embedLoja,
  embedCompra,
  embedColecao,
  embedRanking,
  embedExtrato,
  embedConquistas,
  embedTemas,
  botoesEconomia,
  botoesTema,
};
