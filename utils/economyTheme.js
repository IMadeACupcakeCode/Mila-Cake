// utils/economyTheme.js
// ── Economia: dados de tema (site) + formatação ──────────────────────
// No Discord a economia usa a MESMA estilização dos outros comandos:
// criarEmbed/embedArcade (✦ no título, rodapé da Mila, timestamp, divisores
//  · ｡ﾟ✧ e barras 🟩/⬛ de utils/arcade). Nada de "janela" ou chrome.
// Os seis temas (win7, hangouts, ...) continuam valendo para o site.

const { THEME, criarEmbed } = require('./theme');
const arcade = require('./arcade');
const {
  TEMAS,
  TEMA_PADRAO,
  normalizarTema,
  obterTema,
  listarTemas,
} = require('./economyThemeData');

const MOEDA = '🍬';
const MOEDA_NOME = 'açúcares';

function temaDoServidor(guildId) {
  try {
    return require('./servidorStore').obterConfig(guildId)?.temaEconomia || TEMA_PADRAO;
  } catch {
    return TEMA_PADRAO;
  }
}

function temaDe(interaction) {
  return obterTema(temaDoServidor(interaction?.guildId));
}

/**
 * Barra de progresso padrão da Mila (mesma dos jogos).
 */
function barra(valor, maximo, tamanho = 10) {
  return arcade.barra(valor, maximo, tamanho, '🟩', '⬛');
}

function formatarNumero(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR');
}

function formatarMoeda(valor) {
  return `${formatarNumero(valor)} ${MOEDA}`;
}

function formatarTempo(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const partes = [];
  if (dias) partes.push(`${dias}d`);
  if (horas) partes.push(`${horas}h`);
  if (minutos) partes.push(`${minutos}m`);
  if (!dias && !horas) partes.push(`${segundos}s`);
  return partes.join(' ');
}

function dataCurta(ms) {
  try {
    return new Date(Number(ms) || Date.now()).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--/--';
  }
}

/**
 * Embed padrão da Mila (mesmo formato de /perfil, /ranking, etc.).
 * `tema` é aceito por compatibilidade, mas o visual do Discord é único.
 */
function janela({
  tema,
  titulo,
  descricao,
  cor,
  rodape,
  thumbnail,
  imagem,
  autorNome,
  autorIcone,
  campos,
  status,
}) {
  const corpo = [status ? `\`${status}\`` : '', String(descricao || '').trim()]
    .filter(Boolean)
    .join('\n\n');

  const embed = criarEmbed({
    titulo: String(titulo || 'Economia'),
    descricao: corpo || THEME.div.bolinhas,
    cor: Number.isFinite(Number(cor)) ? Number(cor) : THEME.corPrincipal,
    rodape,
    thumbnail,
    image: imagem,
  });

  const fields = (campos || []).filter((c) => c && c.name && c.value);
  if (fields.length) {
    embed.addFields(
      fields.slice(0, 25).map((c) => ({
        name: String(c.name).slice(0, 256),
        value: String(c.value).slice(0, 1024),
        inline: Boolean(c.inline),
      }))
    );
  }

  return embed;
}

/**
 * Janela de erro/pausa: mesmo padrão, só com a cor de erro da Mila.
 */
function janelaAviso(tema, titulo, mensagem, { cor = THEME.corErro, rodape } = {}) {
  return janela({
    tema,
    titulo,
    descricao: mensagem,
    cor,
    rodape,
  });
}

/**
 * Linha de usuário no padrão dos embeds da Mila.
 */
function linhaUsuario(tema, usuario, extra = '') {
  return `**${usuario}**${extra ? ` · ${extra}` : ''}`;
}

function separador(tema, texto = '') {
  return texto ? `${texto}\n${THEME.div.linha}` : THEME.div.linha;
}

module.exports = {
  TEMAS,
  TEMA_PADRAO,
  MOEDA,
  MOEDA_NOME,
  normalizarTema,
  obterTema,
  listarTemas,
  temaDoServidor,
  temaDe,
  barra,
  formatarNumero,
  formatarMoeda,
  formatarTempo,
  dataCurta,
  janela,
  janelaAviso,
  linhaUsuario,
  separador,
};
