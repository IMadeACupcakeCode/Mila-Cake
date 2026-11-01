// utils/economyThemeData.js
// ── Temas visuais da Economia da Mila ────────────────────────────────
// Cada tema recria a "internet de 2009–2012" sem depender de imagem:
// molduras, barras, divisores e cores são feitos com texto/emoji, então
// funcionam em qualquer embed do Discord e no site.
//
// Este arquivo é só DADOS (sem require de db/servidorStore) para poder ser
// usado tanto pelo servidorStore quanto pelo renderizador de embeds.

const TEMAS = {
  win7: {
    id: 'win7',
    nome: 'Windows 7 Aero',
    emoji: '🪟',
    cor: 0x2E75B6,
    cor2: 0x8CC6F0,
    descricao: 'Vidro azul, janelas do Explorer e brilho Aero.',
    divTopo: '▛▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▜',
    divBase: '▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▟',
    linha: '─',
    marcador: '❖',
    icone: '🪟',
    barraCheia: '▰',
    barraVazia: '▱',
    rodape: 'Mila Aero · uma janela aberta desde 2009',
    saudacao: 'Bem-vindo à Área de Trabalho da Mila.',
    botaoPrimario: 0x2E75B6,
    botaoSecundario: 0x8CC6F0,
  },
  hangouts: {
    id: 'hangouts',
    nome: 'Google Hangouts',
    emoji: '💬',
    cor: 0x0F9D58,
    cor2: 0x34A853,
    descricao: 'Balões de conversa, verde Google e status online.',
    divTopo: '╭──────────────────────────────╮',
    divBase: '╰──────────────────────────────╯',
    linha: '─',
    marcador: '●',
    icone: '💬',
    barraCheia: '🟩',
    barraVazia: '⬜',
    rodape: 'Mila Hangouts · online para você',
    saudacao: 'Oi! Chegou mensagem nova na doceria.',
    botaoPrimario: 0x0F9D58,
    botaoSecundario: 0x34A853,
  },
  gplus: {
    id: 'gplus',
    nome: 'Google+ 2012',
    emoji: '➕',
    cor: 0xDB4437,
    cor2: 0xF4B400,
    descricao: 'Streams, círculos e o botão +1.',
    divTopo: '▸▸▸ ───────────────────────── ▸▸▸',
    divBase: '◂◂◂ ───────────────────────── ◂◂◂',
    linha: '─',
    marcador: '＋',
    icone: '➕',
    barraCheia: '🟥',
    barraVazia: '⬜',
    rodape: 'Mila+ · compartilhe com seus círculos',
    saudacao: 'Poste no seu círculo da doceria.',
    botaoPrimario: 0xDB4437,
    botaoSecundario: 0xF4B400,
  },
  skype: {
    id: 'skype',
    nome: 'Skype 2012',
    emoji: '📞',
    cor: 0x00AFF0,
    cor2: 0x7FBA00,
    descricao: 'Céu azul, contatos online e chamadas.',
    divTopo: '▂▃▄▅▆▇█ SKYPE █▇▆▅▄▃▂',
    divBase: '▂▃▄▅▆▇█ MILA  █▇▆▅▄▃▂',
    linha: '─',
    marcador: '●',
    icone: '📞',
    barraCheia: '🟦',
    barraVazia: '⬜',
    rodape: 'Mila Skype · chamando você ♡',
    saudacao: 'Status: online. Chamada de doces iniciada.',
    botaoPrimario: 0x00AFF0,
    botaoSecundario: 0x7FBA00,
  },
  facebook: {
    id: 'facebook',
    nome: 'Facebook 2012',
    emoji: '📘',
    cor: 0x3B5998,
    cor2: 0x6D84B4,
    descricao: 'Timeline, curtidas e o feed azul.',
    divTopo: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    divBase: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    linha: '─',
    marcador: 'f',
    icone: '📘',
    barraCheia: '🟦',
    barraVazia: '⬜',
    rodape: 'MilaBook · curta, compartilhe, doe doces',
    saudacao: 'No seu feed: a Mila atualizou o status.',
    botaoPrimario: 0x3B5998,
    botaoSecundario: 0x6D84B4,
  },
  ddtank: {
    id: 'ddtank',
    nome: 'DDTank',
    emoji: '⚔️',
    cor: 0xE67E22,
    cor2: 0xC0392B,
    descricao: 'Portal de jogo, madeira, estrelas e aventura.',
    divTopo: '╔══════════════════════════════╗',
    divBase: '╚══════════════════════════════╝',
    linha: '═',
    marcador: '★',
    icone: '⚔️',
    barraCheia: '🟧',
    barraVazia: '⬛',
    rodape: 'MilaTank · entre na batalha dos doces',
    saudacao: 'Servidor aberto! Escolha seu personagem.',
    botaoPrimario: 0xE67E22,
    botaoSecundario: 0xC0392B,
  },
};

const IDS_TEMAS = Object.keys(TEMAS);
const TEMA_PADRAO = 'win7';

function normalizarTema(valor) {
  const id = String(valor ?? '').trim().toLowerCase();
  return TEMAS[id] ? id : TEMA_PADRAO;
}

function obterTema(valor) {
  return TEMAS[normalizarTema(valor)];
}

function listarTemas() {
  return IDS_TEMAS.map((id) => TEMAS[id]);
}

function escolhasTemas() {
  return listarTemas().map((tema) => ({
    name: `${tema.emoji} ${tema.nome}`.slice(0, 100),
    value: tema.id,
  }));
}

module.exports = {
  TEMAS,
  IDS_TEMAS,
  TEMA_PADRAO,
  normalizarTema,
  obterTema,
  listarTemas,
  escolhasTemas,
};
