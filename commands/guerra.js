// ═══════════════════════════════════════════════════════════════════════════
//  GUERRA DE CARTAS — o jogo de cartas da Mila dentro do Discord
//
//  · Botões em vez de reações (funciona no prefixo e no slash)
//  · Baralho, mão, pontos, facções, status e especiais crossover
//  · Animações por edição de mensagem e arte enviada como anexo local
//  · Placar persistente com vitórias, derrotas, sequência e winrate
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const motor = require('../utils/guerraCartas');
const { registrarResultado, estatisticas, top } = require('../utils/guerraStore');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ARTE_DIR = path.resolve(__dirname, '..', 'static', 'guerra', 'cards');
const GUERRA_COOLDOWN_MS = 30_000;
const DESAFIO_TIMEOUT_MS = 60_000;
const TURNO_TIMEOUT_MS = 45_000;
const FINAL_TIMEOUT_MS = 120_000;

const guerraCooldowns = new Map();

const CORES = {
  fundo: 0x1E1B4B,
  painel: 0x312E81,
  dourado: 0xFACC15,
  vermelho: 0xEF4444,
  verde: 0x22C55E,
  azul: 0x38BDF8,
};

// ── Helpers de apresentação ─────────────────────────────────────────────────

function nomeCurto(nome, limite = 18) {
  const texto = String(nome || '???');
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

function pushLog(estado, texto) {
  estado.log.unshift(`• ${texto}`);
  if (estado.log.length > 6) estado.log.pop();
}

function corDaPartida(estado) {
  const [p1, p2] = estado.jogadores;
  if (!p1 || !p2) return CORES.fundo;
  return motor.FACCOES[estado.jogadores[estado.turno]?.faccao]?.cor || CORES.painel;
}

function linhaJogador(jogador, destaque = false) {
  const faccao = motor.FACCOES[jogador.faccao];
  return [
    `${destaque ? '▶ ' : ''}${faccao.emoji} **${jogador.nome}**${jogador.isBot ? ' 🤖' : ''}`,
    motor.barraHp(jogador.hp, jogador.hpMax),
    `\`${jogador.hp}/${jogador.hpMax} HP\` · \`${jogador.pontos}⚡\` · \`${jogador.mao.length}🎴\` · \`${jogador.cargas}🎁\``,
    `🏳️ ${faccao.nome} · forte contra ${motor.FACCOES[faccao.forteContra].emoji} ${motor.FACCOES[faccao.forteContra].nome}`,
    motor.descreverStatus(jogador.statuses),
  ].join('\n');
}

function linhaCarta(carta, indice, ator, alvo) {
  const faccao = motor.FACCOES[carta.faccao];
  const efeito = motor.EFEITOS[carta.efeito];
  const marcas = [];
  if (motor.vantagemContra(carta, alvo)) marcas.push('✨ VANTAGEM');
  if (motor.sinergia(carta, ator)) marcas.push('🧬 SINERGIA');
  return `\`${indice + 1}\` ${faccao.emoji} **${carta.nome}** · \`${carta.custo}⚡\` · \`${carta.danoMin}–${carta.danoMax}\` · ${efeito.emoji} ${efeito.nome}${marcas.length ? ` · ${marcas.join(' · ')}` : ''}`;
}

function embedBoard(estado, ator, alvo, aviso = '') {
  const [p1, p2] = estado.jogadores;
  const embed = criarEmbed({
    titulo: `⚔️ Guerra de Cartas · ${estado.treino ? 'Treino · ' : ''}Rodada ${String(estado.rodada).padStart(2, '0')}`,
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `🎯 **Vez de ${ator.nome}** — escolha uma carta ou uma ação abaixo.\n` +
      `⏳ \`${Math.round(TURNO_TIMEOUT_MS / 1000)}s\` para agir · Partida \`#${estado.matchId}\`\n` +
      (aviso ? `\n${aviso}\n` : '') +
      `\n${THEME.div.estrelado}`,
    cor: corDaPartida(estado),
    thumbnail: ator.avatar || undefined,
    rodape: `Guerra de Cartas · ${motor.CARTAS.length} cartas · arte: Imgflip`,
  });

  embed.addFields(
    { name: '🟦 Lado A', value: linhaJogador(p1, estado.turno === 0), inline: true },
    { name: '⚔️', value: '**VS**', inline: true },
    { name: '🟥 Lado B', value: linhaJogador(p2, estado.turno === 1), inline: true },
  );

  const mao = ator.mao.length
    ? ator.mao.map((carta, i) => linhaCarta(carta, i, ator, alvo)).join('\n')
    : '🃏 Mão vazia. Use **Defender** para comprar uma carta ou abra a **Caixa Crossover**.';
  embed.addFields({
    name: `🎴 Mão de ${ator.nome}`,
    value: mao.slice(0, 1024),
    inline: false,
  });

  if (estado.log.length) {
    embed.addFields({
      name: '📜 Últimas jogadas',
      value: estado.log.slice(0, 5).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  return embed;
}

function embedCarta({ carta, ator, alvo, resultado, tipo = 'ataque' }) {
  const faccao = motor.FACCOES[carta.faccao];
  const raridade = motor.RARIDADES[carta.raridade] || motor.RARIDADES.comum;
  const marcas = (resultado?.marcas || []).map((m) => `✦ ${m.texto}`).join('\n');
  const efeitos = (resultado?.efeitos || []).map((e) => `✦ ${e}`).join('\n');
  const titulo = tipo === 'especial'
    ? `⚡ Crossover: ${carta.nome}`
    : tipo === 'caixa'
      ? '🎁 Caixa Crossover aberta!'
      : `${faccao.emoji} ${ator.nome} usou ${carta.nome}!`;

  const descricao =
    `${THEME.div.bolinhas}\n\n` +
    `**${carta.titulo || carta.nome}**\n` +
    `> ${carta.legenda}\n\n` +
    `${faccao.emoji} ${faccao.nome} · ${raridade.emoji} ${raridade.nome}\n` +
    (resultado
      ? `\n💥 **${resultado.dano} de dano** em **${alvo.nome}**\n${marcas}${marcas && efeitos ? '\n' : ''}${efeitos}`
      : '\n🎴 Carta adicionada ao seu arsenal crossover.') +
    `\n\n${THEME.div.estrelado}`;

  const embed = criarEmbed({
    titulo,
    descricao,
    cor: tipo === 'especial' ? CORES.dourado : raridade.cor || faccao.cor,
    rodape: `${carta.credito || 'Arte: Imgflip'} · Guerra de Cartas`,
  });
  embed.setFooter({ text: `${carta.credito || 'Arte: Imgflip'} · Guerra de Cartas` });
  return embed;
}

function payloadComArte(carta, embed) {
  const arquivo = path.join(ARTE_DIR, carta.arte);
  if (!fs.existsSync(arquivo)) return { embeds: [embed], components: [], attachments: [] };
  const extensao = path.extname(arquivo);
  const nome = `guerra_${carta.id}_${Date.now()}${extensao}`;
  embed.setImage(`attachment://${nome}`);
  return {
    embeds: [embed],
    components: [],
    files: [new AttachmentBuilder(arquivo).setName(nome)],
    attachments: [],
  };
}

function payloadBoard(estado, ator, alvo, opcoes = {}) {
  return {
    embeds: [embedBoard(estado, ator, alvo, opcoes.aviso)],
    components: opcoes.semBotoes ? [] : criarBotoesAcao(ator, estado, opcoes),
    attachments: [],
  };
}

// ── Componentes ─────────────────────────────────────────────────────────────

function botaoCarta(carta, indice, ator, desabilitado) {
  const podePagar = ator.pontos >= carta.custo;
  return new ButtonBuilder()
    .setCustomId(`guerra_atk_${indice}`)
    .setLabel(`${indice + 1} · ${nomeCurto(carta.nome, 16)} · ${carta.custo}⚡`)
    .setEmoji(motor.FACCOES[carta.faccao].icone)
    .setStyle(podePagar ? ButtonStyle.Primary : ButtonStyle.Secondary)
    .setDisabled(desabilitado || !podePagar);
}

function criarBotoesAcao(ator, estado, opcoes = {}) {
  const desabilitado = Boolean(opcoes.desabilitado);
  const rows = [];
  const cartas = ator.mao.slice(0, 5);
  const linhaCartas = new ActionRowBuilder();
  for (let i = 0; i < cartas.length; i++) {
    linhaCartas.addComponents(botaoCarta(cartas[i], i, ator, desabilitado));
  }
  if (cartas.length) rows.push(linhaCartas);

  const linhaAcoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('guerra_defender')
      .setLabel('Defender +2⚡')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId('guerra_caixa')
      .setLabel(ator.caixaAberta ? 'Caixa usada' : 'Caixa Crossover')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(desabilitado || ator.caixaAberta),
    new ButtonBuilder()
      .setCustomId('guerra_especial')
      .setLabel(ator.cargas > 0 ? 'Especial' : 'Especial (sem carga)')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(desabilitado || ator.cargas < 1 || ator.pontos < 3),
    new ButtonBuilder()
      .setCustomId('guerra_render')
      .setLabel('Render')
      .setEmoji('🏳️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado),
  );
  rows.push(linhaAcoes);
  return rows;
}

function criarBotoesDesafio() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('guerra_aceitar').setLabel('Aceitar').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('guerra_recusar').setLabel('Recusar').setEmoji('❌').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('guerra_cancelar').setLabel('Cancelar').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
  );
}

function criarBotoesFim() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('guerra_revanche').setLabel('Revanche').setEmoji('🔁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('guerra_placar').setLabel('Placar').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('guerra_manual').setLabel('Manual').setEmoji('📖').setStyle(ButtonStyle.Secondary),
  );
}

function criarBotoesManual() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('guerra_treinar').setLabel('Treinar contra a Mila').setEmoji('🎮').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('guerra_placar').setLabel('Placar').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
  );
}

