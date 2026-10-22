const path = require('path');
const { lerJson, salvarJson } = require('./jsonStore');

const CAMINHO = path.join(__dirname, '..', 'data', 'cartas.json');

function carregar() {
  const dados = lerJson(CAMINHO, {});
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
}

function salvar(dados) {
  try {
    salvarJson(CAMINHO, dados);
  } catch {
    // não deixa a falha de disco derrubar o comando
  }
}

// Registra uma carta enviada pelo autor (userId)
function registrarCarta(autorId, { paraTag, autorExibido, anonimo, conteudo }) {
  const dados = carregar();
  if (!Array.isArray(dados[autorId])) dados[autorId] = [];
  const carta = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    paraTag,
    autorExibido: anonimo ? null : autorExibido,
    anonimo: !!anonimo,
    conteudo,
    em: Date.now(),
  };
  dados[autorId].unshift(carta); // mais recente primeiro
  salvar(dados);
  return carta;
}

// Retorna as cartas do autor (mais recentes primeiro)
function obterCartas(autorId) {
  const dados = carregar();
  return Array.isArray(dados[autorId]) ? dados[autorId] : [];
}

module.exports = { registrarCarta, obterCartas };
