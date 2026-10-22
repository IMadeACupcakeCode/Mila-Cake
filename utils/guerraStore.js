const path = require('path');
const { lerJson, salvarJson } = require('./jsonStore');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'guerra.json');

function carregar() {
  const dados = lerJson(CAMINHO_ARQUIVO, {});
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
}

function salvar(registro) {
  salvarJson(CAMINHO_ARQUIVO, registro);
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