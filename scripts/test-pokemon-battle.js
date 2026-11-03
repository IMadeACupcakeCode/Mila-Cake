const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

process.env.MILA_DATABASE_PATH = ':memory:';

const db = require('../utils/db');
const pokemon = require('../utils/pokemon');
const battle = require('../utils/pokemonBattle');
const battleCommand = require('../utils/pokemonBattleCommand');
const command = require('../commands/pokemon');

const userId = '820000000000000001';
const guildId = '820000000000000002';
const opponentId = '820000000000000003';

const moveFixtures = {
  'quick-attack': { type: 'normal', category: 'physical', power: 40, pp: 30, accuracy: 100 },
  'thunder-shock': { type: 'electric', category: 'special', power: 40, pp: 30, accuracy: 100 },
  tackle: { type: 'normal', category: 'physical', power: 40, pp: 35, accuracy: 100 },
  'tail-whip': { type: 'normal', category: 'status', power: 0, pp: 30, accuracy: 100, stat: 'defense', change: -1 },
};

function resposta(payload) {
  return { ok: true, status: 200, json: async () => payload };
}

function pokemonFixture(id = 25) {
  const moves = Object.entries(moveFixtures).map(([name], index) => ({
    move: { name },
    version_group_details: [{
      level_learned_at: [20, 10, 5, 8][index],
      move_learn_method: { name: 'level-up' },
      version_group: { name: 'scarlet-violet' },
    }],
  }));
  return {
    id,
    name: id === 25 ? 'pikachu' : `pokemon-${id}`,
    species: { url: `https://pokeapi.co/api/v2/pokemon-species/${id}` },
    types: [{ slot: 1, type: { name: 'electric' } }],
    stats: [
      { stat: { name: 'hp' }, base_stat: 35 },
      { stat: { name: 'attack' }, base_stat: 55 },
      { stat: { name: 'defense' }, base_stat: 40 },
      { stat: { name: 'special-attack' }, base_stat: 50 },
      { stat: { name: 'special-defense' }, base_stat: 50 },
      { stat: { name: 'speed' }, base_stat: 90 },
    ],
    moves,
    sprites: {
      front_default: 'https://example.test/pikachu.png',
      other: { 'official-artwork': { front_default: 'https://example.test/pikachu-art.png' } },
    },
  };
}

function moveFixture(name) {
  const item = moveFixtures[name];
  return {
    id: 1,
    name,
    names: [{ language: { name: 'pt-br' }, name: name === 'quick-attack' ? 'Ataque Rápido' : name }],
    type: { name: item.type },
    damage_class: { name: item.category },
    power: item.power,
    accuracy: item.accuracy,
    pp: item.pp,
    priority: name === 'quick-attack' ? 1 : 0,
    meta: { ailment: { name: 'none' }, ailment_chance: 0 },
    stat_changes: item.stat ? [{ stat: { name: item.stat }, change: item.change }] : [],
    target: { name: 'selected-pokemon' },
  };
}

function combatente({ pokemonId = 25, tipos = ['electric'], status = null } = {}) {
  const stats = { hp: 140, attack: 90, defense: 80, 'special-attack': 90, 'special-defense': 80, speed: 100 };
  return {
    collectionId: 1,
    pokemonId,
    nome: 'Pikachu',
    shiny: false,
    level: battle.LEVEL_BATALHA,
    tipos,
    stats,
    hp: stats.hp,
    hpMax: stats.hp,
    status,
    sleepTurns: status === 'sleep' ? 1 : 0,
    stages: { attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0, accuracy: 0, evasion: 0 },
    moves: [{
      nome: 'Ataque Rápido',
      nomeOriginal: 'quick-attack',
      tipo: 'normal',
      categoria: 'physical',
      poder: 40,
      precisao: 100,
      pp: 30,
      ppAtual: 30,
      prioridade: 1,
      ailment: 'none',
      ailmentChance: 0,
      statChanges: [],
      alvo: 'selected-pokemon',
    }],
  };
}

