const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const {
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');

// ─────────────────────────────────────────────────────────────────────────────
// Sons de voz da Mila:
//  • entrada  → saudação aleatória sempre que ela entra na call;
//  • espera   → "elevator waiting" em loop enquanto a música é resolvida;
//  • despedida→ "me deixa dormir mita" antes de sair no /sair.
//
// O DisTube só assume o canal de voz quando o stream está pronto, e cada
// conexão do Discord aceita um único player por vez. Por isso estes sons usam um
// AudioPlayer próprio, que devolve o canal para o player do DisTube antes da
// música começar. O fade out acontece nessa devolução.
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ = path.join(__dirname, '..');
const DIR_SONS = path.join(RAIZ, 'data', 'sons');
const ARQUIVO_PADRAO = path.join(DIR_SONS, 'espera-elevador.mp3');

const URL_PADRAO = 'https://www.myinstants.com/media/sounds/elevator_2jN6tnc.mp3';

const SONS_ENTRADA = [
  {
    arquivo: path.join(DIR_SONS, 'saudacao-chapeu.mp3'),
    url: 'https://www.myinstants.com/media/sounds/um-chapeu.mp3',
  },
  {
    arquivo: path.join(DIR_SONS, 'saudacao-boininha.mp3'),
    url: 'https://www.myinstants.com/media/sounds/saudacoes-boininha.mp3',
  },
];

const SOM_DESPEDIDA = {
  arquivo: path.join(DIR_SONS, 'despedida-mita.mp3'),
  url: 'https://www.myinstants.com/media/sounds/me-deixa-dormir-mita.mp3',
};

function numero(valor, padrao) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function ligado(valor, padrao = 'true') {
  return !/^(0|false|nao|não|off)$/i.test(String(valor ?? padrao).trim());
}

const ATIVO = ligado(process.env.SOM_ESPERA_ATIVO);
const URL_SOM = String(process.env.SOM_ESPERA_URL || URL_PADRAO).trim();
const ARQUIVO = String(process.env.SOM_ESPERA_ARQUIVO || '').trim() || ARQUIVO_PADRAO;
const VOLUME = Math.min(1, Math.max(0, numero(process.env.SOM_ESPERA_VOLUME, 0.3)));
const FADE_IN = Math.max(0, numero(process.env.SOM_ESPERA_FADE_IN_MS, 900));
const FADE_OUT = Math.max(0, numero(process.env.SOM_ESPERA_FADE_OUT_MS, 800));
const LIMITE_ESPERA = Math.max(10_000, numero(process.env.SOM_ESPERA_MAX_MS, 120_000));
const PASSO_RAMPA = 40;

const ENTRADA_ATIVA = ligado(process.env.SOM_ENTRADA_ATIVO);
const VOLUME_ENTRADA = Math.min(1, Math.max(0, numero(process.env.SOM_ENTRADA_VOLUME, 0.5)));
const FADE_ENTRADA = Math.max(0, numero(process.env.SOM_ENTRADA_FADE_IN_MS, 250));
const ENTRADA_MAX = Math.max(1000, numero(process.env.SOM_ENTRADA_MAX_MS, 6000));

const DESPEDIDA_ATIVA = ligado(process.env.SOM_DESPEDIDA_ATIVO);
const VOLUME_DESPEDIDA = Math.min(1, Math.max(0, numero(process.env.SOM_DESPEDIDA_VOLUME, 0.55)));
const DESPEDIDA_MAX = Math.max(5000, numero(process.env.SOM_DESPEDIDA_MAX_MS, 20_000));

const sessoes = new Map(); // guildId -> sessão
const garantias = new Map(); // arquivo -> Promise
const avisos = new Set();

function baixar(url, destino, saltos = 5) {
  return new Promise((resolve, reject) => {
    const requisicao = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MilaCake/1.0',
          Referer: 'https://www.myinstants.com/',
        },
        timeout: 45000,
      },
      (resposta) => {
        const status = resposta.statusCode || 0;
        if (status >= 300 && status < 400 && resposta.headers.location && saltos > 0) {
          resposta.resume();
          const proxima = new URL(resposta.headers.location, url).toString();
          return baixar(proxima, destino, saltos - 1).then(resolve, reject);
        }
        if (status !== 200) {
          resposta.resume();
          return reject(new Error(`HTTP ${status} ao baixar o som`));
        }
        const parcial = `${destino}.parcial`;
        const arquivo = fs.createWriteStream(parcial);
        let total = 0;
        resposta.on('data', (pedaco) => {
          total += pedaco.length;
          if (total > 8 * 1024 * 1024) requisicao.destroy(new Error('som grande demais'));
        });
        resposta.on('error', reject);
        resposta.pipe(arquivo);
        arquivo.on('error', reject);
        arquivo.on('finish', () => arquivo.close(() => {
          try {
            if (total < 1024) throw new Error('arquivo de áudio vazio');
            fs.renameSync(parcial, destino);
            resolve(total);
          } catch (erro) {
            reject(erro);
          }
        }));
      }
    );
    requisicao.on('timeout', () => requisicao.destroy(new Error('tempo esgotado ao baixar o som')));
    requisicao.on('error', reject);
  });
}

