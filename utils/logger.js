// ⋆｡°✩ Sistema de logs animado da Mila Bot.
// Registra cada comando executado com contexto de usuário, canal e servidor,
// e permite filtrar as linhas por uma pessoa específica (via $logs).
// Terminal colorido e decorado com a identidade visual da Mila.

const fs = require('fs');
const path = require('path');

const CAMINHO_LOGS = path.join(__dirname, '..', 'data', 'logs.json');
const MEMORIA_MAX = 500; // mantém no máximo as últimas N entradas em memória/arquivo

// ════════════════════════════════════════════════════════════════════════════
// Cores ANSI para o terminal — paleta Mila
// ════════════════════════════════════════════════════════════════════════════
const COR = {
  reset: '\x1b[0m',
  negrito: '\x1b[1m',
  cinza: '\x1b[90m',
  lilas: '\x1b[35m',
  ciano: '\x1b[36m',
  verde: '\x1b[32m',
  amarelo: '\x1b[33m',
  vermelho: '\x1b[31m',
  branco: '\x1b[97m',
  rosa: '\x1b[38;5;205m',
  dourado: '\x1b[38;5;220m',
  azul: '\x1b[34m',
  magenta: '\x1b[35m',
  bgRosa: '\x1b[48;5;205m',
  bgVerde: '\x1b[42m',
  bgVermelho: '\x1b[41m',
};

const NIVEIS = {
  info: { cor: COR.ciano, rotulo: '✦ INFO', emoji: '📋' },
  cmd: { cor: COR.rosa, rotulo: '♡ CMD', emoji: '⭐' },
  sucesso: { cor: COR.verde, rotulo: '✓ OK', emoji: '✅' },
  aviso: { cor: COR.amarelo, rotulo: '⚠ AVISO', emoji: '⚠️' },
  erro: { cor: COR.vermelho, rotulo: '✗ ERRO', emoji: '❌' },
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
 * Registra um evento/log com saída decorada no terminal.
 * @param {string} nivel  - uma chave de NIVEIS
 * @param {string} mensagem
 * @param {object} [ctx]  - { usuario, userId, canal, canalId, guildId, comando }
 */
function log(nivel, mensagem, ctx = {}) {
  const def = NIVEIS[nivel] || NIVEIS.info;
  const ts = carimbo();

  // ── Saída no terminal (decorada com a identidade Mila) ──
  const autor = ctx.usuario
    ? `${COR.dourado}${ctx.usuario}${COR.reset}`
    : `${COR.cinza}—${COR.reset}`;
  const canal = ctx.canal
    ? ` ${COR.cinza}em ${COR.rosa}#${ctx.canal}${COR.reset}`
    : '';
  const cmdInfo = ctx.comando
    ? ` ${COR.cinza}→ ${COR.negrito}${ctx.comando}${COR.reset}`
    : '';

  const linha =
    `${COR.cinza}${ts}${COR.reset} ` +
    `${def.cor}${def.rotulo}${COR.reset} ` +
    `${COR.branco}${mensagem}${COR.reset}` +
    `${cmdInfo}${canal} ` +
    `${COR.cinza}por${COR.reset} ${autor}`;

  if (nivel === 'erro') console.error(linha);
  else console.log(linha);

  // ── Registro estruturado p/ filtro por pessoa ──
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

// ════════════════════════════════════════════════════════════════════════════
// Atalhos de nível — cada um com saída decorada
// ════════════════════════════════════════════════════════════════════════════

function info(m, ctx) { log('info', m, ctx); }
function cmd(m, ctx) { log('cmd', m, ctx); }
function sucesso(m, ctx) { log('sucesso', m, ctx); }
function aviso(m, ctx) { log('aviso', m, ctx); }
function erro(m, ctx) { log('erro', m, ctx); }

// ════════════════════════════════════════════════════════════════════════════
// Logs decorados especiais — para comandos e eventos importantes
// ════════════════════════════════════════════════════════════════════════════

/**
 * Exibe um banner decorado no terminal quando um comando é executado.
 */
function logComando(comando, usuario, canal, guildNome) {
  const ts = carimbo();

  const linhas = [
    '',
    `${COR.rosa}${'─'.repeat(52)}${COR.reset}`,
    `${COR.rosa}  ⋆｡°✩${COR.reset}  ${COR.negrito}${COR.branco}$${comando}${COR.reset}  ${COR.cinza}• ${ts}${COR.reset}`,
    `${COR.rosa}  ${COR.dourado}♡${COR.reset}  ${COR.branco}${usuario || '—'}${COR.reset} ${COR.cinza}em #${canal || '?'}${guildNome ? ` ${COR.cinza}(${guildNome})${COR.reset}` : ''}`,
    `${COR.rosa}${'─'.repeat(52)}${COR.reset}`,
  ];

  console.log(linhas.join('\n'));

  // Registra no log estruturado também
  log('cmd', `$${comando} executado`, { usuario, canal, comando: `$${comando}` });
}

/**
 * Exibe uma mensagem de sucesso decorada no terminal.
 */
function logSucesso(comando, detalhe) {
  console.log(
    `${COR.verde}  ✓ ${COR.rosa}⋆｡°✩${COR.reset} ${COR.negrito}$${comando}${COR.reset} ${COR.cinza}— ${detalhe}${COR.reset}`
  );
}

/**
 * Exibe uma mensagem de erro decorada no terminal.
 */
function logErro(comando, detalhe) {
  console.error(
    `${COR.vermelho}  ✗ $${comando}${COR.reset} ${COR.cinza}— ${detalhe}${COR.reset}`
  );
}

/**
 * Separador decorado para o terminal.
 */
function separador() {
  console.log(`${COR.cinza}∘ . * . . * . ∘${COR.reset}`);
}

/**
 * Banner decorado exibido quando a Mila inicia.
 */
function logInicio(nomeBot, tag, guilds) {
  const linhas = [
    '',
    `${COR.rosa}${'═'.repeat(52)}${COR.reset}`,
    `${COR.rosa}  ⋆｡°✩  ${COR.negrito}${COR.branco}${nomeBot}${COR.reset}`,
    `${COR.rosa}${'═'.repeat(52)}${COR.reset}`,
    '',
    `${COR.dourado}  ♡  Online como ${COR.branco}${tag}${COR.reset}`,
    `${COR.dourado}  ♡  Servindo ${COR.branco}${guilds}${COR.dourado} servidor(es)${COR.reset}`,
    '',
    `${COR.rosa}${'─'.repeat(52)}${COR.reset}`,
    '',
  ];
  console.log(linhas.join('\n'));
}

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

module.exports = {
  log, info, cmd, sucesso, aviso, erro,
  logComando, logSucesso, logErro, separador, logInicio,
  filtrarPorUsuario, todas, NIVEIS, COR,
};