// ── Embeds estáticos ────────────────────────────────────────────────────────

function manualEmbed() {
  const embed = criarEmbed({
    titulo: '📖 Manual da Guerra de Cartas',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      '**Um duelo de cartas 1v1 com memes dos EUA e do Brasil.**\n' +
      'Cada jogador começa com **100 HP**, **4⚡**, uma mão de **4 cartas** e ganha **+1⚡** no início de cada turno ativo.\n\n' +
      `${THEME.div.linha}\n\n` +
      '**🎯 Como jogar**\n' +
      '• `$guerra @alguém` — desafia um membro (botões de aceitar/recusar).\n' +
      '• `$guerra` — abre este manual; use **Treinar contra a Mila** para jogar sozinho.\n' +
      '• `$guerra placar` — ranking de vitórias, derrotas e sequências.\n' +
      '• Treinos não alteram o placar competitivo.\n\n' +
      '**🎴 Sua vez**\n' +
      '• No início do seu turno, sua mão é recomposta até 4 cartas.\n' +
      '• Clique em uma carta para atacar. Cada carta custa de `1⚡` a `3⚡`.\n' +
      '• **Defender** ganha `+2⚡` e compra uma carta.\n' +
      '• **Caixa Crossover** (1x por partida) dá uma carga especial e `+1⚡`.\n' +
      '• **Especial** custa `3⚡` + 1 carga e libera um crossover EUA × Brasil.\n' +
      '• No seu turno você tem `45s`; se passar, a Mila defende por você.\n\n' +
      '**🔥 Efeitos**\n' +
      '🔥 **Burn** — 4 de dano por 2 turnos.\n' +
      '🛡️ **Escudo** — reduz 30% do dano recebido.\n' +
      '💧 **Dreno** — cura 35% do dano causado.\n' +
      '⚡ **Atordoamento** — o adversário perde o próximo turno.\n\n' +
      '**🏳️ Facções**\n' +
      '🇺🇸 **Blockbuster** vence 🌐 **Viral**.\n' +
      '🌐 **Viral** vence 🇧🇷 **Brasil**.\n' +
      '🇧🇷 **Brasil** vence 🕹️ **Cult**.\n' +
      '🕹️ **Cult** vence 🇺🇸 **Blockbuster**.\n' +
      'Carta da sua facção: **+10%** de dano. Carta que vence a facção do rival: **+25%**.\n' +
      'Acerto crítico: **12%** de chance para **+50%** de dano.\n\n' +
      `${THEME.div.estrelado}\n\n` +
      '**🏆 Vença baixando o HP do rival a zero.** Vitórias entram no placar; derrotas também ensinam.',
    cor: CORES.painel,
    thumbnail: undefined,
    rodape: 'Guerra de Cartas · 20 cartas + 4 crossovers · arte: Imgflip',
  });
  return embed;
}

