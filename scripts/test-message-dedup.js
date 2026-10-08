const assert = require('assert');
const { db, reivindicarMensagem } = require('../utils/db');

const id = `test-${process.pid}-${Date.now()}`;
assert.strictEqual(reivindicarMensagem(id), true, 'a primeira mensagem deve ser aceita');
assert.strictEqual(reivindicarMensagem(id), false, 'a mesma mensagem não deve ser aceita novamente');
assert.strictEqual(reivindicarMensagem(`${id}-outra`), true, 'mensagens diferentes devem ser aceitas');

db.prepare('DELETE FROM mensagens_processadas WHERE message_id IN (?, ?)').run(id, `${id}-outra`);
db.close();
console.log('Deduplicação de mensagens: OK');
