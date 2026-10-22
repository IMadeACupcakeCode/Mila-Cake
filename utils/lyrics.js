const CACHE = new Map();
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

function guardarNoCache(chave, valor) {
  CACHE.set(chave, valor);
  // Cache limitado: antes crescia sem teto durante toda a vida do processo.
  const agora = Date.now();
  for (const [k, v] of CACHE) {
    if (agora - v.timestamp > CACHE_MS) CACHE.delete(k);
    else break;
  }
  while (CACHE.size > CACHE_MAX) {
    CACHE.delete(CACHE.keys().next().value);
  }
}

function separarMusica(nome = '') {
  const valor = String(nome).replace(/\s*\([^)]*\)\s*$/, '').trim();
  const partes = valor.split(/\s[-–—]\s/);
  if (partes.length > 1) return { artist: partes.shift().trim(), title: partes.join(' - ').trim() };
  return { artist: '', title: valor };
}

function limparTexto(valor) {
  return String(valor || '').replace(/<[^>]+>/g, '').replace(/\r/g, '').trim();
}

async function buscarJson(url) {
  const resposta = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'MilaBot/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!resposta.ok) return null;
  return resposta.json();
}

async function buscarNoLrclib(artist, title) {
  const params = new URLSearchParams({ track_name: title });
  if (artist) params.set('artist_name', artist);
  const dados = await buscarJson(`https://lrclib.net/api/get?${params}`);
  const lyrics = limparTexto(dados?.plainLyrics || dados?.syncedLyrics);
  return lyrics ? { lyrics, source: 'LRCLIB' } : null;
}

async function buscarNoLyricsOvh(artist, title) {
  if (!artist) return null;
  const dados = await buscarJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
  const lyrics = limparTexto(dados?.lyrics);
  return lyrics ? { lyrics, source: 'Lyrics.ovh' } : null;
}

function ehSuno(url) {
  try { return /(?:^|\.)suno\.(?:com|ai)$/i.test(new URL(url).hostname); } catch { return false; }
}

function letraDaMusica(song) {
  const letra = song?.lyrics || song?.lyric;
  return typeof letra === 'string' && letra.trim().length > 20 ? limparTexto(letra) : null;
}

function procurarLetraEmObjeto(valor) {
  if (!valor || typeof valor !== 'object') return null;
  for (const [chave, conteudo] of Object.entries(valor)) {
    if (/^(lyrics|lyric|prompt)$/i.test(chave) && typeof conteudo === 'string' && conteudo.trim().length > 20) return conteudo;
    const encontrada = procurarLetraEmObjeto(conteudo);
    if (encontrada) return encontrada;
  }
  return null;
}

function procurarJsons(html) {
  return [...html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((resultado) => resultado[1])
    .map((texto) => { try { return JSON.parse(texto); } catch { return null; } })
    .filter(Boolean);
}

async function buscarNoSuno(song) {
  const url = song?.pageUrl || song?.url || song?.webpage_url;
  if (!ehSuno(url)) return null;
  const resposta = await fetch(url, { headers: { accept: 'text/html', 'user-agent': 'MilaBot/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!resposta.ok) return null;
  const html = (await resposta.text()).slice(0, 2 * 1024 * 1024);
  const objeto = procurarJsons(html).map(procurarLetraEmObjeto).find(Boolean);
  const correspondencia = html.match(/(?:"lyrics"|"lyric"|"prompt")\s*:\s*"((?:\\.|[^"])*)"/i);
  const letra = objeto || correspondencia?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  const lyrics = limparTexto(letra);
  return lyrics ? { lyrics, source: 'Suno' } : null;
}

async function buscarLetra(song) {
  const nome = song?.name || song?.title || '';
  const letraDoSuno = letraDaMusica(song);
  if (letraDoSuno) return { lyrics: letraDoSuno, source: 'Suno', artist: '', title: nome, songName: nome };
  const { artist, title } = separarMusica(nome);
  if (!title) throw new Error('Não consegui identificar o título da música.');
  const chave = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  const anterior = CACHE.get(chave);
  if (anterior && Date.now() - anterior.timestamp < CACHE_MS) return anterior.valor;
  let valor = null;
  try { valor = await buscarNoSuno(song); } catch {}
  if (!valor) {
    try { valor = await buscarNoLrclib(artist, title); } catch {}
  }
  if (!valor) {
    try { valor = await buscarNoLyricsOvh(artist, title); } catch {}
  }
  if (!valor) throw new Error(`Não encontrei letra pública para "${nome}".`);
  const resultado = { ...valor, artist, title, songName: nome };
  guardarNoCache(chave, { timestamp: Date.now(), valor: resultado });
  return resultado;
}

function dividirLetra(lyrics, limite = 3800) {
  const linhas = String(lyrics).split('\n');
  const partes = [];
  let atual = '';
  for (const linha of linhas) {
    if ((atual + (atual ? '\n' : '') + linha).length > limite && atual) {
      partes.push(atual);
      atual = '';
    }
    atual += `${atual ? '\n' : ''}${linha}`;
  }
  if (atual) partes.push(atual);
  return partes.length ? partes : ['Letra vazia.'];
}

module.exports = { buscarLetra, dividirLetra, separarMusica };
