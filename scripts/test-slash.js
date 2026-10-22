const assert = require('assert/strict');
const slash = require('../utils/slash');

async function main() {
  const resultado = slash.carregar();
  assert.equal(resultado.invalidos.length, 0, resultado.invalidos.join('\n'));
  assert.equal(slash.comandos.size, 77);

  const payloads = slash.listarJson();
  assert.equal(new Set(payloads.map((item) => item.name)).size, 77);
  assert.ok(payloads.find((item) => item.name === 'join'));
  assert.ok(payloads.find((item) => item.name === 'entrar'));
  assert.ok(payloads.find((item) => item.name === 'configurar').options.some((item) => item.name === 'anuncio'));
  assert.ok(payloads.find((item) => item.name === 'lembrete').options.some((item) => item.name === 'cancelar'));
  assert.deepEqual(slash.validarData(payloads[0]), []);

  let resposta;
  const desconhecido = {
    commandName: 'nao-existe',
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
    replied: false,
    deferred: false,
    reply: async (valor) => { resposta = valor; },
    followUp: async () => {},
    editReply: async () => {},
  };
  assert.equal(await slash.tratar(desconhecido, {}), true);
  assert.equal(resposta.ephemeral, true);

  let autocomplete;
  const auto = {
    commandName: 'ping',
    isChatInputCommand: () => false,
    isAutocomplete: () => true,
    respond: async (valor) => { autocomplete = valor; },
  };
  assert.equal(await slash.tratar(auto, {}), true);
  assert.deepEqual(autocomplete, []);

  const componente = {
    isChatInputCommand: () => false,
    isAutocomplete: () => false,
  };
  assert.equal(await slash.tratar(componente, {}), false);

  let bloqueado;
  const dmSay = {
    commandName: 'say',
    guildId: null,
    member: { permissions: { has: () => true } },
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
    replied: false,
    deferred: false,
    reply: async (valor) => { bloqueado = valor; },
    followUp: async () => {},
    editReply: async () => {},
  };
  assert.equal(await slash.tratar(dmSay, {}), true);
  assert.equal(bloqueado.ephemeral, true);

  let semPermissao;
  const saySemPermissao = {
    ...dmSay,
    guildId: 'guild-1',
    member: { permissions: { has: () => false } },
    reply: async (valor) => { semPermissao = valor; },
  };
  assert.equal(await slash.tratar(saySemPermissao, {}), true);
  assert.equal(semPermissao.ephemeral, true);

  console.log('Slash smoke tests: OK');
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
