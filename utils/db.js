const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const criador = require('./criador');

// Garante que a pasta "data" exista
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(process.env.MILA_DATABASE_PATH || path.join(dataDir, 'mila.db'));

// ── Ajustes de desempenho e integridade ────────────────────────────────
// WAL + synchronous=NORMAL é o modo recomendado para servidor: mantém a
// durabilidade contra queda do processo sem um fsync por escrita (o gargalo
// em um bot que grava XP/cooldown a cada mensagem).
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
db.pragma('temp_store = MEMORY');
db.pragma('wal_autocheckpoint = 1000');

// Inicializa as tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    acucares INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    titulo_personalizado TEXT DEFAULT 'Iniciante',
    cooldown_diario INTEGER DEFAULT 0,
    cooldown_xp INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    item_id TEXT,
    quantidade INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS mensagens_processadas (
    message_id TEXT PRIMARY KEY,
    processada_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comandos_processados (
    fingerprint TEXT PRIMARY KEY,
    processada_em INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_inventario_user ON inventario(user_id);
  CREATE INDEX IF NOT EXISTS idx_usuarios_rank ON usuarios(level DESC, xp DESC);
  CREATE INDEX IF NOT EXISTS idx_usuarios_acucares ON usuarios(acucares DESC);
  CREATE INDEX IF NOT EXISTS idx_mensagens_em ON mensagens_processadas(processada_em);
  CREATE INDEX IF NOT EXISTS idx_comandos_em ON comandos_processados(processada_em);

  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor INTEGER NOT NULL DEFAULT 0,
    detalhe TEXT DEFAULT '',
    criado_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conquistas (
    user_id TEXT NOT NULL,
    conquista_id TEXT NOT NULL,
    desbloqueada_em INTEGER NOT NULL,
    PRIMARY KEY (user_id, conquista_id)
  );

  CREATE INDEX IF NOT EXISTS idx_transacoes_user ON transacoes(user_id, criado_em DESC);
  CREATE INDEX IF NOT EXISTS idx_conquistas_user ON conquistas(user_id);
`);

// ── Migração de colunas da economia ───────────────────────────────────
// Bancos antigos (mila.db já existente) não têm as colunas novas. ALTER TABLE
// só é executado quando a coluna realmente falta, então é seguro rodar sempre.
const COLUNAS_EXTRAS = {
  streak_diario: 'INTEGER DEFAULT 0',
  ultimo_diario: 'INTEGER DEFAULT 0',
  cooldown_trabalho: 'INTEGER DEFAULT 0',
  total_ganho: 'INTEGER DEFAULT 0',
  total_gasto: 'INTEGER DEFAULT 0',
  total_doado: 'INTEGER DEFAULT 0',
  trabalhos: 'INTEGER DEFAULT 0',
  compras: 'INTEGER DEFAULT 0',
  diarios: 'INTEGER DEFAULT 0',
  coletas: 'INTEGER DEFAULT 0',
  criado_em: 'INTEGER DEFAULT 0',
};

(function garantirColunas() {
  const existentes = new Set(db.prepare('PRAGMA table_info(usuarios)').all().map((c) => c.name));
  for (const [nome, tipo] of Object.entries(COLUNAS_EXTRAS)) {
    if (!existentes.has(nome)) {
      try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN ${nome} ${tipo}`);
      } catch {
        // Coluna criada por outra instância no meio do caminho: ignora.
      }
    }
  }
})();

