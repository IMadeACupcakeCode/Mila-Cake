// ⋆｡°✩ Mila Stream — fontes de captura (Windows)
// Lista janelas visíveis e monitores da MÁQUINA onde o node roda,
// via PowerShell + Win32. Usado pelo seletor de $stream.
//
// ⚠️ Importante: essa lista reflete o PC onde a Mila está rodando.
// Para mostrar AS SUAS janelas/monitores, a Mila precisa rodar no seu PC.
const { execFile } = require('child_process');

// Cache curto para não spammar PowerShell a cada interação.
const cache = { janelas: null, monitores: null, ts: 0 };
const CACHE_TTL = 4000; // ms

// Código C# para enumerar janelas visíveis (Win32).
// IMPORTANTE: vai embutido num heredoc literal do PowerShell (@'...'@),
// que NÃO interpola — então o código C# deve ficar sem escapes (aspas duplas
// cruas). A única formatação fora do heredoc é a concatenação das linhas.
const C_SHARP_ENUM_WINDOWS = [
  'using System;',
  'using System.Text;',
  'using System.Runtime.InteropServices;',
  'using System.Collections.Generic;',
  '',
  'public class WinEnum {',
  '  [DllImport("user32.dll")]',
  '  static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);',
  '  delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);',
  '  [DllImport("user32.dll")]',
  '  static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
  '  [DllImport("user32.dll")]',
  '  static extern bool IsWindowVisible(IntPtr hWnd);',
  '  [DllImport("user32.dll")]',
  '  static extern int GetWindowTextLength(IntPtr hWnd);',
  '  [DllImport("user32.dll")]',
  '  static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);',
  '  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
  '  public static int Main() {',
  '    var titles = new List<string>();',
  '    EnumWindows(delegate(IntPtr hWnd, IntPtr l) {',
  '      if (IsWindowVisible(hWnd)) {',
  '        int len = GetWindowTextLength(hWnd);',
  '        if (len > 0) {',
  '          StringBuilder sb = new StringBuilder(len + 1);',
  '          GetWindowText(hWnd, sb, sb.Capacity);',
  '          RECT r; GetWindowRect(hWnd, out r);',
  '          int w = r.Right - r.Left; int h = r.Bottom - r.Top;',
  '          titles.Add(sb.ToString() + "|" + w + "|" + h);',
  '        }',
  '      }',
  '      return true;',
  '    }, IntPtr.Zero);',
  '    foreach (var t in titles) Console.WriteLine("WINDOW|" + t);',
  '    return 0;',
  '  }',
  '}',
  '',
].join('\n');

function executarPowerShell(script) {
  return new Promise((resolve, reject) => {
    // Força o console do PowerShell para UTF-8 para títulos acentuados
    // saírem corretos; -InputFormat Text evita objetos; input o script.
    const args = [
      '-NoProfile', '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-InputFormat', 'Text',
      '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ` + script,
    ];
    execFile('powershell.exe', args, { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || '').slice(0, 400) || err.message));
      resolve(stdout);
    });
  });
}

