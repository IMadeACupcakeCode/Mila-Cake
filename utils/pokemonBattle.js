const db = require('./db');
const pokemon = require('./pokemon');

const database = db.db;
const API_BASE = 'https://pokeapi.co/api/v2';
const API_TIMEOUT_MS = 10_000;
const MISSINGNO_ID = 9001;
const CUSTOM_SPECIES = {
  [MISSINGNO_ID]: {
    id: MISSINGNO_ID,
    nome: 'MissingNo.',
    nomeOriginal: 'missingno',
    tipos: ['normal', 'flying'],
    stats: { hp: 33, attack: 136, defense: 0, 'special-attack': 6, 'special-defense': 6, speed: 29 },
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/archive/6/62/20140124140453%21MissingNo.png',
    animatedUrl: null,
    moves: [
      { name: 'gaster-blaster', level: 1 },
      { name: 'command-block', level: 1 },
      { name: 'mordida-de-87', level: 1 },
      { name: 'slenderman', level: 1 },
    ],
  },
};

const CUSTOM_MOVES = {
  'gaster-blaster': { id: 9001, nome: 'Gaster Blaster', nomeOriginal: 'gaster-blaster', tipo: 'dark', categoria: 'special', poder: 120, precisao: 90, pp: 5, prioridade: 0, ailment: 'none', ailmentChance: 0, statChanges: [], alvo: 'selected-pokemon' },
  'command-block': { id: 9002, nome: 'Command Block', nomeOriginal: 'command-block', tipo: 'psychic', categoria: 'special', poder: 100, precisao: 100, pp: 10, prioridade: 0, ailment: 'none', ailmentChance: 0, statChanges: [], alvo: 'selected-pokemon' },
  'mordida-de-87': { id: 9003, nome: 'Mordida de 87', nomeOriginal: 'mordida-de-87', tipo: 'dark', categoria: 'physical', poder: 87, precisao: 95, pp: 15, prioridade: 0, ailment: 'none', ailmentChance: 0, statChanges: [], alvo: 'selected-pokemon' },
  'slenderman': { id: 9004, nome: 'Slenderman', nomeOriginal: 'slenderman', tipo: 'ghost', categoria: 'status', poder: 0, precisao: 100, pp: 5, prioridade: 0, ailment: 'none', ailmentChance: 0, statChanges: [{ stat: 'defense', change: -1 }, { stat: 'evasion', change: -1 }], alvo: 'selected-pokemon' },
};
const MAX_TIME = 6;
const MAX_TURNS = 80;
const STATUS_VALIDOS = new Set(['burn', 'poison', 'paralysis', 'sleep', 'freeze']);
const STATUS_NOMES = {
  burn: 'queimadura',
  poison: 'veneno',
  paralysis: 'paralisia',
  sleep: 'sono',
  freeze: 'congelamento',
};

const GYMS = [
  {
    id: 'trilha',
    nome: 'Insígnia da Trilha',
    lider: 'Nina',
    lema: 'Uma equipe vence quando aprende a trabalhar junto.',
    pokemonPermitidos: [25, 39, 54, 133, 175, 16],
    pokemonPermitidosNomes: 'Pikachu, Jigglypuff, Psyduck, Eevee, Togepi ou Pidgey',
    equipe: [25, 133, 143],
  },
  {
    id: 'estrategia',
    nome: 'Insígnia da Estratégia',
    lider: 'Dante',
    lema: 'Leia o campo antes de escolher seu próximo passo.',
    pokemonPermitidos: [6, 94, 143, 212, 282, 448],
    pokemonPermitidosNomes: 'Charizard, Gengar, Snorlax, Scizor, Gardevoir ou Lucario',
    equipe: [26, 197, 58],
  },
  {
    id: 'jornada',
    nome: 'Insígnia da Jornada',
    lider: 'Luma',
    lema: 'Adapte sua estratégia ao que a aventura trouxer.',
    pokemonPermitidos: [130, 260, 445, 470, 658, 700],
    pokemonPermitidosNomes: 'Gyarados, Swampert, Garchomp, Leafeon, Greninja ou Sylveon',
    equipe: [130, 658, 470],
  },
  {
    id: 'precisao',
    nome: 'Insígnia da Precisão',
    lider: 'Íris',
    lema: 'Um movimento certeiro pode mudar toda a batalha.',
    pokemonPermitidos: [65, 212, 282, 359, 448, 658],
    pokemonPermitidosNomes: 'Alakazam, Scizor, Gardevoir, Absol, Lucario ou Greninja',
    equipe: [94, 282, 700],
  },
  {
    id: 'equilibrio',
    nome: 'Insígnia do Equilíbrio',
    lider: 'Caio',
    lema: 'Força e defesa precisam caminhar lado a lado.',
    pokemonPermitidos: [3, 6, 9, 149, 248, 376],
    pokemonPermitidosNomes: 'Venusaur, Charizard, Blastoise, Dragonite, Tyranitar ou Metagross',
    equipe: [149, 248, 376],
  },
  {
    id: 'coragem',
    nome: 'Insígnia da Coragem',
    lider: 'Maya',
    lema: 'A coragem também é saber quando trocar de Pokémon.',
    pokemonPermitidos: [59, 130, 150, 196, 282, 448],
    pokemonPermitidosNomes: 'Arcanine, Gyarados, Mewtwo, Espeon, Gardevoir ou Lucario',
    equipe: [6, 229, 212],
  },
  {
    id: 'convergencia',
    nome: 'Insígnia da Convergência',
    lider: 'Theo',
    lema: 'Conhecimento, ritmo e criatividade vencem juntos.',
    pokemonPermitidos: [94, 149, 150, 282, 658, 700],
    pokemonPermitidosNomes: 'Gengar, Dragonite, Mewtwo, Gardevoir, Greninja ou Sylveon',
    equipe: [150, 149, 94],
  },
  {
    id: 'mila',
    nome: 'Insígnia da Mila',
    lider: 'Mila',
    lema: 'A equipe precisa de estratégia, confiança e um toque de sorte.',
    pokemonPermitidos: [25, 94, 133, 143, 149, 448],
    pokemonPermitidosNomes: 'Pikachu, Gengar, Eevee, Snorlax, Dragonite ou Lucario',
    equipe: [658, 700, 448],
  },
];