// Baixa cada som uma única vez para data/sons: depois o bot não depende do
// myinstants estar no ar nem da rede para tocar saudação/despedida.
function garantirSom(arquivo, url, { customizado = false } = {}) {
  try {
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).size > 1024) return Promise.resolve(arquivo);
  } catch {}

  if (customizado) {
    return Promise.reject(new Error(`arquivo de som inexistente (${arquivo})`));
  }

  if (garantias.has(arquivo)) return garantias.get(arquivo);

  const promessa = (async () => {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    if (!url) throw new Error(`sem URL para baixar ${path.basename(arquivo)}`);
    console.log(`[Música] Baixando ${path.basename(arquivo)} (só na primeira vez)...`);
    await baixar(url, arquivo);
    console.log(`[Música] Som pronto: ${arquivo}`);
    return arquivo;
  })().finally(() => { garantias.delete(arquivo); });

  garantias.set(arquivo, promessa);
  return promessa;
}

async function garantirArquivo() {
  return garantirSom(ARQUIVO, URL_SOM, { customizado: Boolean(process.env.SOM_ESPERA_ARQUIVO) });
}

function avisarUmaVez(chave, mensagem) {
  if (avisos.has(chave)) return;
  avisos.add(chave);
  console.warn(`[Música] ${mensagem}`);
}

// Sorteia a saudação; se o arquivo não puder ser obtido, a entrada é pulada.
async function sortearSaudacao() {
  const opcoes = [...SONS_ENTRADA];
  while (opcoes.length) {
    const indice = Math.floor(Math.random() * opcoes.length);
    const [escolhido] = opcoes.splice(indice, 1);
    try {
      const arquivo = await garantirSom(escolhido.arquivo, escolhido.url);
      console.log(`[Música] Saudação de entrada: ${path.basename(arquivo)}`);
      return arquivo;
    } catch (erro) {
      avisarUmaVez('saudacao', `Saudação indisponível: ${erro.message}`);
    }
  }
  return null;
}

function rampa(sessao, de, para, duracao) {
  if (sessao.rampa) {
    clearInterval(sessao.rampa);
    sessao.rampa = null;
    try { sessao.rampaResolver?.(); } catch {}
    sessao.rampaResolver = null;
  }
  if (duracao <= 0 || de === para) {
    try { sessao.recurso?.volume?.setVolume(Math.max(0.0001, para)); } catch {}
    sessao.volumeAtual = para;
    return Promise.resolve();
  }
  const passos = Math.max(1, Math.round(duracao / PASSO_RAMPA));
  let atual = 0;
  return new Promise((resolve) => {
    sessao.rampaResolver = resolve;
    sessao.rampa = setInterval(() => {
      atual += 1;
      const fator = atual / passos;
      const valor = de + (para - de) * fator;
      sessao.volumeAtual = valor;
      try { sessao.recurso?.volume?.setVolume(Math.max(0.0001, valor)); } catch {}
      if (atual >= passos) {
        clearInterval(sessao.rampa);
        sessao.rampa = null;
        sessao.rampaResolver = null;
        resolve();
      }
    }, PASSO_RAMPA);
    sessao.rampa.unref?.();
  });
}