function placarEmbed() {
  const lista = top(10);
  if (!lista.length) {
    return criarEmbed({
      titulo: '🏆 Placar da Guerra de Cartas',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        'Ainda não há batalhas registradas.\n\n' +
        'Use `$guerra @alguém` ou **Treinar contra a Mila** para inaugurar o placar!\n\n' +
        `${THEME.div.coracao}`,
      cor: CORES.dourado,
    });
  }

  const medalhas = ['🥇', '🥈', '🥉'];
  const linhas = lista.map((jogador, indice) => {
    const posicao = medalhas[indice] || `**#${indice + 1}**`;
    const sequencia = jogador.sequencia > 0 ? `🔥 ${jogador.sequencia}` : '—';
    return (
      `${posicao} **${nomeCurto(jogador.nome, 22)}**\n` +
      `┗ \`${jogador.vitorias}V\` · \`${jogador.derrotas}D\` · \`${jogador.winrate}%\` · sequência ${sequencia}`
    );
  });

  const totalVitorias = lista.reduce((soma, j) => soma + j.vitorias, 0);
  const totalDerrotas = lista.reduce((soma, j) => soma + j.derrotas, 0);

  return criarEmbed({
    titulo: '🏆 Placar da Guerra de Cartas',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${linhas.join('\n\n')}\n\n` +
      `${THEME.div.linha}\n\n` +
      `📊 **${totalVitorias}** vitórias e **${totalDerrotas}** derrotas registradas no top 10.\n` +
      `${THEME.div.coracao}`,
    cor: CORES.dourado,
    rodape: 'Guerra de Cartas · o meme é o campo de batalha',
  });
}

function embedDesafio(p1, p2, estado) {
  return criarEmbed({
    titulo: '⚔️ Desafio de Guerra de Cartas',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `${motor.FACCOES[p1.faccao].emoji} **${p1.nome}** desafiou ${motor.FACCOES[p2.faccao].emoji} **${p2.nome}**!\n\n` +
      `**${p1.nome}** — ${motor.resumoFaccao(p1.faccao)}\n` +
      `**${p2.nome}** — ${motor.resumoFaccao(p2.faccao)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `**${p2.nome}**, aceite para começar.\n` +
      `**${p1.nome}** pode cancelar.\n\n` +
      `⏳ O desafio expira em **60s**.\n\n` +
      `${THEME.div.estrelado}`,
    cor: motor.FACCOES[p1.faccao].cor,
    thumbnail: p1.avatar,
    rodape: `Partida #${estado.matchId} · Guerra de Cartas`,
  });
}

// ── Fluxo de batalha ────────────────────────────────────────────────────────

async function mostrarBoard(message, estado, ator, alvo, opcoes = {}) {
  try {
    await message.edit(payloadBoard(estado, ator, alvo, opcoes));
  } catch (erro) {
    if (erro?.code === 10008 || erro?.code === 10062) return false;
    throw erro;
  }
  return true;
}

async function atualizarInteracao(i, payload, message) {
  if (i) {
    try {
      await i.update(payload);
      return;
    } catch {}
  }
  try {
    await message.edit(payload);
  } catch {}
}

async function esperarAcao(message, ator, alvo, estado) {
  const limite = Date.now() + TURNO_TIMEOUT_MS;
  while (Date.now() < limite) {
    let i;
    try {
      i = await message.awaitMessageComponent({ time: Math.max(1000, limite - Date.now()) });
    } catch {
      return { tipo: 'timeout' };
    }

    if (i.user.id !== ator.id) {
      await i.reply({ content: `⏳ Calma! Agora é a vez de **${ator.nome}**.`, ephemeral: true }).catch(() => {});
      continue;
    }

    const id = i.customId;
    if (id === 'guerra_render') return { tipo: 'render', i };
    if (id === 'guerra_defender') return { tipo: 'defender', i };
    if (id === 'guerra_caixa') return { tipo: 'caixa', i };
    if (id === 'guerra_especial') return { tipo: 'especial', i };
    if (id.startsWith('guerra_atk_')) {
      const indice = Number(id.split('_').pop());
      const carta = ator.mao[indice];
      if (!carta) {
        await i.reply({ content: '🃏 Essa carta não está mais na sua mão.', ephemeral: true }).catch(() => {});
        continue;
      }
      return { tipo: 'atacar', carta, i };
    }
    await i.reply({ content: '❓ Ação desconhecida. Tente novamente.', ephemeral: true }).catch(() => {});
  }
  return { tipo: 'timeout' };
}

function validarAcao(ator, escolha) {
  if (escolha.tipo === 'atacar' && ator.pontos < escolha.carta.custo) {
    return `⚡ Você precisa de **${escolha.carta.custo}⚡** para usar **${escolha.carta.nome}** (tem ${ator.pontos}).`;
  }
  if (escolha.tipo === 'especial' && ator.cargas < 1) {
    return '🎁 Abra a **Caixa Crossover** primeiro para liberar o Especial.';
  }
  if (escolha.tipo === 'especial' && ator.pontos < 3) {
    return `⚡ O Especial custa **3⚡** (você tem ${ator.pontos}).`;
  }
  if (escolha.tipo === 'caixa' && ator.caixaAberta) {
    return '🎁 Você já abriu sua Caixa Crossover nesta partida.';
  }
  return null;
}

function payloadDefesa(ator, resultado) {
  const embed = criarEmbed({
    titulo: `🛡️ ${ator.nome} defendeu!`,
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**+${resultado.pontosGanhos}⚡** de ação.\n` +
      (resultado.comprou ? '🃏 Você comprou **1 carta**.\n' : '🃏 Sua mão já estava cheia.\n') +
      `\n💠 Pontos agora: \`${ator.pontos}/${motor.PONTOS_MAX}\`\n\n` +
      `${THEME.div.estrelado}`,
    cor: CORES.verde,
    rodape: 'Defesa firme, contra-ataque em breve',
  });
  return { embeds: [embed], components: [], attachments: [] };
}

function payloadCaixa(ator, especial) {
  const embed = criarEmbed({
    titulo: '🎁 Caixa Crossover aberta!',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `Você encontrou **${especial.nome} — ${especial.titulo}**!\n` +
      `> ${especial.legenda}\n\n` +
      `⚡ **+1 ponto de ação** · 🎁 **1 carga especial**\n\n` +
      `Use o botão **Especial** no seu próximo turno para liberar o crossover.\n\n` +
      `${THEME.div.estrelado}`,
    cor: CORES.dourado,
    rodape: especial.credito || 'Crossover Guerra de Cartas',
  });
  return payloadComArte(especial, embed);
}

async function aplicarAcao(message, estado, ator, alvo, escolha) {
  const i = escolha.i || null;

  if (escolha.tipo === 'render') {
    const embed = criarEmbed({
      titulo: `🏳️ ${ator.nome} desistiu`,
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**${alvo.nome}** vence por desistência.\n\n` +
        `${THEME.div.estrelado}`,
      cor: CORES.vermelho,
    });
    await atualizarInteracao(i, { embeds: [embed], components: [], attachments: [] }, message);
    await sleep(1300);
    return 'render';
  }

  if (escolha.tipo === 'defender') {
    const resultado = motor.defender(ator);
    pushLog(estado, `🛡️ **${ator.nome}** defendeu e ganhou +${resultado.pontosGanhos}⚡.`);
    await atualizarInteracao(i, payloadDefesa(ator, resultado), message);
    await sleep(1100);
    return 'ok';
  }

  if (escolha.tipo === 'caixa') {
    const especial = motor.abrirCaixa(ator);
    if (!especial) return 'ok';
    pushLog(estado, `🎁 **${ator.nome}** abriu a Caixa Crossover e ganhou **${especial.nome}**.`);
    await atualizarInteracao(i, payloadCaixa(ator, especial), message);
    await sleep(1500);
    return 'ok';
  }

  if (escolha.tipo === 'especial') {
    const especial = ator.especialGuardado || motor.ESPECIAIS[Math.floor(Math.random() * motor.ESPECIAIS.length)];
    const resultado = motor.resolverEspecial({ atacante: ator, defensor: alvo, especial });
    if (!resultado) return 'ok';
    estado.maiorDano = Math.max(estado.maiorDano, resultado.dano);
    if (resultado.dano >= estado.maiorDano) estado.maiorDanoNome = ator.nome;
    pushLog(
      estado,
      `⚡ **${ator.nome}** usou **${especial.nome}** e causou **${resultado.dano}** de dano${resultado.critico ? ' — CRÍTICO!' : ''}.`,
    );
    const embed = embedCarta({ carta: especial, ator, alvo, resultado, tipo: 'especial' });
    await atualizarInteracao(i, payloadComArte(especial, embed), message);
    await sleep(1600);
    return resultado.abateu ? 'abateu' : 'ok';
  }

  if (escolha.tipo === 'atacar') {
    const carta = escolha.carta;
    const resultado = motor.resolverAtaque({ atacante: ator, defensor: alvo, carta });
    estado.maiorDano = Math.max(estado.maiorDano, resultado.dano);
    if (resultado.dano >= estado.maiorDano) estado.maiorDanoNome = ator.nome;
    const marcas = resultado.marcas.map((m) => m.texto).join(' · ');
    pushLog(
      estado,
      `⚔️ **${ator.nome}** usou **${carta.nome}** em **${alvo.nome}** — **${resultado.dano}** de dano${resultado.critico ? ' 💥 CRÍTICO' : ''}${marcas ? ` (${marcas})` : ''}.`,
    );
    const embed = embedCarta({ carta, ator, alvo, resultado });
    await atualizarInteracao(i, payloadComArte(carta, embed), message);
    await sleep(1600);
    return resultado.abateu ? 'abateu' : 'ok';
  }

  return 'ok';
}

async function escolherEAplicar(message, estado, ator, alvo) {
  await mostrarBoard(message, estado, ator, alvo, { desabilitado: ator.isBot });

  if (ator.isBot) {
    await sleep(1300);
    const acao = motor.escolherAcaoBot({ bot: ator, alvo });
    const escolha = {
      ...acao,
      i: null,
    };
    const bloqueio = validarAcao(ator, escolha);
    if (bloqueio) {
      const resultado = motor.defender(ator);
      pushLog(estado, `🤖 **${ator.nome}** pensou demais e defendeu (+${resultado.pontosGanhos}⚡).`);
      await message.edit(payloadDefesa(ator, resultado));
      await sleep(1000);
      return 'ok';
    }
    return aplicarAcao(message, estado, ator, alvo, escolha);
  }

  while (true) {
    const escolha = await esperarAcao(message, ator, alvo, estado);

    if (escolha.tipo === 'timeout') {
      const resultado = motor.defender(ator);
      pushLog(estado, `⏰ **${ator.nome}** não agiu a tempo e defendeu (+${resultado.pontosGanhos}⚡).`);
      const embed = criarEmbed({
        titulo: '⏰ Tempo esgotado!',
        descricao:
          `${THEME.div.bolinhas}\n\n` +
          `**${ator.nome}** não escolheu a tempo.\n` +
          `Ação automática: **defender** (+${resultado.pontosGanhos}⚡).\n\n` +
          `${THEME.div.estrelado}`,
        cor: CORES.vermelho,
      });
      await message.edit({ embeds: [embed], components: [], attachments: [] }).catch(() => {});
      await sleep(1300);
      return 'ok';
    }

    const bloqueio = validarAcao(ator, escolha);
    if (bloqueio) {
      await escolha.i.reply({ content: bloqueio, ephemeral: true }).catch(() => {});
      continue;
    }

    return aplicarAcao(message, estado, ator, alvo, escolha);
  }
}

async function finalizar(message, estado, vencedor, perdedor, motivo) {
  estado.finalizada = true;
  const empate = !vencedor || !perdedor;
  const duracao = Math.max(1, Math.round((Date.now() - estado.inicio) / 1000));

  if (!empate && !estado.treino) {
    try {
      registrarResultado({
        vencedorId: vencedor.isBot ? null : vencedor.id,
        vencedorNome: vencedor.isBot ? null : vencedor.nome,
        perdedorId: perdedor.isBot ? null : perdedor.id,
        perdedorNome: perdedor.isBot ? null : perdedor.nome,
        estatisticasVencedor: {
          cartasJogadas: vencedor.cartasJogadas,
          danoTotal: vencedor.danoTotal,
        },
        estatisticasPerdedor: {
          cartasJogadas: perdedor.cartasJogadas,
          danoTotal: perdedor.danoTotal,
        },
      });
    } catch {}
  }

  const [p1, p2] = estado.jogadores;
  const statsVencedor = vencedor && !vencedor.isBot && !estado.treino ? estatisticas(vencedor.id) : null;

  const titulo = empate ? '🤝 Empate na Guerra de Cartas' : `🏆 ${vencedor.nome} venceu!`;
  const cor = empate ? CORES.azul : CORES.dourado;
  const primeiro = criarEmbed({
    titulo,
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      (empate
        ? 'Os dois lados resistiram até o fim. O placar não se moveu.\n'
        : `**${vencedor.nome}** derrotou **${perdedor.nome}** por **${motivo}**.\n`) +
      `\n${motor.barraHp(p1.hp, p1.hpMax)} **${p1.nome}** \`${p1.hp} HP\`\n` +
      `${motor.barraHp(p2.hp, p2.hpMax)} **${p2.nome}** \`${p2.hp} HP\`\n\n` +
      `${THEME.div.estrelado}`,
    cor,
    thumbnail: vencedor?.avatar,
    rodape: `Partida #${estado.matchId} · ${duracao}s · ${estado.rodada} rodada(s)`,
  });

  const resumo = criarEmbed({
    titulo: '📊 Resumo da partida',
    descricao: `${THEME.div.bolinhas}`,
    cor: CORES.painel,
  });
  resumo.addFields(
    { name: '⏱️ Duração', value: `\`${duracao}s\``, inline: true },
    { name: '🔁 Rodadas', value: `\`${estado.rodada}\``, inline: true },
    { name: '🏳️ Motivo', value: `\`${motivo}\``, inline: true },
    {
      name: `${p1.nome}`,
      value: `🎴 \`${p1.cartasJogadas}\` cartas\n💥 \`${p1.danoTotal}\` de dano`,
      inline: true,
    },
    {
      name: `${p2.nome}`,
      value: `🎴 \`${p2.cartasJogadas}\` cartas\n💥 \`${p2.danoTotal}\` de dano`,
      inline: true,
    },
    {
      name: '💥 Maior golpe',
      value: `\`${estado.maiorDano}\` de dano${estado.maiorDanoNome ? ` — ${estado.maiorDanoNome}` : ''}`,
      inline: true,
    },
  );

  const final = criarEmbed({
    titulo: empate ? '🤝 Fim da linha' : '🏆 Resultado final',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      (empate
        ? 'Ninguém cedeu. A guerra termina em equilíbrio.\n\n'
        : `**${vencedor.nome}** leva a vitória para casa.\n\n`) +
      (statsVencedor
        ? `📈 **${statsVencedor.nome}** — \`${statsVencedor.vitorias}V\` · \`${statsVencedor.derrotas}D\` · \`${statsVencedor.winrate}%\` de winrate · sequência \`${statsVencedor.sequencia}\`\n\n`
        : '') +
      (estado.treino ? '🎮 **Modo treino** — esta partida não alterou o placar.\n\n' : '') +
      `Quer outra? Clique em **Revanche**.\n\n` +
      `${THEME.div.estrelado}`,
    cor,
    thumbnail: vencedor?.avatar,
    rodape: 'Guerra de Cartas · obrigado por jogar ♡',
  });

  try {
    await message.edit({ embeds: [primeiro], components: [], attachments: [] });
    await sleep(1100);
    await message.edit({ embeds: [resumo], components: [], attachments: [] });
    await sleep(1100);
    await message.edit({ embeds: [final], components: [criarBotoesFim()], attachments: [] });
  } catch {
    return;
  }

  while (true) {
    let i;
    try {
      i = await message.awaitMessageComponent({ time: FINAL_TIMEOUT_MS });
    } catch {
      try { await message.edit({ components: [] }); } catch {}
      return;
    }

    if (i.customId === 'guerra_placar') {
      await i.reply({ embeds: [placarEmbed()], ephemeral: true }).catch(() => {});
      continue;
    }
    if (i.customId === 'guerra_manual') {
      await i.reply({ embeds: [manualEmbed()], ephemeral: true }).catch(() => {});
      continue;
    }
    if (i.customId === 'guerra_revanche') {
      const participantes = estado.jogadores.map((j) => j.id);
      if (!participantes.includes(i.user.id)) {
        await i.reply({ content: '🏳️ Só quem jogou esta partida pode pedir revanche.', ephemeral: true }).catch(() => {});
        continue;
      }
      await i.deferUpdate().catch(() => {});
      const [novoP1, novoP2] = criarDupla(
        { id: p1.id, nome: p1.nome, avatar: p1.avatar, isBot: p1.isBot },
        { id: p2.id, nome: p2.nome, avatar: p2.avatar, isBot: p2.isBot },
      );
      return iniciarBatalha({ message, jogador1: novoP1, jogador2: novoP2, treino: estado.treino });
    }
    await i.reply({ content: '🏁 A partida já terminou. Use **Revanche** para jogar de novo.', ephemeral: true }).catch(() => {});
  }
}

async function iniciarBatalha({ message, jogador1, jogador2, treino = false }) {
  const estado = {
    matchId: `${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
    jogadores: [jogador1, jogador2],
    turno: 0,
    rodada: 1,
    log: [],
    inicio: Date.now(),
    finalizada: false,
    treino,
    maiorDano: 0,
    maiorDanoNome: '',
  };

  motor.comprar(jogador1, motor.MAO_INICIAL);
  motor.comprar(jogador2, motor.MAO_INICIAL);

  const primeiro = Math.random() < 0.5 ? 0 : 1;

  const frames = [
    {
      titulo: '🎴 Embaralhando o baralho do caos...',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**${motor.CARTAS.length} cartas** entram no baralho.\n` +
        `Cada lado compra **${motor.MAO_INICIAL} cartas**.\n\n` +
        `${THEME.div.estrelado}`,
      cor: CORES.fundo,
    },
    {
      titulo: '🃏 Distribuindo as mãos...',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `${motor.FACCOES[jogador1.faccao].emoji} **${jogador1.nome}** — ${motor.FACCOES[jogador1.faccao].nome}\n` +
        `${motor.FACCOES[jogador2.faccao].emoji} **${jogador2.nome}** — ${motor.FACCOES[jogador2.faccao].nome}\n\n` +
        `${THEME.div.coracao}`,
      cor: motor.FACCOES[jogador1.faccao].cor,
    },
    {
      titulo: '⚔️ Que vença o melhor meme!',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `🇺🇸 **Blockbuster** · 🌐 **Viral** · 🇧🇷 **Brasil** · 🕹️ **Cult**\n\n` +
        `🪙 O sorteio decidiu: **${estado.jogadores[primeiro].nome}** começa!\n` +
        `Leia a mão, gaste seus pontos e derrube os **${motor.HP_MAX} HP** do rival.\n\n` +
        `${THEME.div.estrelado}`,
      cor: CORES.dourado,
    },
  ];

  try {
    for (const frame of frames) {
      await message.edit({
        content: '',
        embeds: [criarEmbed({ ...frame, rodape: 'Guerra de Cartas · preparando o duelo' })],
        components: [],
        attachments: [],
      });
      await sleep(750);
    }
  } catch {
    return;
  }

  let turno = primeiro;
  let rodada = 1;

  while (rodada <= motor.TURNOS_MAX) {
    const ator = estado.jogadores[turno];
    const alvo = estado.jogadores[1 - turno];
    estado.turno = turno;
    estado.rodada = rodada;

    const inicioTurno = motor.processarInicioTurno(ator);
    if (inicioTurno.linhas.length) {
      inicioTurno.linhas.forEach((linha) => pushLog(estado, linha));
    }

    if (ator.hp <= 0) {
      return finalizar(message, estado, alvo, ator, 'queimadura');
    }

    if (inicioTurno.atordoado) {
      await mostrarBoard(message, estado, ator, alvo, {
        desabilitado: true,
        aviso: `⚡ **${ator.nome} está atordoado e perdeu o turno!**`,
      });
      await sleep(1600);
      turno = 1 - turno;
      rodada += 1;
      continue;
    }

    // Regeneração passiva: todo turno ativo começa com +1⚡.
    ator.pontos = Math.min(motor.PONTOS_MAX, ator.pontos + 1);

    motor.comprar(ator, Math.max(0, motor.MAO_INICIAL - ator.mao.length));

    const resultado = await escolherEAplicar(message, estado, ator, alvo);
    if (resultado === 'render') {
      return finalizar(message, estado, alvo, ator, 'desistência');
    }
    if (ator.hp <= 0) {
      return finalizar(message, estado, alvo, ator, 'queimadura');
    }
    if (alvo.hp <= 0) {
      return finalizar(message, estado, ator, alvo, 'nocaute');
    }

    turno = 1 - turno;
    rodada += 1;
  }

  const [p1, p2] = estado.jogadores;
  if (p1.hp === p2.hp) {
    return finalizar(message, estado, null, null, 'limite de rodadas');
  }
  return finalizar(
    message,
    estado,
    p1.hp > p2.hp ? p1 : p2,
    p1.hp > p2.hp ? p2 : p1,
    'limite de rodadas',
  );
}

// ── Criação de jogadores ────────────────────────────────────────────────────

function criarDupla(base1, base2) {
  let f1 = motor.ORDEM_FACCOES[Math.floor(Math.random() * motor.ORDEM_FACCOES.length)];
  let f2 = motor.ORDEM_FACCOES[Math.floor(Math.random() * motor.ORDEM_FACCOES.length)];
  if (f2 === f1) {
    f2 = motor.ORDEM_FACCOES[(motor.ORDEM_FACCOES.indexOf(f1) + 1) % motor.ORDEM_FACCOES.length];
  }
  return [
    motor.criarJogador({ ...base1, faccao: f1 }),
    motor.criarJogador({ ...base2, faccao: f2 }),
  ];
}

function baseDoUsuario(user, isBot = false) {
  return {
    id: user.id,
    nome: user.username,
    avatar: user.displayAvatarURL ? user.displayAvatarURL({ size: 256 }) : undefined,
    isBot,
  };
}

// ── Entradas do comando ─────────────────────────────────────────────────────

async function enviarErro(interaction, texto) {
  const payload = { content: texto, ephemeral: true };
  try {
    if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch {
    return null;
  }
}

async function enviarManual(interaction) {
  const msg = await interaction.reply({
    embeds: [manualEmbed()],
    components: [criarBotoesManual()],
    fetchReply: true,
  });
  if (!msg || !msg.createMessageComponentCollector) return;

  let iniciado = false;
  const coletor = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });
  coletor.on('collect', async (i) => {
    if (i.customId === 'guerra_placar') {
      await i.reply({ embeds: [placarEmbed()], ephemeral: true }).catch(() => {});
      return;
    }
    if (i.customId === 'guerra_treinar') {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '🎮 Use `$guerra` para abrir o seu próprio treino.', ephemeral: true }).catch(() => {});
        return;
      }
      const agora = Date.now();
      const ultima = guerraCooldowns.get(i.user.id) || 0;
      if (agora - ultima < GUERRA_COOLDOWN_MS) {
        const restante = Math.ceil((GUERRA_COOLDOWN_MS - (agora - ultima)) / 1000);
        await i.reply({ content: `⏱️ Espere mais **${restante}s** antes de iniciar outro treino.`, ephemeral: true }).catch(() => {});
        return;
      }
      guerraCooldowns.set(i.user.id, agora);
      iniciado = true;
      coletor.stop('treino');
      await i.deferUpdate().catch(() => {});
      const bot = interaction.client.user;
      const [p1, p2] = criarDupla(baseDoUsuario(interaction.user, false), baseDoUsuario(bot, true));
      return iniciarBatalha({ message: msg, jogador1: p1, jogador2: p2, treino: true });
    }
  });
  coletor.on('end', async () => {
    if (iniciado) return;
    try { await msg.edit({ components: [] }); } catch {}
  });
}

