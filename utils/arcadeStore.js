// Placar simples e persistente dos mini-jogos da Mila Arcade.
// Estrutura: { [jogo]: { [userId]: { nome, ...campos } } }

const path = require('path');
const { lerJson, salvarJson } = require('./jsonStore');

const CAMINHO = path.join(__dirname, '..', 'data', 'arcade.json');

function carregar() {
  const dados = lerJson(CAMINHO, {});
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
}

function salvar(dados) {
  try {
    salvarJson(CAMINHO, dados);
  } catch {
    // Não deixa uma falha de disco derrubar o jogo.
  }
}

function obter(jogo, userId) {
  const dados = carregar();
  return dados[jogo]?.[userId] || null;
}

function atualizar(jogo, userId, nome, mutator) {
  const dados = carregar();
  if (!dados[jogo]) dados[jogo] = {};
  const atual = dados[jogo][userId] || {
    nome,
    vitorias: 0,
    derrotas: 0,
    sequencia: 0,
    melhorSequencia: 0,
    partidas: 0,
  };
  const novo = mutator({ ...atual }) || atual;
  novo.nome = nome || novo.nome;
  dados[jogo][userId] = novo;
  salvar(dados);
  return novo;
}

function top(jogo, limite = 10, campo = 'vitorias') {
  const dados = carregar();
  const secao = dados[jogo] || {};
  return Object.entries(secao)
    .map(([id, valor]) => ({ id, ...valor }))
    .sort((a, b) => (Number(b[campo]) || 0) - (Number(a[campo]) || 0))
    .slice(0, limite);
}

module.exports = { obter, atualizar, top, carregar };