function resolverEntrada(sessao) {
  if (!sessao?.entradaFim) return;
  try { sessao.entradaFim.resolver(); } catch {}
  sessao.entradaFim = null;
}

function encerrarSessao(sessao, { restaurar = true } = {}) {
  if (!sessao || sessao.encerrando) return;
  sessao.encerrando = true;
  resolverEntrada(sessao);
  try { clearInterval(sessao.rampa); } catch {}
  try { sessao.rampaResolver?.(); } catch {}
  try { clearTimeout(sessao.limite); } catch {}
  // Tira os listeners antes do stop: o evento "idle" não deve reentrar aqui.
  try { sessao.player.removeAllListeners(); } catch {}
  try { sessao.player.stop(true); } catch {}
  try { sessao.processo?.kill('SIGKILL'); } catch {}
  try { sessao.recurso?.playStream?.destroy?.(); } catch {}
  try {
    if (sessao.aoCair) {
      sessao.connection.off(VoiceConnectionStatus.Disconnected, sessao.aoCair);
      sessao.connection.off(VoiceConnectionStatus.Destroyed, sessao.aoCair);
    }
  } catch {}
  if (restaurar) {
    try { sessao.connection.subscribe(sessao.voice.audioPlayer); } catch {}
  }
  if (sessoes.get(sessao.guildId) === sessao) sessoes.delete(sessao.guildId);
}

function iniciarFase(sessao, fase) {
  if (sessoes.get(sessao.guildId) !== sessao) return;
  sessao.fase = fase.tipo;
  sessao.fila.shift();
  sessao.geracao = (sessao.geracao || 0) + 1;
  const geracao = sessao.geracao;

  try { sessao.processo?.kill('SIGKILL'); } catch {}
  try { sessao.recurso?.playStream?.destroy?.(); } catch {}

  const args = ['-hide_banner', '-loglevel', 'error'];
  if (fase.tipo === 'espera') args.push('-stream_loop', '-1');
  args.push('-i', fase.arquivo, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

  const processo = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  processo.on('error', (erro) => avisarUmaVez(`ffmpeg-${fase.tipo}`, `ffmpeg do som de ${fase.tipo}: ${erro.message}`));

  // O fim do ffmpeg (sem loop) é o sinal de que a fase terminou. Não usamos o
  // evento "idle" do player porque ele também dispara quando trocamos o
  // recurso manualmente, o que causaria transições duplicadas.
  processo.on('exit', () => {
    if (sessoes.get(sessao.guildId) !== sessao) return;
    if (sessao.geracao !== geracao) return;
    if (sessao.encerrando) return;
    if (fase.tipo === 'entrada') tocarProximaFase(sessao);
    else encerrarSessao(sessao);
  });

  const recurso = createAudioResource(processo.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true,
  });

  sessao.processo = processo;
  sessao.recurso = recurso;
  sessao.arquivo = fase.arquivo;
  const volumeAlvo = fase.tipo === 'entrada' ? VOLUME_ENTRADA : VOLUME;
  sessao.volumeAlvo = volumeAlvo;
  sessao.volumeAtual = 0.0001;

  try { recurso.volume.setVolume(0.0001); } catch {}
  try {
    sessao.player.play(recurso);
  } catch (erro) {
    avisarUmaVez('tocar', `Não consegui tocar o som de ${fase.tipo}: ${erro.message}`);
    encerrarSessao(sessao);
    return;
  }

  rampa(sessao, 0.0001, volumeAlvo, fase.tipo === 'entrada' ? FADE_ENTRADA : FADE_IN)
    .then(() => { if (sessao.fase === fase.tipo) sessao.volumeAtual = volumeAlvo; });
}

function tocarProximaFase(sessao) {
  if (sessoes.get(sessao.guildId) !== sessao) return;
  const eraEntrada = sessao.fase === 'entrada';
  if (eraEntrada) resolverEntrada(sessao);

  if (sessao.pularEspera || !sessao.fila.length) {
    encerrarSessao(sessao);
    return;
  }

  iniciarFase(sessao, sessao.fila[0]);
}

