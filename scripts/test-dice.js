const assert = require('assert/strict');
const dado = require('../commands/dado');
const { avaliar, formatar } = require('../utils/dice');

const rng = () => 0.5;
const simples = avaliar('1d20+2', rng);
assert.equal(simples.total, 13);
assert.equal(simples.folhas[0].rolagens[0], 11);
assert.match(formatar(simples), /Total/);
assert.match(formatar(simples, true), /Detalhamento/);

const complexo = avaliar('1d20-5+4x6', rng);
assert.equal(complexo.total, 30);
assert.equal(complexo.folhas[0].valor, 11);

const multiplo = avaliar('2d6+1d4', rng);
assert.equal(multiplo.folhas.length, 2);
assert.ok(multiplo.total > 0);

for (const invalido of ['1d20/2', '1d20++2', '1d20--2', '1d20abc', '1d20+', '20', '']) {
  assert.equal(avaliar(invalido, rng), null, `deveria rejeitar ${invalido}`);
}
assert.equal(avaliar('51d6', rng), null);
assert.equal(avaliar('1d1001', rng), null);
assert.equal(avaliar('50d1000', rng) !== null, true);

const payload = dado.data;
assert.ok(payload.options.some((opcao) => opcao.name === 'detalhar' && opcao.type === 5 && opcao.required === false));
console.log('Dice tests: OK');
