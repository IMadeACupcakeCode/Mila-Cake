const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { caminhoBinario } = require('./ytdlpSetup');

// ─────────────────────────────────────────────────────────────────────────────
// Cache local de áudio.
//
// O yt-dlp devolve URLs do googlevideo que funcionam para ele, mas que o ffmpeg
// do DisTube recebe como 403 (o CDN responde com redirect/assinatura que só o
// cliente do yt-dlp consegue seguir). Em vez de brigar com o CDN, o áudio é
// baixado pelo próprio yt-dlp para data/cache-audio e servido por um servidor
// HTTP local (com suporte a Range, para o ffmpeg poder buscar posições).
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ = path.join(__dirname, '..');
const DIR = process.env.AUDIO_CACHE_DIR || path.join(RAIZ, 'data', 'cache-audio');
const ATIVO = !/^(0|false|nao|não|off)$/i.test(String(process.env.AUDIO_CACHE_ATIVO ?? 'true').trim());
const IDADE_MAXIMA = Math.max(1, Number(process.env.AUDIO_CACHE_HORAS) || 12) * 60 * 60 * 1000;
const LIMITE_TOTAL = Math.max(64, Number(process.env.AUDIO_CACHE_MB) || 1024) * 1024 * 1024;
const TIMEOUT_DOWNLOAD = Math.max(30_000, Number(process.env.AUDIO_CACHE_TIMEOUT_MS) || 300_000);
const CONCORRENCIA = Math.max(1, Number(process.env.AUDIO_CACHE_CONCORRENCIA) || 2);

const MIMES = {
  '.webm': 'audio/webm',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
};

let servidor = null;
let portaAtual = null;
let iniciando = null;
let limpezaFeita = false;
const emAndamento = new Map(); // chave -> Promise<{ arquivo, nome }>

function garantirDiretorio() {
  fs.mkdirSync(DIR, { recursive: true });
}

function chaveDe(song) {
  const base = String(song?.url || song?.id || '');
  return crypto.createHash('sha1').update(base).digest('hex').slice(0, 16);
}

function extensaoDe(nome) {
  return path.extname(String(nome || '')).toLowerCase();
}

function mimeDe(arquivo) {
  return MIMES[extensaoDe(arquivo)] || 'application/octet-stream';
}

