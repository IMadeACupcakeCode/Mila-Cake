const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { caminhoBinario } = require('./ytdlpSetup');

// ─────────────────────────────────────────────────────────────────────────────
// Cookies do yt-dlp vindos do navegador do usuário.
//
// O método antigo escolhia o navegador apenas por "a pasta existe e o arquivo
// de cookies existe", e ainda descartava os navegadores abertos. Na prática
// isso errava quase sempre: Chrome/Edge/Brave travam o banco enquanto rodam e
// o Edge moderno usa criptografia app-bound (DPAPI recusa a chave), então o
// navegador "detectado" falhava só na hora de tocar a música.
//
// Aqui a escolha é validada de verdade: para cada candidato o próprio yt-dlp
// tenta ler os cookies (sem tocar na rede), e o primeiro que entrega cookies
// utilizáveis — de preferência com sessão do YouTube — é o escolhido. A leitura
// é então gravada num snapshot local, que é o que o player usa durante a
// sessão. Assim o navegador pode ficar aberto, fechar ou trocar que a música
// continua funcionando.
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ = path.join(__dirname, '..');
const DIR_DADOS = path.join(RAIZ, 'data');
const ARQUIVO_SNAPSHOT = path.join(DIR_DADOS, 'ytdlp-cookies-navegador.txt');
const ARQUIVO_ESTADO = path.join(DIR_DADOS, 'ytdlp-cookies-estado.json');

// O snapshot vale por horas: cookies de sessão do YouTube duram bem mais que
// isso. Passado o prazo, a escolha é refeita na próxima inicialização.
const IDADE_MAXIMA_SNAPSHOT = Math.max(5 * 60_000, Number(process.env.YTDLP_COOKIES_VALIDADE_MS) || 6 * 60 * 60 * 1000);

// Navegador declarado explicitamente em YTDLP_COOKIES_FROM_BROWSER (lido uma
// vez; depois do primeiro uso trocamos a variável pelo arquivo de snapshot).
const SPEC_FIXADO = String(process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();

const TTL_DETECCAO = Math.max(30_000, Number(process.env.YTDLP_COOKIES_TTL_MS) || 10 * 60 * 1000);
const TTL_PROCESSOS = 30_000;
const LIMITE_SONDAGENS = Math.max(1, Number(process.env.YTDLP_COOKIES_MAX_TENTATIVAS) || 8);
const TIMEOUT_SONDAGEM = 25_000;

// URL inválida de propósito: o yt-dlp carrega os cookies antes de tentar
// interpretar o endereço, então a sondagem mede só a extração — sem rede.
const ALVO_SONDAGEM = 'mila-probe-cookies';

const ORDEM_PADRAO = ['brave', 'edge', 'zen', 'chrome', 'firefox', 'chromium', 'vivaldi', 'opera'];

let cache = { feitaEm: 0, resultado: null };
let emAndamento = null;
let processosCache = { feitaEm: 0, lista: null };

function ordemPreferida() {
  const configurada = String(process.env.YTDLP_BROWSER_ORDER || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const ordem = [...new Set([...configurada, ...ORDEM_PADRAO])];
  return ordem;
}

function listarProcessos() {
  if (process.platform !== 'win32') return null;
  const agora = Date.now();
  if (processosCache.lista && agora - processosCache.feitaEm < TTL_PROCESSOS) return processosCache.lista;
  try {
    const saida = execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
    });
    const lista = new Set(
      saida
        .split(/\r?\n/)
        .map((linha) => linha.match(/^"([^"]+)"/)?.[1]?.toLowerCase())
        .filter(Boolean)
    );
    processosCache = { feitaEm: agora, lista };
    return lista;
  } catch {
    processosCache = { feitaEm: agora, lista: null };
    return null;
  }
}

function navegadorAberto(definicao) {
  if (process.platform !== 'win32' || !definicao?.exe) return false;
  const processos = listarProcessos();
  if (!processos) return false;
  return processos.has(definicao.exe.toLowerCase());
}

function primeiroExistente(...caminhos) {
  return caminhos.find((caminho) => caminho && fs.existsSync(caminho)) || null;
}

