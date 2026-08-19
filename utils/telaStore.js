// ⋆｡°✩ Mila Tela — ponte entre o bot e a "Sala de Tela" (discord-screen)
//
// O compartilhamento de tela NÃO roda dentro do bot: é um app web separado
// (pasta `discord-screen/` junto deste projeto) que usa o sistema de Activity
// do Discord. Este utilitário só LÊ a configuração daquele app (do .env dele)
// e faz um health check — para o comando $tela mostrar o endereço público e o
// estado atual sem precisar do código do app aqui dentro.
//
// ⚠️ Por que não se toca o .env do app daqui: quem manda nele é o assistente
// do próprio app (`npm run configurar` / `npm run tunel` dentro de
// discord-screen/). Ler é seguro e estável.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Pasta do app "Sala de Tela". Resolvida relativa a este arquivo para
// funcionar de qualquer lugar que importe (comandos por prefixo e slash).
const PASTA_TELA = path.join(__dirname, '..', 'discord-screen');
const ARQ_ENV = path.join(PASTA_TELA, '.env');

/** Lê uma variável do .env do app de tela (sem expor segredos). */
function lerVarEnvsTela(chave) {
  try {
    const texto = fs.readFileSync(ARQ_ENV, 'utf8');
    for (const linha of texto.split(/\r?\n/)) {
      const semComentario = linha.replace(/^\s*#.*$/, '').trim();
      if (!semComentario) continue;
      const [k, ...resto] = semComentario.split('=');
      if (k.trim() === chave) {
        return resto.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env do app ainda não existe — configuração incompleta.
  }
  return '';
}

/**
 * Estado atual da Sala de Tela, para o $tela renderizar sem erro.
 * Nunca lança: se algo faltar, devolve o estado "não configurado" e o
 * comando mostra o que fazer.
 */
function estadoTela() {
  const origem = lerVarEnvsTela('PUBLIC_ORIGIN');
  const clientId = lerVarEnvsTela('DISCORD_CLIENT_ID');
  const temApp = fs.existsSync(path.join(PASTA_TELA, 'package.json'));

  const normalizar = (u) => String(u || '').replace(/[/]+$/, '');

  return {
    appPresente: temApp,
    origem: normalizar(origem),
    clientId: clientId || null,
    // Publicar fora do Discord também funciona: o site lista salas.
    configurado: Boolean(origem) && temApp,
  };
}

/**
 * Faz um health check no servidor da Sala de Tela.
 * @returns {Promise<{ok:boolean, ms?:number, motivo?:string}>}
 */
function verificarServidor() {
  const { origem } = estadoTela();
  if (!origem) return Promise.resolve({ ok: false, motivo: 'sem_endereco' });

  let u;
  try {
    u = new URL(origem);
  } catch {
    return Promise.resolve({ ok: false, motivo: 'endereco_invalido' });
  }

  const lib = u.protocol === 'https:' ? https : http;
  const ini = Date.now();

  return new Promise((resolve) => {
    const req = lib.get(`${origem}/api/health`, (res) => {
      res.resume();
      const ms = Date.now() - ini;
      resolve({ ok: res.statusCode === 200, ms, status: res.statusCode });
    });
    req.setTimeout(4000, () => {
      req.destroy();
      resolve({ ok: false, ms: Date.now() - ini, motivo: 'timeout' });
    });
    req.on('error', () => {
      resolve({ ok: false, ms: Date.now() - ini, motivo: 'fora_do_ar' });
    });
  });
}

module.exports = { estadoTela, verificarServidor, PASTA_TELA, ARQ_ENV };
