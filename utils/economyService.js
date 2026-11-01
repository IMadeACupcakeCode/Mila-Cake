// utils/economyService.js
// ── Regras da Economia da Mila ────────────────────────────────────────
// Toda a lógica (diário com streak, trabalho com cooldown, doações,
// conquistas, ranking e extrato) mora aqui. Os comandos só desenham.
// O site consome as mesmas funções por /api, então os números batem.

const db = require('./db');
const criador = require('./criador');
const loja = require('./economyLoja');

const DIARIO_COOLDOWN = 24 * 60 * 60 * 1000; // 24h
const DIARIO_JANELA_STREAK = 48 * 60 * 60 * 1000; // até 48h mantém a sequência
const TRABALHO_COOLDOWN = 15 * 60 * 1000; // 15 min

// ── Conquistas ────────────────────────────────────────────────────────
// `verifica` recebe (estatisticas, extras) e devolve true/false.
const CONQUISTAS = [
  {
    id: 'primeiro_diario',
    nome: 'Primeiro Doce',
    emoji: '🧁',
    descricao: 'Resgate o diário pela primeira vez.',
    verifica: (e) => e.diarios >= 1,
  },
  {
    id: 'semana_doce',
    nome: 'Semana Doce',
    emoji: '📅',
    descricao: 'Mantenha uma sequência de 7 dias.',
    verifica: (e) => e.streak >= 7,
  },
  {
    id: 'mes_doce',
    nome: 'Mês de Açúcar',
    emoji: '🗓️',
    descricao: 'Mantenha uma sequência de 30 dias.',
    verifica: (e) => e.streak >= 30,
  },
  {
    id: 'maos_na_massa',
    nome: 'Mãos na Massa',
    emoji: '👩‍🍳',
    descricao: 'Complete 10 jornadas de trabalho.',
    verifica: (e) => e.trabalhos >= 10,
  },
  {
    id: 'colecionador',
    nome: 'Colecionador',
    emoji: '🎒',
    descricao: 'Tenha 5 itens diferentes na mochila.',
    verifica: (e, extras) => extras.itensDistintos >= 5,
  },
  {
    id: 'acucarado',
    nome: 'Açucarado',
    emoji: '💰',
    descricao: 'Acumule 10.000 açúcares.',
    verifica: (e) => e.acucares >= 10000 || e.totalGanho >= 10000,
  },
  {
    id: 'coracao_de_acucar',
    nome: 'Coração de Açúcar',
    emoji: '💝',
    descricao: 'Doe 1.000 açúcares para alguém.',
    verifica: (e) => e.totalDoado >= 1000,
  },
  {
    id: 'cliente_vip',
    nome: 'Cliente VIP',
    emoji: '🛍️',
    descricao: 'Faça 5 compras na loja.',
    verifica: (e) => e.compras >= 5,
  },
  {
    id: 'sorte_grande',
    nome: 'Sorte Grande',
    emoji: '🎰',
    descricao: 'Abra 10 pacotes ou gire a roleta 10 vezes.',
    verifica: (e) => e.coletas >= 10,
  },
  {
    id: 'nivel_10',
    nome: 'Confeiteiro Experiente',
    emoji: '📈',
    descricao: 'Alcance o nível 10.',
    verifica: (e) => e.level >= 10,
  },
  {
    id: 'criador',
    nome: 'Criador da Mila',
    emoji: '👑',
    descricao: 'Reconhecido(a) pela própria Mila.',
    verifica: (e, extras) => Boolean(extras.ehCriador),
  },
];

function mapaConquistas() {
  return new Map(CONQUISTAS.map((c) => [c.id, c]));
}

/**
 * Verifica e desbloqueia conquistas. Retorna as recém-conquistadas.
 */
