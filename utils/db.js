const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Garante que a pasta "data" exista
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'mila.db'));
db.pragma('journal_mode = WAL');

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
`);

/**
 * Retorna os dados do usuário. Se não existir, cria um registro novo.
 */
function getUsuario(id) {
  let user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!user) {
    db.prepare('INSERT INTO usuarios (id) VALUES (?)').run(id);
    user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  }
  return user;
}

/**
 * Adiciona ou remove açúcares (dinheiro) do usuário
 */
function addAcucares(id, amount) {
  const user = getUsuario(id);
  const novoValor = Math.max(0, user.acucares + amount); // Não permite saldo negativo
  db.prepare('UPDATE usuarios SET acucares = ? WHERE id = ?').run(novoValor, id);
  return novoValor;
}

/**
 * Adiciona XP e cuida de "level up" (cada nível = nivel atual * 1000)
 * Retorna um objeto indicando se subiu de nível.
 */
function addXp(id, amount) {
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

  db.prepare('UPDATE usuarios SET xp = ?, level = ? WHERE id = ?').run(novoXp, novoLevel, id);

  return { level: novoLevel, xp: novoXp, subiu };
}

/**
 * Cooldown de XP - previne spam de mensagens e farm de XP
 */
function podeGanharXp(id) {
  const user = getUsuario(id);
  const agora = Date.now();
  // Delay de 1 minuto (60000ms) entre ganho de xp local
  if (agora - user.cooldown_xp > 60000) {
    db.prepare('UPDATE usuarios SET cooldown_xp = ? WHERE id = ?').run(agora, id);
    return true;
  }
  return false;
}

/**
 * Rank do servidor
 */
function getTopLevel(limit = 10) {
  return db.prepare('SELECT id, level, xp FROM usuarios ORDER BY level DESC, xp DESC LIMIT ?').all(limit);
}

function getTopAcucares(limit = 10) {
  return db.prepare('SELECT id, acucares FROM usuarios ORDER BY acucares DESC LIMIT ?').all(limit);
}

// Retorna itens do usuário
function getInventario(userId) {
  return db.prepare('SELECT item_id, quantidade FROM inventario WHERE user_id = ?').all(userId);
}

function addInventario(userId, itemId, quantidade = 1) {
  getUsuario(userId); // garante criação
  const item = db.prepare('SELECT * FROM inventario WHERE user_id = ? AND item_id = ?').get(userId, itemId);
  if (item) {
    db.prepare('UPDATE inventario SET quantidade = quantidade + ? WHERE id = ?').run(quantidade, item.id);
  } else {
    db.prepare('INSERT INTO inventario (user_id, item_id, quantidade) VALUES (?, ?, ?)').run(userId, itemId, quantidade);
  }
}

function atualizarTitulo(id, novoTitulo) {
    getUsuario(id); // garante
    db.prepare('UPDATE usuarios SET titulo_personalizado = ? WHERE id = ?').run(novoTitulo, id);
}

/**
 * Reivindica um evento de mensagem de forma atômica entre processos.
 * Retorna false quando outra instância já processou o mesmo ID.
 */
function reivindicarMensagem(messageId) {
  if (!messageId) return false;
  const agora = Date.now();
  db.prepare('DELETE FROM mensagens_processadas WHERE processada_em < ?').run(agora - 5 * 60 * 1000);
  const resultado = db
    .prepare('INSERT OR IGNORE INTO mensagens_processadas (message_id, processada_em) VALUES (?, ?)')
    .run(String(messageId), agora);
  return resultado.changes === 1;
}

function reivindicarComando(fingerprint, janelaMs = 5000) {
  if (!fingerprint) return false;
  const agora = Date.now();
  db.prepare('DELETE FROM comandos_processados WHERE processada_em < ?').run(agora - janelaMs);
  const resultado = db
    .prepare('INSERT OR IGNORE INTO comandos_processados (fingerprint, processada_em) VALUES (?, ?)')
    .run(String(fingerprint), agora);
  return resultado.changes === 1;
}

// Transação de Doar
function transferirAcucares(deId, paraId, quantidade) {
  if (quantidade <= 0) return false;
  const remetente = getUsuario(deId);
  if (remetente.acucares < quantidade) return false;

  getUsuario(paraId); // garante destinatário
  const transacao = db.transaction(() => {
    db.prepare('UPDATE usuarios SET acucares = acucares - ? WHERE id = ?').run(quantidade, deId);
    db.prepare('UPDATE usuarios SET acucares = acucares + ? WHERE id = ?').run(quantidade, paraId);
  });

  transacao();
  return true;
}

module.exports = {
  db,
  getUsuario,
  addAcucares,
  addXp,
  podeGanharXp,
  getTopLevel,
  getTopAcucares,
  getInventario,
  addInventario,
  transferirAcucares,
  atualizarTitulo,
  reivindicarMensagem,
  reivindicarComando
};
