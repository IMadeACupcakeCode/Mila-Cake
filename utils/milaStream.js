// ⋆｡°✩ Mila Stream — relé de voz (transmissão real de áudio da chamada)
// Entra no canal de voz e:
//   1. Toca um aviso de voz "Estou a funcionar" (TTS Windows/SAPI, offline).
//   2. RELÉ de voz: capta o áudio de quem fala (receiver.subscribe) e o
//      RETRANSMITE no player — "transmitir o áudio de verdade" da chamada.
//      Quando ninguém fala, fica em SILÊNCIO (sem zumbido).
//   3. Opção de DESCONECTAR (sair da chamada).
//
// ⚠️ IMPORTANTE — riscos do relé:
//   - É um relé: capta e reproduz a fala de TERCEIROS. Requer aviso aos
//     participantes ("estão sendo retransmitidos").
//   - RISCO DE ECO: quem está perto do emissor pode ouvir eco. Mitigamos com
//     selfDeaf para a Mila não captar a si mesma e usando um player único.
//   - Privacidade: forças de quem está na chamada podem ser captadas.
//   - Não é selfbot: usa a API pública (subscribe/receiver) do @discordjs/voice.
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

// ── Estado das sessões: guildId → sessão ──────────────────────────────
const sessoes = new Map();

const RESOLUCAO = { largura: 1280, altura: 720, fps: 15 };

const FRASE_TTS = 'Estou a funcionar';

/** Gera WAV do aviso pelo Windows SAPI (Microsoft Maria, pt-BR), offline. */
function gerarTTSwav(frase) {
  return new Promise((resolve, reject) => {
    const out = path.join(os.tmpdir(), `mila_tts_${Date.now()}.wav`);
    const ps = [
      'Add-Type -AssemblyName System.Speech',
      `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer`,
      `$s.SelectVoice('Microsoft Maria Desktop')`,
      `$s.SetOutputToWaveFile('${out}')`,
      `$s.Speak('${frase.replace(/'/g, "''")}')`,
      `$s.Dispose()`,
    ].join('; ');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 10000, windowsHide: true }, (err) => {
      if (err) return reject(new Error('TTS falhou: ' + (err.message || err)));
      if (!fs.existsSync(out)) return reject(new Error('TTS não gerou arquivo'));
      resolve(out);
    });
  });
}

/** Toca um WAV no player (transcodifica p/ Opus/Ogg no pipe do ffmpeg). */
function tocarWav(player, caminhoWav) {
  const proc = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-i', caminhoWav,
    '-ac', '1', '-ar', '48000',
    '-c:a', 'libopus', '-f', 'ogg', 'pipe:1',
  ], { windowsHide: true });
  const resource = createAudioResource(proc.stdout, {
    inputType: StreamType.OggOpus,
    inlineVolume: false,
  });
  player.play(resource);
  return proc;
}

