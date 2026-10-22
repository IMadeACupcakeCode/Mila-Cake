const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const { obterConfig, salvarConfig } = require('./servidorStore');

const execFileAsync = promisify(execFile);
const sessoes = new Map();
const IDIOMAS = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN', 'ru-RU']);
const PERFIS = {
  padrao: { idioma: 'pt-BR', voz: '', velocidade: 0 },
  paulista: { idioma: 'pt-BR', voz: '', velocidade: 8 },
  carioca: { idioma: 'pt-BR', voz: '', velocidade: -4 },
  chines: { idioma: 'zh-CN', voz: '', velocidade: 0 },
  americana: { idioma: 'en-US', voz: '', velocidade: 0 },
  japonesa: { idioma: 'ja-JP', voz: '', velocidade: 0 },
};

function obterTtsConfig(guildId) {
  const config = obterConfig(guildId);
  config.tts = {
    idioma: 'pt-BR',
    perfil: 'padrao',
    voz: '',
    dizerNome: false,
    ...config.tts,
  };
  return config.tts;
}

function salvarTtsConfig(guildId, alteracoes) {
  const config = obterConfig(guildId);
  config.tts = { ...obterTtsConfig(guildId), ...alteracoes };
  salvarConfig(guildId, config);
  return config.tts;
}

function normalizarIdioma(valor) {
  const idioma = String(valor || '').trim();
  return IDIOMAS.has(idioma) ? idioma : null;
}

function normalizarPerfil(valor) {
  const perfil = String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PERFIS[perfil] ? perfil : null;
}

function textoSeguro(texto) {
  return String(texto || '').replace(/https?:\/\/\S+/gi, ' link ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 450);
}

async function vozesWindows() {
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices().VoiceInfo | ForEach-Object { $_.Name + '|' + $_.Culture.Name }"], { timeout: 10000, windowsHide: true });
    return stdout.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean).map((linha) => {
      const [nome, idioma] = linha.split('|');
      return { nome, idioma };
    });
  } catch {
    return [];
  }
}

async function gerarSapi(texto, config, caminho) {
  const perfil = PERFIS[config.perfil] || PERFIS.padrao;
  const velocidade = Math.max(-10, Math.min(10, Number(perfil.velocidade || 0)));
  // Só aceita nomes de voz plausíveis; o texto do usuário NÃO entra no
  // comando do PowerShell — ele é lido de um arquivo UTF-8 separado.
  const voz = String(config.voz || '').replace(/['`"]/g, '').trim().slice(0, 80);
  const selecao = voz ? `$s.SelectVoice('${voz}')` : '';
  const caminhoTexto = `${caminho}.txt`;
  const caminhoScript = `${caminho}.ps1`;
  const q = (valor) => String(valor).replace(/'/g, "''");
  try {
    fs.writeFileSync(caminhoTexto, texto, 'utf8');
    const ps = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      selecao,
      `$s.Rate = ${velocidade}`,
      `$texto = [System.IO.File]::ReadAllText('${q(caminhoTexto)}', [System.Text.Encoding]::UTF8)`,
      `$s.SetOutputToWaveFile('${q(caminho)}')`,
      '$s.Speak($texto)',
      '$s.Dispose()',
    ].filter(Boolean).join('\r\n');
    fs.writeFileSync(caminhoScript, ps, 'utf8');
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', caminhoScript], { timeout: 30000, windowsHide: true });
  } finally {
    fs.rmSync(caminhoTexto, { force: true });
    fs.rmSync(caminhoScript, { force: true });
  }
  if (!fs.existsSync(caminho)) throw new Error('A voz do Windows não gerou áudio.');
}

async function gerarGoogle(texto, idioma, caminho) {
  const idiomaGoogle = String(idioma || 'pt-BR').split('-')[0];
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(idiomaGoogle)}&q=${encodeURIComponent(texto)}`;
  const resposta = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) throw new Error(`Fallback de voz respondeu HTTP ${resposta.status}.`);
  const buffer = Buffer.from(await resposta.arrayBuffer());
  if (buffer.length < 500) throw new Error('Fallback de voz retornou áudio vazio.');
  fs.writeFileSync(caminho, buffer);
}

function converterParaOpus(caminho) {
  const processo = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', caminho, '-ac', '2', '-ar', '48000', '-c:a', 'libopus', '-f', 'ogg', 'pipe:1'], { windowsHide: true });
  // Sem este listener, uma falha do ffmpeg derruba o processo inteiro.
  processo.on('error', (erro) => console.error('ffmpeg (TTS) falhou:', erro.message));
  processo.stderr?.on('data', () => {});
  return { processo, recurso: createAudioResource(processo.stdout, { inputType: StreamType.OggOpus }) };
}

async function falar(guild, member, texto, alteracoes = {}) {
  const canal = member?.voice?.channel;
  if (!canal) throw new Error('Entre em um canal de voz primeiro.');
  const config = { ...obterTtsConfig(guild.id), ...alteracoes };
  const perfil = PERFIS[config.perfil] || PERFIS.padrao;
  if (!normalizarIdioma(config.idioma)) config.idioma = perfil.idioma;
  const frase = textoSeguro(texto);
  if (!frase) throw new Error('Escreva algo para eu falar.');
  const final = config.dizerNome && member.displayName ? `${member.displayName} disse: ${frase}` : frase;
  let sessao = sessoes.get(guild.id);
  if (!sessao || sessao.canalId !== canal.id) {
    sessao?.connection?.destroy();
    const connection = joinVoiceChannel({ channelId: canal.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
    sessao = { canalId: canal.id, connection, player: createAudioPlayer(), fila: Promise.resolve() };
    connection.subscribe(sessao.player);
    sessoes.set(guild.id, sessao);
  }
  // A fila precisa se auto-curar: sem o catch, um único erro rejeitava a
  // promise e todos os falar() seguintes nunca mais executavam.
  sessao.fila = sessao.fila.catch(() => {}).then(async () => {
    const caminho = path.join(os.tmpdir(), `mila-tts-${process.pid}-${Date.now()}.wav`);
    let processo = null;
    try {
      try { await gerarSapi(final, config, caminho); } catch (erroSapi) {
        try { await gerarGoogle(final, config.idioma, caminho); } catch (erroGoogle) {
          throw new Error(`Não consegui gerar a voz gratuitamente: ${erroGoogle.message || erroSapi.message}`);
        }
      }
      const convertido = converterParaOpus(caminho);
      processo = convertido.processo;
      sessao.player.play(convertido.recurso);
      await new Promise((resolve) => {
        let terminado = false;
        const finalizar = () => {
          if (terminado) return;
          terminado = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finalizar, 45_000);
        sessao.player.once(AudioPlayerStatus.Idle, finalizar);
        processo.once('error', finalizar);
        processo.once('close', finalizar);
      });
    } finally {
      if (processo && !processo.killed) processo.kill();
      fs.rmSync(caminho, { force: true });
    }
  });
  await sessao.fila;
}

function formatarConfig(config) {
  return `Idioma: **${config.idioma}**\nPerfil: **${config.perfil}**\nNome de quem digitou: **${config.dizerNome ? 'sim' : 'não'}**${config.voz ? `\nVoz Windows: **${config.voz}**` : ''}`;
}

function desconectar(guildId) {
  const sessao = sessoes.get(guildId);
  if (!sessao) return false;
  sessao.connection.destroy();
  sessoes.delete(guildId);
  return true;
}

module.exports = { IDIOMAS, PERFIS, obterTtsConfig, salvarTtsConfig, normalizarIdioma, normalizarPerfil, vozesWindows, falar, formatarConfig, desconectar };
