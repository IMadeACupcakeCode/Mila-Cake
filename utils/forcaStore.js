const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '..', 'data', 'forcaRanking.json');
const CAMINHO_BACKUP = path.join(__dirname, '..', 'data', 'forcaRanking.backup.json');

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
    try {
      const backup = fs.readFileSync(CAMINHO_BACKUP, 'utf-8');
      const dados = JSON.parse(backup);
      fs.writeFileSync(CAMINHO, backup, 'utf-8');
      return dados;
    } catch {
      return {};
    }
  }
}

function salvar(dados) {
  garantir();
  try { fs.copyFileSync(CAMINHO, CAMINHO_BACKUP); } catch {}
  fs.writeFileSync(CAMINHO, JSON.stringify(dados, null, 2), 'utf-8');
}

// ── API de Ranking ──

function registrarVitoria(userId, userTag, modo, dificuldade) {
  const dados = carregar();
  if (!dados[userId]) {
    dados[userId] = {
      tag: userTag,
      vitorias: { maquina: 0, competitivo: 0, cooperativo: 0 },
      modo: {},
      total: 0,
    };
  }
  dados[userId].tag = userTag;
  dados[userId].vitorias[modo] = (dados[userId].vitorias[modo] || 0) + 1;
  dados[userId].total = (dados[userId].total || 0) + 1;
  if (!dados[userId].modo[modo]) dados[userId].modo[modo] = {};
  dados[userId].modo[modo][dificuldade] = (dados[userId].modo[modo]?.[dificuldade] || 0) + 1;
  dados[userId].ultimaVitoria = Date.now();
  salvar(dados);
}

function obterRanking(tipo = 'total', limite = 10) {
  const dados = carregar();
  const lista = Object.entries(dados)
    .map(([id, info]) => ({
      id,
      tag: info.tag || 'Desconhecido',
      total: info.total || 0,
      maquina: info.vitorias?.maquina || 0,
      competitivo: info.vitorias?.competitivo || 0,
      cooperativo: info.vitorias?.cooperativo || 0,
      ultimaVitoria: info.ultimaVitoria || 0,
    }));

  if (tipo === 'maquina') lista.sort((a, b) => b.maquina - a.maquina);
  else if (tipo === 'competitivo') lista.sort((a, b) => b.competitivo - a.competitivo);
  else if (tipo === 'cooperativo') lista.sort((a, b) => b.cooperativo - a.cooperativo);
  else lista.sort((a, b) => b.total - a.total);

  return lista.slice(0, limite);
}

function obterJogador(userId) {
  const dados = carregar();
  return dados[userId] || null;
}

module.exports = { registrarVitoria, obterRanking, obterJogador };
