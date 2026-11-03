// Testes do sistema de rinha, vida/status e níveis selvagens.
const assert = require('node:assert/strict');

process.env.MILA_DATABASE_PATH = ':memory:';

const db = require('../utils/db');
const pokemon = require('../utils/pokemon');
const rinha = require('../utils/rinha');

const guildId = '830000000000000001';
const donoId = '830000000000000002';
const rivalId = '830000000000000003';

function inserirCaptura(userId, nome, level = 50) {
  const resultado = db.db.prepare(`
    INSERT INTO pokemon_collection
      (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id)
    VALUES (?, ?, 25, 'pikachu', ?, 0, ?, ?, 'pokebola')
  `).run(String(userId), guildId, nome, level, Date.now());
  return Number(resultado.lastInsertRowid);
}

function combatente(collectionId, nome) {
  return {
    collectionId,
    pokemonId: 25,
    nome,
    level: 50,
    tipos: ['electric'],
    stats: { hp: 120, attack: 80, defense: 70, 'special-attack': 80, 'special-defense': 70, speed: 90 },
    hp: 120,
    hpMax: 120,
    status: null,
    sleepTurns: 0,
    stages: { attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0, accuracy: 0, evasion: 0 },
    moves: [],
  };
}

async function main() {
  // ── Nível selvagem entre 1 e 100, com bônus de raridade ──
  const niveis = [];
  for (let i = 0; i < 200; i += 1) {
    const nivel = pokemon.sortearNivelSelvagem({ captureRate: 255 });
    niveis.push(nivel);
    assert.ok(nivel >= 1 && nivel <= 100, `nível selvagem dentro de 1..100 (recebido ${nivel})`);
  }
  assert.ok(new Set(niveis).size > 20, 'níveis selvagens variam entre encontros');
  const raro = pokemon.sortearNivelSelvagem({ captureRate: 3 }, () => 0);
  const comum = pokemon.sortearNivelSelvagem({ captureRate: 255 }, () => 0);
  assert.ok(raro > comum, 'espécies raras tendem a níveis maiores');

  // ── Vida e status persistem ──
  const capturaId = inserirCaptura(donoId, 'Pikachu do Dono', 50);
  const captura = db.db.prepare('SELECT * FROM pokemon_collection WHERE id = ?').get(capturaId);
  const vidaCheia = pokemon.estadoVidaPokemon(captura, { stats: { hp: 35, attack: 55, defense: 40, speed: 90 } });
  assert.equal(vidaCheia.hp, vidaCheia.hpMax, 'captura nova começa com a vida cheia');
  assert.equal(vidaCheia.status, null, 'captura nova começa sem status');

  const salvo = pokemon.salvarVidaPokemon(donoId, capturaId, { hp: 5, status: 'poison', statusTurns: 0 });
  assert.equal(salvo.ok, true);
  const capturaFerida = db.db.prepare('SELECT * FROM pokemon_collection WHERE id = ?').get(capturaId);
  const vidaFerida = pokemon.estadoVidaPokemon(capturaFerida, { stats: { hp: 35, attack: 55, defense: 40, speed: 90 } });
  assert.equal(vidaFerida.hp, 5, 'HP salvo é lido de volta');
  assert.equal(vidaFerida.statusNome, 'Envenenado', 'status salvo é lido de volta');
  assert.equal(vidaFerida.desmaiado, false);

  pokemon.salvarVidaPokemon(donoId, capturaId, { hp: 0, status: null });
  const desmaiado = pokemon.estadoVidaPokemon(
    db.db.prepare('SELECT * FROM pokemon_collection WHERE id = ?').get(capturaId),
    { stats: { hp: 35, attack: 55, defense: 40, speed: 90 } }
  );
  assert.equal(desmaiado.desmaiado, true, 'HP zero marca o Pokémon como desmaiado');

  // ── Apostas: contra humano, Pokémon derrotado pode ser transferido ──
  const perdido = inserirCaptura(donoId, 'Pikachu Perdido', 50);
  const apostaHumana = rinha.resolverApostas({
    timePerdedor: [{ ...combatente(perdido, 'Pikachu Perdido'), hp: 0 }],
    vencedorId: rivalId,
    contraBot: false,
    tamanho: 1,
    random: () => 0.1,
  });
  assert.equal(apostaHumana.transferidos, 1, 'Pokémon derrotado é transferido ao vencedor humano');
  const donoAtual = db.db.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(perdido);
  assert.equal(String(donoAtual.user_id), rivalId, 'a troca de dono é persistida');

  // ── Apostas: contra o bot, nada é transferido ──
  const preservado = inserirCaptura(donoId, 'Pikachu Preservado', 50);
  const apostaBot = rinha.resolverApostas({
    timePerdedor: [{ ...combatente(preservado, 'Pikachu Preservado'), hp: 0 }],
    vencedorId: donoId,
    contraBot: true,
    tamanho: 1,
    random: () => 0.1,
  });
  assert.equal(apostaBot.transferidos, 0, 'o bot nunca recebe Pokémon');
  const donoPreservado = db.db.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(preservado);
  assert.equal(String(donoPreservado.user_id), donoId, 'Pokémon continua com o treinador após perder para o bot');

  // ── Time de 7 inteiro pode ser perdido ──
  const time = [];
  for (let i = 0; i < 7; i += 1) {
    const id = inserirCaptura(donoId, `Time ${i + 1}`, 50);
    const lutador = combatente(id, `Time ${i + 1}`);
    lutador.hp = 0;
    time.push(lutador);
  }
  const apostaTime = rinha.resolverApostas({
    timePerdedor: time,
    vencedorId: rivalId,
    contraBot: false,
    tamanho: 7,
    random: () => 0,
  });
  assert.equal(apostaTime.timeInteiroPerdido, true, 'time inteiro derrotado pode ser perdido por completo');
  assert.equal(apostaTime.transferidos, 7, 'todos os Pokémon do time passam ao vencedor');

  // ── Simulação de rinha não trava e encerra ──
  const simulacao = rinha.simularRinha(
    [{ ...combatente(1, 'A'), moves: [{ nome: 'Tackle', tipo: 'normal', categoria: 'physical', poder: 40, precisao: 100, ppAtual: 35, prioridade: 0, alvo: 'selected-pokemon', ailment: null, ailmentChance: 0, statChanges: [] }] }],
    [{ ...combatente(2, 'B'), moves: [{ nome: 'Tackle', tipo: 'normal', categoria: 'physical', poder: 40, precisao: 100, ppAtual: 35, prioridade: 0, alvo: 'selected-pokemon', ailment: null, ailmentChance: 0, statChanges: [] }] }]
  );
  assert.ok(['A', 'B', 'empate'].includes(simulacao.vencedor));
  assert.ok(simulacao.log.length > 0, 'a rinha produz um log de golpes');

  console.log('✅ Rinha Pokémon: níveis selvagens, vida/status e apostas validados.');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
