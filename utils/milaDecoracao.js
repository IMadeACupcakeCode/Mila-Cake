// ⋆｡°✩ Sistema de decoração e animação da Mila Bot
// Todos os comandos usam este módulo para ficarem sempre decorados e animados,
// tanto no Discord (typing, embeds, banners) quanto no terminal (logs coloridos).

const { EmbedBuilder } = require('discord.js');
const { THEME } = require('./theme');

// ════════════════════════════════════════════════════════════════════════════
// ANIMAÇÃO NO DISCORD — Typing indicator & loading
// ════════════════════════════════════════════════════════════════════════════

/** Pontos de "digitando" animados para o Discord */
const TYPING_DOTS = ['⠀', '⠀⠀', '⠀⠀⠀', '⠀⠀⠀⠀'];

/**
 * Mostra "Mila está digitando..." por um tempo determinado.
 * @param {Channel} canal - Canal do Discord
 * @param {number} [duracao=1500] - Duração em ms
 */
async function mostrarDigitando(canal, duracao = 1500) {
  try {
    await canal.sendTyping();
    if (duracao > 0) {
      await new Promise((r) => setTimeout(r, duracao));
    }
  } catch {
    // ignora erros de permissão
  }
}

/** Mensagens de carregamento por categoria de comando */
const LOADING_MSGS = {
  diversao: [
    'Preparando a diversão...',
    'Aguenta que já chega...',
    'Deixa comigo~',
    'Montando o espetáculo...',
  ],
  info: [
    'Consultando os registros...',
    'Deixa eu ver...',
    'Ah, deixa comigo...',
    'Um momento...',
  ],
  moderacao: [
    'Processando sua solicitação...',
    'Executando com cuidado...',
    'Tô nisso~',
    'Verificando permissões...',
  ],
  interativo: [
    'Abrindo o painel...',
    'Preparando tudo pra você...',
    'Já chego...',
    'Aguenta uma estrelinha...',
  ],
  DEFAULT: [
    'Um momentinho...',
    'Deixa comigo...',
    'Já volto...',
    'Processando...',
  ],
};

/**
 * Retorna uma mensagem de loading aleatória para a categoria.
 */