function concederConquistas(userId) {
  const estatisticas = db.obterEstatisticas(userId);
  const extras = {
    itensDistintos: db.contarItensDistintos(userId),
    ehCriador: criador.ehCriador(userId),
  };
  const jaTem = new Set(db.listarConquistas(userId).map((c) => c.conquista_id));
  const novas = [];
  for (const conquista of CONQUISTAS) {
    if (jaTem.has(conquista.id)) continue;
    let ok = false;
    try {
      ok = Boolean(conquista.verifica(estatisticas, extras));
    } catch {
      ok = false;
    }
    if (ok && db.desbloquearConquista(userId, conquista.id)) {
      novas.push(conquista);
    }
  }
  return novas;
}

function listarConquistas(userId) {
  const desbloqueadas = new Map(db.listarConquistas(userId).map((c) => [c.conquista_id, c.desbloqueada_em]));
  return CONQUISTAS.map((c) => ({
    ...c,
    desbloqueada: desbloqueadas.has(c.id),
    desbloqueadaEm: desbloqueadas.get(c.id) || 0,
  }));
}

// ── Diário ────────────────────────────────────────────────────────────
function statusDiario(userId) {
  const dados = db.getUsuario(userId);
  const agora = Date.now();
  const ultimo = Number(dados.ultimo_diario) || 0;
  const cooldown = Number(dados.cooldown_diario) || 0;
  const pronto = !cooldown || agora - cooldown >= DIARIO_COOLDOWN;
  const restante = pronto ? 0 : DIARIO_COOLDOWN - (agora - cooldown);
  const mantemStreak = ultimo > 0 && agora - ultimo <= DIARIO_JANELA_STREAK;
  return {
    pronto,
    restante,
    streak: Number(dados.streak_diario) || 0,
    mantemStreak,
    ultimo,
  };
}

/**
 * Resgata o diário. Retorna { ok, motivo, quantidade, streak, saldo, conquistas }.
 */
function resgatarDiario(userId) {
  const dados = db.getUsuario(userId);
  const agora = Date.now();
  const cooldown = Number(dados.cooldown_diario) || 0;
  if (cooldown && agora - cooldown < DIARIO_COOLDOWN) {
    return { ok: false, motivo: 'cooldown', restante: DIARIO_COOLDOWN - (agora - cooldown) };
  }

  const ultimo = Number(dados.ultimo_diario) || 0;
  const mantem = ultimo > 0 && agora - ultimo <= DIARIO_JANELA_STREAK;
  const streak = mantem ? (Number(dados.streak_diario) || 0) + 1 : 1;

  const base = Math.floor(Math.random() * 600) + 200; // 200–800
  const bonusStreak = Math.min(streak, 7) * 50; // até +350
  const bonusSorte = Math.random() < 0.08 ? 500 : 0; // prêmio raro
  const quantidade = base + bonusStreak + bonusSorte;

  const ehCriador = criador.ehCriador(userId);
  db.addAcucares(userId, quantidade);
  db.incrementarEstatistica(userId, 'ganho', quantidade);
  db.incrementarEstatistica(userId, 'diario', 1);
  db.definirStreak(userId, streak, agora);
  db.db.prepare('UPDATE usuarios SET cooldown_diario = ?, criado_em = CASE WHEN criado_em = 0 THEN ? ELSE criado_em END WHERE id = ?')
    .run(agora, agora, userId);
  if (!ehCriador) db.registrarTransacao(userId, 'diario', quantidade, `Sequência de ${streak} dia(s)`);

  const conquistas = concederConquistas(userId);
  const saldo = criador.ehCriador(userId) ? criador.PONTOS_INFINITOS : db.getUsuario(userId).acucares;
  return { ok: true, quantidade, base, bonusStreak, bonusSorte, streak, saldo, conquistas, ehCriador };
}

// ── Trabalho ──────────────────────────────────────────────────────────
function statusTrabalho(userId) {
  const dados = db.getUsuario(userId);
  const agora = Date.now();
  const cooldown = Number(dados.cooldown_trabalho) || 0;
  const restante = Math.max(0, TRABALHO_COOLDOWN - (agora - cooldown));
  return { pronto: restante === 0, restante };
}

