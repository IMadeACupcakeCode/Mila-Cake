const assert = require('assert');
const { db, reivindicarMensagem, reivindicarComando } = require('../utils/db');

const id = `test-${process.pid}-${Date.now()}`;
assert.strictEqual(reivindicarMensagem(id), true, 'a primeira mensagem deve ser aceita');
assert.strictEqual(reivindicarMensagem(id), false, 'a mesma mensagem não deve ser aceita novamente');
assert.strictEqual(reivindicarMensagem(`${id}-outra`), true, 'mensagens diferentes devem ser aceitas');

const comando = `test-comando-${process.pid}-${Date.now()}`;
assert.strictEqual(reivindicarComando(comando), true, 'o primeiro comando deve ser aceito');
assert.strictEqual(reivindicarComando(comando), false, 'o comando repetido deve ser ignorado');

db.prepare('DELETE FROM mensagens_processadas WHERE message_id IN (?, ?)').run(id, `${id}-outra`);
db.prepare('DELETE FROM comandos_processados WHERE fingerprint = ?').run(comando);
db.close();
console.log('Deduplicação de mensagens: OK');