function mensagemLoading(categoria = 'DEFAULT') {
  const msgs = LOADING_MSGS[categoria] || LOADING_MSGS.DEFAULT;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

/**
 * Resposta animada completa: typing → loading → resposta final.
 * Mostra "digitando..." e opcionalmente uma mensagem de loading antes da resposta.
 *
 * @param {Message} message - Mensagem original do usuário
 * @param {object} embed - EmbedBuilder final
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.ephemeral=false]
 * @param {string} [opcoes.categoria='DEFAULT'] - Categoria do comando
 * @param {boolean} [opcoes.mostrarLoading=false] - Mostrar msg de loading animada
 * @param {number} [opcoes.loadingDuracao=1200] - Duração da msg de loading em ms
 */
async function responderAnimado(message, embed, opcoes = {}) {
  const {
    ephemeral = false,
    categoria = 'DEFAULT',
    mostrarLoading = false,
    loadingDuracao = 1200,
  } = opcoes;

  // 1️⃣ Mostra "digitando..." (só para respostas públicas)
  if (!ephemeral) {
    mostrarDigitando(message.channel, 0).catch(() => {});
  }

  // 2️⃣ Opcional: mensagem de loading animada
  if (mostrarLoading) {
    const loadingEmbed = criarEmbedDecorado({
      titulo: `${THEME.iconeFooter} Processando...`,
      descricao: `_${mensagemLoading(categoria)}_`,
      cor: THEME.corPrincipal,
      semTimestamp: true,
      semDecoracao: true,
    });

    const loadingMsg = await message.reply({ embeds: [loadingEmbed] }).catch(() => null);

    if (loadingMsg) {
      await new Promise((r) => setTimeout(r, loadingDuracao));
      return loadingMsg.edit({ embeds: [embed] }).catch(() => null);
    }
  }

  // 3️⃣ Resposta final
  return message.reply({ embeds: [embed], ephemeral });
}

// ════════════════════════════════════════════════════════════════════════════
// EMBEDS DECORADAS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Cria uma embed decorada com a identidade visual da Mila.
 * Versão aprimorada de criarEmbed com divisores e formatação extra.
 */
function criarEmbedDecorado({ titulo, descricao, cor, rodape, thumbnail, image, semTimestamp, semDecoracao }) {
  const embed = new EmbedBuilder()
    .setColor(cor || THEME.corPrincipal);

  // Título com ícone temático
  if (titulo) {
    embed.setTitle(`${THEME.iconeFooter}  ${titulo}`);
  }

  // Descrição com decoração
  if (descricao) {
    embed.setDescription(descricao);
  }

  // Footer decorado
  embed.setFooter({
    text: rodape || THEME.footers[Math.floor(Math.random() * THEME.footers.length)],
  });

  if (!semTimestamp) embed.setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  return embed;
}

/**
 * Adiciona decoração de divisores a um embed existente (após criação).
 * @param {EmbedBuilder} embed
 * @returns {EmbedBuilder}
 */
function decorarEmbed(embed) {
  const desc = embed.data.description;
  if (desc && !desc.includes('─ ･')) {
    const decorado = `${THEME.div.bolinhas}\n\n${desc}\n\n${THEME.div.bolinhas}`;
    embed.setDescription(decorado);
  }
  return embed;
}

/**
 * Cria um embed de sucesso decorado.
 */
function embedSucesso(titulo, descricao) {
  return criarEmbedDecorado({
    titulo,
    descricao: `✅ ${descricao}`,
    cor: THEME.corSucesso,
  });
}

/**
 * Cria um embed de erro decorado.
 */
function embedErro(titulo, descricao) {
  return criarEmbedDecorado({
    titulo,
    descricao: `❌ ${descricao}`,
    cor: THEME.corErro,
  });
}

/**
 * Cria um embed informativo decorado.
 */
function embedInfo(titulo, descricao) {
  return criarEmbedDecorado({
    titulo,
    descricao,
    cor: THEME.corPrincipal,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TERMINAL — Banners e logs decorados
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
};

/**
 * Exibe um banner decorado no terminal quando um comando é executado.
 */
function bannerComando(comando, usuario, canal) {
  const agora = new Date();
  const ts = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;

  const linhas = [
    '',
    `${COR.rosa}${'─'.repeat(52)}${COR.reset}`,
    `${COR.rosa}  ${THEME.iconeFooter}${COR.reset}  ${COR.negrito}${COR.branco}$${comando}${COR.reset}  ${COR.cinza}• ${ts}${COR.reset}`,
    `${COR.rosa}  ${COR.dourado}♡${COR.reset}  ${COR.branco}${usuario || '—'}${COR.reset} ${COR.cinza}em #${canal || '?'}${COR.reset}`,
    `${COR.rosa}${'─'.repeat(52)}${COR.reset}`,
    '',
  ];

  console.log(linhas.join('\n'));
}

/**
 * Exibe uma mensagem de sucesso decorada no terminal.
 */
function bannerSucesso(comando, detalhe) {
  console.log(
    `${COR.verde}  ✓ ${THEME.iconeFooter} $${comando}${COR.reset} ${COR.cinza}— ${detalhe}${COR.reset}`
  );
}

/**
 * Exibe uma mensagem de erro decorada no terminal.
 */
function bannerErro(comando, detalhe) {
  console.error(
    `${COR.vermelho}  ✗ $${comando}${COR.reset} ${COR.cinza}— ${detalhe}${COR.reset}`
  );
}

/**
 * Separador decorado para o terminal.
 */
function separador() {
  console.log(`${COR.cinza}${THEME.div.bolinhas}${COR.reset}`);
}

module.exports = {
  // Discord
  mostrarDigitando,
  responderAnimado,
  criarEmbedDecorado,
  decorarEmbed,
  embedSucesso,
  embedErro,
  embedInfo,
  mensagemLoading,
  TYPING_DOTS,
  // Terminal
  COR,
  bannerComando,
  bannerSucesso,
  bannerErro,
  separador,
};