// Devolve o canal para o player do DisTube (que foi desassinado quando o som
// assumiu). Chamado pelo wrapper de playSong.
async function liberarParaMusica(guildId) {
  const sessao = sessoes.get(guildId);
  if (!sessao) return null;
  await rampa(sessao, sessao.volumeAtual ?? sessao.volumeAlvo ?? VOLUME, 0, FADE_OUT);
  encerrarSessao(sessao);
  return true;
}

async function pararEspera(guildId, { fadeMs = 300 } = {}) {
  const sessao = sessoes.get(guildId);
  if (!sessao) return false;
  if (fadeMs > 0) await rampa(sessao, sessao.volumeAtual ?? VOLUME, 0, fadeMs);
  encerrarSessao(sessao);
  return true;
}

async function iniciarEspera(client, voiceChannel) {
  if (!ATIVO) return null;
  if (!voiceChannel?.guild) return null;
  const guildId = voiceChannel.guild.id;
  if (sessoes.has(guildId)) return sessoes.get(guildId);

  // Com música já tocando não há como sobrepor áudio: só faz sentido na
  // primeira música (a fila vazia é justamente o momento de "carregando").
  const filaAtual = client.distube?.getQueue?.(guildId);
  if (filaAtual && filaAtual.songs?.length && !filaAtual.paused) return null;

  // A saudação de entrada é tocada pelo wrapper de voices.join (distubeHandler)
  // antes de o elevador assumir; aqui só entra o loop de espera.
  const fila = [];
  let arquivoEspera = null;
  try {
    arquivoEspera = await garantirArquivo();
  } catch (erro) {
    avisarUmaVez('espera', `Som de espera indisponível: ${erro.message}`);
  }
  if (arquivoEspera) fila.push({ tipo: 'espera', arquivo: arquivoEspera });
  if (!fila.length) return null;

  let voice;
  try {
    voice = await client.distube.voices.join(voiceChannel);
    if (!voice?.connection) throw new Error('conexão de voz indisponível');
    await entersState(voice.connection, VoiceConnectionStatus.Ready, 15000);
  } catch (erro) {
    console.warn(`[Música] Não consegui entrar na call para os sons de voz: ${erro.message}`);
    return null;
  }

  const player = createAudioPlayer();
  const sessao = {
    guildId,
    voice,
    connection: voice.connection,
    player,
    processo: null,
    recurso: null,
    fila,
    fase: null,
    arquivo: null,
    volumeAlvo: VOLUME,
    volumeAtual: 0,
    rampa: null,
    limite: null,
    entradaFim: null,
    pularEspera: false,
    geracao: 0,
    encerrando: false,
  };
  sessoes.set(guildId, sessao);

  player.on('error', (erro) => {
    console.warn(`[Música] Erro no som de voz: ${erro.message}`);
    encerrarSessao(sessao);
  });

  // Se a conexão cair (kick, canal apagado), não deixa o ffmpeg pendurado.
  sessao.aoCair = () => {
    if (sessoes.get(guildId) === sessao) encerrarSessao(sessao, { restaurar: false });
  };
  try {
    voice.connection.on(VoiceConnectionStatus.Disconnected, sessao.aoCair);
    voice.connection.on(VoiceConnectionStatus.Destroyed, sessao.aoCair);
  } catch {}

  try {
    voice.connection.subscribe(player);
  } catch (erro) {
    console.warn(`[Música] Não consegui assumir o canal de voz: ${erro.message}`);
    encerrarSessao(sessao);
    return null;
  }

  // Deferred resolvido quando a saudação termina (o elevador não usa).
  sessao.entradaFim = null;

  iniciarFase(sessao, fila[0]);

  // Rede de segurança: se algo travar (usuário cancela, música nunca chega),
  // o som não fica tocando para sempre.
  sessao.limite = setTimeout(() => {
    if (sessoes.get(guildId) === sessao) {
      console.warn('[Música] Sons de voz encerrados por tempo limite.');
      pararEspera(guildId, { fadeMs: 400 }).catch(() => {});
    }
  }, LIMITE_ESPERA);
  sessao.limite.unref?.();

  return sessao;
}

