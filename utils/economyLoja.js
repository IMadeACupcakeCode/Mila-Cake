// utils/economyLoja.js
// ── Catálogo e compras da doceria ─────────────────────────────────────
// O catálogo é compartilhado pelo comando /loja e pelo site (/api/loja),
// então preço, descrição e efeito nunca divergem entre Discord e web.

const db = require('./db');
const criador = require('./criador');

const CATEGORIAS = [
  { id: 'titulos', nome: 'Títulos', emoji: '🏅', descricao: 'Muda o título exibido no seu perfil.' },
  { id: 'itens', nome: 'Itens', emoji: '🎒', descricao: 'Guardados na mochila e na coleção.' },
  { id: 'cartas', nome: 'Pacotes', emoji: '🎴', descricao: 'Abra pacotes e tente a sorte.' },
  { id: 'buffs', nome: 'Vantagens', emoji: '⚡', descricao: 'Ajudam nos ganhos do dia a dia.' },
];

// Cartas que podem sair de um pacote (peso maior = mais comum).
const CARTAS = [
  { id: 'carta_cupcake', nome: '🧁 Cupcake Comum', raridade: 'Comum', peso: 100 },
  { id: 'carta_donut', nome: '🍩 Donut Glaceado', raridade: 'Comum', peso: 100 },
  { id: 'carta_brigadeiro', nome: '🍫 Brigadeiro Recheado', raridade: 'Comum', peso: 90 },
  { id: 'carta_trufado', nome: '🎂 Bolo Trufado', raridade: 'Incomum', peso: 45 },
  { id: 'carta_macaron', nome: '🍡 Macaron Mágico', raridade: 'Especial', peso: 12 },
  { id: 'carta_mila', nome: '✨ Mila Suprema', raridade: 'Raro', peso: 1 },
];

const ITENS = [
  // ── Títulos ──
  {
    id: 'titulo_vip',
    nome: 'Título: Confeiteiro VIP',
    emoji: '🏅',
    preco: 5000,
    tipo: 'titulo',
    categoria: 'titulos',
    titulo: 'Confeiteiro VIP',
    descricao: 'Mostre que você é especial na doceria.',
  },
  {
    id: 'titulo_mestre',
    nome: 'Título: Mestre dos Doces',
    emoji: '🏅',
    preco: 10000,
    tipo: 'titulo',
    categoria: 'titulos',
    titulo: 'Mestre dos Doces',
    descricao: 'Para quem já dominou a receita secreta.',
  },
  {
    id: 'titulo_lenda',
    nome: 'Título: Lenda Açucarada',
    emoji: '🌟',
    preco: 25000,
    tipo: 'titulo',
    categoria: 'titulos',
    titulo: 'Lenda Açucarada',
    descricao: 'Um título que poucos ousam carregar.',
  },
  {
    id: 'titulo_herdeiro',
    nome: 'Título: Herdeiro da Mila',
    emoji: '👑',
    preco: 50000,
    tipo: 'titulo',
    categoria: 'titulos',
    titulo: 'Herdeiro da Mila',
    descricao: 'O título mais cobiçado da confeitaria.',
  },
  // ── Itens ──
  {
    id: 'ingresso_evento',
    nome: '🎫 Ingresso p/ Festival',
    emoji: '🎫',
    preco: 1500,
    tipo: 'item',
    categoria: 'itens',
    descricao: 'Entrada para os eventos exclusivos da Mila.',
  },
  {
    id: 'chave_bau',
    nome: '🗝️ Chave do Baú',
    emoji: '🗝️',
    preco: 2500,
    tipo: 'item',
    categoria: 'itens',
    descricao: 'Abre o baú do tesouro da confeitaria.',
  },
  {
    id: 'xicara_mila',
    nome: '☕ Xícara da Mila',
    emoji: '☕',
    preco: 900,
    tipo: 'item',
    categoria: 'itens',
    descricao: 'Colecionável fofo para a sua mochila.',
  },
  // ── Pacotes ──
  {
    id: 'pacote_cartas',
    nome: '🎴 Pacote de Cartas',
    emoji: '🎴',
    preco: 500,
    tipo: 'carta',
    categoria: 'cartas',
    descricao: 'Uma carta aleatória da coleção.',
    cartas: 1,
  },
  {
    id: 'pacote_premium',
    nome: '💎 Pacote Premium',
    emoji: '💎',
    preco: 2500,
    tipo: 'carta',
    categoria: 'cartas',
    descricao: 'Duas cartas com chance dobrada de raridade.',
    cartas: 2,
    premium: true,
  },
  // ── Buffs ──
  {
    id: 'boost_trabalho',
    nome: '⚡ Café Forte',
    emoji: '⚡',
    preco: 1200,
    tipo: 'buff',
    categoria: 'buffs',
    descricao: 'Sua próxima jornada de trabalho rende +30%.',
  },
  {
    id: 'boost_diario',
    nome: '🌙 Bênção da Mila',
    emoji: '🌙',
    preco: 2000,
    tipo: 'buff',
    categoria: 'buffs',
    descricao: 'O próximo diário rende +25%.',
  },
];