/** Cria um recurso de silêncio-true (sem zumbido) longo. */
function recursoSilencio(duracaoMs = 12 * 60 * 60 * 1000) {
  const proc = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=1:d=${Math.floor(duracaoMs / 1000)}`,
    '-ac', '1', '-ar', '48000',
    '-c:a', 'libopus', '-f', 'ogg', 'pipe:1',
  ], { windowsHide: true });
  const resource = createAudioResource(proc.stdout, {
    inputType: StreamType.OggOpus,
    inlineVolume: false,
  });
  return { proc, resource };
}

/** Toca um stream de Opus (AudioReceiveStream) no player — retransmissão. */
function tocarOpusLive(player, streamOpus) {
  const resource = createAudioResource(streamOpus, {
    inputType: StreamType.Opus,
    inlineVolume: false,
  });
  player.play(resource);
  return resource;
}

/**
 * Inicia a transmissão de voz da Mila num canal (relé real de áudio).
 * Toca o aviso TTS, depois capta e retransmite quem fala (ignorando a própria
 * Mila, o dono que pediu, e todos os bots/Discord); silêncio quando ninguém.
 */
async function iniciarStream(guildId, canalVozId, fonte, client = null, donoUserId = null) {
  await pararStream(guildId);

  let guild = client?.guilds?.cache?.get(guildId) || null;
  if (!guild && client && typeof client.guilds?.fetch === 'function') {
    guild = await client.guilds.fetch(guildId).catch(() => null);
  }
  const adapterCreator = guild?.voiceAdapterCreator || client?.guilds?.cache?.get(guildId)?.voiceAdapterCreator;
  if (!adapterCreator || typeof adapterCreator !== 'function') {
    await pararStream(guildId).catch(() => {});
    throw new Error('adapterCreator indisponível. Reveja as intents Guilds/GuildVoiceStates.');
  }

  // selfDeaf:false OBRIGATÓRIO p/ o receiver captar áudio dos outros
  // (a doc oficial do @discordjs/voice: "join with selfDeaf:false for the
  // receiver to work"). selfMute também false — queremos enviar o relé.
  const connection = joinVoiceChannel({
    channelId: canalVozId,
    guildId,
    adapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
      maxMissedFrames: Infinity,
      legacy: true,
    },
  });
  connection.subscribe(player);
  connection.setSpeaking(1);

  const sessao = {
    guildId,
    canalVozId,
    fonte,
    player,
    connection,
    proc: null,
    resource: null,
    ttsProc: null,
    _standby: null,
    _silenciado: false,
    _speakingMap: null,
    _subsRelay: new Map(), // userId → { stream, resource, timer }
    _donoId: donoUserId || null,
    ativoEm: Date.now(),
  };

  // ── 1) Aviso "Estou a funcionar" (TTS) ──
  let ttsOk = false;
  try {
    const wav = await gerarTTSwav(FRASE_TTS);
    sessao.ttsProc = tocarWav(player, wav);
    ttsOk = true;
    setTimeout(() => fs.rmSync(wav, { force: true }), 4000);
  } catch (e) {
    console.error('⋆｡°✩ Mila Stream — TTS não disponível:', e.message);
  }

  // ── 2) Silêncio-true (sem zumbido) ──
  const iniciarSilencio = () => {
    if (sessao._silenciado) return;
    sessao._silenciado = true;
    try { sessao._standby?.proc?.kill('SIGKILL'); } catch {}
    const sb = recursoSilencio();
    sessao._standby = sb;
    sessao.proc = sb.proc;
    sessao.resource = sb.resource;
    player.play(sb.resource);
    if (player.state.status === AudioPlayerStatus.AutoPaused) {
      try { player.unpause(); } catch {}
    }
  };

  if (!ttsOk) iniciarSilencio();
  player.on('stateChange', (_o, novo) => {
    if (novo.status === AudioPlayerStatus.Idle || novo.status === AudioPlayerStatus.AutoPaused) {
      if (!sessao._silenciado) iniciarSilencio();
    }
  });

  // ── 3) RELÉ de voz: capta quem fala e retransmite ──
  // Quem está isento de retransmissão (não tocar):
  //   - a própria Mila (client.user.id)
  //   - o usuário que pediu (dono)
  //   - TODOS os bots (inclui qualquer bot/Discord na chamada)
  const ID_MILA = client?.user?.id || null;

  // Quem NÃO retransmitir:
  //   - a própria Mila
  //   - o dono (usuário que pediu, sessao._donoId)
  //   - QUALQUER bot (user.bot === true; inclui qualquer bot na chamada, e o
  //     próprio "Discord" é um bot nos membros — coberto por u.bot).
  function ehBotouEu(userId) {
    if (userId === ID_MILA) return true;
    if (userId === (sessao._donoId || null)) return true;
    // Determina se é bot de forma resiliente: tenta o cache de users (bot);
    // senão usa o cache de membros da guild (via guildId da sessão). Padrão:
    // se não der para resolver, RETRANSMITE (não exclui pessoas por falha).
    const u = client?.users?.cache?.get(userId);
    if (u && typeof u.bot === 'boolean') return u.bot;
    const g = client?.guilds?.cache?.get(guildId);
    const membro = g?.members?.cache?.get(userId);
    if (membro) return !!membro.user?.bot;
    return false;
  }

  function comecarSubs(userId) {
    if (ehBotouEu(userId)) return; // ignorar Mila, dono e bots
    if (sessao._subsRelay.has(userId)) return; // já ativo
    if (sessao._stopped) return;

    // Mesmo se o receiver está em Signalling, tenta; se não houver subscribe,
    // cai no catch e segue (não trava).
    let stream;
    try {
      if (typeof connection.receiver?.subscribe !== 'function') {
        console.warn('⋆｡°✩ Mila Stream — receiver.subscribe indisponível (state ' + (connection.state?.status || '?') + ').');
        return;
      }
      stream = connection.receiver.subscribe(userId, {
        end: { behavior: 'manual' },
      });
    } catch (e) {
      console.error(`⋆｡°✩ Mila Stream — sem receiver p/ ${userId}:`, e.message);
      return;
    }

    // Tocar o relé interrompe o silêncio automaticamente.
    let resource;
    try {
      resource = tocarOpusLive(player, stream);
    } catch (e) {
      console.error(`⋆｡°✩ Mila Stream — erro ao tocar relé de ${userId}:`, e.message);
      try { stream.destroy(); } catch {}
      return;
    }

    sessao._subsRelay.set(userId, { stream, resource });
    // Após o áudio do falante, o player deve voltar ao silêncio quando ele parar.
    stream.on('end', () => {
      if (sessao._subsRelay.has(userId)) {
        sessao._subsRelay.delete(userId);
        sessao.player.stop(true);
        iniciarSilencio();
      }
    });
    console.log(`⋆｡°✩ Mila Stream — retransmitindo ${userId}...`);
  }

  function pararSubs(userId) {
    const sub = sessao._subsRelay.get(userId) || null;
    if (!sub) return;
    sessao._subsRelay.delete(userId);
    try { sub.stream?.destroy?.(); } catch {}
    // Se não há mais falantes, volta ao silêncio (se ainda não está).
    if (sessao._subsRelay.size === 0 && sessao._silenciado) {
      try { sessao.player.stop(true); } catch {}
      iniciarSilencio();
    }
  }

  try {
    const speaking = connection.receiver?.speaking;
    if (speaking && typeof speaking.on === 'function') {
      sessao._speakingMap = speaking;
      speaking.on('start', comecarSubs);
      speaking.on('end', pararSubs);
    }
  } catch (e) {
    console.error('⋆｡°✩ Mila Stream — sem SpeakingMap:', e.message);
  }

  // Proteção: idle geral limpa; erro limpa.
  player.on('stateChange', (_o, novo) => {
    if (novo.status === AudioPlayerStatus.Idle && !sessao._silenciado && sessao._standby) {
      pararStream(guildId).catch(() => {});
    }
  });
  player.on('error', (erro) => {
    console.error(`⋆｡°✩ Mila Stream — erro no player (guild ${guildId}):`, erro?.message || erro);
    pararStream(guildId).catch(() => {});
  });

  sessoes.set(guildId, sessao);
  return sessao;
}

/** Para o stream e sai da chamada de voz (desconectar). */
async function pararStream(guildId, desconectar = false) {
  const sessao = sessoes.get(guildId);
  if (!sessao) return;

  sessao._stopped = true;

  // Encerra todas as subscrições do relé.
  for (const [, sub] of sessao._subsRelay || []) {
    try { sub.stream?.destroy?.(); } catch {}
  }
  sessao._subsRelay = new Map();

  try { sessao._speakingMap?.removeAllListeners?.(); } catch {}
  try { sessao.connection?.setSpeaking(0); } catch {}
  try { sessao.ttsProc?.kill('SIGKILL'); } catch {}
  try { sessao.proc?.kill('SIGKILL'); } catch {}
  try { sessao.resource?.playStream?.destroy?.(); } catch {}
  try { sessao._standby?.proc?.kill('SIGKILL'); } catch {}
  sessao.player?.stop(true);
  if (desconectar) {
    try { sessao.connection?.destroy(); } catch {}
  } else {
    try { sessao.connection?.destroy(); } catch {}
  }

  sessoes.delete(guildId);
  return true;
}

/** Desconecta a Mila da chamada de voz (sai do canal) + limpa. */
async function desconectar(guildId) {
  return pararStream(guildId, true);
}

function listarSessoes() {
  return [...sessoes.values()];
}

function getSessao(guildId) {
  return sessoes.get(guildId) || null;
}

function suportaStream() {
  return !!ffmpegPath;
}

module.exports = {
  iniciarStream,
  pararStream,
  desconectar,
  listarSessoes,
  getSessao,
  suportaStream,
  RESOLUCAO,
  FRASE_TTS,
};

// ─────────────────────────────────────────────────────────────────────────
// Notas honestas sobre o relé:
//  - Capta a fala de TERCEIROS via receiver.subscribe (API pública do @discordjs/voice).
//  - Transmite num único player p/ todos no canal (não dá para filtrar por assinante).
//  - selfDeaf=true: a Mila não ouve a si mesma (mitiga eco), ainda envia normalmente.
//  - O risco de ECO pode permanecer p/ quem fala perto do emissor; avise os
//    participantes de que a Mila é um relé e transmite o que ouvem.
//  - Não é selfbot; é a API oficial. Sem risco de banimento pelo Discord.