async function enviarPlacar(interaction) {
  return interaction.reply({ embeds: [placarEmbed()] });
}

async function treinar(interaction) {
  const agora = Date.now();
  const ultima = guerraCooldowns.get(interaction.user.id) || 0;
  if (agora - ultima < GUERRA_COOLDOWN_MS) {
    const restante = Math.ceil((GUERRA_COOLDOWN_MS - (agora - ultima)) / 1000);
    return enviarErro(interaction, `⏱️ Espere mais **${restante}s** antes de iniciar outro treino.`);
  }
  guerraCooldowns.set(interaction.user.id, agora);

  const bot = interaction.client.user;
  const [p1, p2] = criarDupla(baseDoUsuario(interaction.user, false), baseDoUsuario(bot, true));
  const msg = await interaction.reply({
    embeds: [
      criarEmbed({
        titulo: '🤖 Treino contra a Mila',
        descricao:
          `${THEME.div.bolinhas}\n\n` +
          `${motor.FACCOES[p1.faccao].emoji} **${interaction.user.username}** — ${motor.FACCOES[p1.faccao].nome}\n` +
          `${motor.FACCOES[p2.faccao].emoji} **${bot.username}** — ${motor.FACCOES[p2.faccao].nome}\n\n` +
          `A Mila aceitou o desafio. Vamos ver se você aguenta o caos.\n\n` +
          `${THEME.div.estrelado}`,
        cor: CORES.painel,
        rodape: 'Guerra de Cartas · treino',
      }),
    ],
    fetchReply: true,
  });
  await sleep(900);
  return iniciarBatalha({ message: msg, jogador1: p1, jogador2: p2, treino: true });
}