function listarItens() {
  return ITENS.map((i) => ({ ...i }));
}

function buscarItem(id) {
  const alvo = String(id || '').trim().toLowerCase();
  return ITENS.find((i) => i.id === alvo) || null;
}

function listarPorCategoria() {
  return CATEGORIAS.map((cat) => ({
    ...cat,
    itens: ITENS.filter((i) => i.categoria === cat.id),
  }));
}

function sortearCarta(premium = false) {
  const pool = premium
    ? CARTAS.map((c) => ({ ...c, peso: c.raridade === 'Comum' ? c.peso / 2 : c.peso * 2 }))
    : CARTAS;
  const total = pool.reduce((soma, c) => soma + c.peso, 0);
  let r = Math.random() * total;
  for (const carta of pool) {
    if (r < carta.peso) return carta;
    r -= carta.peso;
  }
  return pool[0];
}

/**
 * Compra um item do catálogo.
 * @returns {{ok: boolean, motivo?: string, item?: object, saldo?: number, cartas?: Array, mensagem?: string}}
 */
function comprar(usuario, itemId) {
  const item = buscarItem(itemId);
  if (!item) return { ok: false, motivo: 'nao_encontrado' };

  const ehCriador = criador.ehCriador(usuario);
  const dados = db.getUsuario(usuario);
  const saldo = ehCriador ? criador.PONTOS_INFINITOS : Number(dados.acucares) || 0;

  if (!ehCriador && saldo < item.preco) {
    return { ok: false, motivo: 'sem_saldo', item, saldo };
  }

  if (!ehCriador) {
    db.addAcucares(usuario, -item.preco);
    db.incrementarEstatistica(usuario, 'gasto', item.preco);
    db.registrarTransacao(usuario, 'compra', -item.preco, item.nome);
  }
  db.incrementarEstatistica(usuario, 'compra', 1);

  let cartas = [];
  if (item.tipo === 'titulo') {
    db.atualizarTitulo(usuario, item.titulo);
  } else if (item.tipo === 'carta') {
    const quantidade = Math.max(1, Number(item.cartas) || 1);
    for (let i = 0; i < quantidade; i += 1) {
      const carta = sortearCarta(item.premium);
      cartas.push(carta);
      db.addInventario(usuario, carta.nome, 1);
    }
  } else {
    db.addInventario(usuario, item.nome, 1);
  }

  return {
    ok: true,
    item,
    cartas,
    saldo: ehCriador ? criador.PONTOS_INFINITOS : Math.max(0, saldo - item.preco),
    mensagem: item.tipo === 'titulo'
      ? `Seu título agora é **${item.titulo}**.`
      : item.tipo === 'carta'
        ? cartas.map((c) => `${c.nome} (${c.raridade})`).join(' · ')
        : `**${item.nome}** foi para a sua mochila.`,
  };
}

module.exports = {
  CATEGORIAS,
  CARTAS,
  ITENS,
  listarItens,
  listarPorCategoria,
  buscarItem,
  sortearCarta,
  comprar,
};
