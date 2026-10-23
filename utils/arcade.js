// ⋆｡°✩ Mila Arcade — helpers visuais compartilhados pelos jogos.
// Barras, embeds, animações por edição de mensagem e pequenos utilitários.

const { criarEmbed, THEME } = require('./theme');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function truncar(texto, limite = 80) {
  const valor = String(texto ?? '');
  return valor.length > limite ? `${valor.slice(0, limite - 1)}…` : valor;
}

function barra(valor, maximo, tamanho = 10, cheio = '🟩', vazio = '⬛') {
  const total = Math.max(1, Number(tamanho) || 10);
  const proporcao = maximo > 0 ? Math.max(0, Math.min(1, valor / maximo)) : 0;
  const preenchido = Math.round(proporcao * total);
  return `${cheio.repeat(preenchido)}${vazio.repeat(total - preenchido)}`;
}

function barraPorcentagem(porcentagem, tamanho = 10) {
  const pct = Math.max(0, Math.min(100, Number(porcentagem) || 0));
  const cheio = pct >= 75 ? '🟩' : pct >= 40 ? '🟨' : pct >= 15 ? '🟧' : '🟥';
  return barra(pct, 100, tamanho, cheio, '⬛');
}

function corPorPercentual(porcentagem) {
  const pct = Number(porcentagem) || 0;
  if (pct >= 75) return 0x22C55E;
  if (pct >= 40) return 0xFACC15;
  if (pct >= 15) return 0xF97316;
  return 0xEF4444;
}

function embedArcade({ titulo, descricao, cor, rodape, thumbnail, campos, semTimestamp }) {
  const embed = criarEmbed({ titulo, descricao, cor, rodape, thumbnail, semTimestamp });
  if (Array.isArray(campos) && campos.length) embed.addFields(campos.slice(0, 25));
  return embed;
}

function payload(embed, components = []) {
  return { embeds: [embed], components, attachments: [] };
}

async function animar(message, frames, delay = 650) {
  for (const frame of frames) {
    const corpo = frame && (frame.embeds || frame.components || frame.files)
      ? frame
      : { embeds: [frame], components: [], attachments: [] };
    await message.edit(corpo);
    await sleep(delay);
  }
}

const FACES_DADO = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function faceDado(valor) {
  return FACES_DADO[Number(valor) - 1] || '🎲';
}

function setaRoleta(opcoes, destaque) {
  return opcoes
    .map((opcao, indice) => {
      if (indice === destaque) return `➤ **${opcao}**`;
      return `˖ ${opcao}`;
    })
    .join('\n');
}

function assinatura(nome = 'Mila Arcade') {
  return `${nome} · ${THEME.nome}`;
}

module.exports = {
  sleep,
  truncar,
  barra,
  barraPorcentagem,
  corPorPercentual,
  embedArcade,
  payload,
  animar,
  faceDado,
  setaRoleta,
  assinatura,
};