let sql;

database.exec(`
  CREATE TABLE IF NOT EXISTS pokemon_battle_species_cache (
    pokemon_id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pokemon_battle_move_cache (
    move_name TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pokemon_battle_badges (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, badge_id)
  );
  CREATE TABLE IF NOT EXISTS pokemon_battle_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    player1_id TEXT NOT NULL,
    player2_id TEXT,
    winner_id TEXT,
    gym_id TEXT,
    team_size INTEGER NOT NULL,
    turns INTEGER NOT NULL,
    finished_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pokemon_battle_results_guild ON pokemon_battle_results(guild_id, finished_at DESC);
`);

sql = {
  species: database.prepare('SELECT payload FROM pokemon_battle_species_cache WHERE pokemon_id = ?'),
  cacheSpecies: database.prepare(`
    INSERT INTO pokemon_battle_species_cache (pokemon_id, payload, cached_at)
    VALUES (?, ?, ?)
    ON CONFLICT(pokemon_id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at
  `),
  move: database.prepare('SELECT payload FROM pokemon_battle_move_cache WHERE move_name = ?'),
  cacheMove: database.prepare(`
    INSERT INTO pokemon_battle_move_cache (move_name, payload, cached_at)
    VALUES (?, ?, ?)
    ON CONFLICT(move_name) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at
  `),
  badges: database.prepare('SELECT badge_id, earned_at FROM pokemon_battle_badges WHERE user_id = ? ORDER BY earned_at, badge_id'),
  awardBadge: database.prepare(`
    INSERT OR IGNORE INTO pokemon_battle_badges (user_id, badge_id, earned_at)
    VALUES (?, ?, ?)
  `),
  result: database.prepare(`
    INSERT INTO pokemon_battle_results
      (guild_id, mode, player1_id, player2_id, winner_id, gym_id, team_size, turns, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
};

async function buscarJson(url) {
  if (typeof fetch !== 'function') throw new Error('Batalhas Pokémon exigem Node.js com fetch global.');
  const resposta = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!resposta.ok) throw new Error(`PokéAPI respondeu HTTP ${resposta.status}.`);
  return resposta.json();
}

async function comLimite(valores, limite, executar) {
  const resultados = new Array(valores.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(limite, valores.length) }, async () => {
    while (proximo < valores.length) {
      const indice = proximo;
      proximo += 1;
      resultados[indice] = await executar(valores[indice], indice);
    }
  }));
  return resultados;
}

function localizarGrupoDeMovimentos(pokemonData) {
  const gruposPreferidos = [
    'scarlet-violet',
    'brilliant-diamond-and-shining-pearl',
    'sword-shield',
    'ultra-sun-ultra-moon',
    'sun-moon',
    'omega-ruby-alpha-sapphire',
    'x-y',
    'black-white',
  ];
  const gruposDisponiveis = new Set(
    pokemonData.moves.flatMap((item) => item.version_group_details.map((detalhe) => detalhe.version_group.name))
  );
  return gruposPreferidos.find((grupo) => gruposDisponiveis.has(grupo)) || null;
}

function listarMovimentosAprendidos(pokemonData) {
  const grupo = localizarGrupoDeMovimentos(pokemonData);
  const movimentos = new Map();
  for (const item of pokemonData.moves) {
    const detalhes = item.version_group_details.filter((detalhe) =>
      detalhe.move_learn_method.name === 'level-up' &&
      (!grupo || detalhe.version_group.name === grupo) &&
      detalhe.level_learned_at <= LEVEL_BATALHA
    );
    if (!detalhes.length) continue;
    const nivel = Math.max(...detalhes.map((detalhe) => detalhe.level_learned_at));
    movimentos.set(item.move.name, { name: item.move.name, level: nivel });
  }
  if (!movimentos.size) {
    for (const item of pokemonData.moves.slice(0, 12)) {
      movimentos.set(item.move.name, { name: item.move.name, level: 1 });
    }
  }
  return Array.from(movimentos.values()).sort((a, b) => b.level - a.level);
}

async function obterDetalheMovimento(nome) {
  if (CUSTOM_MOVES[nome]) return { ...CUSTOM_MOVES[nome] };
  const emCache = sql.move.get(nome);
  if (emCache) return JSON.parse(emCache.payload);
  if (!/^[a-z0-9-]+$/.test(nome)) throw new TypeError('Nome de movimento inválido recebido da PokéAPI.');
  const dados = await buscarJson(`${API_BASE}/move/${encodeURIComponent(nome)}`);
  const detalhes = {
    id: dados.id,
    nome: dados.names?.find((item) => ['pt-br', 'pt'].includes(item.language?.name))?.name || dados.name.replace(/-/g, ' '),
    nomeOriginal: dados.name,
    tipo: dados.type?.name || 'normal',
    categoria: dados.damage_class?.name || 'status',
    poder: Number(dados.power) || 0,
    precisao: Number(dados.accuracy) || 100,
    pp: Math.max(1, Number(dados.pp) || 1),
    prioridade: Number(dados.priority) || 0,
    ailment: dados.meta?.ailment?.name || 'none',
    ailmentChance: Math.max(0, Number(dados.meta?.ailment_chance) || 0),
    statChanges: (dados.stat_changes || []).map((item) => ({
      stat: item.stat?.name,
      change: Number(item.change) || 0,
    })),
    alvo: dados.target?.name || 'selected-pokemon',
  };
  sql.cacheMove.run(nome, JSON.stringify(detalhes), Date.now());
  return detalhes;
}

function temEfeitoUtil(movimento) {
  return movimento.poder > 0 ||
    (STATUS_VALIDOS.has(movimento.ailment) && movimento.ailmentChance > 0) ||
    movimento.statChanges.some((item) => item.change !== 0);
}

async function obterEspecieDeBatalha(id) {
  const pokemonId = Number(id);
  if (CUSTOM_SPECIES[pokemonId]) {
    return { ...CUSTOM_SPECIES[pokemonId] };
  }
  if (!Number.isInteger(pokemonId) || pokemonId < 1 || pokemonId > pokemon.MAX_POKEMON_ID) {
    throw new RangeError('Espécie Pokémon fora do intervalo suportado.');
  }
  const cache = sql.species.get(pokemonId);
  if (cache) return JSON.parse(cache.payload);

  let dadosPokemon;
  let dadosPublicos;
  try {
    [dadosPokemon, dadosPublicos] = await Promise.all([
      buscarJson(`${API_BASE}/pokemon/${pokemonId}`),
      pokemon.obterPokemon(String(pokemonId)),
    ]);
  } catch (erro) {
    dadosPublicos = await pokemon.obterPokemon(String(pokemonId));
    console.warn(`[Pokémon] PokéAPI indisponível para #${pokemonId}; usando dados básicos de batalha:`, erro?.message || erro);
    const types = dadosPublicos?.types?.length ? dadosPublicos.types : ['normal'];
    const especieFallback = {
      id: pokemonId,
      nome: dadosPublicos?.namePt || `Pokémon #${pokemonId}`,
      nomeOriginal: dadosPublicos?.name || `pokemon-${pokemonId}`,
      tipos: types,
      stats: {
        hp: 65,
        attack: 65,
        defense: 65,
        'special-attack': 65,
        'special-defense': 65,
        speed: 65,
      },
      imageUrl: dadosPublicos?.imageUrl || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
      animatedUrl: dadosPublicos?.animatedUrl || (pokemonId <= 649
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokemonId}.gif`
        : null),
      moves: [{ name: 'tackle', level: 1 }, { name: 'quick-attack', level: 1 }],
    };
    return especieFallback;
  }
  if (!dadosPublicos) {
    dadosPublicos = {
      name: dadosPokemon.name,
      namePt: dadosPokemon.name,
      types: (dadosPokemon.types || []).map((item) => item.type.name),
      imageUrl: dadosPokemon.sprites?.other?.['official-artwork']?.front_default || dadosPokemon.sprites?.front_default || null,
      animatedUrl: null,
    };
  }
  const stats = Object.fromEntries((dadosPokemon.stats || []).map((item) => [item.stat.name, Number(item.base_stat)]));
  for (const stat of ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']) {
    if (!Number.isFinite(stats[stat]) || stats[stat] < 1) {
      throw new Error(`A PokéAPI não retornou o atributo ${stat} para ${dadosPokemon.name}.`);
    }
  }
  const especies = {
    id: pokemonId,
    nome: dadosPublicos.namePt || dadosPokemon.name,
    nomeOriginal: dadosPokemon.name,
    tipos: (dadosPokemon.types || []).map((item) => item.type.name),
    stats,
    imageUrl: dadosPublicos.imageUrl,
    animatedUrl: dadosPublicos.animatedUrl,
    moves: listarMovimentosAprendidos(dadosPokemon).slice(0, 12),
  };
  sql.cacheSpecies.run(pokemonId, JSON.stringify(especies), Date.now());
  return especies;
}

async function obterMoveset(especie, level = LEVEL_BATALHA, movimentosEscolhidos = null) {
  const nivel = Math.max(1, Number(level) || LEVEL_BATALHA);
  const candidatosBase = Array.isArray(especie.moves) ? especie.moves : [];
  const aprendiveis = candidatosBase.filter((item) => {
    if (item?.name && typeof item?.level === 'number') {
      return item.level <= nivel;
    }
    const detalhes = item.version_group_details || [];
    return detalhes.some((detalhe) =>
      detalhe.move_learn_method?.name === 'level-up' &&
      Number(detalhe.level_learned_at) <= nivel
    );
  });
  let nomes = [];
  if (Array.isArray(movimentosEscolhidos) && movimentosEscolhidos.length) {
    nomes = movimentosEscolhidos.map((item) => String(item).trim()).filter(Boolean);
  } else {
    nomes = aprendiveis.map((item) => item.move?.name || item.name).filter(Boolean);
  }
  nomes = [...new Set(nomes)];
  const movimentos = [];
  try {
    for (let inicio = 0; inicio < nomes.length && movimentos.length < 4; inicio += 4) {
      const lote = nomes.slice(inicio, inicio + 4);
      const resultados = await comLimite(lote, 4, (nome) => obterDetalheMovimento(nome));
      movimentos.push(...resultados.filter(temEfeitoUtil));
    }
  } catch (erro) {
    console.warn(`[Pokémon] Não consegui carregar todos os golpes de ${especie.nome}; usando golpes básicos:`, erro?.message || erro);
  }
  const unicos = new Map(movimentos.map((movimento) => [movimento.nomeOriginal, movimento]));
  let moveset = Array.from(unicos.values()).slice(0, 4);
  if (movimentosEscolhidos && moveset.length < movimentosEscolhidos.length) {
    // Completa com golpes aprendíveis caso algum escolhido seja inválido.
    const extras = aprendiveis.map((item) => item.move?.name).filter((nome) => !moveset.some((mov) => mov.nomeOriginal === nome));
    for (const nome of extras) {
      if (moveset.length >= 4) break;
      try {
        const detalhe = await obterDetalheMovimento(nome);
        if (temEfeitoUtil(detalhe) && !moveset.some((mov) => mov.nomeOriginal === detalhe.nomeOriginal)) {
          moveset.push(detalhe);
        }
      } catch { /* ignora golpe inválido */ }
    }
  }
  if (!moveset.length) {
    moveset.push(
      { nome: 'Investida', nomeOriginal: 'tackle', tipo: 'normal', categoria: 'physical', poder: 40, precisao: 100, pp: 35, prioridade: 0, ailment: 'none', ailmentChance: 0, statChanges: [], alvo: 'selected-pokemon' },
      { nome: 'Ataque Rápido', nomeOriginal: 'quick-attack', tipo: 'normal', categoria: 'physical', poder: 40, precisao: 100, pp: 30, prioridade: 1, ailment: 'none', ailmentChance: 0, statChanges: [], alvo: 'selected-pokemon' }
    );
  }
  if (!movimentosEscolhidos) {
    const embaralhar = (lista) => {
      const copia = [...lista];
      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    };
    const deDano = moveset.filter((movimento) => movimento.categoria !== 'status' && movimento.poder > 0);
    const deApoio = moveset.filter((movimento) => !(movimento.categoria !== 'status' && movimento.poder > 0));
    moveset = [...embaralhar(deDano), ...embaralhar(deApoio)];
  }
  return moveset.slice(0, 4).map((movimento) => ({ ...movimento, ppAtual: movimento.pp }));
}

async function listarGolpesAprendiveis(especie, level = LEVEL_BATALHA) {
  const nivel = Math.max(1, Number(level) || LEVEL_BATALHA);
  const candidatosBase = Array.isArray(especie.moves) ? especie.moves : [];
  const aprendiveis = candidatosBase.filter((item) => {
    if (item?.name && typeof item?.level === 'number') {
      return item.level <= nivel;
    }
    const detalhes = item.version_group_details || [];
    return detalhes.some((detalhe) =>
      detalhe.move_learn_method?.name === 'level-up' &&
      Number(detalhe.level_learned_at) <= nivel
    );
  });
  const nomes = [...new Set(aprendiveis.map((item) => item.move?.name || item.name).filter(Boolean))];
  const movimentos = [];
  try {
    for (let inicio = 0; inicio < nomes.length; inicio += 4) {
      const lote = nomes.slice(inicio, inicio + 4);
      const resultados = await comLimite(lote, 4, (nome) => obterDetalheMovimento(nome));
      movimentos.push(...resultados.filter(temEfeitoUtil));
    }
  } catch (erro) {
    console.warn(`[Pokémon] Não consegui listar golpes de ${especie.nome}:`, erro?.message || erro);
  }
  const unicos = new Map(movimentos.map((movimento) => [movimento.nomeOriginal, movimento]));
  return Array.from(unicos.values());
}

function calcularStat(base, level, hp = false) {
  if (hp) return Math.floor(((2 * base + 31) * level) / 100) + level + 10;
  return Math.floor(((2 * base + 31) * level) / 100) + 5;
}

async function prepararPokemon(row) {
  const level = Math.max(1, Math.min(100, Number(row.level) || LEVEL_BATALHA));
  let movimentosEscolhidos = null;
  if (row.moves_json) {
    try { movimentosEscolhidos = JSON.parse(row.moves_json); } catch { movimentosEscolhidos = null; }
  }
  const especie = await obterEspecieDeBatalha(row.pokemon_id);
  const moveset = await obterMoveset(especie, level, movimentosEscolhidos);
  const stats = {
    hp: calcularStat(especie.stats.hp, level, true),
    attack: calcularStat(especie.stats.attack, level),
    defense: calcularStat(especie.stats.defense, level),
    'special-attack': calcularStat(especie.stats['special-attack'], level),
    'special-defense': calcularStat(especie.stats['special-defense'], level),
    speed: calcularStat(especie.stats.speed, level),
  };
  const vida = pokemon.estadoVidaPokemon({ ...row, level }, { stats: especie.stats });
  stats.hp = vida.hpMax;
  return {
    collectionId: row.id == null ? null : Number(row.id),
    pokemonId: especie.id,
    nome: row.name_pt || especie.nome,
    nomeOriginal: especie.nomeOriginal,
    shiny: Boolean(Number(row.shiny)),
    level,
    tipos: especie.tipos,
    stats,
    hp: Math.min(vida.hpMax, vida.hp),
    hpMax: vida.hpMax,
    status: vida.status,
    sleepTurns: Math.max(0, Number(row.status_turns) || 0),
    stages: { attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0, accuracy: 0, evasion: 0 },
    moves: moveset,
    imageUrl: especie.imageUrl,
    animatedUrl: especie.animatedUrl,
  };
}

async function prepararEquipeDoUsuario(userId, collectionIds, tamanho) {
  if (!userId || !Array.isArray(collectionIds) || !Number.isInteger(tamanho) || tamanho < 1 || tamanho > MAX_TIME) {
    throw new TypeError('Seleção de equipe inválida.');
  }
  if (collectionIds.length !== tamanho || new Set(collectionIds.map(String)).size !== tamanho) {
    throw new RangeError(`Escolha exatamente ${tamanho} Pokémon diferentes.`);
  }
  const colecao = pokemon.listarColecao(userId, 250).pokemon;
  const porId = new Map(colecao.map((item) => [String(item.id), item]));
  const selecionados = collectionIds.map((id) => porId.get(String(id)));
  if (selecionados.some((item) => !item)) throw new Error('Um ou mais Pokémon não pertencem à coleção deste treinador.');
  return comLimite(selecionados, 3, prepararPokemon);
}

async function prepararEquipeDoGinasio(gymId) {
  const ginasio = GYMS.find((item) => item.id === gymId);
  if (!ginasio) throw new Error('Esse ginásio não existe.');
  const equipe = await comLimite(ginasio.equipe, 3, async (id, index) => {
    const especie = await obterEspecieDeBatalha(id);
    return prepararPokemon({
      pokemon_id: id,
      name_pt: especie.nome,
      shiny: 0,
      id: null,
      npcIndex: index,
    });
  });
  return equipe;
}

function multiplicadorTipo(tipoGolpe, tiposAlvo) {
  const superEfetivo = {
    normal: [], fire: ['grass', 'ice', 'bug', 'steel'], water: ['fire', 'ground', 'rock'],
    electric: ['water', 'flying'], grass: ['water', 'ground', 'rock'],
    ice: ['grass', 'ground', 'flying', 'dragon'], fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
    poison: ['grass', 'fairy'], ground: ['fire', 'electric', 'poison', 'rock', 'steel'],
    flying: ['grass', 'fighting', 'bug'], psychic: ['fighting', 'poison'],
    bug: ['grass', 'psychic', 'dark'], rock: ['fire', 'ice', 'flying', 'bug'],
    ghost: ['psychic', 'ghost'], dragon: ['dragon'], dark: ['psychic', 'ghost'],
    steel: ['ice', 'rock', 'fairy'], fairy: ['fighting', 'dragon', 'dark'],
  };
  const poucoEfetivo = {
    normal: ['rock', 'steel'], fire: ['fire', 'water', 'rock', 'dragon'],
    water: ['water', 'grass', 'dragon'], electric: ['electric', 'grass', 'dragon'],
    grass: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
    ice: ['fire', 'water', 'ice', 'steel'], fighting: ['poison', 'flying', 'psychic', 'bug', 'fairy'],
    poison: ['poison', 'ground', 'rock', 'ghost'], ground: ['grass', 'bug'],
    flying: ['electric', 'rock', 'steel'], psychic: ['psychic', 'steel'],
    bug: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
    rock: ['fighting', 'ground', 'steel'], ghost: ['dark'], dragon: ['steel'],
    dark: ['fighting', 'dark', 'fairy'], steel: ['fire', 'water', 'electric', 'steel'],
    fairy: ['fire', 'poison', 'steel'],
  };
  const imune = {
    normal: ['ghost'], electric: ['ground'], fighting: ['ghost'],
    poison: ['steel'], ground: ['flying'], psychic: ['dark'], ghost: ['normal'],
    dragon: ['fairy'],
  };
  let resultado = 1;
  for (const tipoAlvo of tiposAlvo) {
    if (imune[tipoGolpe]?.includes(tipoAlvo)) return 0;
    if (superEfetivo[tipoGolpe]?.includes(tipoAlvo)) resultado *= 2;
    if (poucoEfetivo[tipoGolpe]?.includes(tipoAlvo)) resultado *= 0.5;
  }
  return resultado;
}

function multiplicadorEstagio(estagio) {
  const seguro = Math.max(-6, Math.min(6, Number(estagio) || 0));
  return seguro >= 0 ? (2 + seguro) / 2 : 2 / (2 - seguro);
}

function velocidadeAtual(combatente) {
  const base = combatente.stats.speed * multiplicadorEstagio(combatente.stages.speed);
  return combatente.status === 'paralysis' ? base * 0.5 : base;
}

function chance(random, porcentagem) {
  return random() * 100 < porcentagem;
}

function calcularDano(atacante, defensor, golpe, random = Math.random) {
  const tipo = multiplicadorTipo(golpe.tipo, defensor.tipos);
  if (tipo === 0) return { dano: 0, tipo, critico: false };
  const statAtaque = golpe.categoria === 'physical' ? 'attack' : 'special-attack';
  const statDefesa = golpe.categoria === 'physical' ? 'defense' : 'special-defense';
  const ataque = atacante.stats[statAtaque] * multiplicadorEstagio(atacante.stages[statAtaque]);
  const defesa = Math.max(1, defensor.stats[statDefesa] * multiplicadorEstagio(defensor.stages[statDefesa]));
  const critico = chance(random, 4.17);
  const stab = atacante.tipos.includes(golpe.tipo) ? 1.5 : 1;
  const danoBase = (((2 * LEVEL_BATALHA / 5 + 2) * golpe.poder * ataque / defesa) / 50) + 2;
  const randomFactor = 0.85 + random() * 0.15;
  const queimadura = atacante.status === 'burn' && golpe.categoria === 'physical' ? 0.5 : 1;
  const dano = Math.max(1, Math.floor(danoBase * stab * tipo * (critico ? 1.5 : 1) * randomFactor * queimadura));
  return { dano, tipo, critico };
}

function aplicarAlteracoesDeAtributo(combatente, alteracoes) {
  for (const alteracao of alteracoes) {
    const stat = alteracao.stat;
    if (!Object.hasOwn(combatente.stages, stat)) continue;
    combatente.stages[stat] = Math.max(-6, Math.min(6, combatente.stages[stat] + alteracao.change));
  }
}

function aplicarStatus(alvo, golpe, random) {
  if (!STATUS_VALIDOS.has(golpe.ailment) || alvo.status || !chance(random, golpe.ailmentChance)) return null;
  const tipos = new Set(alvo.tipos);
  if (
    (golpe.ailment === 'burn' && tipos.has('fire')) ||
    (golpe.ailment === 'poison' && (tipos.has('poison') || tipos.has('steel'))) ||
    (golpe.ailment === 'paralysis' && tipos.has('electric')) ||
    (golpe.ailment === 'freeze' && (tipos.has('ice') || tipos.has('fire'))) ||
    (golpe.ailment === 'paralysis' && golpe.tipo === 'electric' && tipos.has('ground'))
  ) return null;
  alvo.status = golpe.ailment;
  if (alvo.status === 'sleep') alvo.sleepTurns = 1 + Math.floor(random() * 3);
  return alvo.status;
}

function iniciarTurno(combatente, random = Math.random) {
  if (combatente.hp <= 0) return { podeAgir: false, linhas: [] };
  if (combatente.status === 'sleep') {
    combatente.sleepTurns -= 1;
    if (combatente.sleepTurns <= 0) {
      combatente.status = null;
      return { podeAgir: true, linhas: [`💤 ${combatente.nome} acordou!`] };
    }
    return { podeAgir: false, linhas: [`💤 ${combatente.nome} está dormindo e perdeu o turno.`] };
  }
  if (combatente.status === 'freeze') {
    if (chance(random, 20)) {
      combatente.status = null;
      return { podeAgir: true, linhas: [`❄️ ${combatente.nome} descongelou!`] };
    }
    return { podeAgir: false, linhas: [`❄️ ${combatente.nome} continua congelado.`] };
  }
  if (combatente.status === 'paralysis' && chance(random, 25)) {
    return { podeAgir: false, linhas: [`⚡ ${combatente.nome} está paralisado e não conseguiu se mover.`] };
  }
  return { podeAgir: true, linhas: [] };
}

function resolverGolpe(atacante, defensor, indiceGolpe, random = Math.random) {
  const golpe = atacante.moves[indiceGolpe];
  if (!golpe || golpe.ppAtual < 1) return { linhas: ['Esse golpe não tem PP restante.'], dano: 0, valido: false };
  golpe.ppAtual -= 1;
  if (!chance(random, golpe.precisao)) {
    return { linhas: [`💨 **${atacante.nome}** usou **${golpe.nome}**, mas errou!`], dano: 0, valido: true };
  }

  const linhas = [`✨ **${atacante.nome}** usou **${golpe.nome}**!`];
  if (multiplicadorTipo(golpe.tipo, defensor.tipos) === 0) {
    linhas.push(`🛡️ Não afeta ${defensor.nome}.`);
    return { linhas, dano: 0, valido: true };
  }
  let dano = 0;
  if (golpe.poder > 0 && golpe.categoria !== 'status') {
    const resultado = calcularDano(atacante, defensor, golpe, random);
    dano = Math.min(defensor.hp, resultado.dano);
    defensor.hp = Math.max(0, defensor.hp - dano);
    const eficacia = resultado.tipo > 1 ? ' É super efetivo!' : resultado.tipo > 0 && resultado.tipo < 1 ? ' Não é muito efetivo...' : resultado.tipo === 0 ? ' Não afeta o alvo.' : '';
    linhas.push(`💥 ${defensor.nome} perdeu **${dano} HP**.${eficacia}${resultado.critico ? ' 🎯 Golpe crítico!' : ''}`);
  }

  const alvoEfeito = ['user', 'users-field', 'entire-field'].includes(golpe.alvo) ? atacante : defensor;
  aplicarAlteracoesDeAtributo(alvoEfeito, golpe.statChanges);
  const status = aplicarStatus(alvoEfeito, golpe, random);
  if (status) linhas.push(`🔸 ${alvoEfeito.nome} recebeu **${STATUS_NOMES[status]}**.`);
  return { linhas, dano, valido: true };
}

function fimDeTurno(combatente) {
  if (combatente.hp <= 0) return [];
  let dano = 0;
  let nomeStatus = '';
  if (combatente.status === 'burn') {
    dano = Math.max(1, Math.floor(combatente.hpMax / 16));
    nomeStatus = 'queimadura';
  } else if (combatente.status === 'poison') {
    dano = Math.max(1, Math.floor(combatente.hpMax / 8));
    nomeStatus = 'veneno';
  }
  if (!dano) return [];
  combatente.hp = Math.max(0, combatente.hp - dano);
  return [`🩹 ${combatente.nome} sofreu **${dano} HP** por ${nomeStatus}.`];
}

function ordenarEscolhas(equipe1, escolha1, equipe2, escolha2, random = Math.random) {
  const ativo1 = equipe1[escolha1.ativoIndice];
  const ativo2 = equipe2[escolha2.ativoIndice];
  const prioridade = (equipe, escolha) => {
    if (escolha.tipo === 'switch') return 6;
    return equipe[escolha.ativoIndice].moves[escolha.indiceGolpe]?.prioridade || 0;
  };
  const diferencaPrioridade = prioridade(equipe1, escolha1) - prioridade(equipe2, escolha2);
  if (diferencaPrioridade !== 0) return diferencaPrioridade > 0 ? 0 : 1;
  const velocidade1 = velocidadeAtual(ativo1);
  const velocidade2 = velocidadeAtual(ativo2);
  if (velocidade1 !== velocidade2) return velocidade1 > velocidade2 ? 0 : 1;
  return random() < 0.5 ? 0 : 1;
}

function trocarAtivo(equipe, indice) {
  if (!Number.isInteger(indice) || indice < 0 || indice >= equipe.length || equipe[indice].hp <= 0) return false;
  return true;
}

function escolherProximoVivo(equipe, atual) {
  return equipe.findIndex((combatente, indice) => indice !== atual && combatente.hp > 0);
}

function temPokemonVivo(equipe) {
  return equipe.some((combatente) => combatente.hp > 0);
}

function listarInsignias(userId) {
  if (!userId) throw new TypeError('userId é obrigatório para consultar insígnias.');
  const obtidas = new Map(sql.badges.all(String(userId)).map((item) => [item.badge_id, item.earned_at]));
  return GYMS.map((ginasio) => ({
    id: ginasio.id,
    nome: ginasio.nome,
    lider: ginasio.lider,
    obtida: obtidas.has(ginasio.id),
    obtidaEm: obtidas.get(ginasio.id) || null,
    pokemonPermitidos: ginasio.pokemonPermitidos,
  }));
}

function registrarVitoriaGinasio(userId, gymId, team, now = Date.now()) {
  const ginasio = GYMS.find((item) => item.id === gymId);
  if (!ginasio || !Array.isArray(team) || !team.some((combatente) => ginasio.pokemonPermitidos.includes(combatente.pokemonId))) {
    return { ok: false, motivo: 'equipe_invalida' };
  }
  const insercao = sql.awardBadge.run(String(userId), gymId, now);
  return { ok: true, nova: insercao.changes === 1, insignia: ginasio };
}

function registrarResultado({ guildId, modo, jogador1, jogador2 = null, vencedorId = null, ginasioId = null, tamanho, turnos, now = Date.now() }) {
  if (!guildId || !modo || !jogador1 || !Number.isInteger(tamanho) || tamanho < 1 || tamanho > MAX_TIME) {
    throw new TypeError('Resultado de batalha inválido.');
  }
  sql.result.run(
    String(guildId),
    String(modo),
    String(jogador1),
    jogador2 ? String(jogador2) : null,
    vencedorId ? String(vencedorId) : null,
    ginasioId || null,
    tamanho,
    Math.max(0, Number(turnos) || 0),
    now
  );
}

const LEVEL_BATALHA = 50;

module.exports = {
  LEVEL_BATALHA,
  MAX_TIME,
  MAX_TURNS,
  STATUS_NOMES,
  GYMS,
  obterEspecieDeBatalha,
  obterMoveset,
  listarGolpesAprendiveis,
  prepararPokemon,
  prepararEquipeDoUsuario,
  prepararEquipeDoGinasio,
  multiplicadorTipo,
  multiplicadorEstagio,
  velocidadeAtual,
  calcularDano,
  iniciarTurno,
  resolverGolpe,
  fimDeTurno,
  ordenarEscolhas,
  trocarAtivo,
  escolherProximoVivo,
  temPokemonVivo,
  listarInsignias,
  registrarVitoriaGinasio,
  registrarResultado,
  internals: { sql, listarMovimentosAprendidos, calcularStat, temEfeitoUtil },
};
