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
  const idioma = config.idioma || perfil.idioma;
  const velocidade = Number(perfil.velocidade || 0);
  const voz = String(config.voz || '').replace(/'/g, "''");
  const selecao = voz ? `$s.SelectVoice('${voz}')` : '';
  const frase = texto.replace(/'/g, "''");
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    selecao,
    `$s.Rate = ${velocidade}`,
    `$s.SetOutputToWaveFile('${caminho.replace(/'/g, "''")}')`,
    `$s.Speak('${frase}')`,
    '$s.Dispose()',
  ].filter(Boolean).join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 30000, windowsHide: true });
  if (!fs.existsSync(caminho)) throw new Error('A voz do Windows não gerou áudio.');
}

async function gerarGoogle(texto, idioma, caminho) {
  const idiomaGoogle = String(idioma || 'pt-BR').split('-')[0];
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(idiomaGoogle)}&q=${encodeURIComponent(texto)}`;
  const resposta = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!resposta.ok) throw new Error(`Fallback de voz respondeu HTTP ${resposta.status}.`);
  fs.writeFileSync(caminho, Buffer.from(await resposta.arrayBuffer()));
}

function converterParaOpus(caminho) {
  const processo = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', caminho, '-ac', '2', '-ar', '48000', '-c:a', 'libopus', '-f', 'ogg', 'pipe:1'], { windowsHide: true });
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
  sessao.fila = sessao.fila.then(async () => {
    const caminho = path.join(os.tmpdir(), `mila-tts-${process.pid}-${Date.now()}.wav`);
    try {
      try { await gerarSapi(final, config, caminho); } catch (erroSapi) {
        try { await gerarGoogle(final, config.idioma, caminho); } catch (erroGoogle) {
          throw new Error(`Não consegui gerar a voz gratuitamente: ${erroGoogle.message || erroSapi.message}`);
        }
      }
      const { processo, recurso } = converterParaOpus(caminho);
      sessao.player.play(recurso);
      await new Promise((resolve) => sessao.player.once(AudioPlayerStatus.Idle, resolve));
      processo.kill();
    } finally {
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