async function desafiar(interaction, oponente) {
  const agora = Date.now();
  const ultima = guerraCooldowns.get(interaction.user.id) || 0;
  if (agora - ultima < GUERRA_COOLDOWN_MS) {
    const restante = Math.ceil((GUERRA_COOLDOWN_MS - (agora - ultima)) / 1000);
    return enviarErro(interaction, `⏱️ Calma, guerreiro! Espere **${restante}s** para desafiar de novo.`);
  }
  guerraCooldowns.set(interaction.user.id, agora);

  const [p1, p2] = criarDupla(baseDoUsuario(interaction.user, false), baseDoUsuario(oponente, false));
  const estado = { matchId: `${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 90 + 10)}` };

  const msg = await interaction.reply({
    content: `${oponente} — você foi desafiado para a Guerra de Cartas!`,
    embeds: [embedDesafio(p1, p2, estado)],
    components: [criarBotoesDesafio()],
    allowedMentions: { users: [oponente.id] },
    fetchReply: true,
  });

  const limite = Date.now() + DESAFIO_TIMEOUT_MS;
  while (Date.now() < limite) {
    let i;
    try {
      i = await msg.awaitMessageComponent({ time: Math.max(1000, limite - Date.now()) });
    } catch {
      break;
    }

    if (i.customId === 'guerra_cancelar') {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '✖️ Só quem enviou o desafio pode cancelar.', ephemeral: true }).catch(() => {});
        continue;
      }
      await i.update({
        content: '',
        embeds: [
          criarEmbed({
            titulo: '✖️ Desafio cancelado',
            descricao: `${THEME.div.bolinhas}\n\nO desafio de **${interaction.user.username}** foi cancelado.\n\n${THEME.div.coracao}`,
            cor: CORES.vermelho,
          }),
        ],
        components: [],
      }).catch(() => {});
      return;
    }

    if (i.customId === 'guerra_aceitar' || i.customId === 'guerra_recusar') {
      if (i.user.id !== oponente.id) {
        await i.reply({ content: '👀 Só o desafiado pode aceitar ou recusar.', ephemeral: true }).catch(() => {});
        continue;
      }
      if (i.customId === 'guerra_recusar') {
        await i.update({
          content: '',
          embeds: [
            criarEmbed({
              titulo: '❌ Desafio recusado',
              descricao: `${THEME.div.bolinhas}\n\n**${oponente.username}** recusou o desafio.\n\n${THEME.div.coracao}`,
              cor: CORES.vermelho,
            }),
          ],
          components: [],
        }).catch(() => {});
        return;
      }
      await i.deferUpdate().catch(() => {});
      return iniciarBatalha({ message: msg, jogador1: p1, jogador2: p2 });
    }

    await i.reply({ content: '❓ Ação desconhecida.', ephemeral: true }).catch(() => {});
  }

  try {
    await msg.edit({
      content: '',
      embeds: [
        criarEmbed({
          titulo: '⌛ Desafio expirado',
          descricao: `${THEME.div.bolinhas}\n\nNinguém respondeu ao desafio a tempo.\n\n${THEME.div.coracao}`,
          cor: CORES.vermelho,
        }),
      ],
      components: [],
    });
  } catch {}
}

