const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

process.env.MILA_DATABASE_PATH = ':memory:';
process.env.CRIADOR_IDS = '800000000000001007';

const db = require('../utils/db');
const pokemon = require('../utils/pokemon');
const criador = require('../utils/criador');

const guildId = '800000000000001001';
const otherGuildId = '800000000000001006';
const missionGuildId = '800000000000001010';
const channelId = '800000000000001002';
const otherChannelId = '800000000000001003';
const userId = '800000000000001004';
const otherUserId = '800000000000001005';
const ownerUserId = '800000000000001007';
const impostorUserId = '800000000000001008';
const missionUserId = '800000000000001009';

function limpar() {
  const database = db.db;
  database.prepare('DELETE FROM pokemon_favorites WHERE guild_id = ?').run(guildId);
  database.prepare('DELETE FROM pokemon_favorites WHERE guild_id = ?').run(otherGuildId);
  database.prepare('DELETE FROM pokemon_collection WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM pokemon_inventory WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM pokemon_user_preferences WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM pokemon_mission_claims WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM pokemon_encounters WHERE guild_id = ?').run(guildId);
  database.prepare('DELETE FROM pokemon_encounters WHERE guild_id = ?').run(otherGuildId);
  database.prepare('DELETE FROM pokemon_encounters WHERE guild_id = ?').run(missionGuildId);
  database.prepare('DELETE FROM pokemon_spawn_state WHERE guild_id = ?').run(guildId);
  database.prepare('DELETE FROM pokemon_spawn_state WHERE guild_id = ?').run(otherGuildId);
  database.prepare('DELETE FROM pokemon_spawn_state WHERE guild_id = ?').run(missionGuildId);
  database.prepare('DELETE FROM pokemon_server_config WHERE guild_id = ?').run(guildId);
  database.prepare('DELETE FROM pokemon_server_config WHERE guild_id = ?').run(otherGuildId);
  database.prepare('DELETE FROM pokemon_server_config WHERE guild_id = ?').run(missionGuildId);
  database.prepare('DELETE FROM inventario WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM transacoes WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM conquistas WHERE user_id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
  database.prepare('DELETE FROM usuarios WHERE id IN (?, ?, ?, ?, ?)').run(userId, otherUserId, ownerUserId, impostorUserId, missionUserId);
}

function pokemonTeste() {
  return {
    id: 25,
    name: 'pikachu',
    namePt: 'Pikachu',
    captureRate: 190,
    types: ['electric'],
    imageUrl: 'https://example.com/pikachu.png',
    animatedUrl: 'https://example.com/pikachu.gif',
    shiny: false,
  };
}

async function main() {
  limpar();
  try {
    assert.equal(pokemon.obterConfig(guildId).enabled, false, 'encontros começam desativados');
    const config = pokemon.salvarConfig(guildId, {
      enabled: true,
      spawnChance: 8,
      cooldownMs: 120_000,
      channels: [channelId],
    });
    assert.equal(config.enabled, true);
    assert.deepEqual(config.channels, [channelId]);
    assert.throws(() => pokemon.salvarConfig(guildId, { spawnChance: 101 }), RangeError);
    assert.equal(
      pokemon.reivindicarTentativaSpawn(guildId, otherChannelId, 0, { now: 1_000_000, random: () => 0 }),
      false,
      'canal fora da lista não gera encontro'
    );
    assert.equal(
      pokemon.reivindicarTentativaSpawn(guildId, channelId, 0, { now: 1_000_000, random: () => 0 }),
      true,
      'canal permitido pode gerar encontro'
    );
    assert.equal(
      pokemon.reivindicarTentativaSpawn(guildId, channelId, 0, { now: 1_000_001, random: () => 0 }),
      false,
      'cooldown impede encontros repetidos'
    );

    const pikachu = pokemonTeste();
    assert.equal(pokemon.alterarFavorito(guildId, userId, 'adicionar', pikachu).ok, true);
    assert.deepEqual(
      { ping: pokemon.obterPreferencias(userId).pingEnabled, favoritos: pokemon.obterPreferencias(userId).favoriteAlerts },
      { ping: false, favoritos: false },
      'pings e alertas de favoritos começam desativados'
    );
    assert.deepEqual(pokemon.obterUsuariosParaAviso(guildId, pikachu.id), [], 'pings começam desligados');
    pokemon.salvarPreferencias(userId, { pingEnabled: true, favoriteAlerts: true });
    assert.deepEqual(pokemon.obterUsuariosParaAviso(guildId, pikachu.id), [userId], 'alerta só menciona usuário opt-in');
    pokemon.salvarPreferencias(otherUserId, { pingEnabled: true, favoriteAlerts: false });
    pokemon.alterarFavorito(guildId, otherUserId, 'adicionar', pikachu);
    assert.deepEqual(pokemon.obterUsuariosParaAviso(guildId, pikachu.id), [userId], 'preferência de favoritos também é respeitada');

    db.addAcucares(userId, 10_000);
    const greatBall = pokemon.comprar(userId, 'greatball');
    assert.equal(greatBall.ok, true, 'compra debita a economia e entrega item');
    assert.equal(pokemon.equiparItem(userId, 'greatball').ok, true);
    assert.equal(pokemon.comprar(userId, 'incenso').ok, true);
    assert.equal(pokemon.comprar(userId, 'moldura_morango').ok, true);
    assert.equal(pokemon.equiparItem(userId, 'moldura_morango').ok, true);

    const encounterTime = Date.now();
    pokemon.registrarEncontro(guildId, channelId, pikachu, 'message-1', encounterTime);
    assert.equal(pokemon.capturar(guildId, otherChannelId, userId).motivo, 'canal_errado');
    assert.equal(pokemon.capturar(guildId, channelId, userId, 'eevee').motivo, 'nome_errado');
    const escapou = pokemon.capturar(guildId, channelId, userId, '', { now: encounterTime + 1, random: () => 0.999 });
    assert.equal(escapou.motivo, 'escapou');
    assert.ok(pokemon.obterEncontro(guildId, encounterTime + 2), 'falha não remove o encontro');

    const captura = pokemon.capturar(guildId, channelId, userId, 'Pikachu', { now: encounterTime + 3, random: () => 0 });
    assert.equal(captura.ok, true);
    assert.equal(captura.ball.id, 'greatball');
    assert.equal(captura.cosmetic.id, 'moldura_morango');
    assert.equal(pokemon.obterEncontro(guildId, encounterTime + 4), null, 'captura bem-sucedida encerra o encontro');
    assert.equal(pokemon.listarColecao(userId).total, 1);
    assert.equal(pokemon.listarColecao(userId).species, 1);
    assert.equal(pokemon.obterInventario(userId).itens.find((item) => item.id === 'greatball'), undefined, 'bola usada é consumida');

    const compraLote = pokemon.comprarLote(userId, [
      { itemId: 'greatball', quantidade: 2 },
      { itemId: 'ultraball', quantidade: 1 },
    ]);
    assert.equal(compraLote.ok, true, 'carrinho Pokémon compra vários itens em uma operação');
    const saldoAposLote = db.getUsuario(userId).acucares;
    const loteSemSaldo = pokemon.comprarLote(userId, [{ itemId: 'beastball', quantidade: 99 }]);
    assert.equal(loteSemSaldo.motivo, 'sem_saldo', 'checkout valida saldo para todo o carrinho');
    assert.equal(db.getUsuario(userId).acucares, saldoAposLote, 'carrinho recusado não debita saldo parcialmente');

    const bolasEsperadas = [
      'pokebola', 'greatball', 'ultraball', 'masterball', 'safariball', 'netball',
      'diveball', 'nestball', 'repeatball', 'timerball', 'luxuryball', 'premierball',
      'duskball', 'healball', 'quickball', 'cherishball', 'fastball', 'levelball',
      'lureball', 'heavyball', 'loveball', 'friendball', 'moonball', 'sportball',
      'dreamball', 'beastball', 'parkball', 'strangeball', 'featherball', 'wingball',
      'jetball', 'leadenball', 'gigatonball', 'originball',
    ];
    for (const id of bolasEsperadas) {
      assert.ok(pokemon.buscarItem(id), `catálogo inclui ${id}`);
      assert.ok(pokemon.buscarItem(id).preco > 0, `${id} tem preço positivo`);
    }

    assert.equal(criador.ehCriador(ownerUserId), true);
    const inserirArceus = db.db.prepare(`
      INSERT INTO pokemon_collection
        (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id)
      VALUES (?, ?, 493, 'arceus', 'Arceus', 0, 1, ?, 'pokebola')
    `);
    inserirArceus.run(impostorUserId, guildId, encounterTime);
    inserirArceus.run(ownerUserId, guildId, encounterTime + 1);
    inserirArceus.run(ownerUserId, otherGuildId, encounterTime + 2);
    const arceus = pokemon.garantirArceusDoCriador(ownerUserId, encounterTime + 3);
    assert.equal(arceus.ok, true, 'criador recebe Arceus automaticamente');
    const arceusRows = db.db.prepare('SELECT user_id, guild_id, ball_id FROM pokemon_collection WHERE pokemon_id = 493').all();
    assert.deepEqual(arceusRows, [{ user_id: ownerUserId, guild_id: null, ball_id: 'masterball' }], 'Arceus é único, global e registrado como capturado com Master Ball');
    assert.equal(pokemon.garantirArceusDoCriador(ownerUserId).collectionId, arceus.collectionId, 'sincronizar novamente não duplica Arceus');
    assert.equal(pokemon.obterPerfil(ownerUserId, guildId).arceusExclusivo, true, 'perfil do dono exibe Arceus em qualquer servidor');
    assert.equal(pokemon.obterPerfil(impostorUserId, guildId).arceusExclusivo, false, 'outros perfis não recebem Arceus');
    assert.throws(() => pokemon.registrarEncontro(guildId, channelId, { ...pikachu, id: pokemon.ARCEUS_ID }), RangeError, 'Arceus não aparece em encontros');

    const missaoNow = Date.now();
    const inserirCaptura = db.db.prepare(`
      INSERT INTO pokemon_collection
        (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, 'pokebola')
    `);
    for (let index = 1; index <= 30; index += 1) {
      const id = 100 + index;
      inserirCaptura.run(missionUserId, missionGuildId, id, `species-${id}`, `Espécie ${id}`, missaoNow);
    }
    const missoes = pokemon.listarMissoes(missionUserId, missaoNow);
    assert.equal(missoes.find((item) => item.id === 'capturas-trinta').progresso, 30, 'missões contam capturas válidas e ignoram o Arceus global');
    for (const missionId of ['primeira-captura', 'colecao-cinco', 'capturas-dez', 'capturas-trinta', 'capturas-diarias-tres']) {
      const resgate = pokemon.reivindicarMissao(missionUserId, missionId, missaoNow);
      assert.equal(resgate.ok, true, `${missionId} entrega sua Pokébola`);
      assert.equal(pokemon.reivindicarMissao(missionUserId, missionId, missaoNow).motivo, 'ja_resgatada', `${missionId} só pode ser resgatada uma vez por período`);
    }
    assert.ok(pokemon.obterInventario(missionUserId).itens.some((item) => item.id === 'masterball'), 'missão de 30 capturas recompensa uma Master Ball');
    assert.equal(pokemon.equiparItem(missionUserId, 'masterball').ok, true);
    pokemon.registrarEncontro(missionGuildId, channelId, pikachu, 'message-masterball', missaoNow + 1);
    const capturaMasterball = pokemon.capturar(missionGuildId, channelId, missionUserId, 'Pikachu', {
      now: missaoNow + 2,
      random: () => 0.999,
    });
    assert.equal(capturaMasterball.ok, true, 'Master Ball garante a captura');
    assert.equal(capturaMasterball.ball.id, 'masterball');

    const incenso = pokemon.usarItem(userId, 'incenso', 3_000_000);
    assert.equal(incenso.ok, true);
    assert.equal(incenso.expiresAt, 3_000_000 + pokemon.INCENSO_MS);
    assert.equal(pokemon.reivindicarTentativaSpawn(guildId, channelId, incenso.expiresAt, { now: 3_100_000, random: () => 0 }), true, 'incenso mantém o sistema de encontros funcional');

    const command = require('../commands/pokemon');
    let prefixReply = null;
    await command.executePrefix(
      {
        author: { id: userId, username: 'Teste' },
        guildId,
        channelId,
        member: {},
        reply: async (payload) => { prefixReply = payload; },
      },
      ['manual'],
      { user: { id: '800000000000001099' } }
    );
    const prefixEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(prefixEmbed?.title?.includes('Manual'), 'manual completo está disponível por prefixo');
    assert.ok(prefixEmbed?.fields?.some((field) => field.name.includes('Como capturar')), 'manual cobre as regras de captura');
    assert.ok(prefixEmbed?.fields?.some((field) => field.name.includes('Loja')), 'manual cobre os itens e a loja');
    assert.ok(prefixEmbed?.fields?.some((field) => field.name.includes('Missões')), 'manual explica as missões');

    const userView = { id: userId, username: 'Teste', displayAvatarURL: () => 'https://example.com/user.png' };
    const catalog = command.internals.montarLojaEmbed({
      user: userView,
      categoria: 'todas',
      saldo: 10000,
      selecionado: null,
      carrinho: new Map(),
    }).toJSON();
    assert.ok(catalog.title.includes('Loja Pokémon'));
    assert.ok(catalog.fields.some((field) => field.value.includes('Master Ball')));
    const shopControls = command.internals.montarLojaComponentes({
      categoria: 'todas',
      selecionado: null,
      carrinho: new Map(),
    }).map((row) => row.toJSON());
    assert.equal(shopControls.length, 4, 'loja Pokémon separa categorias, item, carrinho e checkout');
    assert.equal(shopControls[0].components[0].options.length, pokemon.CATEGORIAS.length + 1);
    for (const categoria of pokemon.CATEGORIAS) {
      const controls = command.internals.montarLojaComponentes({
        categoria: categoria.id,
        selecionado: null,
        carrinho: new Map(),
      }).map((row) => row.toJSON());
      assert.equal(controls[1].components[0].options.length, pokemon.listarCategorias().find((item) => item.id === categoria.id).itens.length);
    }

    const shopCollector = new EventEmitter();
    shopCollector.stop = (reason) => shopCollector.emit('end', [], reason);
    let shopReply;
    const shopMessage = {
      createMessageComponentCollector: () => shopCollector,
      edit: async (payload) => { shopReply = payload; },
    };
    const shopInteraction = {
      user: userView,
      guildId,
      channelId,
      member: {},
      options: { getSubcommand: () => 'loja', getString: () => null },
      reply: async (payload) => {
        shopReply = payload;
        return shopMessage;
      },
    };
    await command.execute(shopInteraction, { user: { displayAvatarURL: () => 'https://example.com/mila.png' } });
    assert.equal(shopReply.ephemeral, true, 'loja interativa é privada no slash');
    const interagirComLoja = async (customId, values = []) => {
      let updated;
      await shopCollector.listeners('collect')[0]({
        customId,
        values,
        user: userView,
        replied: false,
        deferred: false,
        update: async (payload) => { updated = payload; },
        reply: async () => {},
      });
      shopReply = updated;
      return updated;
    };
    await interagirComLoja('pokemon_loja_categoria', ['situacionais']);
    await interagirComLoja('pokemon_loja_item', ['quickball']);
    await interagirComLoja('pokemon_loja_adicionar');
    const reciboPokemon = await interagirComLoja('pokemon_loja_finalizar');
    assert.ok(reciboPokemon.embeds[0].toJSON().title.includes('Pedido Pokémon confirmado'));
    assert.equal(reciboPokemon.components.length, 0, 'checkout encerra a loja e remove os controles');

    const missionView = { ...userView, id: missionUserId };
    const missionCards = command.internals.montarMissoesEmbed(missionView, missaoNow, 'capturas-trinta').toJSON();
    assert.ok(missionCards.title.includes('Missões'));
    assert.equal(command.internals.montarMissoesComponentes(missionUserId, missaoNow, 'capturas-trinta').length, 2);

    const channelCache = new Map([
      [channelId, { id: channelId, name: 'pokemon-geral', type: 0 }],
      [otherChannelId, { id: otherChannelId, name: '✨|pokemon-teste', type: 0 }],
    ]);
    const channelMessage = {
      author: { id: userId, username: 'Teste' },
      guildId,
      guild: { channels: { cache: channelCache } },
      channelId: otherChannelId,
      channel: channelCache.get(otherChannelId),
      member: { permissions: { has: () => true } },
      mentions: { channels: { first: () => null }, users: { first: () => null } },
      reply: async (payload) => { prefixReply = payload; },
    };
    await command.executePrefix(channelMessage, ['canal', '✨|pokemon-teste'], { user: { id: '800000000000001099' } });
    let channelEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(channelEmbed?.description?.includes('Canal adicionado'), 'nome de canal sozinho é aceito como atalho para adicionar');
    assert.ok(pokemon.obterConfig(guildId).channels.includes(otherChannelId), 'canal é resolvido pelo nome exato');

    await command.executePrefix(channelMessage, ['canal', 'remover', '✨|pokemon-teste'], { user: { id: '800000000000001099' } });
    channelEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(channelEmbed?.description?.includes('Canal removido'), 'remoção confirma a alteração real');
    assert.ok(!pokemon.obterConfig(guildId).channels.includes(otherChannelId));

    await command.executePrefix(channelMessage, ['canal', 'adicionar'], { user: { id: '800000000000001099' } });
    assert.ok(pokemon.obterConfig(guildId).channels.includes(otherChannelId), 'canal atual é o padrão ao adicionar sem alvo');
    await command.executePrefix(channelMessage, ['canal'], { user: { id: '800000000000001099' } });
    channelEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(channelEmbed?.description?.includes(`<#${channelId}>`) && channelEmbed.description.includes(`<#${otherChannelId}>`), 'canal sem ação lista a configuração atual');

    await command.executePrefix(channelMessage, ['configurar', 'chance', 'abc'], { user: { id: '800000000000001099' } });
    channelEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(channelEmbed?.title?.includes('Chance inválida'), 'valor de configuração inválido recebe orientação em vez de erro genérico');

    pokemon.registrarEncontro(guildId, channelId, pikachu, 'message-2');
    let capturaNatural = null;
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      await pokemon.processarMensagem({
        guild: { id: guildId },
        author: { id: otherUserId, bot: false, toString: () => `<@${otherUserId}>` },
        content: 'Pikachu',
        channelId,
        reply: async (payload) => { capturaNatural = payload; },
      });
    } finally {
      Math.random = originalRandom;
    }
    const naturalCaptureEmbed = capturaNatural?.embeds?.[0]?.toJSON?.() || capturaNatural?.embeds?.[0];
    assert.ok(naturalCaptureEmbed?.title?.includes('capturado'), 'palpite natural captura o Pokémon');
    assert.equal(pokemon.listarColecao(otherUserId).total, 1);

    const profile = pokemon.obterPerfil(userId, guildId);
    assert.equal(profile.global.total, 1);
    assert.equal(profile.servidor.total, 1);
    assert.ok(profile.globalPosition > 0, 'posição global é calculada');
    assert.equal(profile.guildPosition, 1);
    assert.equal(pokemon.rankingServidor(guildId).find((entry) => entry.user_id === userId)?.total, 1);
    assert.equal(pokemon.obterPerfil(userId, otherGuildId).servidor.total, 0, 'capturas não vazam entre rankings de servidores');
    assert.equal(pokemon.rankingServidor(otherGuildId).length, 0);

    await command.executePrefix(channelMessage, ['perfil'], { user: { id: '800000000000001099' } });
    let responseEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(responseEmbed?.title?.includes('Perfil Pokémon'), 'perfil próprio está disponível');
    assert.ok(responseEmbed?.fields?.some((field) => field.name.includes('Coleção global')), 'perfil mostra estatísticas globais');
    channelMessage.mentions.users.first = () => ({ id: otherUserId, username: 'Outro', displayAvatarURL: () => null });
    await command.executePrefix(channelMessage, ['perfil', `<@${otherUserId}>`], { user: { id: '800000000000001099' } });
    channelMessage.mentions.users.first = () => null;
    responseEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(responseEmbed?.description?.includes(`<@${otherUserId}>`), 'perfil de outra pessoa pode ser consultado no servidor');

    await command.executePrefix(channelMessage, ['ranking'], { user: { id: '800000000000001099' } });
    responseEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(responseEmbed?.title?.includes('Servidor'), 'ranking padrão é do servidor');
    await command.executePrefix(channelMessage, ['ranking', 'global'], { user: { id: '800000000000001099' } });
    responseEmbed = prefixReply?.embeds?.[0]?.toJSON?.() || prefixReply?.embeds?.[0];
    assert.ok(responseEmbed?.title?.includes('Global'), 'ranking global pode ser selecionado');

    const speciesCache = db.db.prepare('SELECT payload, cached_at FROM pokemon_species_cache WHERE pokemon_id = 1').get();
    const bulbasaur = {
      id: 1,
      name: 'bulbasaur',
      namePt: 'Bulbasaur',
      captureRate: 45,
      types: ['grass', 'poison'],
      imageUrl: 'https://example.com/bulbasaur.png',
      shinyImageUrl: 'https://example.com/bulbasaur-shiny.png',
      animatedUrl: null,
    };
    db.db.prepare(`
      INSERT INTO pokemon_species_cache (pokemon_id, payload, cached_at)
      VALUES (1, ?, ?)
      ON CONFLICT(pokemon_id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at
    `).run(JSON.stringify(bulbasaur), Date.now());
    let spawnPayload = null;
    const originalSpawnRandom = Math.random;
    Math.random = () => 0;
    try {
      await pokemon.processarMensagem({
        guild: { id: guildId },
        author: { id: userId, bot: false },
        content: 'Oi, Mila!',
        channelId,
        channel: { send: async (payload) => { spawnPayload = payload; return { id: 'spawned-message' }; } },
      });
    } finally {
      Math.random = originalSpawnRandom;
      if (speciesCache) {
        db.db.prepare(`
          INSERT INTO pokemon_species_cache (pokemon_id, payload, cached_at)
          VALUES (1, ?, ?)
          ON CONFLICT(pokemon_id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at
        `).run(speciesCache.payload, speciesCache.cached_at);
      } else {
        db.db.prepare('DELETE FROM pokemon_species_cache WHERE pokemon_id = 1').run();
      }
    }
    assert.ok(spawnPayload?.embeds?.[0]?.title?.includes('Pokémon'), 'mensagem elegível gera e publica um encontro');
    assert.equal(pokemon.obterEncontro(guildId)?.id, 1, 'encontro publicado fica disponível para captura');

    const commandLoader = require('../utils/slash').carregar();
    assert.equal(commandLoader.invalidos.some((entry) => entry.includes('pokemon.js')), false);
    assert.ok(commandLoader.comandos.has('pokemon'));
    const commandData = commandLoader.comandos.get('pokemon').json;
    assert.ok(commandData.options.some((option) => option.name === 'configurar'), 'a configuração está registrada como subcomando slash');
    assert.ok(commandData.options.some((option) => option.name === 'manual'), 'manual está registrado como slash');
    assert.ok(commandData.options.some((option) => option.name === 'perfil'), 'perfil está registrado como slash');
    assert.ok(commandData.options.some((option) => option.name === 'ranking'), 'rankings estão registrados como slash');
    assert.ok(commandData.options.some((option) => option.name === 'missoes'), 'missões estão registradas como slash');
    assert.equal(commandData.options.find((option) => option.name === 'comprar').options[0].choices, undefined, 'catálogo completo não excede o limite de opções do Discord');
    assert.ok(commandData.options.length <= 25, 'o número de subcomandos respeita o limite do Discord');
    assert.ok(commandData.options.every((option) => option.description.length <= 100), 'as descrições respeitam o limite do Discord');

    const { publicarComando } = require('../utils/discordCommandDeploy');
    const deploymentCalls = [];
    const rest = {
      get: async (route) => {
        deploymentCalls.push(['get', route]);
        return route.includes('guilds')
          ? [{ id: 'existing-guild-command', name: 'pokemon' }]
          : [{ id: 'other-global-command', name: 'ping' }];
      },
      patch: async (route, payload) => deploymentCalls.push(['patch', route, payload.body.name]),
      post: async (route, payload) => deploymentCalls.push(['post', route, payload.body.name]),
    };
    const globalDeployment = await publicarComando(rest, { applicationId: 'app-id', data: commandData });
    const guildDeployment = await publicarComando(rest, { applicationId: 'app-id', guildId: guildId, data: commandData });
    assert.equal(globalDeployment.action, 'created', 'comando novo é publicado sem substituir o conjunto existente');
    assert.equal(guildDeployment.action, 'updated', 'comando existente é atualizado por sua rota individual');
    assert.deepEqual(deploymentCalls.map(([method]) => method), ['get', 'post', 'get', 'patch']);
    assert.ok(deploymentCalls[1][1].includes('applications/app-id/commands'), 'registro global usa POST de um comando');
    assert.ok(deploymentCalls[3][1].includes(`guilds/${guildId}/commands/existing-guild-command`), 'registro de servidor atualiza somente o comando alvo');

    const commandModule = require('../commands/pokemon');
    const styled = commandModule.internals.embed('Teste visual', 'Descrição decorada', 0x123456, null, 'Rodapé temático', null, [
      { name: 'Campo', value: 'Detalhes' },
    ]).toJSON();
    assert.ok(styled.title.startsWith('✦'), 'embed usa o título padrão da Mila');
    assert.ok(styled.description.includes('｡ﾟ✧'), 'embed usa divisores decorativos da Mila');
    assert.equal(styled.footer.text, 'Rodapé temático');
    assert.equal(styled.fields[0].name, 'Campo');
    console.log('✅ Sistema Pokémon: configuração, canais, alertas, loja, uso de itens e captura validados.');
  } finally {
    limpar();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
