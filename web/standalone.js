// web/standalone.js
// ── Site da Mila sem o bot ────────────────────────────────────────────
// Útil para testar o visual, hospedar só o site ou abrir o painel antes de
// ligar o Discord. Usa o mesmo banco (data/mila.db) e as mesmas regras.
//
//   npm run web            → http://localhost:3000
//   npm run web -- 8080    → outra porta
//
// Variáveis: WEB_PORT, WEB_HOST, MILA_SITE_URL

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { criarServidor } = require('./server');

const porta = Math.max(1, Number(process.argv[2]) || Number(process.env.WEB_PORT) || 3000);
const host = process.env.WEB_HOST || '0.0.0.0';

const servidor = criarServidor(null);

servidor.on('error', (erro) => {
  if (erro?.code === 'EADDRINUSE') {
    console.error(`❌ A porta ${porta} já está em uso. Rode: npm run web -- 3001`);
    process.exit(1);
  }
  console.error('❌ Não consegui subir o site:', erro?.message || erro);
  process.exit(1);
});

servidor.listen(porta, host, () => {
  const publico = process.env.WEB_PUBLIC_URL || `http://localhost:${porta}`;
  console.log(`🌐 Site da Mila no ar em ${publico} (host ${host}:${porta})`);
  console.log('   Páginas: /  ·  API: /api/status  ·  Saúde: /health');
});
