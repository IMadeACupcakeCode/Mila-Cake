// ⋆｡°✩ Sistema de logs da Mila Bot.
// Registra cada comando executado com contexto de usuário, canal e servidor,
// e permite filtrar as linhas por uma pessoa específica (via $logs).

const fs = require('fs');
const path = require('path');

const CAMINHO_LOGS = path.join(__dirname, '..', 'data', 'logs.json');
const MEMORIA_MAX = 500; // mantém no máximo as últimas N entradas em memória/arquivo

// Cores ANSI para o terminal (bonitinho)
const COR = {
  reset: '\x1b[0m',
  cinza: '\x1b[90m',
  lilas: '\x1b[95m',
  ciano: '\x1b[96m',
  verde: '\x1b[92m',
  amarelo: '\x1b[93m',
  vermelho: '\x1b[91m',
  branco: '\x1b[97m',
};

const NIVEIS = {
  info: { cor: COR.ciano, rotulo: 'INFO' },
  cmd: { cor: COR.lilas, rotulo: 'COMANDO' },
  sucesso: { cor: COR.verde, rotulo: 'OK' },
  aviso: { cor: COR.amarelo, rotulo: 'AVISO' },
  erro: { cor: COR.vermelho, rotulo: 'ERRO' },
};

function carimbo() {
  const d = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Registro em memória (para o $logs filtrar por pessoa)
let registros = carregar();

function carregar() {
  try {
    const conteudo = fs.readFileSync(CAMINHO_LOGS, 'utf-8');
    const arr = JSON.parse(conteudo);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function salvar() {
  try {
    const pasta = path.dirname(CAMINHO_LOGS);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(CAMINHO_LOGS, JSON.stringify(registros.slice(-MEMORIA_MAX), null, 2), 'utf-8');
  } catch {
    /* ignora falhas de escrita */
  }
}

/**
 * Registra um evento/log.
 * @param {string} nivel  - uma chave de NIVEIS
 * @param {string} mensagem
 * @param {object} [ctx]  - { usuario, userId, canal, canalId, guildId, comando }
 */
function log(nivel, mensagem, ctx = {}) {
  const def = NIVEIS[nivel] || NIVEIS.info;
  const ts = carimbo();

  // Saída no terminal (bonitinha)
  const autor = ctx.usuario ? COR.branco + ctx.usuario + COR.reset : COR.cinza + '—' + COR.reset;
  const canal = ctx.canal ? ` em #${ctx.canal}` : '';
  const linha = `${COR.cinza}${ts}${COR.reset} ${def.cor}[${def.rotulo}]${COR.reset} ${mensagem} ${COR.cinza}(${autor}${canal})${COR.reset}`;
  if (nivel === 'erro') console.error(linha);
  else console.log(linha);

  // Registro estruturado p/ filtro por pessoa
  const entrada = {
    ts: new Date().toISOString(),
    nivel,
    mensagem,
    usuario: ctx.usuario || null,
    userId: ctx.userId || null,
    canal: ctx.canal || null,
    canalId: ctx.canalId || null,
    guildId: ctx.guildId || null,
    comando: ctx.comando || null,
  };
  registros.push(entrada);
  if (registros.length > MEMORIA_MAX) registros = registros.slice(-MEMORIA_MAX);
  salvar();
}

// Atalhos de nível
function info(m, ctx) { log('info', m, ctx); }
function cmd(m, ctx) { log('cmd', m, ctx); }
function sucesso(m, ctx) { log('sucesso', m, ctx); }
function aviso(m, ctx) { log('aviso', m, ctx); }
function erro(m, ctx) { log('erro', m, ctx); }

/**
 * Filtra logs por uma pessoa específica.
 * @param {string} termo - pode ser um ID, uma menção <@123>, ou um nome de usuário
 * @param {number} [limite=15]
 * @returns {Array}
 */
function filtrarPorUsuario(termo, limite = 15) {
  if (!termo) return [];
  const t = termo.trim();
  const men = t.match(/^<@!?(\d+)>$/);
  const id = men ? men[1] : /^\d{10,}$/.test(t) ? t : null;
  const nome = t.toLowerCase();
  return registros
    .filter((r) => {
      if (id) return r.userId === id;
      if (r.usuario) return r.usuario.toLowerCase().includes(nome);
      return false;
    })
    .slice(-limite);
}

// Retorna as últimas N entradas (sem filtro).
function todas(limite = 15) {
  return registros.slice(-limite);
}

module.exports = { log, info, cmd, sucesso, aviso, erro, filtrarPorUsuario, todas, NIVEIS };
