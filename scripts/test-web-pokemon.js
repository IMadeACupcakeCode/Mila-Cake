const assert = require('node:assert/strict');

process.env.MILA_DATABASE_PATH = ':memory:';

const { criarServidor } = require('../web/server');
const database = require('../utils/db').db;

const userId = '800000000000001101';
const guildId = '800000000000001102';
const user = {
  id: userId,
  username: 'testtrainer',
  globalName: 'Test Trainer',
  displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/test.png',
};
const guild = {
  id: guildId,
  name: 'Servidor de teste',
  members: { cache: new Map([[userId, { user }]]) },
};
const client = {
  users: {
    cache: new Map([[userId, user]]),
    fetch: async (id) => (id === userId ? user : null),
  },
  guilds: { cache: new Map([[guildId, guild]]) },
};

async function main() {
  database.prepare(`
    INSERT INTO pokemon_species_cache (pokemon_id, payload, cached_at)
    VALUES (?, ?, ?)
  `).run(25, JSON.stringify({
    id: 25,
    name: 'pikachu',
    namePt: 'Pikachu',
    captureRate: 190,
    types: ['electric'],
    imageUrl: 'https://example.com/pikachu.png',
    shinyImageUrl: 'https://example.com/pikachu-shiny.png',
    animatedUrl: null,
  }), Date.now());

  const servidor = criarServidor(client);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const endereco = servidor.address();
  const base = `http://127.0.0.1:${endereco.port}`;
  const get = async (rota) => {
    const resposta = await fetch(`${base}${rota}`);
    return { resposta, dados: await resposta.json() };
  };

  try {
    const perfilEconomia = await get('/api/perfil?username=%40TESTTRAINER');
    assert.equal(perfilEconomia.resposta.status, 200);
    assert.equal(perfilEconomia.dados.usuario.username, 'testtrainer');

    const usernameInexistente = await get('/api/perfil?username=unknowntrainer');
    assert.equal(usernameInexistente.resposta.status, 404);

    const servidores = await get('/api/pokemon/servidores');
    assert.equal(servidores.dados.servidores[0].id, guildId);

    const loja = await get('/api/pokemon/loja');
    assert.ok(loja.dados.categorias.some((categoria) => categoria.itens.some((item) => item.id === 'masterball')));

    const pokedex = await get('/api/pokemon/info?pokemon=25');
    assert.equal(pokedex.resposta.status, 200);
    assert.equal(pokedex.dados.pokemon.namePt, 'Pikachu');

    const buscaPokedexInvalida = await get('/api/pokemon/info?pokemon=%2Fetc%2Fpasswd');
    assert.equal(buscaPokedexInvalida.resposta.status, 400);

    const rankingGlobal = await get('/api/pokemon/ranking?escopo=global');
    assert.equal(rankingGlobal.resposta.status, 200);
    assert.equal(rankingGlobal.dados.escopo, 'global');

    const rankingServidor = await get(`/api/pokemon/ranking?escopo=servidor&servidor=${guildId}`);
    assert.equal(rankingServidor.resposta.status, 200);
    assert.equal(rankingServidor.dados.servidor.id, guildId);

    const perfilPokemon = await get(`/api/pokemon/perfil?username=testtrainer&servidor=${guildId}`);
    assert.equal(perfilPokemon.resposta.status, 200);
    assert.equal(perfilPokemon.dados.perfil.global.total, 0);
    assert.equal(perfilPokemon.dados.perfil.servidor.total, 0);
    assert.ok(Array.isArray(perfilPokemon.dados.missoes));
    assert.ok(Array.isArray(perfilPokemon.dados.colecao));
    assert.ok(Array.isArray(perfilPokemon.dados.insignias));
    assert.equal(perfilPokemon.dados.insignias.length, 8);
    assert.ok(perfilPokemon.dados.insignias.every((insignia) => insignia.pokemonPermitidosNomes));

    const perfilGlobal = await get('/api/pokemon/perfil?username=testtrainer');
    assert.equal(perfilGlobal.resposta.status, 200);
    assert.equal(perfilGlobal.dados.servidor, null);
    assert.equal(perfilGlobal.dados.perfil.favorites.length, 0);

    const pagina = await fetch(`${base}/pokemon`);
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /Mila Pokémon/);

    console.log('Testes do site Pokémon concluídos.');
  } finally {
    await new Promise((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve()));
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
