// Smoke test dos fluxos interativos da Mila Arcade sem abrir o Discord.
// Usa uma mensagem/interação falsas para garantir que os embeds e animações
// são construídos sem exceções e que os collectors são registrados.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ARCADO = path.join(__dirname, '..', 'data', 'arcade.json');
const backup = fs.existsSync(ARCADO) ? fs.readFileSync(ARCADO, 'utf-8') : null;

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function fakeUser(id = '111111111111111111', username = 'Tester') {
  return {
    id,
    username,
    bot: false,
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
  };
}

function fakeMessage() {
  const msg = {
    id: 'msg-teste',
    edits: [],
    interactions: [],
    lastCollector: null,
    lastPayload: null,
    guerraUser: null,
    async edit(payload) {
      this.edits.push(payload);
      this.lastPayload = payload;
      return this;
    },
    async awaitMessageComponent() {
      if (this.interactions.length) return this.interactions.shift();

      // Auto-piloto do treino da Guerra de Cartas: desiste no primeiro turno
      // humano para testar tabuleiro, render e finalização sem jogar 15 turnos.
      const ids = [];
      for (const row of this.lastPayload?.components || []) {
        for (const botao of row.components || []) {
          const dados = botao.data || botao;
          if (!dados.disabled && dados.custom_id) ids.push(dados.custom_id);
        }
      }
      if (this.guerraUser && ids.includes('guerra_render')) {
        const msg = this;
        return {
          customId: 'guerra_render',
          user: this.guerraUser,
          updated: null,
          replied: null,
          async update(payload) {
            this.updated = payload;
            msg.lastPayload = payload;
            msg.edits.push(payload);
          },
          async reply(payload) { this.replied = payload; },
          async deferUpdate() {},
        };
      }
      throw new Error('timeout simulado');
    },
    createMessageComponentCollector() {
      const handlers = {};
      const coletor = {
        handlers,
        stopped: null,
        on(event, fn) {
          handlers[event] = fn;
          return this;
        },
        stop(reason) {
          this.stopped = reason;
          return handlers.end ? handlers.end(new Map(), reason) : undefined;
        },
      };
      this.lastCollector = coletor;
      return coletor;
    },
  };
  return msg;
}

function fakeInteraction({ user = fakeUser(), options = {}, client = null, channel = null } = {}) {
  const msg = fakeMessage();
  return {
    user,
    client: client || {
      user: fakeUser('999999999999999999', 'Mila'),
      ws: { ping: 42 },
      guilds: { cache: { size: 2 } },
      users: { cache: { size: 7 } },
    },
    channel: channel || { sendTyping: async () => {} },
    guildId: '123',
    options: {
      getString: (n) => (options[n] != null ? String(options[n]) : null),
      getBoolean: (n) => (options[n] != null ? Boolean(options[n]) : null),
      getInteger: (n) => (options[n] != null ? Number(options[n]) : null),
      getUser: (n) => options[n] || null,
    },
    replied: false,
    deferred: false,
    async reply(payload) {
      this.replied = true;
      this.replyPayload = payload;
      return msg;
    },
    async followUp(payload) {
      this.followUpPayload = payload;
      return fakeMessage();
    },
    async editReply(payload) {
      this.editReplyPayload = payload;
      return msg;
    },
    async deferReply() {
      this.deferred = true;
      return msg;
    },
    message: null,
    _guerraArgs: [],
    _guerraMention: null,
    _msg: msg,
  };
}

const testes = [];
function teste(nome, fn) {
  testes.push({ nome, fn });
}

teste('moeda: aposta, giro e resultado', async () => {
  const mod = require('../commands/moeda');
  const i = fakeInteraction();
  const aposta = {
    customId: 'moeda_cara',
    user: i.user,
    updated: null,
    async update(payload) { this.updated = payload; },
    async reply() {},
    async deferUpdate() {},
  };
  i._msg.interactions.push(aposta);
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i.replyPayload.embeds.length);
  assert.ok(i.replyPayload.components.length);
  assert.ok(aposta.updated, 'o clique deveria atualizar a mensagem');
  assert.ok(i._msg.edits.length >= 4, 'deveria animar o giro e mostrar o resultado');
  assert.ok(i._msg.edits.some((e) => e.embeds?.[0]?.data?.title?.includes('acertou') || e.embeds?.[0]?.data?.title?.includes('Não foi')));
});

teste('dado: animação + resultado', async () => {
  const mod = require('../commands/dado');
  const i = fakeInteraction({ options: { notacao: '1d20+2', detalhar: true } });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i._msg.edits.length >= 4, 'deveria animar e mostrar o resultado');
  assert.ok(i._msg.edits.some((e) => e.embeds?.[0]?.data?.title?.includes('Resultado')));
});

