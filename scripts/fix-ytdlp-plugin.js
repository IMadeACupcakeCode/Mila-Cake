const fs = require('fs');
const path = require('path');

const arquivo = path.join(__dirname, '..', 'node_modules', '@distube', 'yt-dlp', 'dist', 'index.js');
if (!fs.existsSync(arquivo)) process.exit(0);
const original = fs.readFileSync(arquivo, 'utf8');
let corrigido = original.replace(/\s*noCallHome: true,\n/g, '\n');
const trechoOriginal = 'var args = /* @__PURE__ */ __name((url, flags = {}) => [url].concat((0, import_dargs.default)(flags, { useEquals: false })).filter(Boolean), "args");';
const trechoCorrigido = 'var args = /* @__PURE__ */ __name((url, flags = {}) => {\n  const extras = [];\n  if (process.env.YTDLP_COOKIES_FILE) extras.push("--cookies", process.env.YTDLP_COOKIES_FILE);\n  if (process.env.YTDLP_COOKIES_FROM_BROWSER) extras.push("--cookies-from-browser", process.env.YTDLP_COOKIES_FROM_BROWSER);\n  return [url].concat((0, import_dargs.default)(flags, { useEquals: false }), extras).filter(Boolean);\n}, "args");';
if (corrigido.includes(trechoOriginal)) corrigido = corrigido.replace(trechoOriginal, trechoCorrigido);
if (corrigido !== original) fs.writeFileSync(arquivo, corrigido);
