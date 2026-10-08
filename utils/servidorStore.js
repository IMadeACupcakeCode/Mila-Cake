const fs = require('fs');
const path = require('path');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'servidores.json');
const CAMINHO_BACKUP = path.join(__dirname, '..', 'data', 'servidores.backup.json');

const TIPOS_ANUNCIO = ['geral', 'evento', 'regra', 'atualizacao', 'aviso'];

function configPadrao() {
  return {
    prefixo: '$',
    idioma: 'pt-BR',
    canaisPermitidos: [],
    canaisBloqueados: [],
    anuncios: { geral: null, evento: null, regra: null, atualizacao: null, aviso: null },
    cargosStaff: [],
    canalShutdown: null,
    categoriaTicket: null,
    canalOnOff: null,
    canalTicketFixo: null,
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
  const cfg = registro[guildId];
  const padrao = configPadrao();
  cfg.prefixo = cfg.prefixo || padrao.prefixo;
  cfg.idioma = cfg.idioma || padrao.idioma;
  cfg.canaisPermitidos = cfg.canaisPermitidos || padrao.canaisPermitidos;
  cfg.canaisBloqueados = cfg.canaisBloqueados || padrao.canaisBloqueados;
  cfg.anuncios = { ...padrao.anuncios, ...(cfg.anuncios || {}) };
  cfg.cargosStaff = cfg.cargosStaff || padrao.cargosStaff;
  cfg.canalShutdown = cfg.canalShutdown || padrao.canalShutdown;
  cfg.categoriaTicket = cfg.categoriaTicket || padrao.categoriaTicket;
  cfg.canalOnOff = cfg.canalOnOff || padrao.canalOnOff;
  cfg.canalTicketFixo = cfg.canalTicketFixo || padrao.canalTicketFixo;
  return cfg;
}

function salvarConfig(guildId, config) {
  const registro = carregarTodos();
  registro[guildId] = config;
  salvarTodos(registro);
}

function exportarConfig(guildId) {
  return JSON.stringify(obterConfig(guildId), null, 2);
}

function importarConfig(guildId, jsonString) {
  try {
    const dados = JSON.parse(jsonString);
    if (!Array.isArray(dados.canaisPermitidos) || !Array.isArray(dados.canaisBloqueados) || !dados.anuncios) {
      return { ok: false, erro: 'Estrutura inválida.' };
    }
    salvarConfig(guildId, dados);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: `JSON inválido: ${e.message}` };
  }
}

function verificarCanal(guildId, channelId) {
  const cfg = obterConfig(guildId);
  if (cfg.canaisBloqueados.includes(channelId)) return { ok: false, motivo: 'bloqueado' };
  if (cfg.canaisPermitidos.length > 0 && !cfg.canaisPermitidos.includes(channelId)) return { ok: false, motivo: 'foraDaLista' };
  return { ok: true };
}

module.exports = {
  TIPOS_ANUNCIO,
  configPadrao,
  obterConfig,
  salvarConfig,
  verificarCanal,
  exportarConfig,
  importarConfig,
};