teste('8ball: consulta + resposta', async () => {
  const mod = require('../commands/eightball');
  const i = fakeInteraction({ options: { pergunta: 'Vai dar certo?' } });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i._msg.edits.length >= 4);
  const final = i._msg.edits[i._msg.edits.length - 2] || i._msg.edits[i._msg.edits.length - 1];
  assert.ok(final.embeds?.[0]);
});

teste('roleta: giro + resultado', async () => {
  const mod = require('../commands/roleta');
  const i = fakeInteraction({ options: { opcoes: 'pizza, sushi, hambúrguer' } });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i._msg.edits.length >= 5);
});

teste('ship: cálculo + resultado', async () => {
  const mod = require('../commands/ship');
  const i = fakeInteraction({
    options: {
      usuario1: fakeUser('111111111111111111', 'Ana'),
      usuario2: fakeUser('222222222222222222', 'Bia'),
    },
  });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i._msg.edits.length >= 3);
  const final = i._msg.edits[i._msg.edits.length - 1];
  assert.ok(final.embeds?.[0]);
});

teste('roleta_russa: início + collector', async () => {
  const mod = require('../commands/roleta_russa');
  const i = fakeInteraction({ user: fakeUser('333333333333333333', 'Russo') });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i.replyPayload.embeds.length);
  assert.ok(i.replyPayload.components.length);
});

teste('votar: voto atualiza barras e encerramento', async () => {
  const mod = require('../commands/votar');
  const i = fakeInteraction({ options: { pergunta: 'Qual jogo?', opcoes: 'Minecraft, Valorant', duracao: '10m' } });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i._msg.lastCollector);

  const coletor = i._msg.lastCollector;
  const botao = {
    customId: 'votar_0',
    user: i.user,
    updated: null,
    replied: null,
    async update(payload) { this.updated = payload; },
    async reply(payload) { this.replied = payload; },
    async deferUpdate() {},
  };
  await coletor.handlers.collect(botao);
  assert.ok(botao.updated, 'o voto deveria atualizar a mensagem');

  const fechar = {
    customId: 'votar_encerrar',
    user: i.user,
    replied: null,
    async update() {},
    async reply(payload) { this.replied = payload; },
    async deferUpdate() {},
  };
  await coletor.handlers.collect(fechar);
  await new Promise((resolve) => setTimeout(resolve, 2600));
  assert.ok(i._msg.edits.length >= 4, 'o encerramento deveria animar a contagem');
  const final = i._msg.edits[i._msg.edits.length - 1];
  assert.ok(final.embeds?.[0]);
});

teste('status: embed com métricas', async () => {
  const mod = require('../commands/status');
  const i = fakeInteraction();
  await mod.execute(i, i.client);
  assert.ok(i.replied);
  assert.ok(i.replyPayload.embeds[0].data.fields.length >= 3);
});

teste('guerra: manual + collector', async () => {
  const mod = require('../commands/guerra');
  const i = fakeInteraction({ options: { sub: 'manual' } });
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i.replyPayload.embeds.length);
  assert.ok(i.replyPayload.components.length);
  assert.ok(i._msg.lastCollector);
});

teste('guerra: treino, tabuleiro, render e final', async () => {
  const mod = require('../commands/guerra');
  const i = fakeInteraction({
    user: fakeUser('444444444444444444', 'Treinador'),
    options: { sub: 'treino' },
  });
  i._msg.guerraUser = i.user;
  await mod.execute(i);
  assert.ok(i.replied);
  assert.ok(i._msg.edits.length >= 6, 'deveria animar abertura, tabuleiro e final');
  assert.ok(
    i._msg.edits.some((e) => String(e.embeds?.[0]?.data?.title || '').includes('Guerra de Cartas')),
    'deveria renderizar o tabuleiro'
  );
  assert.ok(
    i._msg.edits.some((e) => String(e.embeds?.[0]?.data?.description || '').includes('Modo treino')),
    'deveria indicar que o treino não alterou o placar'
  );
});

(async () => {
  let falhas = 0;
  for (const { nome, fn } of testes) {
    try {
      await fn();
      console.log(`✓ ${nome}`);
    } catch (erro) {
      falhas += 1;
      console.error(`✗ ${nome}`);
      console.error(erro);
    }
  }

  if (backup == null) {
    try { fs.rmSync(ARCADO, { force: true }); } catch {}
  } else {
    fs.writeFileSync(ARCADO, backup, 'utf-8');
  }

  console.log(`\n${testes.length - falhas}/${testes.length} testes de UI passaram.`);
  if (falhas) process.exitCode = 1;
})();