// ── Statements preparados uma única vez ─────────────────────────────────
// Antes cada chamada recompilava o SQL (db.prepare dentro da função), o que
// acontecia várias vezes por mensagem no caminho de XP.
const sql = {
  selecionarUsuario: db.prepare('SELECT * FROM usuarios WHERE id = ?'),
  inserirUsuario: db.prepare('INSERT OR IGNORE INTO usuarios (id) VALUES (?)'),
  atualizarAcucares: db.prepare('UPDATE usuarios SET acucares = MAX(0, acucares + ?) WHERE id = ? RETURNING acucares'),
  atualizarXp: db.prepare('UPDATE usuarios SET xp = ?, level = ? WHERE id = ?'),
  ganharCooldownXp: db.prepare('UPDATE usuarios SET cooldown_xp = ? WHERE id = ? AND cooldown_xp <= ?'),
  topLevel: db.prepare('SELECT id, level, xp FROM usuarios ORDER BY level DESC, xp DESC LIMIT ?'),
  topAcucares: db.prepare('SELECT id, acucares FROM usuarios ORDER BY acucares DESC LIMIT ?'),
  inventario: db.prepare('SELECT item_id, quantidade FROM inventario WHERE user_id = ?'),
  itemInventario: db.prepare('SELECT * FROM inventario WHERE user_id = ? AND item_id = ?'),
  somarItem: db.prepare('UPDATE inventario SET quantidade = quantidade + ? WHERE id = ?'),
  inserirItem: db.prepare('INSERT INTO inventario (user_id, item_id, quantidade) VALUES (?, ?, ?)'),
  debitarItem: db.prepare('UPDATE inventario SET quantidade = quantidade - ? WHERE user_id = ? AND item_id = ? AND quantidade >= ?'),
  limparItemZerado: db.prepare('DELETE FROM inventario WHERE user_id = ? AND item_id = ? AND quantidade <= 0'),
  atualizarTitulo: db.prepare('UPDATE usuarios SET titulo_personalizado = ? WHERE id = ?'),
  limparMensagens: db.prepare('DELETE FROM mensagens_processadas WHERE processada_em < ?'),
  reivindicarMensagem: db.prepare('INSERT OR IGNORE INTO mensagens_processadas (message_id, processada_em) VALUES (?, ?)'),
  limparComandos: db.prepare('DELETE FROM comandos_processados WHERE processada_em < ?'),
  reivindicarComando: db.prepare('INSERT OR IGNORE INTO comandos_processados (fingerprint, processada_em) VALUES (?, ?)'),
  debitar: db.prepare('UPDATE usuarios SET acucares = acucares - ? WHERE id = ? AND acucares >= ?'),
  creditar: db.prepare('UPDATE usuarios SET acucares = acucares + ? WHERE id = ?'),
  // ── Economia visual ──
  contarInventario: db.prepare('SELECT COALESCE(SUM(quantidade), 0) AS total FROM inventario WHERE user_id = ?'),
  contarItensDistintos: db.prepare('SELECT COUNT(*) AS total FROM inventario WHERE user_id = ?'),
  inserirTransacao: db.prepare(
    'INSERT INTO transacoes (user_id, tipo, valor, detalhe, criado_em) VALUES (?, ?, ?, ?, ?)'
  ),
  transacoes: db.prepare(
    'SELECT tipo, valor, detalhe, criado_em FROM transacoes WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ),
  apagarTransacoesAntigas: db.prepare('DELETE FROM transacoes WHERE criado_em < ?'),
  inserirConquista: db.prepare(
    'INSERT OR IGNORE INTO conquistas (user_id, conquista_id, desbloqueada_em) VALUES (?, ?, ?)'
  ),
  conquistas: db.prepare(
    'SELECT conquista_id, desbloqueada_em FROM conquistas WHERE user_id = ? ORDER BY desbloqueada_em DESC'
  ),
  estatisticas: db.prepare(
    `SELECT acucares, level, xp, titulo_personalizado, total_ganho, total_gasto, total_doado, trabalhos,
            compras, diarios, coletas, streak_diario, criado_em
       FROM usuarios WHERE id = ?`
  ),
  somarGanho: db.prepare('UPDATE usuarios SET total_ganho = total_ganho + ? WHERE id = ?'),
  somarGasto: db.prepare('UPDATE usuarios SET total_gasto = total_gasto + ? WHERE id = ?'),
  somarDoado: db.prepare('UPDATE usuarios SET total_doado = total_doado + ? WHERE id = ?'),
  somarTrabalho: db.prepare('UPDATE usuarios SET trabalhos = trabalhos + ? WHERE id = ?'),
  somarCompra: db.prepare('UPDATE usuarios SET compras = compras + ? WHERE id = ?'),
  somarDiario: db.prepare('UPDATE usuarios SET diarios = diarios + ? WHERE id = ?'),
  somarColeta: db.prepare('UPDATE usuarios SET coletas = coletas + ? WHERE id = ?'),
  definirStreak: db.prepare('UPDATE usuarios SET streak_diario = ?, ultimo_diario = ? WHERE id = ?'),
};

/**
 * Retorna os dados do usuário. Se não existir, cria um registro novo.
 */
function getUsuario(id) {
  let usuario = sql.selecionarUsuario.get(id);
  if (!usuario) {
    sql.inserirUsuario.run(id);
    usuario = sql.selecionarUsuario.get(id);
  }
  // Brincadeira do criador: o saldo exibido (e usado) é sempre infinito.
  return criador.ehCriador(id) ? { ...usuario, acucares: criador.PONTOS_INFINITOS } : usuario;
}

/**
 * Adiciona ou remove açúcares (dinheiro) do usuário, sem permitir negativo.
 * Para o criador nada é debitado/creditado: o saldo é infinito por definição.
 */
function addAcucares(id, amount) {
  if (criador.ehCriador(id)) return criador.PONTOS_INFINITOS;
  getUsuario(id);
  const linha = sql.atualizarAcucares.get(Number(amount) || 0, id);
  return linha?.acucares ?? 0;
}

/**
 * Adiciona XP e cuida de "level up" (cada nível = nivel atual * 1000)
 * Retorna um objeto indicando se subiu de nível.
 */
const transacaoXp = db.transaction((id, amount) => {
  const user = getUsuario(id);
  let novoXp = user.xp + amount;
  let novoLevel = user.level;
  let subiu = false;

  const xpProxLevel = novoLevel * 1000;
  if (novoXp >= xpProxLevel) {
    novoLevel += 1;
    novoXp -= xpProxLevel;
    subiu = true;
  }

  sql.atualizarXp.run(novoXp, novoLevel, id);
  return { level: novoLevel, xp: novoXp, subiu };
});

function addXp(id, amount) {
  return transacaoXp(id, Number(amount) || 0);
}

/**
 * Cooldown de XP - previne spam de mensagens e farm de XP.
 * O UPDATE condicional é atômico: se outra instância já reivindicou o
 * cooldown, `changes` é 0 e ninguém ganha XP duas vezes.
 */
function podeGanharXp(id) {
  const agora = Date.now();
  getUsuario(id);
  return sql.ganharCooldownXp.run(agora, id, agora - 60000).changes === 1;
}

/**
 * Fluxo completo de XP em uma única transação (cooldown + ganho + level up).
 * @returns {{ganhou: boolean, level?: number, xp?: number, subiu?: boolean}}
 */
const transacaoXpCompleta = db.transaction((id, amount) => {
  const agora = Date.now();
  getUsuario(id);
  if (sql.ganharCooldownXp.run(agora, id, agora - 60000).changes !== 1) {
    return { ganhou: false };
  }
  const resultado = transacaoXp(id, amount);
  return { ganhou: true, ...resultado };
});

function ganharXp(id, amount) {
  return transacaoXpCompleta.immediate(id, Number(amount) || 0);
}

/**
 * Rank do servidor
 */
function getTopLevel(limit = 10) {
  return sql.topLevel.all(Math.max(1, Math.min(100, Number(limit) || 10)));
}

function getTopAcucares(limit = 10) {
  return sql.topAcucares.all(Math.max(1, Math.min(100, Number(limit) || 10)));
}

// Retorna itens do usuário
function getInventario(userId) {
  return sql.inventario.all(userId);
}

function addInventario(userId, itemId, quantidade = 1) {
  getUsuario(userId); // garante criação
  const item = sql.itemInventario.get(userId, itemId);
  if (item) {
    sql.somarItem.run(quantidade, item.id);
  } else {
    sql.inserirItem.run(userId, itemId, quantidade);
  }
}

function atualizarTitulo(id, novoTitulo) {
  getUsuario(id); // garante
  sql.atualizarTitulo.run(String(novoTitulo ?? '').slice(0, 80), id);
}

/**
 * Reivindica um evento de mensagem de forma atômica entre processos.
 * Retorna false quando outra instância já processou o mesmo ID.
 */
function reivindicarMensagem(messageId) {
  if (!messageId) return false;
  const agora = Date.now();
  // Limpeza probabilística: evita um DELETE por mensagem no caminho quente.
  if (Math.random() < 0.02) sql.limparMensagens.run(agora - 5 * 60 * 1000);
  const resultado = sql.reivindicarMensagem.run(String(messageId), agora);
  return resultado.changes === 1;
}

function reivindicarComando(fingerprint, janelaMs = 5000) {
  if (!fingerprint) return false;
  const agora = Date.now();
  if (Math.random() < 0.02) sql.limparComandos.run(agora - 60 * 1000);
  const resultado = sql.reivindicarComando.run(String(fingerprint), agora);
  return resultado.changes === 1;
}

// Transação de Doar — o débito condicional elimina a corrida de saldo.
const transacaoDoacao = db.transaction((deId, paraId, quantidade) => {
  getUsuario(deId);
  getUsuario(paraId);
  const debitou = sql.debitar.run(quantidade, deId, quantidade);
  if (debitou.changes !== 1) return false;
  sql.creditar.run(quantidade, paraId);
  return true;
});

function transferirAcucares(deId, paraId, quantidade) {
  const valor = Number(quantidade);
  if (!Number.isInteger(valor) || valor <= 0 || deId === paraId) return false;
  // Criador doa sem perder saldo (afinal, são infinitos).
  if (criador.ehCriador(deId)) {
    getUsuario(paraId);
    sql.creditar.run(valor, paraId);
    return true;
  }
  return transacaoDoacao.immediate(deId, paraId, valor);
}

// ── Extrato ───────────────────────────────────────────────────────────
/**
 * Registra uma linha no extrato. `valor` positivo = entrada, negativo = saída.
 */
function registrarTransacao(userId, tipo, valor, detalhe = '') {
  if (criador.ehCriador(userId)) return false; // criador não move saldo
  getUsuario(userId);
  const agora = Date.now();
  // Limpeza probabilística: extrato não precisa ser eterno.
  if (Math.random() < 0.02) sql.apagarTransacoesAntigas.run(agora - 30 * 24 * 60 * 60 * 1000);
  sql.inserirTransacao.run(
    String(userId),
    String(tipo || 'outro').slice(0, 24),
    Math.trunc(Number(valor) || 0),
    String(detalhe || '').slice(0, 120),
    agora
  );
  return true;
}

function listarTransacoes(userId, limite = 10) {
  return sql.transacoes.all(String(userId), Math.max(1, Math.min(50, Number(limite) || 10)));
}

// ── Conquistas ────────────────────────────────────────────────────────
function desbloquearConquista(userId, conquistaId) {
  getUsuario(userId);
  const resultado = sql.inserirConquista.run(String(userId), String(conquistaId), Date.now());
  return resultado.changes === 1;
}

function listarConquistas(userId) {
  return sql.conquistas.all(String(userId));
}

// ── Estatísticas da economia ──────────────────────────────────────────
function obterEstatisticas(userId) {
  getUsuario(userId);
  const base = sql.estatisticas.get(userId) || {};
  return {
    acucares: criador.ehCriador(userId) ? criador.PONTOS_INFINITOS : Number(base.acucares) || 0,
    level: Number(base.level) || 1,
    xp: Number(base.xp) || 0,
    tituloPersonalizado: base.titulo_personalizado || '',
    totalGanho: Number(base.total_ganho) || 0,
    totalGasto: Number(base.total_gasto) || 0,
    totalDoado: Number(base.total_doado) || 0,
    trabalhos: Number(base.trabalhos) || 0,
    compras: Number(base.compras) || 0,
    diarios: Number(base.diarios) || 0,
    coletas: Number(base.coletas) || 0,
    streak: Number(base.streak_diario) || 0,
    criadoEm: Number(base.criado_em) || 0,
  };
}

function incrementarEstatistica(userId, campo, valor = 1) {
  const mapa = {
    ganho: sql.somarGanho,
    gasto: sql.somarGasto,
    doado: sql.somarDoado,
    trabalho: sql.somarTrabalho,
    compra: sql.somarCompra,
    diario: sql.somarDiario,
    coleta: sql.somarColeta,
  };
  const stmt = mapa[campo];
  if (!stmt) return false;
  getUsuario(userId);
  stmt.run(Math.abs(Number(valor) || 0), userId);
  return true;
}

function definirStreak(userId, streak, ultimoDiario) {
  getUsuario(userId);
  sql.definirStreak.run(Math.max(0, Number(streak) || 0), Number(ultimoDiario) || Date.now(), userId);
}

function contarInventario(userId) {
  return Number(sql.contarInventario.get(userId)?.total) || 0;
}

function contarItensDistintos(userId) {
  return Number(sql.contarItensDistintos.get(userId)?.total) || 0;
}


const transacaoDoacaoItem = db.transaction((deId, paraId, itemId, quantidade) => {
  getUsuario(deId);
  getUsuario(paraId);
  const item = sql.itemInventario.get(deId, itemId);
  if (!item || Number(item.quantidade) < quantidade) return false;
  const debitou = sql.debitarItem.run(quantidade, deId, itemId, quantidade);
  if (debitou.changes !== 1) return false;
  sql.limparItemZerado.run(deId, itemId);
  const existente = sql.itemInventario.get(paraId, itemId);
  if (existente) sql.somarItem.run(quantidade, existente.id);
  else sql.inserirItem.run(paraId, itemId, quantidade);
  return true;
});

function transferirItem(deId, paraId, itemId, quantidade = 1) {
  const qtd = Math.max(1, Number(quantidade) || 1);
  if (deId === paraId) return false;
  if (!itemId) return false;
  return transacaoDoacaoItem.immediate(deId, paraId, itemId, qtd);
}


function resetarEconomiaUsuarios(ids) {
  const lista = Array.isArray(ids) ? ids : [];
  if (!lista.length) return 0;
  const stmt = db.prepare('DELETE FROM inventario WHERE user_id = ?');
  const stmt2 = db.prepare('DELETE FROM transacoes WHERE user_id = ?');
  const stmt3 = db.prepare('DELETE FROM conquistas WHERE user_id = ?');
  const stmt4 = db.prepare('DELETE FROM usuarios WHERE id = ?');
  let count = 0;
  const tx = db.transaction((arr) => {
    for (const id of arr) {
      stmt.run(id);
      stmt2.run(id);
      stmt3.run(id);
      stmt4.run(id);
      count++;
    }
  });
  tx(lista);
  return count;
}

module.exports = {
  db,
  getUsuario,
  addAcucares,
  addXp,
  podeGanharXp,
  ganharXp,
  getTopLevel,
  getTopAcucares,
  getInventario,
  addInventario,
  transferirAcucares,
  transferirItem,
  resetarEconomiaUsuarios,
  atualizarTitulo,
  reivindicarMensagem,
  reivindicarComando,
  registrarTransacao,
  listarTransacoes,
  desbloquearConquista,
  listarConquistas,
  obterEstatisticas,
  incrementarEstatistica,
  definirStreak,
  contarInventario,
  contarItensDistintos,
};
