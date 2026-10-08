const fs = require('fs');
const path = require('path');

const arquivo = path.join(__dirname, '..', 'node_modules', '@distube', 'yt-dlp', 'dist', 'index.js');
if (!fs.existsSync(arquivo)) process.exit(0);
const original = fs.readFileSync(arquivo, 'utf8');
const corrigido = original.replace(/\s*noCallHome: true,\n/g, '\n');
if (corrigido !== original) fs.writeFileSync(arquivo, corrigido);
