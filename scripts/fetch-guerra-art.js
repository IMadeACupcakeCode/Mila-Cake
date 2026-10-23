// Baixa e otimiza as artes da Guerra de Cartas.
// Uso: node scripts/fetch-guerra-art.js [--force]
//
// As imagens ficam em static/guerra/cards/ e são enviadas como anexo nas
// embeds, então o jogo não depende de hotlink em runtime.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { CARTAS, ESPECIAIS } = require('../utils/guerraCartas');

const DIR = path.join(__dirname, '..', 'static', 'guerra', 'cards');
const FORCE = process.argv.includes('--force');

const artes = new Map();
for (const carta of [...CARTAS, ...ESPECIAIS]) {
  if (!artes.has(carta.arte)) artes.set(carta.arte, carta);
}

function otimizar(origem, destino) {
  const ext = path.extname(destino).toLowerCase();
  const args = ['-y', '-i', origem, '-vf', 'scale=700:-2:flags=lanczos'];
  if (ext === '.jpg' || ext === '.jpeg') {
    args.push('-q:v', '4');
  } else {
    args.push('-compression_level', '9');
  }
  args.push(destino);
  execFileSync(ffmpeg, args, { stdio: 'pipe' });
}

async function baixar(url, destino) {
  const resposta = await fetch(url, { redirect: 'follow' });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const buffer = Buffer.from(await resposta.arrayBuffer());
  if (buffer.length < 256) throw new Error('arquivo pequeno demais');
  const tmp = path.join(os.tmpdir(), `guerra-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(destino)}`);
  fs.writeFileSync(tmp, buffer);
  try {
    otimizar(tmp, destino);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
  const final = fs.statSync(destino);
  return final.size;
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const falhas = [];
  for (const [arte, carta] of artes) {
    const destino = path.join(DIR, arte);
    if (!FORCE && fs.existsSync(destino) && fs.statSync(destino).size > 512) {
      console.log(`• ${arte} já existe (${Math.round(fs.statSync(destino).size / 1024)} KB)`);
      continue;
    }
    try {
      const bytes = await baixar(carta.arteUrl, destino);
      console.log(`✓ ${arte} — ${Math.round(bytes / 1024)} KB`);
    } catch (erro) {
      falhas.push(`${arte}: ${erro.message}`);
      console.error(`✗ ${arte}: ${erro.message}`);
    }
  }
  if (falhas.length) {
    console.error(`\n${falhas.length} arte(s) falharam.`);
    process.exitCode = 1;
  } else {
    console.log(`\nPronto: ${artes.size} artes em ${DIR}`);
  }
})();