module.exports = {
  data: {
    name: 'guerra',
    description: '⚔️ Guerra de Cartas — duelo 1v1 com memes dos EUA e do Brasil',
    options: [
      { name: 'usuario', description: 'Usuário desafiado (ou a própria Mila para treinar)', type: 6, required: false },
      {
        name: 'sub',
        description: 'manual, placar, ranking ou treino',
        type: 3,
        required: false,
        choices: [
          { name: 'manual', value: 'manual' },
          { name: 'placar', value: 'placar' },
          { name: 'ranking', value: 'ranking' },
          { name: 'treino', value: 'treino' },
        ],
      },
    ],
  },

  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 900).catch(() => {});

    const sub = interaction.options && typeof interaction.options.getString === 'function'
      ? (interaction.options.getString('sub') || '').toLowerCase()
      : (interaction._guerraArgs || []).join(' ').toLowerCase();

    if (sub === 'placar' || sub === 'ranking') return enviarPlacar(interaction);
    if (sub === 'manual' || sub === 'ajuda' || sub === 'help' || sub === 'regras') return enviarManual(interaction);

    let oponente = interaction.options && interaction.options.getUser
      ? interaction.options.getUser('usuario')
      : null;
    if (!oponente && interaction._guerraMention) oponente = interaction._guerraMention;
    if (!oponente && interaction.message?.mentions?.users) {
      oponente = interaction.message.mentions.users.first() || null;
    }

    if (sub === 'treino') return treinar(interaction);

    if (!oponente) return enviarManual(interaction);

    if (oponente.id === interaction.client.user.id) return treinar(interaction);

    if (oponente.bot) {
      return enviarErro(interaction, '🤖 Eu só posso duelar com humanos — ou comigo mesma no modo treino.');
    }

    if (oponente.id === interaction.user.id) {
      return enviarErro(interaction, '🙃 Duelar contra si mesmo é permitido no xadrez mental, não aqui. Marque outra pessoa.');
    }

    return desafiar(interaction, oponente);
  },
};
