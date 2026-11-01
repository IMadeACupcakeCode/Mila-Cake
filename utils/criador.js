// utils/criador.js
// ── Reconhecimento do criador da Mila ────────────────────────────────
// O criador é identificado pelo @ (username) definido em CRIADOR_USERNAME
// (padrão: acupcakecatsocial) e/ou por IDs fixos em CRIADOR_IDS.
//
// O ID encontrado é aprendido e salvo em data/criador.json, então continua
// valendo mesmo se o @ mudar depois. Como brincadeira, o saldo do criador é
// sempre infinito: tudo mostra "+999999" e ganhos/gastos não mudam o valor.
//
// Importante: este módulo NÃO depende de utils/db para evitar ciclo — o db
// é quem depende dele.

const path = require('path');
const { lerJson, salvarJson } = require('./jsonStore');

const PONTOS_INFINITOS = 999999;
const SELO = '👑 Criador da Mila';
const TITULO = 'Criador da Mila';
const ARQUIVO = path.join(__dirname, '..', 'data', 'criador.json');

function normalizarNome(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
}

function normalizarId(valor) {
  const id = String(valor ?? '').trim();
  return /^\d{5,}$/.test(id) ? id : null;
}

// @s aceitos. O primeiro é o padrão e também é usado nas mensagens.
const USERNAMES = (() => {
  const doEnv = [process.env.CRIADOR_USERNAME, process.env.CRIADOR_USERNAMES]
    .flatMap((valor) => String(valor || '').split(','));
  const nomes = ['acupcakecatsocial', ...doEnv]
    .map(normalizarNome)
    .filter(Boolean);
  return [...new Set(nomes)];
})();

const NOME_CRIADOR = USERNAMES[0] || 'acupcakecatsocial';

const idsFixos = new Set(
  String(process.env.CRIADOR_IDS || '')
    .split(',')
    .map(normalizarId)
    .filter(Boolean)
);

const idsAprendidos = new Set();
let clientAtual = null;

// Carrega os IDs já descobertos em execuções anteriores.
try {
  const dados = lerJson(ARQUIVO, { ids: [] });
  const lista = Array.isArray(dados?.ids) ? dados.ids : [];
  for (const id of lista) {
    const limpo = normalizarId(id);
    if (limpo) idsAprendidos.add(limpo);
  }
} catch {
  // Sem arquivo/JSON inválido: segue só com env e descoberta em runtime.
}

function persistir() {
  try {
    salvarJson(ARQUIVO, { usernames: USERNAMES, ids: [...idsAprendidos] });
  } catch {
    // Persistir é conveniência; não deve quebrar nenhum comando.
  }
}

function aprenderId(valor) {
  const id = normalizarId(valor);
  if (!id) return null;
  if (!idsAprendidos.has(id)) {
    idsAprendidos.add(id);
    persistir();
  }
  return id;
}

function ehCriadorId(alvo) {
  const id = normalizarId(alvo);
  if (!id) return false;
  return idsFixos.has(id) || idsAprendidos.has(id);
}

/**
 * Aceita um User, GuildMember, ou apenas o ID.
 * Quando o username bate, o ID é aprendido automaticamente.
 */
function ehCriador(alvo) {
  if (!alvo) return false;
  if (typeof alvo === 'string' || typeof alvo === 'number') return ehCriadorId(alvo);

  const id = normalizarId(alvo.id ?? alvo.user?.id);
  if (id && ehCriadorId(id)) return true;

  const user = alvo.user || alvo;
  const username = normalizarNome(user.username ?? alvo.username);
  if (username && USERNAMES.includes(username)) {
    aprenderId(id);
    return true;
  }
  return false;
}

/** Aprende o ID do criador quando o alvo for reconhecido. */
function marcar(alvo) {
  if (!ehCriador(alvo)) return null;
  return normalizarId(alvo?.id ?? alvo?.user?.id);
}

function idsConhecidos() {
  return [...new Set([...idsFixos, ...idsAprendidos])];
}

/** Devolve o saldo efetivo: infinito para o criador. */
function pontosDe(alvo, valor = 0) {
  if (ehCriador(alvo)) return PONTOS_INFINITOS;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/** Formata um saldo. O criador sempre aparece como "+999999". */
function formatarPontos(alvo, valor = 0) {
  if (ehCriador(alvo)) return `+${PONTOS_INFINITOS}`;
  return Number(valor || 0).toLocaleString('pt-BR');
}

/** Formata um ganho ("+123" / "+999999"). */
function formatarGanho(alvo, valor = 0) {
  if (ehCriador(alvo)) return `+${PONTOS_INFINITOS}`;
  return `+${Math.abs(Number(valor) || 0).toLocaleString('pt-BR')}`;
}

/** Selo opcional para mensagens do criador. */
function selo(alvo) {
  return ehCriador(alvo) ? SELO : '';
}

function associarClient(client) {
  clientAtual = client || clientAtual;
  return clientAtual;
}

async function resolverGuild(guild) {
  if (!guild?.members) return;
  for (const nome of USERNAMES) {
    try {
      const membros = await guild.members.fetch({ query: nome, limit: 25 });
      for (const membro of membros.values()) {
        const user = membro.user || membro;
        if (USERNAMES.includes(normalizarNome(user.username))) aprenderId(membro.id || user.id);
      }
    } catch {
      // Sem a intent GuildMembers (ou sem permissão) cai no cache abaixo.
    }
  }
  for (const membro of guild.members.cache?.values?.() || []) {
    const user = membro.user || membro;
    if (USERNAMES.includes(normalizarNome(user.username))) aprenderId(membro.id || user.id);
  }
}

/**
 * Procura o criador em todos os servidores onde a Mila está. É chamado no
 * startup e quando ela entra em um servidor novo, então vale para todos.
 */
async function resolverNoCliente(client = clientAtual) {
  if (!client) return idsConhecidos();
  clientAtual = client;

  for (const id of idsFixos) {
    try {
      const user = await client.users.fetch(id);
      aprenderId(user.id);
    } catch {
      // ID inválido ou usuário inacessível: ignora.
    }
  }

  for (const user of client.users.cache?.values?.() || []) {
    if (USERNAMES.includes(normalizarNome(user.username))) aprenderId(user.id);
  }

  for (const guild of client.guilds.cache?.values?.() || []) {
    await resolverGuild(guild);
  }

  return idsConhecidos();
}

module.exports = {
  PONTOS_INFINITOS,
  SELO,
  TITULO,
  NOME_CRIADOR,
  USERNAMES,
  ehCriador,
  ehCriadorId,
  marcar,
  idsConhecidos,
  pontosDe,
  formatarPontos,
  formatarGanho,
  selo,
  associarClient,
  resolverGuild,
  resolverNoCliente,
};
