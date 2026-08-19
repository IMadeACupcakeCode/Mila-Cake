const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '..', 'data', 'seguranca.json');
const CAMINHO_BACKUP = path.join(__dirname, '..', 'data', 'seguranca.backup.json');

function garantir() {
  const pasta = path.dirname(CAMINHO);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  if (!fs.existsSync(CAMINHO)) fs.writeFileSync(CAMINHO, '{}', 'utf-8');
}

function carregar() {
  garantir();
  try {
    return JSON.parse(fs.readFileSync(CAMINHO, 'utf-8'));
  } catch {
    try {
      const b = JSON.parse(fs.readFileSync(CAMINHO_BACKUP, 'utf-8'));
      fs.writeFileSync(CAMINHO, JSON.stringify(b, null, 2));
      return b;
    } catch {
      return {};
    }
  }
}

function salvar(dados) {
  garantir();
  try {
    if (fs.existsSync(CAMINHO)) fs.copyFileSync(CAMINHO, CAMINHO_BACKUP);
  } catch {}
  fs.writeFileSync(CAMINHO, JSON.stringify(dados, null, 2), 'utf-8');
}

// Salva um instantâneo dos membros atuais do servidor
function salvarSnapshot(guildId, membros) {
  const dados = carregar();
  const agora = Date.now();
  const lista = membros.map((m) => ({
    id: m.user.id,
    tag: m.user.tag,
    nome: m.user.username,
    bot: m.user.bot,
    criadoEm: m.user.createdAt ? m.user.createdAt.getTime() : 0,
    entrouEm: m.joinedAt ? m.joinedAt.getTime() : 0,
    cargoAlto: m.roles.cache.filter((r) => r.id !== m.guild.id && !r.managed).sort((a, b) => b.position - a.position).first()?.name || 'Sem cargo',
  }));
  dados[guildId] = {
    atualizadoEm: agora,
    total: lista.length,
    membros: lista,
  };
  salvar(dados);
  return dados[guildId];
}

function obterSnapshot(guildId) {
  const dados = carregar();
  return dados[guildId] || null;
}

// Marca um membro como suspeito/aviso na "memória" do bot
function marcarMembro(guildId, userId, tipo, nota) {
  const dados = carregar();
  if (!dados[guildId]) dados[guildId] = { atualizadoEm: Date.now(), total: 0, membros: [], marcacoes: {} };
  if (!dados[guildId].marcacoes) dados[guildId].marcacoes = {};
  dados[guildId].marcacoes[userId] = { tipo, nota, em: Date.now() };
  salvar(dados);
  return dados[guildId].marcacoes[userId];
}

function obterMarcacoes(guildId) {
  const dados = carregar();
  return (dados[guildId] && dados[guildId].marcacoes) || {};
}

// ── Histórico de suspensões / suspeitas (servidor + Discord) ──────────────
// Guarda por userId (global, cruza servidores) para rastrear "já foi suspenso
// e quantas vezes", além de suspeitas internas e externas.
const CAMINHO_HIST = path.join(__dirname, '..', 'data', 'historico.json');

function carregarHistorico() {
  try {
    if (fs.existsSync(CAMINHO_HIST)) return JSON.parse(fs.readFileSync(CAMINHO_HIST, 'utf-8'));
  } catch {}
  return {};
}

function salvarHistorico(dados) {
  try {
    fs.writeFileSync(CAMINHO_HIST, JSON.stringify(dados, null, 2), 'utf-8');
  } catch {}
}

// Registra uma suspensão (ban/kick/time-out) de um membro.
// origem: 'servidor' | 'discord'
function registrarSuspensao(userId, { origem = 'servidor', motivo = '', por = 'desconhecido', guildId = null } = {}) {
  const h = carregarHistorico();
  if (!h[userId]) h[userId] = { suspenso: 0, suspensoDiscord: 0, suspensoServidor: 0, suspeitas: [], historico: [] };
  const entry = h[userId];
  entry.suspenso += 1;
  if (origem === 'discord') entry.suspensoDiscord += 1;
  else entry.suspensoServidor += 1;
  entry.historico.push({ tipo: 'suspensao', origem, motivo, por, em: Date.now(), guildId });
  salvarHistorico(h);
  return entry;
}

// Marca um membro como suspeito (interno ou externo ao servidor).
function marcarSuspeito(userId, { escopo = 'interno', motivo = '', por = 'desconhecido' } = {}) {
  const h = carregarHistorico();
  if (!h[userId]) h[userId] = { suspenso: 0, suspensoDiscord: 0, suspensoServidor: 0, suspeitas: [], historico: [] };
  const entry = h[userId];
  entry.suspeitas.push({ escopo, motivo, por, em: Date.now() });
  salvarHistorico(h);
  return entry;
}

// Lê o histórico de um membro (ou objeto vazio).
function obterHistorico(userId) {
  const h = carregarHistorico();
  return h[userId] || { suspenso: 0, suspensoDiscord: 0, suspensoServidor: 0, suspeitas: [], historico: [] };
}

// Sinaliza suspeita automática a partir de heurísticas do próprio Discord
// (conta nova, nome suspeito, etc.) — consulta apenas dados que a API expõe.
function avaliarRisco(member) {
  const sinais = [];
  const user = member.user || member;
  const agora = Date.now();
  const criadoEm = user.createdAt ? user.createdAt.getTime() : 0;
  const idadeConta = agora - criadoEm;
  const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
  if (criadoEm && idadeConta < SETE_DIAS) {
    sinais.push('Conta criada há menos de 7 dias');
  }
  if (user.bot) sinais.push('É um bot (verifique se é oficial/autorizado)');
  return sinais;
}

module.exports = {
  salvarSnapshot,
  obterSnapshot,
  marcarMembro,
  obterMarcacoes,
  registrarSuspensao,
  marcarSuspeito,
  obterHistorico,
  avaliarRisco,
};
