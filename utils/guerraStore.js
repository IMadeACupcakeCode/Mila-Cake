const fs = require('fs');
const path = require('path');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'guerra.json');

function garantirArquivo() {
  const pasta = path.dirname(CAMINHO_ARQUIVO);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  if (!fs.existsSync(CAMINHO_ARQUIVO)) fs.writeFileSync(CAMINHO_ARQUIVO, '{}', 'utf-8');
}

function carregar() {
  garantirArquivo();
  try {
    return JSON.parse(fs.readFileSync(CAMINHO_ARQUIVO, 'utf-8'));
  } catch {
    return {};
  }
}

function salvar(registro) {
  garantirArquivo();
  fs.writeFileSync(CAMINHO_ARQUIVO, JSON.stringify(registro, null, 2), 'utf-8');
}

function registrarVitoria(userId, username) {
  const registro = carregar();
  if (!registro[userId]) registro[userId] = { vitorias: 0, nome: username };
  registro[userId].vitorias = (registro[userId].vitorias || 0) + 1;
  registro[userId].nome = username;
  salvar(registro);
}

function atualizarNome(userId, username) {
  const registro = carregar();
  if (!registro[userId]) registro[userId] = { vitorias: 0, nome: username };
  registro[userId].nome = username;
  salvar(registro);
}

function top(limite = 10) {
  const registro = carregar();
  return Object.entries(registro)
    .map(([id, v]) => ({ id, vitorias: v.vitorias || 0, nome: v.nome || 'desconhecido' }))
    .sort((a, b) => b.vitorias - a.vitorias)
    .slice(0, limite);
}

module.exports = { registrarVitoria, atualizarNome, top };