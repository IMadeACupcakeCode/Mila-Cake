// utils/jsonStore.js
// -------------------------------------------------
// Leitura e escrita de arquivos JSON de estado com segurança.
// - Escrita atômica (arquivo temporário + rename): um crash no meio da
//   gravação não deixa o JSON truncado, o que antes fazia o bot perder
//   rankings, tickets e lembretes.
// - Leitura com fallback para backup quando o arquivo principal corrompe.
// -------------------------------------------------

const fs = require('fs');
const path = require('path');

function garantirArquivo(caminho, padrao = '{}') {
  const pasta = path.dirname(caminho);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  if (!fs.existsSync(caminho)) fs.writeFileSync(caminho, padrao, 'utf-8');
}

/**
 * Lê um JSON. Em caso de corrupção, tenta o backup e restaura o principal.
 * @param {string} caminho
 * @param {*} padrao valor devolvido quando nada é legível (não é compartilhado)
 * @param {string|null} caminhoBackup
 */
function lerJson(caminho, padrao = {}, caminhoBackup = null) {
  garantirArquivo(caminho, JSON.stringify(padrao));
  try {
    return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  } catch {
    if (caminhoBackup) {
      try {
        const bruto = fs.readFileSync(caminhoBackup, 'utf-8');
        const dados = JSON.parse(bruto);
        fs.writeFileSync(caminho, bruto, 'utf-8');
        return dados;
      } catch {
        // sem backup legível: devolve o padrão
      }
    }
    return padrao;
  }
}

/**
 * Grava um JSON de forma atômica, opcionalmente guardando um backup do
 * conteúdo anterior.
 * @param {string} caminho
 * @param {*} dados
 * @param {{ backup?: string|null }} [opcoes]
 */
function salvarJson(caminho, dados, { backup = null } = {}) {
  garantirArquivo(caminho);
  if (backup) {
    try {
      if (fs.existsSync(caminho)) fs.copyFileSync(caminho, backup);
    } catch {
      // backup é uma conveniência: falhar aqui não impede a gravação
    }
  }
  const json = JSON.stringify(dados, null, 2);
  const temporario = `${caminho}.tmp`;
  try {
    fs.writeFileSync(temporario, json, 'utf-8');
    fs.renameSync(temporario, caminho);
  } catch {
    try { fs.rmSync(temporario, { force: true }); } catch { /* ignora */ }
    fs.writeFileSync(caminho, json, 'utf-8');
  }
}

module.exports = { garantirArquivo, lerJson, salvarJson };
