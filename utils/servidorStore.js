const fs = require('fs');
const path = require('path');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'servidores.json');
const CAMINHO_BACKUP = path.join(__dirname, '..', 'data', 'servidores.backup.json');
const CAMINHO_TEMP = path.join(__dirname, '..', 'data', 'servidores.tmp.json');

const TIPOS_ANUNCIO = ['geral', 'evento', 'regra', 'atualizacao', 'aviso'];

// Cache em memória: antes, cada mensagem relia e reparseava o arquivo inteiro
// (duas vezes: obterConfig + verificarCanal). Agora o arquivo só é lido quando
// o cache expira ou quando esta instância grava.
const CACHE_TTL_MS = 1000;
let cacheRegistro = null;
let cacheEm = 0;

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
    tts: { idioma: 'pt-BR', perfil: 'padrao', voz: '', dizerNome: false },
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

function lerDoDisco() {
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

function carregarTodos() {
  const agora = Date.now();
  if (cacheRegistro && agora - cacheEm < CACHE_TTL_MS) return cacheRegistro;
  cacheRegistro = lerDoDisco();
  cacheEm = agora;
  return cacheRegistro;
}

function salvarTodos(registro) {
  garantirArquivo();
  fazerBackup();
  const json = JSON.stringify(registro, null, 2);
  // Escrita atômica: um crash no meio do write não deixa o JSON truncado.
  try {
    fs.writeFileSync(CAMINHO_TEMP, json, 'utf-8');
    fs.renameSync(CAMINHO_TEMP, CAMINHO_ARQUIVO);
  } catch {
    fs.writeFileSync(CAMINHO_ARQUIVO, json, 'utf-8');
  }
  cacheRegistro = registro;
  cacheEm = Date.now();
}

function clonarConfig(cfg) {
  return {
    ...cfg,
    canaisPermitidos: [...(cfg.canaisPermitidos || [])],
    canaisBloqueados: [...(cfg.canaisBloqueados || [])],
    anuncios: { ...(cfg.anuncios || {}) },
    cargosStaff: [...(cfg.cargosStaff || [])],
    tts: { ...(cfg.tts || {}) },
  };
}

function normalizarConfig(cfg) {
  const padrao = configPadrao();
  const resultado = { ...padrao, ...cfg };
  resultado.canaisPermitidos = Array.isArray(cfg.canaisPermitidos) ? cfg.canaisPermitidos : [];
  resultado.canaisBloqueados = Array.isArray(cfg.canaisBloqueados) ? cfg.canaisBloqueados : [];
  resultado.cargosStaff = Array.isArray(cfg.cargosStaff) ? cfg.cargosStaff : [];
  resultado.anuncios = { ...padrao.anuncios, ...(cfg.anuncios || {}) };
  resultado.tts = { ...padrao.tts, ...(cfg.tts || {}) };
  return resultado;
}

function obterConfig(guildId) {
  if (!guildId) return configPadrao();
  const registro = carregarTodos();
  const existente = registro[guildId];
  if (!existente) {
    registro[guildId] = configPadrao();
    salvarTodos(registro);
    return clonarConfig(registro[guildId]);
  }
  return clonarConfig(normalizarConfig(existente));
}

function salvarConfig(guildId, config) {
  if (!guildId) return;
  const registro = carregarTodos();
  registro[guildId] = normalizarConfig(config);
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

function verificarCanal(guildId, channelId, config = null) {
  const cfg = config || obterConfig(guildId);
  if (cfg.canaisBloqueados?.includes(channelId)) return { ok: false, motivo: 'bloqueado' };
  if (cfg.canaisPermitidos?.length > 0 && !cfg.canaisPermitidos.includes(channelId)) return { ok: false, motivo: 'foraDaLista' };
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