function listarArquivos() {
  try {
    garantirDiretorio();
    return fs.readdirSync(DIR)
      .filter((nome) => !nome.endsWith('.part') && !nome.endsWith('.parcial'))
      .map((nome) => {
        const completo = path.join(DIR, nome);
        try {
          const info = fs.statSync(completo);
          return { nome, completo, tamanho: info.size, mtime: info.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Remove o que já passou da validade e, se o cache crescer demais, apaga os
// arquivos mais antigos (a URL do YouTube expira em poucas horas de qualquer
// forma, então guardar por muito tempo não ajuda).
function limparCache() {
  if (limpezaFeita) return;
  limpezaFeita = true;
  const agora = Date.now();
  let arquivos = listarArquivos();
  for (const item of arquivos) {
    if (agora - item.mtime > IDADE_MAXIMA) {
      try { fs.unlinkSync(item.completo); } catch {}
    }
  }
  arquivos = listarArquivos();
  let total = arquivos.reduce((soma, item) => soma + item.tamanho, 0);
  if (total <= LIMITE_TOTAL) return;
  arquivos.sort((a, b) => a.mtime - b.mtime);
  for (const item of arquivos) {
    if (total <= LIMITE_TOTAL) break;
    try { fs.unlinkSync(item.completo); total -= item.tamanho; } catch {}
  }
}

function arquivoEmCache(chave) {
  const prefixo = `${chave}.`;
  return listarArquivos().find((item) => item.nome.startsWith(prefixo)) || null;
}

function argumentosCookies() {
  if (process.env.YTDLP_COOKIES_FILE && fs.existsSync(process.env.YTDLP_COOKIES_FILE)) {
    return ['--cookies', process.env.YTDLP_COOKIES_FILE];
  }
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
    return ['--cookies-from-browser', process.env.YTDLP_COOKIES_FROM_BROWSER];
  }
  return [];
}

function baixarComYtdlp(song, chave) {
  return new Promise((resolve, reject) => {
    garantirDiretorio();
    const destino = path.join(DIR, `${chave}.%(ext)s`);
    const args = [
      String(song.url),
      '-f', 'ba/b',
      '--no-playlist',
      '--no-warnings',
      '--js-runtimes', process.env.YTDLP_JS_RUNTIME || 'node',
      '--remote-components', process.env.YTDLP_REMOTE_COMPONENTS || 'ejs:github',
      '-o', destino,
      ...argumentosCookies(),
    ];

    const processo = spawn(caminhoBinario(), args, { windowsHide: true });
    let erro = '';
    let finalizado = false;

    const terminar = (fn, valor) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      fn(valor);
    };

    const temporizador = setTimeout(() => {
      try { processo.kill('SIGKILL'); } catch {}
      terminar(reject, new Error('o download do áudio demorou demais'));
    }, TIMEOUT_DOWNLOAD);
    temporizador.unref?.();

    processo.stderr.on('data', (pedaco) => { erro += pedaco.toString(); });
    processo.on('error', (falha) => terminar(reject, falha));
    processo.on('exit', (codigo) => {
      if (codigo !== 0) {
        const resumo = erro.split('\n').filter(Boolean).slice(-2).join(' | ');
        return terminar(reject, new Error(`yt-dlp saiu com código ${codigo}: ${resumo}`));
      }
      const encontrado = arquivoEmCache(chave);
      if (!encontrado || encontrado.tamanho < 1024) {
        return terminar(reject, new Error('o yt-dlp não gerou um arquivo de áudio válido'));
      }
      terminar(resolve, { arquivo: encontrado.completo, nome: encontrado.nome });
    });
  });
}

// Garante que a música esteja no cache. Chamadas simultâneas para a mesma
// música reaproveitam o mesmo download.
async function baixarAudio(song) {
  if (!ATIVO) return null;
  if (!song?.url) throw new Error('música sem URL para baixar');
  limparCache();

  const chave = chaveDe(song);
  const existente = arquivoEmCache(chave);
  if (existente) return { arquivo: existente.completo, nome: existente.nome };

  if (emAndamento.has(chave)) return emAndamento.get(chave);

  const promessa = baixarComYtdlp(song, chave)
    .then((resultado) => {
      console.log(`[Música] Áudio em cache: ${resultado.nome}`);
      return resultado;
    })
    .finally(() => { emAndamento.delete(chave); });

  emAndamento.set(chave, promessa);
  return promessa;
}

function responder(req, res) {
  let nome;
  try {
    nome = decodeURIComponent(String(req.url || '/').split('?')[0].replace(/^\/+/, ''));
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (!nome || nome.includes('/') || nome.includes('\\') || nome.includes('..')) {
    res.writeHead(400);
    return res.end();
  }

  const arquivo = path.join(DIR, nome);
  fs.stat(arquivo, (erro, info) => {
    if (erro || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('não encontrado');
    }

    const tipo = mimeDe(arquivo);
    const range = req.headers.range;
    const cabecalhos = {
      'Content-Type': tipo,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    };

    if (range) {
      const encontrado = /bytes=(\d*)-(\d*)/.exec(range);
      let inicio = encontrado && encontrado[1] ? Number(encontrado[1]) : 0;
      let fim = encontrado && encontrado[2] ? Number(encontrado[2]) : info.size - 1;
      if (!Number.isFinite(inicio) || inicio < 0) inicio = 0;
      if (!Number.isFinite(fim) || fim >= info.size) fim = info.size - 1;
      if (inicio > fim) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return res.end();
      }
      res.writeHead(206, {
        ...cabecalhos,
        'Content-Length': fim - inicio + 1,
        'Content-Range': `bytes ${inicio}-${fim}/${info.size}`,
      });
      if (req.method === 'HEAD') return res.end();
      const fluxo = fs.createReadStream(arquivo, { start: inicio, end: fim });
      fluxo.on('error', () => res.destroy());
      return fluxo.pipe(res);
    }

    res.writeHead(200, { ...cabecalhos, 'Content-Length': info.size });
    if (req.method === 'HEAD') return res.end();
    const fluxo = fs.createReadStream(arquivo);
    fluxo.on('error', () => res.destroy());
    fluxo.pipe(res);
  });
}

function iniciarServidor() {
  if (servidor) return Promise.resolve(portaAtual);
  if (iniciando) return iniciando;
  iniciando = new Promise((resolve, reject) => {
    garantirDiretorio();
    const srv = http.createServer(responder);
    srv.on('error', (erro) => {
      iniciando = null;
      reject(erro);
    });
    srv.listen(0, '127.0.0.1', () => {
      servidor = srv;
      portaAtual = srv.address().port;
      console.log(`[Música] Cache de áudio em http://127.0.0.1:${portaAtual}`);
      resolve(portaAtual);
    });
    srv.unref?.();
  });
  return iniciando;
}

// Confirma que o servidor local realmente entrega o arquivo antes de passar a
// URL ao ffmpeg. Se algo der errado aqui, é melhor falhar agora (com mensagem
// clara) do que o DisTube morrer com FFMPEG_EXITED no meio.
function verificarUrlLocal(url) {
  return new Promise((resolve, reject) => {
    const requisicao = http.request(url, { method: 'HEAD', timeout: 8000 }, (resposta) => {
      resposta.resume();
      if (resposta.statusCode === 200 || resposta.statusCode === 206) return resolve();
      reject(new Error(`o servidor local respondeu HTTP ${resposta.statusCode}`));
    });
    requisicao.on('timeout', () => requisicao.destroy(new Error('o servidor local não respondeu')));
    requisicao.on('error', reject);
    requisicao.end();
  });
}

// URL local (http://127.0.0.1:porta/arquivo) que o ffmpeg consegue abrir.
async function obterUrlLocal(song) {
  const baixado = await baixarAudio(song);
  if (!baixado) throw new Error('cache de áudio desativado');
  const porta = await iniciarServidor();
  const url = `http://127.0.0.1:${porta}/${encodeURIComponent(baixado.nome)}`;
  await verificarUrlLocal(url);
  return url;
}

// Pré-baixa em segundo plano para a troca de música não esperar o download.
// Erros são silenciosos: o download "de verdade" acontece no getStreamURL.
// A fila limita downloads simultâneos para não saturar a rede/CPU quando
// alguém adiciona uma playlist inteira.
const filaPrefetch = [];
let prefetchAtivos = 0;

function processarPrefetch() {
  while (prefetchAtivos < CONCORRENCIA && filaPrefetch.length) {
    const song = filaPrefetch.shift();
    if (!song?.url) continue;
    prefetchAtivos += 1;
    baixarAudio(song)
      .catch(() => {})
      .finally(() => {
        prefetchAtivos -= 1;
        processarPrefetch();
      });
  }
}

function prefetch(song) {
  if (!ATIVO || !song?.url) return;
  if (emAndamento.has(chaveDe(song))) return;
  if (filaPrefetch.some((item) => chaveDe(item) === chaveDe(song))) return;
  filaPrefetch.push(song);
  processarPrefetch();
}

function encerrarServidor() {
  try { servidor?.close(); } catch {}
  servidor = null;
  portaAtual = null;
}

module.exports = {
  ATIVO,
  DIR,
  baixarAudio,
  obterUrlLocal,
  prefetch,
  iniciarServidor,
  encerrarServidor,
};
