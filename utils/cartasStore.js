const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '..', 'data', 'cartas.json');

function garantir() {
  const pasta = path.dirname(CAMINHO);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  if (!fs.existsSync(CAMINHO)) fs.writeFileSync(CAMINHO, '{}', 'utf-8');
}

function carregar() {
  garantir();
  try {
    return JSON.parse(fs.readFileSync(CAMINHO, 'utf-8'));
  } catch {
    return {};
  }
}

function salvar(dados) {
  garantir();
  try {
    fs.writeFileSync(CAMINHO, JSON.stringify(dados, null, 2), 'utf-8');
  } catch {}
}

// Registra uma carta enviada pelo autor (userId)
function registrarCarta(autorId, { paraTag, autorExibido, anonimo, conteudo }) {
  const dados = carregar();
  if (!dados[autorId]) dados[autorId] = [];
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
  return dados[autorId] || [];
}

module.exports = { registrarCarta, obterCartas };