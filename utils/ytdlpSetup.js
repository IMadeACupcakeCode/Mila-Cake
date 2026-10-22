const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DIR_LEGADO = path.join(RAIZ, 'node_modules', '@distube', 'yt-dlp', 'bin');
const NOME_PADRAO = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const TAMANHO_MINIMO = 1024 * 1024; // rejeita páginas de erro salvas como se fossem binário
const LIMITE_DOWNLOAD = 300 * 1024 * 1024;

let caminhoAtual = null;

// O plugin lê YTDLP_DIR/YTDLP_FILENAME no momento do require, então isto
// precisa rodar antes de require('@distube/yt-dlp'). Usar data/bin deixa o
// bot independente de escrever em node_modules (que pode ser somente leitura
// em hospedagens) e sobrevive a reinstalações.
function configurarAmbiente() {
  const diretorio = process.env.YTDLP_DIR || path.join(RAIZ, 'data', 'bin');
  const nome = process.env.YTDLP_FILENAME || NOME_PADRAO;
  process.env.YTDLP_DIR = diretorio;
  process.env.YTDLP_FILENAME = nome;
  caminhoAtual = path.join(diretorio, nome);
  return caminhoAtual;
}

function caminhoBinario() {
  return caminhoAtual || configurarAmbiente();
}

function binarioValido(caminho = caminhoBinario()) {
  try {
    const info = fs.statSync(caminho);
    return info.isFile() && info.size >= TAMANHO_MINIMO;
  } catch {
    return false;
  }
}

function nomeRelease() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return 'yt-dlp';
}

// Cookies vindos de variáveis de ambiente permitem rodar em VPS/container sem
// navegador instalado. Aceita o cookies.txt em texto (com \n escapado) ou em
// base64, que é o formato mais seguro para painéis de hospedagem.
function prepararCookies() {
  const arquivoConfigurado = process.env.YTDLP_COOKIES_FILE;
  if (arquivoConfigurado) {
    if (fs.existsSync(arquivoConfigurado)) return arquivoConfigurado;
    console.warn(`[Música] YTDLP_COOKIES_FILE aponta para um arquivo inexistente (${arquivoConfigurado}); ignorando.`);
    delete process.env.YTDLP_COOKIES_FILE;
  }

  const bruto = process.env.YTDLP_COOKIES_BASE64 || process.env.YTDLP_COOKIES;
  if (!bruto) return null;

  try {
    const conteudo = process.env.YTDLP_COOKIES_BASE64
      ? Buffer.from(bruto, 'base64').toString('utf8')
      : bruto.replace(/\\n/g, '\n');
    const linhas = conteudo.split(/\r?\n/).filter((linha) => linha && !linha.startsWith('#'));
    const valido = conteudo.includes('HTTP Cookie File') || linhas.some((linha) => linha.split('\t').length >= 7);
    if (!valido) throw new Error('o conteúdo não parece ser um cookies.txt no formato Netscape');

    const destino = path.join(RAIZ, 'data', 'ytdlp-cookies.txt');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, conteudo, { mode: 0o600 });
    process.env.YTDLP_COOKIES_FILE = destino;
    console.log('[Música] Cookies do yt-dlp carregados das variáveis de ambiente.');
    return destino;
  } catch (erro) {
    console.warn(`[Música] Não foi possível usar os cookies configurados: ${erro.message}`);
    return null;
  }
}

function baixar(url, destino, saltos = 5) {
  return new Promise((resolve, reject) => {
    const requisicao = https.get(
      url,
      { headers: { 'user-agent': 'MilaCake/1.0' }, timeout: 180000 },
      (resposta) => {
        const status = resposta.statusCode || 0;
        if (status >= 300 && status < 400 && resposta.headers.location && saltos > 0) {
          resposta.resume();
          return baixar(new URL(resposta.headers.location, url).toString(), destino, saltos - 1).then(resolve, reject);
        }
        if (status !== 200) {
          resposta.resume();
          return reject(new Error(`HTTP ${status} ao baixar o yt-dlp`));
        }

        const parcial = `${destino}.parcial`;
        const arquivo = fs.createWriteStream(parcial, { mode: 0o755 });
        let total = 0;

        resposta.on('data', (pedaco) => {
          total += pedaco.length;
          if (total > LIMITE_DOWNLOAD) requisicao.destroy(new Error('binário maior que o esperado'));
        });
        resposta.on('error', reject);
        resposta.pipe(arquivo);
        arquivo.on('error', reject);
        arquivo.on('finish', () => arquivo.close(() => {
          try {
            fs.renameSync(parcial, destino);
            resolve(total);
          } catch (erro) {
            reject(erro);
          }
        }));
      }
    );
    requisicao.on('timeout', () => requisicao.destroy(new Error('tempo esgotado ao baixar o yt-dlp')));
    requisicao.on('error', reject);
  });
}

function versaoBinario(caminho) {
  return new Promise((resolve, reject) => {
    execFile(caminho, ['--version'], { timeout: 20000, windowsHide: true }, (erro, stdout) => {
      if (erro) reject(erro);
      else resolve(String(stdout).trim());
    });
  });
}

// Garante o binário sem depender de postinstall (npm 11 bloqueia scripts de
// dependências). Na primeira execução copia o binário que o npm já trouxe, se
// existir; caso contrário baixa direto do GitHub.
async function garantirBinario() {
  const destino = caminhoBinario();
  if (binarioValido(destino)) return { caminho: destino, baixado: false };
  fs.mkdirSync(path.dirname(destino), { recursive: true });

  const legado = path.join(DIR_LEGADO, path.basename(destino));
  if (destino !== legado && binarioValido(legado)) {
    try {
      fs.copyFileSync(legado, destino);
      fs.chmodSync(destino, 0o755);
      return { caminho: destino, baixado: false, reaproveitado: true };
    } catch {
      // segue para o download
    }
  }

  const url = process.env.YTDLP_URL || `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${nomeRelease()}`;
  let baixou = false;
  try {
    await baixar(url, destino);
    baixou = true;
    if (process.platform !== 'win32') fs.chmodSync(destino, 0o755);
    const versao = await versaoBinario(destino);
    return { caminho: destino, baixado: true, versao };
  } catch (erro) {
    try { fs.unlinkSync(`${destino}.parcial`); } catch {}
    // Não deixa um arquivo inválido (download corrompido/página de erro) passar
    // como binário pronto na próxima inicialização.
    if (baixou) { try { fs.unlinkSync(destino); } catch {} }
    throw erro;
  }
}

module.exports = { configurarAmbiente, caminhoBinario, binarioValido, prepararCookies, garantirBinario };