// Toca a despedida uma única vez e devolve quando terminar (ou no timeout).
// Quem chama decide quando desconectar de fato.
async function tocarDespedida(client, guildId) {
  if (!DESPEDIDA_ATIVA) return false;

  // Se o elevador/saudação estiver no ar, encerra antes de tocar a despedida.
  if (sessoes.has(guildId)) await pararEspera(guildId, { fadeMs: 200 });

  const voice = client.distube?.voices?.get(guildId);
  const connection = voice?.connection;
  if (!connection) return false;

  let arquivo;
  try {
    const customizado = Boolean(process.env.SOM_DESPEDIDA_ARQUIVO);
    arquivo = await garantirSom(
      String(process.env.SOM_DESPEDIDA_ARQUIVO || '').trim() || SOM_DESPEDIDA.arquivo,
      SOM_DESPEDIDA.url,
      { customizado }
    );
  } catch (erro) {
    avisarUmaVez('despedida', `Som de despedida indisponível: ${erro.message}`);
    return false;
  }

  console.log(`[Música] Despedida: ${path.basename(arquivo)}`);

  return tocarUmaVez(voice, arquivo, {
    volume: VOLUME_DESPEDIDA,
    maxMs: DESPEDIDA_MAX,
    rotulo: 'despedida',
  });
}

// Saudação aleatória tocada assim que a Mila entra na call (chamada pelo
// wrapper de voices.join em distubeHandler). Resolve só quando o áudio termina,
// para a música não começar por cima.
async function tocarSaudacaoEntrada(voice) {
  if (!ENTRADA_ATIVA) return false;
  const arquivo = await sortearSaudacao();
  if (!arquivo) return false;
  return tocarUmaVez(voice, arquivo, {
    volume: VOLUME_ENTRADA,
    maxMs: Math.max(5000, ENTRADA_MAX),
    rotulo: 'saudação',
  });
}

// Toca um arquivo uma única vez no canal, devolve o canal ao DisTube no fim e
// resolve quando termina (ou no timeout).
function tocarUmaVez(voice, arquivo, { volume = 0.5, maxMs = 15_000, rotulo = 'som' } = {}) {
  const connection = voice?.connection;
  if (!connection) return Promise.resolve(false);

  const player = createAudioPlayer();
  const processo = spawn(
    ffmpegPath,
    ['-hide_banner', '-loglevel', 'error', '-i', arquivo, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
  );
  processo.on('error', (erro) => avisarUmaVez(`ffmpeg-${rotulo}`, `ffmpeg da ${rotulo}: ${erro.message}`));

  const recurso = createAudioResource(processo.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true,
  });
  try { recurso.volume.setVolume(volume); } catch {}

  return new Promise((resolve) => {
    let finalizado = false;
    const finalizar = () => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      try { player.removeAllListeners(); } catch {}
      try { player.stop(true); } catch {}
      try { processo.kill('SIGKILL'); } catch {}
      try { recurso.playStream?.destroy?.(); } catch {}
      // Devolve o canal ao DisTube antes de a música (ou o leave) continuar.
      try { connection.subscribe(voice.audioPlayer); } catch {}
      resolve(true);
    };

    const temporizador = setTimeout(finalizar, maxMs);
    temporizador.unref?.();

    player.on(AudioPlayerStatus.Idle, finalizar);
    player.on('error', finalizar);

    try {
      connection.subscribe(player);
      player.play(recurso);
      console.log(`[Música] Tocando ${rotulo}: ${path.basename(arquivo)}`);
    } catch (erro) {
      avisarUmaVez(`tocar-${rotulo}`, `Não consegui tocar a ${rotulo}: ${erro.message}`);
      finalizar();
    }
  });
}

function temEspera(guildId) {
  return sessoes.has(guildId);
}

function pararTodas() {
  for (const guildId of [...sessoes.keys()]) {
    encerrarSessao(sessoes.get(guildId));
  }
}

module.exports = {
  iniciarEspera,
  pararEspera,
  liberarParaMusica,
  tocarSaudacaoEntrada,
  tocarDespedida,
  temEspera,
  pararTodas,
  ARQUIVO,
  ATIVO,
  ENTRADA_ATIVA,
  DESPEDIDA_ATIVA,
};