function recompensaTrabalho(level = 1, acertou = true) {
  const nivel = Math.max(1, Number(level) || 1);
  const base = Math.floor(Math.random() * 120) + 40; // 40–160
  const escala = 1 + (nivel - 1) * 0.05;
  const critico = Math.random() < 0.12;
  const multiplicador = (acertou ? 1 : 0.35) * (critico ? 1.5 : 1);
  const quantidade = Math.max(10, Math.round(base * escala * multiplicador));
  return { quantidade, critico, acertou };
}

function concluirTrabalho(userId, { acertou = true } = {}) {
  const dados = db.getUsuario(userId);
  const agora = Date.now();
  const cooldown = Number(dados.cooldown_trabalho) || 0;
  if (cooldown && agora - cooldown < TRABALHO_COOLDOWN) {
    return { ok: false, motivo: 'cooldown', restante: TRABALHO_COOLDOWN - (agora - cooldown) };
  }

  const premio = recompensaTrabalho(dados.level, acertou);
  const ehCriador = criador.ehCriador(userId);
  db.addAcucares(userId, premio.quantidade);
  db.incrementarEstatistica(userId, 'ganho', premio.quantidade);
  db.incrementarEstatistica(userId, 'trabalho', 1);
  db.db.prepare('UPDATE usuarios SET cooldown_trabalho = ?, criado_em = CASE WHEN criado_em = 0 THEN ? ELSE criado_em END WHERE id = ?')
    .run(agora, agora, userId);
  if (!ehCriador) db.registrarTransacao(userId, 'trabalho', premio.quantidade, acertou ? 'Jornada concluída' : 'Jornada parcial');

  const conquistas = concederConquistas(userId);
  const saldo = criador.ehCriador(userId) ? criador.PONTOS_INFINITOS : db.getUsuario(userId).acucares;
  return { ok: true, ...premio, saldo, conquistas, ehCriador };
}

// ── Carteira ──────────────────────────────────────────────────────────
function posicaoRanking(userId, categoria = 'money') {
  const coluna = categoria === 'xp' ? 'level DESC, xp DESC' : 'acucares DESC';
  const lista = db.db
    .prepare(`SELECT id FROM usuarios ORDER BY ${coluna}`)
    .all();
  const indice = lista.findIndex((linha) => linha.id === userId);
  return indice >= 0 ? indice + 1 : lista.length + 1;
}

function carteira(userId) {
  const estatisticas = db.obterEstatisticas(userId);
  return {
    ...estatisticas,
    itens: db.contarInventario(userId),
    itensDistintos: db.contarItensDistintos(userId),
    posicaoDinheiro: posicaoRanking(userId, 'money'),
    posicaoXp: posicaoRanking(userId, 'xp'),
    ehCriador: criador.ehCriador(userId),
    diario: statusDiario(userId),
    trabalho: statusTrabalho(userId),
  };
}

// ── Ranking ───────────────────────────────────────────────────────────
function ranking(categoria = 'money', limite = 10) {
  const lim = Math.max(1, Math.min(50, Number(limite) || 10));
  if (categoria === 'xp') {
    const top = db.getTopLevel(lim);
    const max = Math.max(1, ...top.map((l) => l.level * 1000 + l.xp));
    return top.map((l, i) => ({
      posicao: i + 1,
      id: l.id,
      valor: l.level * 1000 + l.xp,
      level: l.level,
      xp: l.xp,
      max,
      ehCriador: criador.ehCriador(l.id),
    }));
  }

  // Dinheiro: o criador sempre lidera com +999999.
  const base = db.getTopAcucares(100);
  const porId = new Map(base.map((l) => [l.id, { ...l }]));
  for (const id of criador.idsConhecidos()) {
    const atual = porId.get(id) || { id, acucares: criador.PONTOS_INFINITOS };
    porId.set(id, { ...atual, acucares: criador.PONTOS_INFINITOS });
  }
  const lista = [...porId.values()]
    .sort((a, b) => (Number(b.acucares) || 0) - (Number(a.acucares) || 0))
    .slice(0, lim);
  const max = Math.max(1, ...lista.map((l) => criador.pontosDe(l.id, l.acucares)));
  return lista.map((l, i) => ({
    posicao: i + 1,
    id: l.id,
    valor: criador.pontosDe(l.id, l.acucares),
    acucares: criador.pontosDe(l.id, l.acucares),
    max,
    ehCriador: criador.ehCriador(l.id),
  }));
}

