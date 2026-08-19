const fs = require('fs');
const path = require('path');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'tickets.json');
const CAMINHO_BACKUP = path.join(__dirname, '..', 'data', 'tickets.backup.json');

function configPadrao() {
  return {
    ativo: false,
    categoriaId: null,
    categoriasPorTipo: {},
    cargosStaff: [],
    contador: 0,
  };
}

function garantirArquivo() {
  const pasta = path.dirname(CAMINHO_ARQUIVO);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  if (!fs.existsSync(CAMINHO_ARQUIVO)) fs.writeFileSync(CAMINHO_ARQUIVO, '{}', 'utf-8');
}

function fazerBackup() {
  try {
    if (fs.existsSync(CAMINHO_ARQUIVO)) fs.copyFileSync(CAMINHO_ARQUIVO, CAMINHO_BACKUP);
  } catch {
    // silêncio
  }
}

function carregarTodos() {
  garantirArquivo();
  const conteudo = fs.readFileSync(CAMINHO_ARQUIVO, 'utf-8');
  try {
    return JSON.parse(conteudo);
  } catch {
    try {
      const backup = fs.readFileSync(CAMINHO_BACKUP, 'utf-8');
      const dados = JSON.parse(backup);
      fs.writeFileSync(CAMINHO_ARQUIVO, backup, 'utf-8');
      return dados;
    } catch {
      return {};
    }
  }
}

function salvarTodos(registro) {
  garantirArquivo();
  fazerBackup();
  fs.writeFileSync(CAMINHO_ARQUIVO, JSON.stringify(registro, null, 2), 'utf-8');
}

function obterConfig(guildId) {
  const registro = carregarTodos();
  if (!registro[guildId]) {
    registro[guildId] = configPadrao();
    salvarTodos(registro);
  }
  const cfg = { ...registro[guildId] };
  cfg.categoriasPorTipo = cfg.categoriasPorTipo || {};
  cfg.cargosStaff = cfg.cargosStaff || [];
  return cfg;
}

function salvarConfig(guildId, config) {
  const registro = carregarTodos();
  registro[guildId] = config;
  salvarTodos(registro);
}

module.exports = {
  obterConfig,
  salvarConfig,
};