// Tabela de navegadores suportados no Windows. O Zen não é reconhecido pelo
// yt-dlp (a lista oficial é brave/chrome/chromium/edge/firefox/opera/safari/
// vivaldi/whale), mas é baseado no Firefox: apontar o motor "firefox" para a
// pasta do perfil funciona e é o que fazemos abaixo.
function definicoesWindows() {
  const local = process.env.LOCALAPPDATA || '';
  const roaming = process.env.APPDATA || '';
  return [
    { id: 'brave', rotulo: 'Brave', exe: 'brave.exe', tipo: 'chromium', base: path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data') },
    { id: 'edge', rotulo: 'Edge', exe: 'msedge.exe', tipo: 'chromium', base: path.join(local, 'Microsoft', 'Edge', 'User Data') },
    { id: 'zen', rotulo: 'Zen', exe: 'zen.exe', tipo: 'firefox', base: primeiroExistente(path.join(roaming, 'zen', 'Profiles'), path.join(roaming, 'Zen', 'Profiles')) },
    { id: 'chrome', rotulo: 'Chrome', exe: 'chrome.exe', tipo: 'chromium', base: path.join(local, 'Google', 'Chrome', 'User Data') },
    { id: 'firefox', rotulo: 'Firefox', exe: 'firefox.exe', tipo: 'firefox', base: path.join(roaming, 'Mozilla', 'Firefox', 'Profiles') },
    { id: 'chromium', rotulo: 'Chromium', exe: 'chromium.exe', tipo: 'chromium', base: path.join(local, 'Chromium', 'User Data') },
    { id: 'vivaldi', rotulo: 'Vivaldi', exe: 'vivaldi.exe', tipo: 'chromium', base: path.join(local, 'Vivaldi', 'User Data') },
    { id: 'opera', rotulo: 'Opera', exe: 'opera.exe', tipo: 'chromium', base: path.join(roaming, 'Opera Software', 'Opera Stable') },
  ];
}

function perfisDoSistema(definicao) {
  if (!definicao?.base) return [];
  const base = definicao.base;
  if (!fs.existsSync(base)) return [];

  const encontrados = [];
  const candidatos = [];

  if (definicao.tipo === 'firefox') {
    // Perfis do Firefox/Zen ficam em subpastas com cookies.sqlite.
    try {
      for (const entrada of fs.readdirSync(base, { withFileTypes: true })) {
        if (!entrada.isDirectory()) continue;
        const arquivo = path.join(base, entrada.name, 'cookies.sqlite');
        if (fs.existsSync(arquivo)) candidatos.push({ nome: entrada.name, diretorio: path.join(base, entrada.name), arquivo });
      }
    } catch {}
  } else {
    // Chromium: o perfil pode ser a própria pasta (Opera) ou uma subpasta
    // (Default, Profile 1, "Person 1"...). Varremos em vez de adivinhar nomes.
    const diretos = [path.join(base, 'Network', 'Cookies'), path.join(base, 'Cookies')];
    if (diretos.some((arquivo) => fs.existsSync(arquivo))) {
      candidatos.push({ nome: path.basename(base), diretorio: base, arquivo: diretos.find((arquivo) => fs.existsSync(arquivo)) });
    }
    try {
      for (const entrada of fs.readdirSync(base, { withFileTypes: true })) {
        if (!entrada.isDirectory()) continue;
        const diretorio = path.join(base, entrada.name);
        const arquivo = [path.join(diretorio, 'Network', 'Cookies'), path.join(diretorio, 'Cookies')].find((item) => fs.existsSync(item));
        if (arquivo) candidatos.push({ nome: entrada.name, diretorio, arquivo });
      }
    } catch {}
  }

  for (const item of candidatos) {
    let mtime = 0;
    try { mtime = fs.statSync(item.arquivo).mtimeMs; } catch {}
    encontrados.push({ ...item, mtime });
  }

  // O perfil usado por último é o que tem a sessão boa.
  encontrados.sort((a, b) => {
    if (a.nome === 'Default' && b.nome !== 'Default') return -1;
    if (b.nome === 'Default' && a.nome !== 'Default') return 1;
    return b.mtime - a.mtime;
  });
  return encontrados;
}

function specDoPerfil(definicao, perfil) {
  // O motor firefox aceita caminho completo do perfil; é o que habilita o Zen.
  if (definicao.tipo === 'firefox') return `firefox:${perfil.diretorio}`;
  // Chromium aceita nome do perfil depois dos dois-pontos.
  if (perfil.nome && perfil.nome !== 'Default') return `${definicao.id}:${perfil.nome}`;
  return definicao.id;
}

function montarCandidatos() {
  const fixado = SPEC_FIXADO;
  if (process.platform !== 'win32') {
    // Fora do Windows só dá para confiar no que o usuário declarou.
    return fixado ? [{ id: fixado, rotulo: fixado, spec: fixado, aberto: false, tipo: 'manual' }] : [];
  }

  const tabela = new Map(definicoesWindows().map((definicao) => [definicao.id, definicao]));
  const ordem = ordemPreferida();
  const fixadoId = fixado ? fixado.split(':')[0].toLowerCase() : '';
  const lista = ordem
    .map((id) => tabela.get(id))
    .filter(Boolean)
    .flatMap((definicao) => {
      const perfis = perfisDoSistema(definicao).slice(0, 2);
      return perfis.map((perfil) => ({
        id: definicao.id,
        rotulo: definicao.rotulo,
        tipo: definicao.tipo,
        perfil: perfil.nome,
        spec: fixado && definicao.id === fixadoId && fixado.includes(':')
          ? fixado
          : specDoPerfil(definicao, perfil),
        aberto: navegadorAberto(definicao),
        fixado: definicao.id === fixadoId,
      }));
    });

  // Prioridade: navegador declarado em YTDLP_COOKIES_FROM_BROWSER, depois o
  // que está aberto agora (é o que o usuário está usando), depois a ordem.
  return lista.sort((a, b) => {
    if (a.fixado !== b.fixado) return Number(b.fixado) - Number(a.fixado);
    return Number(b.aberto) - Number(a.aberto);
  });
}

const COOKIES_LOGIN = /^(SID|SAPISID|APISID|SSID|HSID|__Secure-1PSID|__Secure-3PSID|__Secure-1PAPISID|__Secure-3PAPISID)$/;

function lerCookies(arquivo) {
  const resultado = { total: 0, youtube: 0, logado: false };
  let conteudo;
  try {
    conteudo = fs.readFileSync(arquivo, 'utf8');
  } catch {
    return resultado;
  }
  for (const linha of conteudo.split(/\r?\n/)) {
    if (!linha || linha.startsWith('#')) continue;
    const colunas = linha.split('\t');
    if (colunas.length < 7) continue;
    resultado.total += 1;
    const dominio = colunas[0].toLowerCase();
    const nome = colunas[5];
    if (dominio.includes('youtube.com')) {
      resultado.youtube += 1;
      if (COOKIES_LOGIN.test(nome)) resultado.logado = true;
    }
  }
  return resultado;
}

function traduzirErro(stderr, erro) {
  const texto = String(stderr || '').trim() || String(erro?.message || '');
  if (/could not copy chrome cookie database/i.test(texto)) return 'banco de cookies travado pelo navegador aberto';
  if (/failed to decrypt with dpapi/i.test(texto)) return 'criptografia do Windows recusou a chave (proteção app-bound do navegador)';
  if (/could not find .*cookies database|no such file|cookies database.*(not found|missing)/i.test(texto)) return 'sem banco de cookies no perfil';
  if (/permission denied|acesso negado/i.test(texto)) return 'sem permissão de leitura no arquivo de cookies';
  if (/failed to decrypt/i.test(texto)) return 'falha ao descriptografar os cookies';
  const primeiraLinha = texto.split(/\r?\n/).find((linha) => /error/i.test(linha)) || texto.split(/\r?\n/)[0] || '';
  return primeiraLinha.replace(/^ERROR:\s*/i, '').slice(0, 160);
}

// Sondagem: o yt-dlp lê os cookies do navegador e grava o que conseguiu num
// arquivo Netscape. O erro de URL inválida é esperado e não invalida a leitura.
function sondar(candidato, indice) {
  const destino = path.join(DIR_DADOS, `.probe-${indice}-${Date.now()}.txt`);
  const args = [
    '--cookies-from-browser', candidato.spec,
    '--cookies', destino,
    '--simulate', '--skip-download', '--no-warnings', '--no-update',
    '--', ALVO_SONDAGEM,
  ];
  return new Promise((resolve) => {
    execFile(caminhoBinario(), args, { windowsHide: true, timeout: TIMEOUT_SONDAGEM, maxBuffer: 8 * 1024 * 1024 }, (erro, _stdout, stderr) => {
      const lidos = lerCookies(destino);
      if (lidos.total === 0) {
        try { fs.unlinkSync(destino); } catch {}
        resolve({ ok: false, motivo: traduzirErro(stderr, erro) });
        return;
      }
      resolve({ ok: true, ...lidos, arquivo: destino, aviso: erro ? traduzirErro(stderr, erro) : null });
    });
  });
}

function guardarSnapshot(origem) {
  fs.mkdirSync(DIR_DADOS, { recursive: true });
  fs.copyFileSync(origem, ARQUIVO_SNAPSHOT);
  try { fs.chmodSync(ARQUIVO_SNAPSHOT, 0o600); } catch {}
}

function lerEstado() {
  try {
    const dados = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
    return dados && typeof dados === 'object' ? dados : null;
  } catch {
    return null;
  }
}

function gravarEstado(resultado) {
  try {
    fs.mkdirSync(DIR_DADOS, { recursive: true });
    fs.writeFileSync(
      ARQUIVO_ESTADO,
      JSON.stringify({ ...resultado, quando: Date.now() }, null, 2),
      { mode: 0o600 }
    );
  } catch {}
}

function limparProbes() {
  try {
    for (const nome of fs.readdirSync(DIR_DADOS)) {
      if (nome.startsWith('.probe-')) {
        try { fs.unlinkSync(path.join(DIR_DADOS, nome)); } catch {}
      }
    }
  } catch {}
}

function resumo(resultado) {
  if (!resultado) return 'nenhum navegador com cookies utilizáveis';
  const partes = [`${resultado.rotulo}${resultado.aberto ? ' (aberto agora)' : ''}`];
  partes.push(`${resultado.youtube} cookies do YouTube`);
  partes.push(resultado.logado ? 'sessão logada' : 'sessão anônima');
  return partes.join(' · ');
}

async function detectar({ forcar = false, silencioso = false } = {}) {
  // Cookies entregues por variável de ambiente têm prioridade absoluta.
  if (process.env.YTDLP_COOKIES_BASE64 || process.env.YTDLP_COOKIES) {
    return { origem: 'ambiente', rotulo: 'variáveis de ambiente', arquivo: process.env.YTDLP_COOKIES_FILE || null };
  }
  const arquivoDoUsuario = process.env.YTDLP_COOKIES_FILE;
  if (arquivoDoUsuario && arquivoDoUsuario !== ARQUIVO_SNAPSHOT && fs.existsSync(arquivoDoUsuario)) {
    return { origem: 'arquivo', rotulo: 'arquivo YTDLP_COOKIES_FILE', arquivo: arquivoDoUsuario };
  }

  const agora = Date.now();

  // Caminho rápido: snapshot recente já validado numa execução anterior.
  // Evita gastar segundos sondando navegadores em cada boot ou cada música.
  if (!forcar) {
    const estado = lerEstado();
    const idade = estado ? agora - Number(estado.quando || 0) : Infinity;
    if (estado && idade < IDADE_MAXIMA_SNAPSHOT && fs.existsSync(ARQUIVO_SNAPSHOT) && lerCookies(ARQUIVO_SNAPSHOT).total > 0) {
      process.env.YTDLP_COOKIES_FILE = ARQUIVO_SNAPSHOT;
      delete process.env.YTDLP_COOKIES_FROM_BROWSER;
      cache = { feitaEm: agora, resultado: estado };
      if (!silencioso && !cache.avisado) {
        console.log(`[Música] Cookies do yt-dlp: ${resumo(estado)} (snapshot de ${Math.round(idade / 60000)} min atrás).`);
        cache.avisado = true;
      }
      // Fora da validade curta, renova em segundo plano sem travar a música.
      if (idade > TTL_DETECCAO && !emAndamento) {
        const temporizador = setTimeout(() => {
          detectar({ forcar: true, silencioso: true }).catch(() => {});
        }, 5000);
        temporizador.unref?.();
      }
      return estado;
    }
  }

  if (!forcar && cache.resultado && agora - cache.feitaEm < TTL_DETECCAO) return cache.resultado;
  if (emAndamento) return emAndamento;

  emAndamento = (async () => {
    limparProbes();
    const candidatos = montarCandidatos();
    const falhas = [];
    let melhor = null;

    for (const [indice, candidato] of candidatos.slice(0, LIMITE_SONDAGENS).entries()) {
      const leitura = await sondar(candidato, indice);
      if (!leitura.ok) {
        falhas.push(`${candidato.rotulo}: ${leitura.motivo}`);
        continue;
      }
      const achado = { ...candidato, ...leitura };
      // Prioridade: sessão logada no YouTube > cookies do YouTube > quaisquer.
      const nota = achado.logado ? 3 : achado.youtube > 0 ? 2 : 1;
      if (!melhor || nota > melhor.nota) {
        if (melhor) { try { fs.unlinkSync(melhor.arquivo); } catch {} }
        melhor = { ...achado, nota };
      } else {
        try { fs.unlinkSync(achado.arquivo); } catch {}
      }
      if (melhor.nota === 3) break; // já é o melhor cenário possível
    }

    let resultado = null;
    if (melhor) {
      guardarSnapshot(melhor.arquivo);
      try { fs.unlinkSync(melhor.arquivo); } catch {}
      resultado = {
        origem: melhor.id,
        rotulo: melhor.rotulo,
        perfil: melhor.perfil,
        aberto: melhor.aberto,
        cookies: melhor.total,
        youtube: melhor.youtube,
        logado: melhor.logado,
        arquivo: ARQUIVO_SNAPSHOT,
        falhas,
      };
      process.env.YTDLP_COOKIES_FILE = ARQUIVO_SNAPSHOT;
      delete process.env.YTDLP_COOKIES_FROM_BROWSER;
      if (!silencioso) {
        console.log(`[Música] Cookies do yt-dlp: ${resumo(resultado)}.`);
        if (falhas.length) console.log(`[Música] Navegadores descartados — ${falhas.join(' | ')}`);
      }
    } else if (fs.existsSync(ARQUIVO_SNAPSHOT) && lerCookies(ARQUIVO_SNAPSHOT).total > 0) {
      // Nenhum navegador colaborou agora, mas o último snapshot ainda serve.
      process.env.YTDLP_COOKIES_FILE = ARQUIVO_SNAPSHOT;
      const antigo = lerCookies(ARQUIVO_SNAPSHOT);
      resultado = {
        origem: 'snapshot',
        rotulo: 'snapshot anterior',
        cookies: antigo.total,
        youtube: antigo.youtube,
        logado: antigo.logado,
        arquivo: ARQUIVO_SNAPSHOT,
        falhas,
      };
      if (!silencioso) console.warn(`[Música] Nenhum navegador entregou cookies agora; usando o snapshot anterior (${antigo.total} cookies). ${falhas.join(' | ')}`);
    } else if (!silencioso) {
      console.warn(`[Música] Sem cookies de navegador para o yt-dlp. ${falhas.join(' | ') || 'Nenhum navegador suportado encontrado.'}`);
      console.warn('[Música] YouTube pode exigir login. Abra o navegador, entre no YouTube e tente de novo — ou exporte um cookies.txt.');
    }

    if (resultado) gravarEstado(resultado);
    cache = { feitaEm: Date.now(), resultado };
    return resultado;
  })();

  try {
    return await emAndamento;
  } finally {
    emAndamento = null;
  }
}

// Versão síncrona mantida para compatibilidade: só heurística, sem sondagem.
function detectarNavegadorCookies() {
  if (process.env.YTDLP_COOKIES_FILE) return 'arquivo';
  const candidato = montarCandidatos()[0];
  return candidato ? candidato.id : null;
}

// Argumentos para chamadas diretas ao yt-dlp (fora do plugin do DisTube).
function argumentosCookies() {
  const arquivo = process.env.YTDLP_COOKIES_FILE;
  if (arquivo && fs.existsSync(arquivo)) return ['--cookies', arquivo];
  const navegador = process.env.YTDLP_COOKIES_FROM_BROWSER;
  return navegador ? ['--cookies-from-browser', navegador] : [];
}

async function garantirCookies(opcoes = {}) {
  return detectar(opcoes);
}

module.exports = {
  garantirCookies,
  detectar,
  detectarNavegadorCookies,
  argumentosCookies,
  montarCandidatos,
  lerCookies,
  ARQUIVO_SNAPSHOT,
};