// ── Extrato ───────────────────────────────────────────────────────────
function extrato(userId, limite = 10) {
  return db.listarTransacoes(userId, limite).map((t) => ({
    tipo: t.tipo,
    valor: Number(t.valor) || 0,
    detalhe: t.detalhe || '',
    em: Number(t.criado_em) || 0,
  }));
}

// ── Doação ────────────────────────────────────────────────────────────
function doar(deId, paraId, quantidade) {
  const valor = Number(quantidade);
  if (!Number.isInteger(valor) || valor <= 0) return { ok: false, motivo: 'valor' };
  if (deId === paraId) return { ok: false, motivo: 'mesmo_usuario' };

  const ehCriador = criador.ehCriador(deId);
  const saldoAntes = db.getUsuario(deId).acucares;
  if (!ehCriador && saldoAntes < valor) return { ok: false, motivo: 'sem_saldo', saldo: saldoAntes };

  const sucesso = db.transferirAcucares(deId, paraId, valor);
  if (!sucesso) return { ok: false, motivo: 'falhou' };

  db.incrementarEstatistica(deId, 'doado', valor);
  if (!ehCriador) db.registrarTransacao(deId, 'doacao', -valor, `Para ${paraId}`);
  db.registrarTransacao(paraId, 'doacao', valor, `De ${deId}`);
  db.incrementarEstatistica(paraId, 'ganho', valor);

  concederConquistas(deId);
  concederConquistas(paraId);

  return {
    ok: true,
    quantidade: valor,
    saldo: criador.ehCriador(deId) ? criador.PONTOS_INFINITOS : db.getUsuario(deId).acucares,
    ehCriador,
  };
}


// ?"? Doacao de itens (presentes) ?"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function doarItem(deId, paraId, itemId, quantidade = 1) {
  const item = loja.buscarItem(itemId);
  if (!item) return { ok: false, motivo: 'item_invalido' };
  if (deId === paraId) return { ok: false, motivo: 'mesmo_usuario' };
  const qtd = Math.max(1, Number(quantidade) || 1);
  const sucesso = db.transferirItem(deId, paraId, itemId, qtd);
  if (!sucesso) return { ok: false, motivo: 'sem_item' };

  try {
    db.registrarTransacao(deId, 'presente', 0, `Presenteou ${qtd}x ${item.nome} para ${paraId}`);
    db.registrarTransacao(paraId, 'presente', 0, `Recebeu ${qtd}x ${item.nome} de ${deId}`);
  } catch {}
  concederConquistas(deId);
  concederConquistas(paraId);

  return {
    ok: true,
    item,
    quantidade: qtd,
    ehCriador: criador.ehCriador(deId),
  };
}

module.exports = {
  DIARIO_COOLDOWN,
  DIARIO_JANELA_STREAK,
  TRABALHO_COOLDOWN,
  CONQUISTAS,
  mapaConquistas,
  concederConquistas,
  listarConquistas,
  statusDiario,
  resgatarDiario,
  statusTrabalho,
  recompensaTrabalho,
  concluirTrabalho,
  carteira,
  posicaoRanking,
  ranking,
  extrato,
  doar,
  doarItem,
  loja,
};
