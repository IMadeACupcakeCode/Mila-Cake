const path = require('path');
const { lerJson, salvarJson } = require('./jsonStore');

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

function carregarTodos() {
  const dados = lerJson(CAMINHO_ARQUIVO, {}, CAMINHO_BACKUP);
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
}

function salvarTodos(registro) {
  salvarJson(CAMINHO_ARQUIVO, registro, { backup: CAMINHO_BACKUP });
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