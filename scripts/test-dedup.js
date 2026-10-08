const { temRepeticaoRecente } = require('../utils/prefix');

let pass = 0;
let fail = 0;

function t(desc, fn) {
  try {
    fn();
    console.log('PASS:', desc);
    pass++;
  } catch (e) {
    console.log('FAIL:', desc, '->', e.message);
    fail++;
  }
}

// 1. Primeira chamada não é repetição
t('primeira chamada não é repetição', () => {
  if (temRepeticaoRecente('dado 1d20')) throw new Error('deveria ser false');
});

// 2. Chamada dentro da janela (1,5s depois) é detectada como repetição rápida
setTimeout(() => {
  t('repetição rápida detectada (1,5s)', () => {
    if (!temRepeticaoRecente('dado 1d20')) throw new Error('deveria ser true');
  });
}, 1500);

// 3. Chamada após a janela expirar (> 5s) não é repetição
setTimeout(() => {
  t('janela expirada (5s+)', () => {
    if (temRepeticaoRecente('dado 1d20')) throw new Error('deveria ser false');
  });
}, 5500);

// 4. Conteúdo diferente não é bloqueado
setTimeout(() => {
  t('conteúdo diferente não é bloqueado', () => {
    if (temRepeticaoRecente('dado 2d6')) throw new Error('deveria ser false');
  });
}, 5500);

setTimeout(() => {
  console.log('\nRESULTADO: ' + pass + ' passos, ' + fail + ' falhas');
  process.exit(fail > 0 ? 1 : 0);
}, 11000);