async function main() {
  const chamadas = [];
  global.fetch = async (url) => {
    const texto = String(url);
    chamadas.push(texto);
    const moveMatch = texto.match(/\/move\/([^/?]+)/);
    if (moveMatch) return resposta(moveFixture(decodeURIComponent(moveMatch[1])));
    if (texto.includes('/pokemon-species/')) {
      return resposta({
        capture_rate: 190,
        names: [{ language: { name: 'pt-br' }, name: 'Pikachu' }],
      });
    }
    if (texto.includes('/pokemon/')) return resposta(pokemonFixture(25));
    throw new Error(`URL inesperada no teste: ${texto}`);
  };

  const tipoDuplo = battle.multiplicadorTipo('fire', ['grass', 'steel']);
  assert.equal(tipoDuplo, 4, 'efetividade acumula para os dois tipos');
  assert.equal(battle.multiplicadorTipo('electric', ['ground']), 0, 'imunidade de tipo é aplicada');
  assert.equal(battle.multiplicadorEstagio(2), 2, 'estágios positivos aumentam atributos');
  assert.equal(battle.multiplicadorEstagio(-2), 0.5, 'estágios negativos reduzem atributos');

  const especie = await battle.obterEspecieDeBatalha(25);
  assert.equal(especie.nome, 'Pikachu');
  assert.deepEqual(especie.tipos, ['electric']);
  assert.ok(especie.stats.speed > 0);
  assert.ok(chamadas.some((url) => url.includes('/pokemon-species/25')));

  const preparado = await battle.prepararPokemon({
    id: 7,
    pokemon_id: 25,
    name_pt: 'Pikachu',
    shiny: 0,
  });
  assert.equal(preparado.level, 50);
  assert.equal(preparado.pokemonId, 25);
  assert.ok(preparado.hp > 100);
  assert.equal(preparado.moves.length, 4);
  assert.ok(preparado.moves.every((move) => move.ppAtual === move.pp));
  assert.ok(preparado.moves.some((move) => move.nome === 'Ataque Rápido'));
  const equipeDoGinasio = await battle.prepararEquipeDoGinasio('trilha');
  assert.equal(equipeDoGinasio.length, 3, 'a equipe do ginásio é carregada completa');
  assert.deepEqual(equipeDoGinasio.map((item) => item.pokemonId), [25, 133, 143]);

  const fetchDisponivel = global.fetch;
  try {
    global.fetch = async () => { throw new Error('teste: indisponível'); };
    const especieReserva = await battle.obterEspecieDeBatalha(1000);
    const movimentosReserva = await battle.obterMoveset(especieReserva);
    assert.equal(especieReserva.id, 1000, 'dados básicos permitem batalha durante falha da PokéAPI');
    assert.ok(movimentosReserva.length >= 2, 'golpes locais mantêm a batalha jogável sem a PokéAPI');
  } finally {
    global.fetch = fetchDisponivel;
  }

  const ataque = battle.calcularDano(combatente(), combatente({ tipos: ['grass'] }), {
    tipo: 'fire',
    categoria: 'special',
    poder: 50,
  }, () => 0.5);
  assert.ok(ataque.dano > 0);
  assert.equal(ataque.tipo, 2);

  const alvo = combatente({ tipos: ['grass'] });
  const atacante = combatente();
  const resultadoGolpe = battle.resolverGolpe(atacante, alvo, 0, () => 0.5);
  assert.equal(resultadoGolpe.valido, true);
  assert.ok(alvo.hp < alvo.hpMax);
  assert.equal(atacante.moves[0].ppAtual, 29, 'o golpe consome PP no combatente que o usou');

  const dormindo = combatente({ status: 'sleep' });
  const despertar = battle.iniciarTurno(dormindo, () => 0.5);
  assert.equal(despertar.podeAgir, true);
  assert.equal(dormindo.status, null);
  const paralisado = combatente({ status: 'paralysis' });
  assert.equal(battle.iniciarTurno(paralisado, () => 0).podeAgir, false);
  const envenenado = combatente({ status: 'poison' });
  const hpAnterior = envenenado.hp;
  assert.ok(battle.fimDeTurno(envenenado).length);
  assert.ok(envenenado.hp < hpAnterior);
  const imuneQueimadura = combatente({ tipos: ['fire'] });
  imuneQueimadura.moves = [{
    nome: 'Brasa',
    tipo: 'normal',
    categoria: 'status',
    poder: 0,
    precisao: 100,
    pp: 10,
    ppAtual: 10,
    ailment: 'burn',
    ailmentChance: 100,
    statChanges: [],
    alvo: 'selected-pokemon',
  }];
  battle.resolverGolpe(combatente(), imuneQueimadura, 0, () => 0.5);
  assert.equal(imuneQueimadura.status, null, 'Pokémon de fogo não recebem queimadura');

  const database = db.db;
  const inserir = database.prepare(`
    INSERT INTO pokemon_collection
      (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id)
    VALUES (?, ?, ?, ?, ?, 0, 50, ?, 'pokebola')
  `);
  for (let index = 0; index < 60; index += 1) {
    inserir.run(userId, guildId, 25, 'pikachu', 'Pikachu', index + 1);
  }
  const colecao = pokemon.listarColecao(userId, 250);
  assert.equal(colecao.pokemon.length, 60, 'a seleção permite navegar por mais de 50 capturas');
  const equipe = await battle.prepararEquipeDoUsuario(userId, [colecao.pokemon[0].id], 1);
  assert.equal(equipe.length, 1);
  assert.equal(equipe[0].pokemonId, 25);

  inserir.run(opponentId, guildId, 25, 'pikachu', 'Pikachu', 100);
  const challenger = { id: userId, username: 'Teste', globalName: 'Treinador Teste', bot: false };
  const opponent = { id: opponentId, username: 'Rival', bot: false };
  const client = {
    users: { cache: new Map([[userId, challenger], [opponentId, opponent]]) },
  };
  let mensagemPublica = null;
  const message = {
    edit: async (payload) => {
      mensagemPublica = payload;
      return message;
    },
  };
  const ctx = {
    isSlash: true,
    guildId,
    channelId: '820000000000000004',
    user: challenger,
    client,
    interaction: {
      reply: async (payload) => { mensagemPublica = payload; },
      fetchReply: async () => message,
    },
  };
  await battleCommand.iniciarDuelo(ctx, opponent, 1);
  let idSessao = mensagemPublica.components[0].toJSON().components[0].custom_id.split(':')[1];
  const simularInteracao = (customId, user, extras = {}) => ({
    customId,
    user,
    ...extras,
  });
  const conferirIdsComponentes = (payload) => {
    const ids = payload.components.flatMap((row) => row.toJSON().components.map((item) => item.custom_id));
    assert.equal(new Set(ids).size, ids.length, 'cada componente da mensagem tem custom_id único');
  };
  conferirIdsComponentes(mensagemPublica);
  await battleCommand.tratarComponente(simularInteracao(`pb:${idSessao}:accept`, opponent, {
    update: async (payload) => { mensagemPublica = payload; },
  }));
  conferirIdsComponentes(mensagemPublica);
  async function prepararEquipe(user, jogador) {
    const abrirId = mensagemPublica.components
      .flatMap((row) => row.toJSON().components)
      .find((item) => item.custom_id === `pb:${idSessao}:open-picker:${jogador}`).custom_id;
    let seletor = null;
    await battleCommand.tratarComponente(simularInteracao(abrirId, user, {
      reply: async (payload) => { seletor = payload; },
    }));
    conferirIdsComponentes(seletor);
    const selecionarId = seletor.components
      .flatMap((row) => row.toJSON().components)
      .find((item) => item.custom_id.includes(`pb:${idSessao}:pick:`)).custom_id;
    await battleCommand.tratarComponente(simularInteracao(selecionarId, user, {
      update: async (payload) => { seletor = { ...seletor, ...payload }; },
    }));
    const confirmarId = seletor.components
      .flatMap((row) => row.toJSON().components)
      .find((item) => item.custom_id === `pb:${idSessao}:team-done`).custom_id;
    await battleCommand.tratarComponente(simularInteracao(confirmarId, user, {
      deferUpdate: async () => {},
      editReply: async () => {},
    }));
    assert.ok(battleCommand.internals.sessions.get(idSessao).teams.has(jogador));
  }
  await prepararEquipe(challenger, userId);
  await prepararEquipe(opponent, opponentId);
  assert.equal(battleCommand.internals.sessions.get(idSessao).status, 'battle');
  assert.ok(mensagemPublica.embeds[0].data.description.includes('Turno 1'));
  conferirIdsComponentes(mensagemPublica);
  async function escolherGolpe(user) {
    let menu = null;
    await battleCommand.tratarComponente(simularInteracao(`pb:${idSessao}:action:${user.id}`, user, {
      reply: async (payload) => { menu = payload; },
    }));
    const escolha = menu.components[0].toJSON().components[0].options[0].value;
    await battleCommand.tratarComponente(simularInteracao(`pb:${idSessao}:choose`, user, {
      values: [escolha],
      update: async () => {},
    }));
  }
  const batalhaAtiva = battleCommand.internals.sessions.get(idSessao);
  const hpInicialChallenger = batalhaAtiva.teams.get(userId)[0].hp;
  const hpInicialOpponent = batalhaAtiva.teams.get(opponentId)[0].hp;
  await escolherGolpe(challenger);
  await escolherGolpe(opponent);
  assert.equal(batalhaAtiva.turns, 1, 'o turno só resolve depois das escolhas dos dois jogadores');
  assert.ok(batalhaAtiva.teams.get(userId)[0].hp < hpInicialChallenger);
  assert.ok(batalhaAtiva.teams.get(opponentId)[0].hp < hpInicialOpponent);
  await battleCommand.tratarComponente(simularInteracao(`pb:${idSessao}:forfeit`, challenger, {
    deferUpdate: async () => {},
  }));
  assert.equal(battleCommand.internals.sessions.has(idSessao), false, 'desistência encerra e libera os participantes');

  const trilha = battle.GYMS.find((gym) => gym.id === 'trilha');
  assert.ok(trilha.pokemonPermitidos.length >= 5, 'o desafio exige uma lista concreta de espécies');
  const conquista = battle.registrarVitoriaGinasio(userId, 'trilha', [{ pokemonId: 25 }], 1_700_000_000_000);
  assert.equal(conquista.ok, true);
  assert.equal(conquista.nova, true);
  assert.equal(battle.registrarVitoriaGinasio(userId, 'trilha', [{ pokemonId: 25 }], 1_700_000_000_001).nova, false);
  assert.equal(battle.registrarVitoriaGinasio(userId, 'trilha', [{ pokemonId: 6 }]).ok, false);
  assert.equal(battle.listarInsignias(userId).filter((item) => item.obtida).length, 1);

  battle.registrarResultado({
    guildId,
    modo: 'duelo',
    jogador1: userId,
    jogador2: '820000000000000003',
    vencedorId: userId,
    tamanho: 1,
    turnos: 3,
    now: 1_700_000_000_000,
  });
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM pokemon_battle_results').get().total, 2);

  await battleCommand.iniciarGinasio(ctx, 'trilha', 2);
  idSessao = mensagemPublica.components[0].toJSON().components[0].custom_id.split(':')[1];
  const botaoAbrirGinasio = mensagemPublica.components
    .flatMap((row) => row.toJSON().components)
    .find((item) => item.custom_id === `pb:${idSessao}:open-picker:${userId}`);
  let seletorGinasio = null;
  await battleCommand.tratarComponente(simularInteracao(botaoAbrirGinasio.custom_id, challenger, {
    reply: async (payload) => { seletorGinasio = payload; },
  }));
  const escolhasGinasio = seletorGinasio.components
    .flatMap((row) => row.toJSON().components)
    .filter((item) => item.custom_id.includes(`pb:${idSessao}:pick:`))
    .slice(0, 2);
  assert.equal(escolhasGinasio.length, 2);
  for (const escolha of escolhasGinasio) {
    await battleCommand.tratarComponente(simularInteracao(escolha.custom_id, challenger, {
      update: async (payload) => { seletorGinasio = { ...seletorGinasio, ...payload }; },
    }));
  }
  const confirmarGinasio = seletorGinasio.components
    .flatMap((row) => row.toJSON().components)
    .find((item) => item.custom_id === `pb:${idSessao}:team-done`);
  await battleCommand.tratarComponente(simularInteracao(confirmarGinasio.custom_id, challenger, {
    deferUpdate: async () => {},
    editReply: async () => {},
  }));
  const sessaoGinasio = battleCommand.internals.sessions.get(idSessao);
  assert.equal(sessaoGinasio.status, 'battle', 'confirmação da equipe inicia a batalha do ginásio');
  assert.equal(sessaoGinasio.teams.get(sessaoGinasio.npcId).length, 3, 'a equipe do líder é carregada no fluxo do ginásio');
  await battleCommand.tratarComponente(simularInteracao(`pb:${idSessao}:forfeit`, challenger, {
    deferUpdate: async () => {},
  }));
  assert.equal(battleCommand.internals.sessions.has(idSessao), false, 'encerrar o ginásio libera a sessão do treinador');
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM pokemon_battle_results').get().total, 3);

  const subcommands = command.data.options.map((option) => option.name);
  assert.ok(subcommands.includes('duelo'));
  assert.ok(subcommands.includes('ginasio'));
  assert.ok(subcommands.includes('insignias'));
  const ginasioChoices = command.data.options.find((option) => option.name === 'ginasio').options[0].choices;
  assert.equal(ginasioChoices.length, battle.GYMS.length);
  assert.ok(command.internals.helpEmbed().data.fields.some((field) => field.name.includes('Batalhas')));
  const prefixDuel = command.internals.opcoesPrefixo('duelo', ['3'], {
    mentions: { users: { first: () => opponent } },
  });
  assert.equal(prefixDuel.usuario.id, opponentId);
  assert.equal(prefixDuel.tamanho, 3);
  assert.equal(command.internals.opcoesPrefixo('ginasio', ['trilha', '4'], { mentions: {} }).desafio, 'trilha');
  let insigniasPayload = null;
  const badgeCollector = new EventEmitter();
  const badgeMessage = {
    createMessageComponentCollector: () => badgeCollector,
    edit: async () => {},
  };
  await battleCommand.listarInsigniasCommand({
    user: { id: userId, username: 'Teste' },
    isSlash: false,
    reply: async (payload) => { insigniasPayload = payload; return badgeMessage; },
  });
  assert.ok(insigniasPayload.embeds[0].data.description.includes(`1/${battle.GYMS.length} conquistadas`));
  assert.equal(insigniasPayload.components[0].toJSON().components[1].label, 'Próximo');
  let paginaInsignias;
  await badgeCollector.listeners('collect')[0]({
    customId: 'pokemon_insignias_proxima',
    user: { id: userId },
    update: async (payload) => { paginaInsignias = payload; },
  });
  assert.ok(paginaInsignias.embeds[0].data.description.includes('página 2/2'));

  console.log('✅ Batalhas Pokémon: cálculo, status, equipes, ginásios, insígnias e comandos validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
