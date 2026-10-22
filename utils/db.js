const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Garante que a pasta "data" exista
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'mila.db'));

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
`);

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
  atualizarTitulo: db.prepare('UPDATE usuarios SET titulo_personalizado = ? WHERE id = ?'),
  limparMensagens: db.prepare('DELETE FROM mensagens_processadas WHERE processada_em < ?'),
  reivindicarMensagem: db.prepare('INSERT OR IGNORE INTO mensagens_processadas (message_id, processada_em) VALUES (?, ?)'),
  limparComandos: db.prepare('DELETE FROM comandos_processados WHERE processada_em < ?'),
  reivindicarComando: db.prepare('INSERT OR IGNORE INTO comandos_processados (fingerprint, processada_em) VALUES (?, ?)'),
  debitar: db.prepare('UPDATE usuarios SET acucares = acucares - ? WHERE id = ? AND acucares >= ?'),
  creditar: db.prepare('UPDATE usuarios SET acucares = acucares + ? WHERE id = ?'),
};

/**
 * Retorna os dados do usuário. Se não existir, cria um registro novo.
 */
function getUsuario(id) {
  const existente = sql.selecionarUsuario.get(id);
  if (existente) return existente;
  sql.inserirUsuario.run(id);
  return sql.selecionarUsuario.get(id);
}

/**
 * Adiciona ou remove açúcares (dinheiro) do usuário, sem permitir negativo.
 */
function addAcucares(id, amount) {
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
  return transacaoDoacao.immediate(deId, paraId, valor);
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
  atualizarTitulo,
  reivindicarMensagem,
  reivindicarComando
};
