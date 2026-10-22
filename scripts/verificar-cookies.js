// Diagnóstico dos cookies do yt-dlp.
//
// Uso: npm run cookies
//
// Mostra quais navegadores foram encontrados, qual o bot escolheu e por que os
// outros foram descartados. É o mesmo caminho usado em produção — se aparece
// "sessão logada" aqui, o YouTube vai tocar sem bloqueio anti-bot.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { detectar, montarCandidatos, ARQUIVO_SNAPSHOT, lerCookies } = require('../utils/cookiesNavegador');

(async () => {
  console.log('⋆｡°✩ Diagnóstico de cookies do yt-dlp\n');

  const candidatos = montarCandidatos();
  if (!candidatos.length) {
    console.log('Nenhum navegador suportado com banco de cookies foi encontrado.');
    console.log('Instale Brave, Edge, Zen, Chrome ou Firefox e abra o YouTube nele uma vez.');
    process.exitCode = 1;
    return;
  }

  console.log('Navegadores com banco de cookies:');
  for (const candidato of candidatos) {
    console.log(`  • ${candidato.rotulo} — perfil "${candidato.perfil}"${candidato.aberto ? ' (aberto agora)' : ''}`);
  }
  console.log('');

  const resultado = await detectar({ forcar: true });

  if (!resultado) {
    console.log('❌ Nenhum navegador entregou cookies utilizáveis.');
    console.log('   Dicas: deixe o navegador logado no YouTube; feche o navegador e rode de novo');
    console.log('   se a mensagem citar banco travado; ou exporte um cookies.txt.');
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Escolhido: ${resultado.rotulo}${resultado.aberto ? ' (estava aberto)' : ''}`);
  console.log(`   Cookies: ${resultado.cookies ?? lerCookies(ARQUIVO_SNAPSHOT).total} (YouTube: ${resultado.youtube ?? '?'})`);
  console.log(`   Sessão: ${resultado.logado ? 'logada' : 'anônima (pode cair em bloqueio anti-bot)'}`);
  console.log(`   Snapshot: ${ARQUIVO_SNAPSHOT}`);

  if (resultado.falhas?.length) {
    console.log('\nDescartados:');
    for (const falha of resultado.falhas) console.log(`  • ${falha}`);
  }
})();