/** Remove caracteres de controle e junk (ex.: ) dos títulos. */
function limparTitulo(titulo) {
  // eslint-disable-next-line no-control-regex
  return titulo.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Lista janelas visíveis da máquina.
 * @returns {Promise<Array<{id:string, titulo:string, largura:number, altura:number}>>}
 */
async function listarJanelas() {
  if (cache.janelas && Date.now() - cache.ts < CACHE_TTL) return cache.janelas;

  const comando = [
    'Add-Type -TypeDefinition @\'',
    C_SHARP_ENUM_WINDOWS.trim(),
    '\'@',
    '[WinEnum]::Main()',
  ].join('\n');

  try {
    const saida = await executarPowerShell(comando);
    const janelas = saida
      .split('\n')
      .map((linha) => linha.trim())
      .filter((l) => l.startsWith('WINDOW|'))
      .map((l) => {
        const corpo = l.slice('WINDOW|'.length);
        // corpo = titulo|largura|altura  (largura/altura sempre numéricos no fim)
        const isd = corpo.lastIndexOf('|');
        const largura = parseInt(corpo.slice(isd + 1), 10) || 0;
        const corpo2 = corpo.slice(0, isd);
        const isd2 = corpo2.lastIndexOf('|');
        const altura = parseInt(corpo2.slice(isd2 + 1), 10) || 0;
        const titulo = limparTitulo(corpo2.slice(0, isd2));
        return { id: `janela|${titulo}`, titulo, largura, altura };
      })
      .filter((j) => j.titulo && j.titulo.length > 0);

    cache.janelas = janelas;
    cache.ts = Date.now();
    return janelas;
  } catch {
    cache.janelas = [];
    cache.ts = Date.now();
    return [];
  }
}

/**
 * Lista monitores da máquina.
 * @returns {Promise<Array<{id:string, indice:number, largura:number, altura:number, primary:boolean}>>}
 */
async function listarMonitores() {
  if (cache.monitores && Date.now() - cache.ts < CACHE_TTL) return cache.monitores;

  const comando = `
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$screens = [System.Windows.Forms.Screen]::AllScreens
for ($i = 0; $i -lt $screens.Count; $i++) {
  $r = $screens[$i].Bounds
  Write-Output ("MONITOR|{0}|{1}|{2}|{3}" -f ($i+1), $r.Width, $r.Height, $screens[$i].Primary)
}
`;

  try {
    const saida = await executarPowerShell(comando);
    const monitores = saida
      .split('\n')
      .map((linha) => linha.trim())
      .filter((l) => l.startsWith('MONITOR|'))
      .map((l) => {
        const [, indice, largura, altura, primary] = l.split('|');
        return {
          id: `monitor|${parseInt(indice, 10)}`,
          indice: parseInt(indice, 10),
          largura: parseInt(largura, 10) || 0,
          altura: parseInt(altura, 10) || 0,
          primary: primary === 'True',
        };
      });

    cache.monitores = monitores;
    cache.ts = Date.now();
    return monitores;
  } catch {
    cache.monitores = [];
    cache.ts = Date.now();
    return [];
  }
}

/** Desktop = tela inteira (principal). Usado quando o usuário escolhe "Desktop". */
function fonteDesktop() {
  return { id: 'desktop', tipo: 'desktop', titulo: 'Tela inteira (Desktop)', largura: 0, altura: 0 };
}

/** Converte o `value` de um select de volta em {tipo, alvo, rotulo}. */
function decodificarFonte(value) {
  if (value === 'desktop') {
    return { tipo: 'desktop', alvo: null, rotulo: 'Tela inteira (Desktop)' };
  }
  if (value.startsWith('monitor|')) {
    const indice = parseInt(value.split('|')[1], 10);
    return { tipo: 'monitor', alvo: indice, rotulo: `Monitor ${indice}` };
  }
  if (value.startsWith('janela|')) {
    // O título pode ter um sufixo `#n` (janelas repetidas) — remove p/ o
    // ffmpeg/gdigrab achar a janela real (o título original não tem o `#n`).
    const titulo = value.slice('janela|'.length).replace(/#\d+$/, '');
    return { tipo: 'janela', alvo: titulo, rotulo: titulo };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// ⋆｡°✩ Mila Stream — fontes de ÁUDIO (Windows)
// O bot captura o som do PC e re-emite no canal. Sem drivers extra.
//   - Loopback WASAPI: o que SAI no alto-falante (a call + tudo que o PC toca).
//   - Microfone: ffmpeg dshow (os 2 microfones reais da máquina).
// Enumera devices via PowerShell + C# (WASAPI), mesmo padrão do código acima.
// ─────────────────────────────────────────────────────────────────────────

const ffmpegPath = require('ffmpeg-static');

/** Roda um PowerShell script e devolve o stdout. */
function executarPowerShellAudio(script) {
  return executarPowerShell(script);
}

/** Enumera os microfones reais expostos ao ffmpeg (dshow). */
async function listarMicrofones() {
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-f', 'dshow', '-list_devices', 'true', '-i', 'dummy'], { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const saida = (stdout || '') + '\n' + (stderr || '');
      const mics = [];
      // ffmpeg lista ex.:  "Microphone (High Definition Audio Device)" (audio)
      for (const linha of saida.split('\n')) {
        const m = linha.match(/"([^"]+)"\s*\(audio\)/i);
        if (m && /microfone|microphone|mic/i.test(m[1])) {
          const nome = m[1].trim();
          mics.push({ id: `microfone|${nome}`, nome });
        }
      }
      if (mics.length === 0) {
        // Fallback deterministico (os dispositivos que vimos nesta maquina)
        mics.push({ id: 'microfone|Microphone (High Definition Audio Device)', nome: 'Microphone (High Definition Audio Device)' });
        mics.push({ id: 'microfone|Microphone (USBAudio2.0)', nome: 'Microphone (USBAudio2.0)' });
      }
      resolve(mics);
    });
  });
}

/** Confirma que existe um dispositivo de saída (render) ativo — base do loopback WASAPI. */
async function verificarRenderAtivo() {
  const cs = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class WasapiDefault {
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int eDataFlow, int dwStateMask, out IntPtr ppDevices);
    [PreserveSig] int GetDefaultAudioEndpoint(int eDataFlow, int eRole, out IMMDevice ppDevice);
    [PreserveSig] int GetDevice(string pwstrId, out IMMDevice ppDevice);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, out IntPtr ppInterface);
    [PreserveSig] int GetId(out string ppstrId);
    [PreserveSig] int GetState(out int pdwState);
  }
  public static void Run() {
    try {
      var o = (IMMDeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")));
      IMMDevice dev;
      int hr = o.GetDefaultAudioEndpoint(0 /*Render*/, 1 /*Multimedia*/, out dev);
      if (hr != 0) { Console.WriteLine("RENDER_ATIVO=nao"); return; }
      int st; try { dev.GetState(out st); } catch { st = 0; }
      Console.WriteLine("RENDER_ATIVO=" + ((st & 1) == 1 ? "sim" : "nao"));
    } catch { Console.WriteLine("RENDER_ATIVO|erro"); }
  }
}
'@
[WasapiDefault]::Run()
`;
  try {
    const stdout = await executarPowerShellAudio(cs);
    const linha = stdout.split('\n').map((l) => l.trim()).find((l) => l.startsWith('RENDER_ATIVO='));
    return linha ? linha.split('=')[1] === 'sim' : true;
  } catch {
    return false;
  }
}

/** Detecta o modo de audio disponivel para a transmissao. */
async function detectarModoAudio() {
  const microfones = await listarMicrofones();
  const renderOk = await verificarRenderAtivo();
  return {
    // Loopback WASAPI e sempre o modo principal; microfone e fallback.
    modo: renderOk ? 'loopback' : 'microfone',
    microfones,
    renderAtivo: renderOk,
    loopbackOk: renderOk,
    suportaMic: microfones.length > 0,
  };
}

module.exports = {
  listarJanelas,
  listarMonitores,
  fonteDesktop,
  decodificarFonte,
  listarMicrofones,
  verificarRenderAtivo,
  detectarModoAudio,
  executarBinario: executarPowerShell,
};