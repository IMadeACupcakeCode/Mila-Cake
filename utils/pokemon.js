const db = require('./db');
const criador = require('./criador');

const database = db.db;
const MAX_POKEMON_ID = 1025;
const ARCEUS_ID = 493;
const ENCONTRO_TTL_MS = 10 * 60 * 1000;
const INCENSO_MS = 30 * 60 * 1000;
const API_TIMEOUT_MS = 10_000;
const API_BASE = 'https://pokeapi.co/api/v2';
const FallbackPokemon = [
  { id: 1, name: 'bulbasaur', namePt: 'Bulbasaur', captureRate: 45 },
  { id: 4, name: 'charmander', namePt: 'Charmander', captureRate: 45 },
  { id: 7, name: 'squirtle', namePt: 'Squirtle', captureRate: 45 },
  { id: 25, name: 'pikachu', namePt: 'Pikachu', captureRate: 190 },
  { id: 39, name: 'jigglypuff', namePt: 'Jigglypuff', captureRate: 170 },
  { id: 54, name: 'psyduck', namePt: 'Psyduck', captureRate: 190 },
  { id: 94, name: 'gengar', namePt: 'Gengar', captureRate: 45 },
  { id: 133, name: 'eevee', namePt: 'Eevee', captureRate: 45 },
  { id: 143, name: 'snorlax', namePt: 'Snorlax', captureRate: 25 },
  { id: 150, name: 'mewtwo', namePt: 'Mewtwo', captureRate: 3 },
  { id: 151, name: 'mew', namePt: 'Mew', captureRate: 45 },
  { id: 175, name: 'togepi', namePt: 'Togepi', captureRate: 190 },
  { id: 448, name: 'lucario', namePt: 'Lucario', captureRate: 45 },
  { id: 658, name: 'greninja', namePt: 'Greninja', captureRate: 45 },
  { id: 700, name: 'sylveon', namePt: 'Sylveon', captureRate: 45 },
];

const CATEGORIAS = [
  { id: 'basicas', nome: 'Clássicas', emoji: '🔴', descricao: 'Pokébolas do dia a dia e modelos especiais.' },
  { id: 'situacionais', nome: 'Estratégicas', emoji: '🎯', descricao: 'Bolas com bônus para a aventura.' },
  { id: 'apricorn', nome: 'Apricorn', emoji: '🌰', descricao: 'Bolas artesanais e colecionáveis.' },
  { id: 'raras', nome: 'Raras', emoji: '✨', descricao: 'Bolas especiais e difíceis de encontrar.' },
  { id: 'consumiveis', nome: 'Consumíveis', emoji: '🪻', descricao: 'Itens de uso temporário.' },
  { id: 'cosmeticos', nome: 'Cosméticos', emoji: '🎨', descricao: 'Personalize a aparência das capturas.' },
];

const ITENS = [
  { id: 'pokebola', nome: 'Poké Ball', emoji: '🔴', preco: 100, tipo: 'bola', categoria: 'basicas', multiplicador: 1, descricao: 'A bola clássica. Sem bônus de captura.' },
  { id: 'greatball', nome: 'Great Ball', emoji: '🔵', preco: 450, tipo: 'bola', categoria: 'basicas', multiplicador: 1.25, descricao: 'Aumenta a chance de captura em 25%.' },
  { id: 'ultraball', nome: 'Ultra Ball', emoji: '⚫', preco: 1100, tipo: 'bola', categoria: 'basicas', multiplicador: 1.55, descricao: 'Aumenta a chance de captura em 55%.' },
  { id: 'masterball', nome: 'Master Ball', emoji: '🟣', preco: 50000, tipo: 'bola', categoria: 'basicas', garanteCaptura: true, descricao: 'Captura garantida. Uma das bolas mais raras da loja.' },
  { id: 'premierball', nome: 'Premier Ball', emoji: '⚪', preco: 700, tipo: 'bola', categoria: 'basicas', multiplicador: 1.15, descricao: 'Uma bola comemorativa com bônus leve.' },
  { id: 'luxuryball', nome: 'Luxury Ball', emoji: '🟡', preco: 2500, tipo: 'bola', categoria: 'basicas', multiplicador: 1.2, descricao: 'Elegante e confortável; bônus moderado.' },
  { id: 'healball', nome: 'Heal Ball', emoji: '💗', preco: 900, tipo: 'bola', categoria: 'basicas', multiplicador: 1.25, descricao: 'Uma captura gentil com chance um pouco melhor.' },
  { id: 'cherishball', nome: 'Cherish Ball', emoji: '🎁', preco: 35000, tipo: 'bola', categoria: 'basicas', multiplicador: 1.5, descricao: 'Bola comemorativa rara, com bônus de captura.' },
  { id: 'parkball', nome: 'Park Ball', emoji: '🌳', preco: 12000, tipo: 'bola', categoria: 'basicas', multiplicador: 1.8, descricao: 'Bola de parque com um bônus elevado.' },
  { id: 'netball', nome: 'Net Ball', emoji: '🕸️', preco: 1600, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.4, descricao: 'Bola estratégica com bônus de captura.' },
  { id: 'diveball', nome: 'Dive Ball', emoji: '🌊', preco: 1400, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.3, descricao: 'Bola aquática com bônus moderado.' },
  { id: 'nestball', nome: 'Nest Ball', emoji: '🪺', preco: 2200, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.3, descricao: 'Bola especial para uma captura mais tranquila.' },
  { id: 'repeatball', nome: 'Repeat Ball', emoji: '🔁', preco: 2200, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.35, descricao: 'Bola de repetição com bônus moderado.' },
  { id: 'timerball', nome: 'Timer Ball', emoji: '⏱️', preco: 1800, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.4, descricao: 'Bola de cronômetro com bônus estável neste minijogo.' },
  { id: 'duskball', nome: 'Dusk Ball', emoji: '🌙', preco: 1800, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.4, descricao: 'Bola noturna com bônus de captura.' },
  { id: 'quickball', nome: 'Quick Ball', emoji: '⚡', preco: 2600, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.45, descricao: 'Rápida e prática, com bônus de captura.' },
  { id: 'featherball', nome: 'Feather Ball', emoji: '🪶', preco: 3000, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.35, descricao: 'Leve e veloz, inspirada nas bolas de Hisui.' },
  { id: 'wingball', nome: 'Wing Ball', emoji: '🪽', preco: 5000, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.5, descricao: 'Uma bola alada com bônus de captura.' },
  { id: 'jetball', nome: 'Jet Ball', emoji: '🚀', preco: 9000, tipo: 'bola', categoria: 'situacionais', multiplicador: 1.7, descricao: 'Bola veloz de Hisui com bônus elevado.' },
  { id: 'fastball', nome: 'Fast Ball', emoji: '💨', preco: 3000, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.5, descricao: 'Bola veloz feita de Apricorn.' },
  { id: 'levelball', nome: 'Level Ball', emoji: '📶', preco: 3200, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.3, descricao: 'Bola artesanal com bônus equilibrado.' },
  { id: 'lureball', nome: 'Lure Ball', emoji: '🎣', preco: 3400, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.4, descricao: 'Bola artesanal para uma captura especial.' },
  { id: 'heavyball', nome: 'Heavy Ball', emoji: '🪨', preco: 4200, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.6, descricao: 'Uma bola robusta com bônus elevado.' },
  { id: 'leadenball', nome: 'Leaden Ball', emoji: '⚙️', preco: 5000, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.65, descricao: 'Uma versão reforçada com bônus elevado.' },
  { id: 'gigatonball', nome: 'Gigaton Ball', emoji: '🧱', preco: 9000, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.8, descricao: 'Uma bola pesada e resistente com bônus alto.' },
  { id: 'loveball', nome: 'Love Ball', emoji: '💖', preco: 3800, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.35, descricao: 'Bola artesanal feita com carinho.' },
  { id: 'friendball', nome: 'Friend Ball', emoji: '🤝', preco: 3600, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.25, descricao: 'Uma bola amigável com bônus leve.' },
  { id: 'moonball', nome: 'Moon Ball', emoji: '🌕', preco: 5000, tipo: 'bola', categoria: 'apricorn', multiplicador: 1.55, descricao: 'Bola lunar para capturas especiais.' },
  { id: 'safariball', nome: 'Safari Ball', emoji: '🦒', preco: 5000, tipo: 'bola', categoria: 'raras', multiplicador: 1.4, descricao: 'Uma bola de expedição com bônus moderado.' },
  { id: 'sportball', nome: 'Sport Ball', emoji: '🏅', preco: 9000, tipo: 'bola', categoria: 'raras', multiplicador: 1.65, descricao: 'Bola esportiva colecionável com bônus alto.' },
  { id: 'dreamball', nome: 'Dream Ball', emoji: '💭', preco: 12000, tipo: 'bola', categoria: 'raras', multiplicador: 1.6, descricao: 'Uma bola rara para capturas de sonho.' },
  { id: 'beastball', nome: 'Beast Ball', emoji: '👾', preco: 18000, tipo: 'bola', categoria: 'raras', multiplicador: 1.8, descricao: 'Bola rara e poderosa com bônus elevado.' },
  { id: 'strangeball', nome: 'Strange Ball', emoji: '🌀', preco: 9500, tipo: 'bola', categoria: 'raras', multiplicador: 1.5, descricao: 'Uma bola misteriosa de outra época.' },
  { id: 'originball', nome: 'Origin Ball', emoji: '🌌', preco: 25000, tipo: 'bola', categoria: 'raras', multiplicador: 1.9, descricao: 'Uma bola lendária de Hisui com bônus especial.' },
  { id: 'incenso', nome: 'Incenso', emoji: '🪻', preco: 1400, tipo: 'consumivel', categoria: 'consumiveis', descricao: 'Por 30 minutos, suas mensagens atraem mais encontros.' },
  { id: 'moldura_morango', nome: 'Moldura Morango', emoji: '🍓', preco: 3500, tipo: 'cosmetico', categoria: 'cosmeticos', cor: 0xff80ab, descricao: 'Uma moldura rosa para suas capturas.' },
  { id: 'moldura_aurora', nome: 'Moldura Aurora', emoji: '🌌', preco: 6500, tipo: 'cosmetico', categoria: 'cosmeticos', cor: 0x8e9bff, descricao: 'Uma moldura cósmica para suas capturas.' },
  { id: 'moldura_limao', nome: 'Moldura Limão', emoji: '🍋', preco: 5000, tipo: 'cosmetico', categoria: 'cosmeticos', cor: 0x9bd36a, descricao: 'Uma moldura verde para suas capturas.' },
];

const MISSOES = [
  { id: 'primeira-captura', nome: 'Primeiro encontro', descricao: 'Capture 1 Pokémon.', tipo: 'capturas', meta: 1, recompensa: 'greatball', periodo: 'uma vez' },
  { id: 'colecao-cinco', nome: 'Coleção em expansão', descricao: 'Capture 5 espécies diferentes.', tipo: 'especies', meta: 5, recompensa: 'friendball', periodo: 'uma vez' },
  { id: 'capturas-dez', nome: 'Treinador dedicado', descricao: 'Capture 10 Pokémon.', tipo: 'capturas', meta: 10, recompensa: 'ultraball', periodo: 'uma vez' },
  { id: 'capturas-trinta', nome: 'Lenda da Mila', descricao: 'Capture 30 Pokémon.', tipo: 'capturas', meta: 30, recompensa: 'masterball', periodo: 'uma vez' },
  { id: 'capturas-diarias-tres', nome: 'Rota do dia', descricao: 'Capture 3 Pokémon hoje.', tipo: 'capturas-diarias', meta: 3, recompensa: 'quickball', periodo: 'diária' },
];

database.exec(`
  CREATE TABLE IF NOT EXISTS pokemon_server_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    muted INTEGER NOT NULL DEFAULT 0,
    spawn_chance INTEGER NOT NULL DEFAULT 3,
    cooldown_ms INTEGER NOT NULL DEFAULT 900000,
    channels_json TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS pokemon_spawn_state (
    guild_id TEXT PRIMARY KEY,
    last_spawn_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pokemon_encounters (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    pokemon_id INTEGER NOT NULL,
    species_name TEXT NOT NULL,
    name_pt TEXT NOT NULL,
    capture_rate INTEGER NOT NULL DEFAULT 45,
    types_json TEXT NOT NULL DEFAULT '[]',
    image_url TEXT,
    animated_url TEXT,
    shiny INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    message_id TEXT
  );
  CREATE TABLE IF NOT EXISTS pokemon_collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT,
    pokemon_id INTEGER NOT NULL,
    species_name TEXT NOT NULL,
    name_pt TEXT NOT NULL,
    shiny INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    caught_at INTEGER NOT NULL,
    ball_id TEXT NOT NULL DEFAULT 'pokebola',
    cosmetic_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pokemon_collection_user ON pokemon_collection(user_id, caught_at DESC);
  CREATE TABLE IF NOT EXISTS pokemon_user_preferences (
    user_id TEXT PRIMARY KEY,
    ping_enabled INTEGER NOT NULL DEFAULT 0,
    favorite_alerts INTEGER NOT NULL DEFAULT 0,
    equipped_ball TEXT NOT NULL DEFAULT 'pokebola',
    equipped_cosmetic TEXT,
    incense_until INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pokemon_inventory (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS pokemon_favorites (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    pokemon_id INTEGER NOT NULL,
    species_name TEXT NOT NULL,
    name_pt TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, pokemon_id)
  );
  CREATE TABLE IF NOT EXISTS pokemon_species_cache (
    pokemon_id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pokemon_mission_claims (
    user_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    period_key TEXT NOT NULL,
    claimed_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, mission_id, period_key)
  );
`);

const collectionColumns = new Set(database.prepare('PRAGMA table_info(pokemon_collection)').all().map((column) => column.name));
if (!collectionColumns.has('guild_id')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN guild_id TEXT');
}
database.exec('CREATE INDEX IF NOT EXISTS idx_pokemon_collection_guild ON pokemon_collection(guild_id, user_id, caught_at DESC)');

const sql = {
  config: database.prepare('SELECT * FROM pokemon_server_config WHERE guild_id = ?'),
  upsertConfig: database.prepare(`
    INSERT INTO pokemon_server_config (guild_id, enabled, muted, spawn_chance, cooldown_ms, channels_json)
    VALUES (@guild_id, @enabled, @muted, @spawn_chance, @cooldown_ms, @channels_json)
    ON CONFLICT(guild_id) DO UPDATE SET
      enabled = excluded.enabled, muted = excluded.muted, spawn_chance = excluded.spawn_chance,
      cooldown_ms = excluded.cooldown_ms, channels_json = excluded.channels_json
  `),
  state: database.prepare('SELECT last_spawn_at FROM pokemon_spawn_state WHERE guild_id = ?'),
  upsertState: database.prepare(`
    INSERT INTO pokemon_spawn_state (guild_id, last_spawn_at) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET last_spawn_at = excluded.last_spawn_at
  `),
  encounter: database.prepare('SELECT * FROM pokemon_encounters WHERE guild_id = ?'),
  upsertEncounter: database.prepare(`
    INSERT INTO pokemon_encounters
      (guild_id, channel_id, pokemon_id, species_name, name_pt, capture_rate, types_json,
       image_url, animated_url, shiny, expires_at, message_id)
    VALUES (@guild_id, @channel_id, @pokemon_id, @species_name, @name_pt, @capture_rate, @types_json,
       @image_url, @animated_url, @shiny, @expires_at, @message_id)
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id, pokemon_id = excluded.pokemon_id,
      species_name = excluded.species_name, name_pt = excluded.name_pt,
      capture_rate = excluded.capture_rate, types_json = excluded.types_json,
      image_url = excluded.image_url, animated_url = excluded.animated_url,
      shiny = excluded.shiny, expires_at = excluded.expires_at, message_id = excluded.message_id
  `),
  deleteEncounter: database.prepare('DELETE FROM pokemon_encounters WHERE guild_id = ?'),
  preferences: database.prepare('SELECT * FROM pokemon_user_preferences WHERE user_id = ?'),
  ensurePreferences: database.prepare('INSERT OR IGNORE INTO pokemon_user_preferences (user_id, ping_enabled, favorite_alerts) VALUES (?, 0, 0)'),
  inventory: database.prepare('SELECT item_id, quantity FROM pokemon_inventory WHERE user_id = ? AND quantity > 0 ORDER BY item_id'),
  inventoryItem: database.prepare('SELECT quantity FROM pokemon_inventory WHERE user_id = ? AND item_id = ?'),
  addInventory: database.prepare(`
    INSERT INTO pokemon_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity
  `),
  useInventory: database.prepare('UPDATE pokemon_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ? AND quantity > 0'),
  favorites: database.prepare('SELECT pokemon_id, species_name, name_pt FROM pokemon_favorites WHERE guild_id = ? AND user_id = ? ORDER BY name_pt'),
  favorite: database.prepare('SELECT 1 FROM pokemon_favorites WHERE guild_id = ? AND user_id = ? AND pokemon_id = ?'),
  addFavorite: database.prepare(`
    INSERT OR IGNORE INTO pokemon_favorites (guild_id, user_id, pokemon_id, species_name, name_pt)
    VALUES (?, ?, ?, ?, ?)
  `),
  removeFavorite: database.prepare('DELETE FROM pokemon_favorites WHERE guild_id = ? AND user_id = ? AND pokemon_id = ?'),
  alertUsers: database.prepare(`
    SELECT f.user_id
      FROM pokemon_favorites f
      JOIN pokemon_user_preferences p ON p.user_id = f.user_id
     WHERE f.guild_id = ? AND f.pokemon_id = ?
       AND p.ping_enabled = 1 AND p.favorite_alerts = 1
     ORDER BY f.user_id
     LIMIT 50
  `),
  collection: database.prepare(`
    SELECT id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id, cosmetic_id
      FROM pokemon_collection WHERE user_id = ? ORDER BY caught_at DESC, id DESC LIMIT ?
  `),
  collectionCount: database.prepare('SELECT COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species FROM pokemon_collection WHERE user_id = ?'),
  profileCount: database.prepare(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species, COALESCE(SUM(shiny), 0) AS shinies
      FROM pokemon_collection WHERE user_id = ?
  `),
  guildProfileCount: database.prepare(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species, COALESCE(SUM(shiny), 0) AS shinies
      FROM pokemon_collection WHERE user_id = ? AND guild_id = ?
  `),
  latestCapture: database.prepare(`
    SELECT pokemon_id, name_pt, shiny, caught_at
      FROM pokemon_collection WHERE user_id = ? ORDER BY caught_at DESC, id DESC LIMIT 1
  `),
  guildLatestCapture: database.prepare(`
    SELECT pokemon_id, name_pt, shiny, caught_at
      FROM pokemon_collection WHERE user_id = ? AND guild_id = ? ORDER BY caught_at DESC, id DESC LIMIT 1
  `),
  globalRanking: database.prepare(`
    SELECT user_id, COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species
      FROM pokemon_collection GROUP BY user_id ORDER BY total DESC, species DESC, user_id ASC LIMIT ?
  `),
  guildRanking: database.prepare(`
    SELECT user_id, COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species
      FROM pokemon_collection WHERE guild_id = ? GROUP BY user_id ORDER BY total DESC, species DESC, user_id ASC LIMIT ?
  `),
  globalRankPosition: database.prepare(`
    SELECT COUNT(*) + 1 AS position FROM (
      SELECT user_id, COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species
        FROM pokemon_collection GROUP BY user_id
    )
    WHERE total > ? OR (total = ? AND species > ?) OR (total = ? AND species = ? AND user_id < ?)
  `),
  guildRankPosition: database.prepare(`
    SELECT COUNT(*) + 1 AS position FROM (
      SELECT user_id, COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species
        FROM pokemon_collection WHERE guild_id = ? GROUP BY user_id
    )
    WHERE total > ? OR (total = ? AND species > ?) OR (total = ? AND species = ? AND user_id < ?)
  `),
  cachedSpecies: database.prepare('SELECT payload FROM pokemon_species_cache WHERE pokemon_id = ?'),
  cacheSpecies: database.prepare(`
    INSERT INTO pokemon_species_cache (pokemon_id, payload, cached_at) VALUES (?, ?, ?)
    ON CONFLICT(pokemon_id) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at
  `),
  missionClaim: database.prepare(`
    SELECT 1 FROM pokemon_mission_claims
     WHERE user_id = ? AND mission_id = ? AND period_key = ?
  `),
  claimMission: database.prepare(`
    INSERT OR IGNORE INTO pokemon_mission_claims (user_id, mission_id, period_key, claimed_at)
    VALUES (?, ?, ?, ?)
  `),
};

function normalizarNome(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function configPadrao() {
  return { enabled: false, muted: false, spawnChance: 3, cooldownMs: 15 * 60 * 1000, channels: [] };
}

function obterConfig(guildId) {
  if (!guildId) throw new TypeError('guildId é obrigatório.');
  const row = sql.config.get(String(guildId));
  if (!row) return configPadrao();
  return {
    enabled: Boolean(row.enabled),
    muted: Boolean(row.muted),
    spawnChance: row.spawn_chance,
    cooldownMs: row.cooldown_ms,
    channels: JSON.parse(row.channels_json),
  };
}

function salvarConfig(guildId, patch) {
  if (!guildId || !patch || typeof patch !== 'object') throw new TypeError('Configuração do servidor inválida.');
  const atual = obterConfig(guildId);
  const config = { ...atual };
  if (patch.enabled !== undefined) config.enabled = Boolean(patch.enabled);
  if (patch.muted !== undefined) config.muted = Boolean(patch.muted);
  if (patch.spawnChance !== undefined) {
    const chance = Number(patch.spawnChance);
    if (!Number.isInteger(chance) || chance < 1 || chance > 100) throw new RangeError('A chance deve ser um inteiro entre 1 e 100.');
    config.spawnChance = chance;
  }
  if (patch.cooldownMs !== undefined) {
    const cooldown = Number(patch.cooldownMs);
    if (!Number.isInteger(cooldown) || cooldown < 60_000 || cooldown > 24 * 60 * 60 * 1000) {
      throw new RangeError('O intervalo deve ficar entre 1 minuto e 24 horas.');
    }
    config.cooldownMs = cooldown;
  }
  if (patch.channels !== undefined) {
    if (!Array.isArray(patch.channels) || patch.channels.some((id) => !/^\d{5,25}$/.test(String(id)))) {
      throw new TypeError('A lista de canais é inválida.');
    }
    config.channels = [...new Set(patch.channels.map(String))];
  }
  sql.upsertConfig.run({
    guild_id: String(guildId),
    enabled: Number(config.enabled),
    muted: Number(config.muted),
    spawn_chance: config.spawnChance,
    cooldown_ms: config.cooldownMs,
    channels_json: JSON.stringify(config.channels),
  });
  return config;
}

function atualizarCanal(guildId, action, channelId) {
  const config = obterConfig(guildId);
  if (action === 'listar') return config.channels;
  if (!channelId || !/^\d{5,25}$/.test(String(channelId))) throw new TypeError('Informe um canal válido.');
  const channels = new Set(config.channels);
  if (action === 'adicionar') channels.add(String(channelId));
  else if (action === 'remover') channels.delete(String(channelId));
  else throw new TypeError('Ação de canal inválida.');
  return salvarConfig(guildId, { channels: [...channels] }).channels;
}

function obterPreferencias(userId) {
  if (!userId) throw new TypeError('userId é obrigatório.');
  sql.ensurePreferences.run(String(userId));
  const row = sql.preferences.get(String(userId));
  return {
    pingEnabled: Boolean(row.ping_enabled),
    favoriteAlerts: Boolean(row.favorite_alerts),
    equippedBall: row.equipped_ball,
    equippedCosmetic: row.equipped_cosmetic,
    incenseUntil: row.incense_until,
  };
}

function salvarPreferencias(userId, patch) {
  const atual = obterPreferencias(userId);
  const preferencias = { ...atual };
  if (patch.pingEnabled !== undefined) preferencias.pingEnabled = Boolean(patch.pingEnabled);
  if (patch.favoriteAlerts !== undefined) preferencias.favoriteAlerts = Boolean(patch.favoriteAlerts);
  if (patch.equippedBall !== undefined) preferencias.equippedBall = patch.equippedBall;
  if (patch.equippedCosmetic !== undefined) preferencias.equippedCosmetic = patch.equippedCosmetic;
  if (patch.incenseUntil !== undefined) preferencias.incenseUntil = Number(patch.incenseUntil) || 0;
  database.prepare(`
    UPDATE pokemon_user_preferences
       SET ping_enabled = ?, favorite_alerts = ?, equipped_ball = ?, equipped_cosmetic = ?, incense_until = ?
     WHERE user_id = ?
  `).run(
    Number(preferencias.pingEnabled),
    Number(preferencias.favoriteAlerts),
    preferencias.equippedBall,
    preferencias.equippedCosmetic,
    preferencias.incenseUntil,
    String(userId)
  );
  return preferencias;
}

function listarItens() {
  return ITENS.map((item) => ({ ...item }));
}

function listarCategorias() {
  return CATEGORIAS.map((categoria) => ({
    ...categoria,
    itens: ITENS.filter((item) => item.categoria === categoria.id).map((item) => ({ ...item })),
  }));
}

function buscarItem(id) {
  const alvo = normalizarNome(id);
  const aliases = {
    'poke-ball': 'pokebola',
    pokeball: 'pokebola',
    great: 'greatball',
    'great-ball': 'greatball',
    superbola: 'greatball',
    ultra: 'ultraball',
    'ultra-ball': 'ultraball',
    'master-ball': 'masterball',
    'premier-ball': 'premierball',
    'luxury-ball': 'luxuryball',
    'heal-ball': 'healball',
    'cherish-ball': 'cherishball',
    'park-ball': 'parkball',
    'net-ball': 'netball',
    'dive-ball': 'diveball',
    'nest-ball': 'nestball',
    'repeat-ball': 'repeatball',
    'timer-ball': 'timerball',
    'dusk-ball': 'duskball',
    'quick-ball': 'quickball',
    'fast-ball': 'fastball',
    'level-ball': 'levelball',
    'lure-ball': 'lureball',
    'heavy-ball': 'heavyball',
    'love-ball': 'loveball',
    'friend-ball': 'friendball',
    'moon-ball': 'moonball',
    'safari-ball': 'safariball',
    'sport-ball': 'sportball',
    'dream-ball': 'dreamball',
    'beast-ball': 'beastball',
    'strange-ball': 'strangeball',
    aurora: 'moldura-aurora',
    morango: 'moldura-morango',
    limao: 'moldura-limao',
  };
  const chave = aliases[alvo] || alvo;
  return ITENS.find((item) =>
    normalizarNome(item.id) === chave || normalizarNome(item.nome) === alvo
  ) || null;
}

function saldoETransacao(userId, item) {
  const ehCriador = criador.ehCriador(userId);
  db.getUsuario(userId);
  const saldoAtual = ehCriador ? criador.PONTOS_INFINITOS : Number(db.getUsuario(userId).acucares) || 0;
  if (!ehCriador && saldoAtual < item.preco) return { ok: false, motivo: 'sem_saldo', saldo: saldoAtual, item };

  const compra = database.transaction(() => {
    if (!ehCriador) {
      const debito = database.prepare('UPDATE usuarios SET acucares = acucares - ? WHERE id = ? AND acucares >= ?')
        .run(item.preco, String(userId), item.preco);
      if (debito.changes !== 1) return { ok: false, motivo: 'sem_saldo', saldo: Number(db.getUsuario(userId).acucares) || 0, item };
      db.incrementarEstatistica(userId, 'gasto', item.preco);
      db.incrementarEstatistica(userId, 'compra', 1);
      db.registrarTransacao(userId, 'pokemon', -item.preco, `Compra: ${item.nome}`);
    }
    sql.addInventory.run(String(userId), item.id, 1);
    return {
      ok: true,
      item,
      saldo: ehCriador ? criador.PONTOS_INFINITOS : Number(db.getUsuario(userId).acucares) || 0,
    };
  });
  return compra.immediate();
}

function comprar(userId, itemId) {
  const item = buscarItem(itemId);
  if (!item) return { ok: false, motivo: 'nao_encontrado' };
  return saldoETransacao(userId, item);
}

function comprarLote(userId, linhas) {
  if (!userId || !Array.isArray(linhas) || !linhas.length) {
    return { ok: false, motivo: 'carrinho_vazio' };
  }
  const quantidades = new Map();
  for (const linha of linhas) {
    const item = buscarItem(linha?.itemId);
    const quantidade = Number(linha?.quantidade);
    if (!item || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
      return { ok: false, motivo: 'item_invalido' };
    }
    quantidades.set(item.id, (quantidades.get(item.id) || 0) + quantidade);
    if (quantidades.get(item.id) > 99) return { ok: false, motivo: 'limite_excedido' };
  }

  const itens = [...quantidades].map(([id, quantidade]) => ({
    item: buscarItem(id),
    quantidade,
  }));
  const total = itens.reduce((soma, linha) => soma + linha.item.preco * linha.quantidade, 0);
  const ehCriador = criador.ehCriador(userId);
  const compra = database.transaction(() => {
    db.getUsuario(userId);
    const saldoAtual = ehCriador ? criador.PONTOS_INFINITOS : Number(db.getUsuario(userId).acucares) || 0;
    if (!ehCriador) {
      const debito = database.prepare(
        'UPDATE usuarios SET acucares = acucares - ? WHERE id = ? AND acucares >= ?'
      ).run(total, String(userId), total);
      if (debito.changes !== 1) {
        return { ok: false, motivo: 'sem_saldo', saldo: Number(db.getUsuario(userId).acucares) || 0, itens, total };
      }
      db.incrementarEstatistica(userId, 'gasto', total);
      db.incrementarEstatistica(userId, 'compra', itens.reduce((soma, linha) => soma + linha.quantidade, 0));
      db.registrarTransacao(userId, 'pokemon', -total, `Compra Pokémon (${itens.length} itens)`);
    }
    for (const { item, quantidade } of itens) {
      sql.addInventory.run(String(userId), item.id, quantidade);
    }
    return {
      ok: true,
      itens,
      total,
      saldo: ehCriador ? criador.PONTOS_INFINITOS : Number(db.getUsuario(userId).acucares) || 0,
    };
  });
  return compra.immediate();
}

function obterInventario(userId) {
  const preferencias = obterPreferencias(userId);
  const quantidade = new Map(sql.inventory.all(String(userId)).map((row) => [row.item_id, row.quantity]));
  return {
    itens: listarItens()
      .map((item) => ({ ...item, quantidade: quantidade.get(item.id) || 0 }))
      .filter((item) => item.quantidade > 0),
    preferencias,
  };
}

function usarItem(userId, itemId, now = Date.now()) {
  const item = buscarItem(itemId);
  if (!item || item.id !== 'incenso') return { ok: false, motivo: 'nao_usavel' };
  const usar = database.transaction(() => {
    const consumido = sql.useInventory.run(String(userId), item.id);
    if (consumido.changes !== 1) return { ok: false, motivo: 'sem_item' };
    const preferencias = obterPreferencias(userId);
    const incenseUntil = Math.max(now, preferencias.incenseUntil) + INCENSO_MS;
    salvarPreferencias(userId, { incenseUntil });
    return { ok: true, expiresAt: incenseUntil };
  });
  return usar.immediate();
}

function equiparItem(userId, itemId) {
  const id = normalizarNome(itemId);
  if (id === 'pokebola' || id === 'bola-normal') {
    return { ok: true, preferencias: salvarPreferencias(userId, { equippedBall: 'pokebola' }) };
  }
  const item = buscarItem(id);
  if (!item || !['bola', 'cosmetico'].includes(item.tipo)) return { ok: false, motivo: 'nao_equipavel' };
  const inventory = sql.inventoryItem.get(String(userId), item.id);
  if (!inventory || inventory.quantity < 1) return { ok: false, motivo: 'sem_item', item };
  const patch = item.tipo === 'bola' ? { equippedBall: item.id } : { equippedCosmetic: item.id };
  return { ok: true, item, preferencias: salvarPreferencias(userId, patch) };
}

function listarFavoritos(guildId, userId) {
  return sql.favorites.all(String(guildId), String(userId));
}

function alterarFavorito(guildId, userId, action, pokemon) {
  if (!guildId || !userId || !pokemon?.id) throw new TypeError('Dados do favorito inválidos.');
  if (action === 'adicionar') {
    const resultado = sql.addFavorite.run(String(guildId), String(userId), pokemon.id, pokemon.name, pokemon.namePt);
    return { ok: resultado.changes === 1, action, pokemon };
  }
  if (action === 'remover') {
    const resultado = sql.removeFavorite.run(String(guildId), String(userId), pokemon.id);
    return { ok: resultado.changes === 1, action, pokemon };
  }
  throw new TypeError('Ação de favorito inválida.');
}

function progressoMissoes(userId, now = Date.now()) {
  const hoje = new Date(now).toISOString().slice(0, 10);
  const inicioDoDia = Date.parse(`${hoje}T00:00:00.000Z`);
  const capturas = database.prepare(`
    SELECT COUNT(*) AS total
      FROM pokemon_collection
     WHERE user_id = ? AND pokemon_id != ?
  `).get(String(userId), ARCEUS_ID).total;
  const especies = database.prepare(`
    SELECT COUNT(DISTINCT pokemon_id) AS total
      FROM pokemon_collection
     WHERE user_id = ? AND pokemon_id != ?
  `).get(String(userId), ARCEUS_ID).total;
  const capturasHoje = database.prepare(`
    SELECT COUNT(*) AS total
      FROM pokemon_collection
     WHERE user_id = ? AND pokemon_id != ? AND caught_at >= ?
  `).get(String(userId), ARCEUS_ID, inicioDoDia).total;
  return { capturas, especies, capturasHoje, hoje };
}

function listarMissoes(userId, now = Date.now()) {
  if (!userId) throw new TypeError('userId é obrigatório para listar missões.');
  const progresso = progressoMissoes(userId, now);
  return MISSOES.map((missao) => {
    const periodoKey = missao.periodo === 'diária' ? progresso.hoje : 'uma-vez';
    const valor = missao.tipo === 'especies'
      ? progresso.especies
      : missao.tipo === 'capturas-diarias'
        ? progresso.capturasHoje
        : progresso.capturas;
    return {
      ...missao,
      recompensaItem: buscarItem(missao.recompensa),
      progresso: Math.min(valor, missao.meta),
      concluida: valor >= missao.meta,
      resgatada: Boolean(sql.missionClaim.get(String(userId), missao.id, periodoKey)),
      periodoKey,
    };
  });
}

function reivindicarMissao(userId, missaoId, now = Date.now()) {
  if (!userId) throw new TypeError('userId é obrigatório para resgatar missão.');
  const missao = MISSOES.find((item) => item.id === String(missaoId));
  if (!missao) return { ok: false, motivo: 'nao_encontrada' };
  const resgate = database.transaction(() => {
    const atual = listarMissoes(userId, now).find((item) => item.id === missao.id);
    if (atual.resgatada) return { ok: false, motivo: 'ja_resgatada', missao: atual };
    if (!atual.concluida) return { ok: false, motivo: 'progresso_insuficiente', missao: atual };
    const registrado = sql.claimMission.run(String(userId), missao.id, atual.periodoKey, now);
    if (registrado.changes !== 1) return { ok: false, motivo: 'ja_resgatada', missao: atual };
    sql.addInventory.run(String(userId), missao.recompensa, 1);
    return { ok: true, missao: atual, recompensa: buscarItem(missao.recompensa) };
  });
  return resgate.immediate();
}

function garantirArceusDoCriador(alvo = null, now = Date.now()) {
  if (alvo && !criador.ehCriador(alvo)) return { ok: false, motivo: 'nao_e_criador' };
  const solicitanteId = alvo && (typeof alvo === 'string' || typeof alvo === 'number')
    ? String(alvo)
    : String(alvo?.id ?? alvo?.user?.id ?? '');
  const idsCriador = criador.idsConhecidos();
  if (solicitanteId && criador.ehCriadorId(solicitanteId) && !idsCriador.includes(solicitanteId)) {
    idsCriador.unshift(solicitanteId);
  }
  if (!idsCriador.length) return { ok: false, motivo: 'criador_nao_resolvido' };

  const garantir = database.transaction(() => {
    const existentes = database.prepare(`
      SELECT id, user_id
        FROM pokemon_collection
       WHERE pokemon_id = ?
       ORDER BY caught_at ASC, id ASC
    `).all(ARCEUS_ID);
    const doCriador = existentes.find((item) => item.user_id === solicitanteId)
      || existentes.find((item) => idsCriador.includes(item.user_id));
    const vencedor = doCriador || null;
    if (vencedor) {
      database.prepare(`
        UPDATE pokemon_collection
           SET user_id = ?, guild_id = NULL, species_name = 'arceus', name_pt = 'Arceus',
               ball_id = 'masterball', cosmetic_id = NULL
         WHERE id = ?
      `).run(solicitanteId || vencedor.user_id, vencedor.id);
    } else {
      database.prepare(`
        INSERT INTO pokemon_collection
          (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id, cosmetic_id)
        VALUES (?, NULL, ?, 'arceus', 'Arceus', 0, 1, ?, 'masterball', NULL)
      `).run(solicitanteId || idsCriador[0], ARCEUS_ID, now);
    }
    const arceusDoCriador = database.prepare(`
      SELECT id FROM pokemon_collection
       WHERE pokemon_id = ? AND user_id IN (${idsCriador.map(() => '?').join(',')})
       ORDER BY caught_at ASC, id ASC LIMIT 1
    `).get(ARCEUS_ID, ...idsCriador);
    database.prepare('DELETE FROM pokemon_collection WHERE pokemon_id = ? AND id != ?')
      .run(ARCEUS_ID, arceusDoCriador.id);
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_collection_unique_arceus
      ON pokemon_collection (pokemon_id) WHERE pokemon_id = ${ARCEUS_ID}
    `);
    return {
      ok: true,
      userId: database.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(arceusDoCriador.id).user_id,
      collectionId: arceusDoCriador.id,
    };
  });
  return garantir.immediate();
}

function obterUsuariosParaAviso(guildId, pokemonId) {
  return sql.alertUsers.all(String(guildId), Number(pokemonId)).map((row) => row.user_id);
}

function aliasesDoPokemon(pokemon) {
  return new Set([pokemon.name, pokemon.namePt, String(pokemon.id)].map(normalizarNome));
}

function correspondeNome(pokemon, guess) {
  const nome = normalizarNome(guess);
  return Boolean(nome && aliasesDoPokemon(pokemon).has(nome));
}

function capturar(guildId, channelId, userId, guess = '', options = {}) {
  const now = Number(options.now) || Date.now();
  const random = options.random || Math.random;
  const captura = database.transaction(() => {
    const row = sql.encounter.get(String(guildId));
    if (!row) return { ok: false, motivo: 'sem_encontro' };
    if (row.expires_at <= now) {
      sql.deleteEncounter.run(String(guildId));
      return { ok: false, motivo: 'expirado' };
    }
    if (row.channel_id !== String(channelId)) return { ok: false, motivo: 'canal_errado' };
    const pokemon = formatarPokemon(row);
    if (guess && !correspondeNome(pokemon, guess)) return { ok: false, motivo: 'nome_errado' };
    if (pokemon.id === ARCEUS_ID) return { ok: false, motivo: 'arceus_exclusivo', pokemon };

    const preferencias = obterPreferencias(userId);
    const itemEquipado = buscarItem(preferencias.equippedBall);
    const qtdBola = itemEquipado?.tipo === 'bola' ? sql.inventoryItem.get(String(userId), itemEquipado.id)?.quantity || 0 : 0;
    const usaBola = qtdBola > 0 ? itemEquipado : null;
    const chanceBase = Math.max(0.18, Math.min(0.88, 0.25 + row.capture_rate / 255 * 0.6));
    const chance = usaBola?.garanteCaptura
      ? 1
      : Math.min(0.99, chanceBase * (usaBola?.multiplicador || 1) + (preferencias.incenseUntil > now ? 0.05 : 0));
    if (random() >= chance) return { ok: false, motivo: 'escapou', chance: Math.round(chance * 100), pokemon };

    if (usaBola && sql.useInventory.run(String(userId), usaBola.id).changes !== 1) {
      return { ok: false, motivo: 'bola_indisponivel' };
    }
    const cosmetic = buscarItem(preferencias.equippedCosmetic);
    const ballId = usaBola?.id || 'pokebola';
    const result = database.prepare(`
      INSERT INTO pokemon_collection
        (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id, cosmetic_id)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(String(userId), String(guildId), row.pokemon_id, row.species_name, row.name_pt, row.shiny, now, ballId, cosmetic?.id || null);
    sql.deleteEncounter.run(String(guildId));
    return { ok: true, pokemon, collectionId: Number(result.lastInsertRowid), ball: usaBola, cosmetic };
  });
  return captura.immediate();
}

function formatarPokemon(row) {
  return {
    id: Number(row.pokemon_id ?? row.id),
    name: row.species_name ?? row.name,
    namePt: row.name_pt ?? row.namePt ?? row.species_name ?? row.name,
    captureRate: Number(row.capture_rate ?? row.captureRate) || 45,
    types: Array.isArray(row.types) ? row.types : JSON.parse(row.types_json || '[]'),
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    animatedUrl: row.animated_url ?? row.animatedUrl ?? null,
    shinyImageUrl: row.shiny_image_url ?? row.shinyImageUrl ?? null,
    shiny: Boolean(Number(row.shiny) || row.shiny),
  };
}

function obterEncontro(guildId, now = Date.now()) {
  const row = sql.encounter.get(String(guildId));
  if (!row) return null;
  if (row.expires_at <= now) {
    sql.deleteEncounter.run(String(guildId));
    return null;
  }
  return {
    ...formatarPokemon(row),
    channelId: row.channel_id,
    expiresAt: row.expires_at,
    messageId: row.message_id,
  };
}

function registrarEncontro(guildId, channelId, pokemon, messageId = null, now = Date.now()) {
  if (!guildId || !channelId || !pokemon || !Number.isInteger(Number(pokemon.id)) || Number(pokemon.id) < 1 || Number(pokemon.id) > MAX_POKEMON_ID) {
    throw new TypeError('Encontro inválido.');
  }
  if (Number(pokemon.id) === ARCEUS_ID) {
    throw new RangeError('Arceus é uma espécie exclusiva do perfil do criador e não pode aparecer em encontros.');
  }
  const info = formatarPokemon({
    pokemon_id: Number(pokemon.id),
    species_name: String(pokemon.name || '').slice(0, 100),
    name_pt: String(pokemon.namePt || pokemon.name || '').slice(0, 100),
    capture_rate: pokemon.captureRate,
    types: pokemon.types || [],
    imageUrl: pokemon.imageUrl,
    animatedUrl: pokemon.animatedUrl,
    shiny: pokemon.shiny,
  });
  if (!info.name || !info.namePt) throw new TypeError('O encontro precisa ter nomes válidos.');
  const config = obterConfig(guildId);
  const expiresAt = now + ENCONTRO_TTL_MS;
  sql.upsertEncounter.run({
    guild_id: String(guildId),
    channel_id: String(channelId),
    pokemon_id: info.id,
    species_name: info.name,
    name_pt: info.namePt,
    capture_rate: info.captureRate,
    types_json: JSON.stringify(info.types),
    image_url: info.imageUrl,
    animated_url: info.animatedUrl,
    shiny: Number(info.shiny),
    expires_at: expiresAt,
    message_id: messageId ? String(messageId) : null,
  });
  return { ...info, channelId: String(channelId), expiresAt, messageId };
}

function reivindicarTentativaSpawn(guildId, channelId, incenseUntil, options = {}) {
  const now = Number(options.now) || Date.now();
  const random = options.random || Math.random;
  const claim = database.transaction(() => {
    const config = obterConfig(guildId);
    if (!config.enabled || config.muted) return false;
    if (config.channels.length && !config.channels.includes(String(channelId))) return false;
    const active = sql.encounter.get(String(guildId));
    if (active && active.expires_at > now) return false;
    if (active) sql.deleteEncounter.run(String(guildId));
    const state = sql.state.get(String(guildId));
    if (state && now - state.last_spawn_at < config.cooldownMs) return false;
    const chance = Math.min(1, config.spawnChance / 100 * (incenseUntil > now ? 1.5 : 1));
    if (random() >= chance) return false;
    sql.upsertState.run(String(guildId), now);
    return true;
  });
  return claim.immediate();
}

function listarColecao(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(250, Number(limit) || 20));
  return {
    pokemon: sql.collection.all(String(userId), safeLimit),
    ...sql.collectionCount.get(String(userId)),
  };
}

function ranking(limit = 10) {
  return sql.globalRanking.all(Math.max(1, Math.min(10, Number(limit) || 10)));
}

function rankingServidor(guildId, limit = 10) {
  if (!guildId) throw new TypeError('guildId é obrigatório para o ranking do servidor.');
  return sql.guildRanking.all(String(guildId), Math.max(1, Math.min(10, Number(limit) || 10)));
}

function obterPerfil(userId, guildId) {
  if (!userId) throw new TypeError('userId é obrigatório para o perfil Pokémon.');
  const servidorId = guildId ? String(guildId) : null;
  const global = sql.profileCount.get(String(userId));
  const servidor = servidorId
    ? sql.guildProfileCount.get(String(userId), servidorId)
    : { total: 0, species: 0, shinies: 0 };
  const globalPosition = global.total
    ? sql.globalRankPosition.get(global.total, global.total, global.species, global.total, global.species, String(userId)).position
    : null;
  const guildPosition = servidorId && servidor.total
    ? sql.guildRankPosition.get(servidorId, servidor.total, servidor.total, servidor.species, servidor.total, servidor.species, String(userId)).position
    : null;
  const preferences = obterPreferencias(userId);
  const inventory = sql.inventory.all(String(userId));
  return {
    global,
    servidor,
    globalPosition,
    guildPosition,
    latestGlobal: sql.latestCapture.get(String(userId)) || null,
    latestServer: servidorId ? sql.guildLatestCapture.get(String(userId), servidorId) || null : null,
    arceusExclusivo: Boolean(database.prepare(`
      SELECT 1 FROM pokemon_collection WHERE user_id = ? AND pokemon_id = ? LIMIT 1
    `).get(String(userId), ARCEUS_ID)),
    favorites: servidorId ? sql.favorites.all(servidorId, String(userId)) : [],
    inventoryCount: inventory.reduce((total, item) => total + item.quantity, 0),
    equippedBall: buscarItem(preferences.equippedBall),
    equippedCosmetic: buscarItem(preferences.equippedCosmetic),
    incenseUntil: preferences.incenseUntil,
  };
}

function carregarFallback(id) {
  const fallback = FallbackPokemon.find((item) => item.id === Number(id));
  if (!fallback) return null;
  return {
    ...fallback,
    types: [],
    imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${fallback.id}.png`,
    shinyImageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${fallback.id}.png`,
    animatedUrl: fallback.id <= 649
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${fallback.id}.gif`
      : null,
  };
}

async function buscarJson(url) {
  if (typeof fetch !== 'function') throw new Error('Este runtime do Node.js não oferece fetch global; atualize para Node 22+.');
  const resposta = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!resposta.ok) throw new Error(`PokéAPI respondeu HTTP ${resposta.status} para ${url}.`);
  return resposta.json();
}

function salvarCachePokemon(pokemon) {
  sql.cacheSpecies.run(pokemon.id, JSON.stringify(pokemon), Date.now());
}

async function obterPokemon(alvo) {
  const texto = String(alvo ?? '').trim().toLowerCase();
  if (!texto) return null;
  const cachedById = /^\d+$/.test(texto) ? sql.cachedSpecies.get(Number(texto)) : null;
  if (cachedById) return JSON.parse(cachedById.payload);

  if (!/^\d+$/.test(texto)) {
    const chave = normalizarNome(texto);
    const cacheRows = database.prepare('SELECT payload FROM pokemon_species_cache').all();
    for (const row of cacheRows) {
      const item = JSON.parse(row.payload);
      if ([item.name, item.namePt].some((name) => normalizarNome(name) === chave)) return item;
    }
    const fallback = FallbackPokemon.find((item) => [item.name, item.namePt].some((name) => normalizarNome(name) === chave));
    if (fallback) return carregarFallback(fallback.id);
  }

  const slug = texto.replace(/\s+/g, '-');
  if (!/^\d+$/.test(texto) && !/^[a-z0-9-]+$/.test(slug)) return null;
  const url = `${API_BASE}/pokemon/${encodeURIComponent(slug)}`;
  try {
    const pokemonData = await buscarJson(url);
    const speciesData = await buscarJson(pokemonData.species.url);
    const namePt = speciesData.names?.find((entry) => ['pt-br', 'pt'].includes(entry.language?.name))?.name || pokemonData.name;
    const official = pokemonData.sprites?.other?.['official-artwork'];
    const info = {
      id: pokemonData.id,
      name: pokemonData.name,
      namePt,
      captureRate: Number(speciesData.capture_rate) || 45,
      types: (pokemonData.types || []).map((entry) => entry.type.name),
      imageUrl: official?.front_default || pokemonData.sprites?.front_default || null,
      shinyImageUrl: official?.front_shiny || pokemonData.sprites?.front_shiny || null,
      animatedUrl: pokemonData.id <= 649
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokemonData.id}.gif`
        : null,
    };
    salvarCachePokemon(info);
    return info;
  } catch (erro) {
    console.warn(`[Pokémon] Não foi possível consultar a PokéAPI para "${texto}": ${erro?.message || erro}`);
    if (/^\d+$/.test(texto)) return carregarFallback(Number(texto));
    return null;
  }
}

async function sortearPokemon(random = Math.random) {
  const valor = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
  const candidato = 1 + Math.floor(valor * (MAX_POKEMON_ID - 1));
  const id = candidato >= ARCEUS_ID ? candidato + 1 : candidato;
  const item = await obterPokemon(String(id));
  if (item) return item;
  const fallback = FallbackPokemon[Math.floor(random() * FallbackPokemon.length)];
  console.warn(`[Pokémon] Usando espécie reserva (${fallback.name}) após falha da PokéAPI.`);
  return carregarFallback(fallback.id);
}

async function processarMensagem(message) {
  if (!message?.guild || !message.author || message.author.bot) return;
  const content = String(message.content || '').trim();
  if (!content) return;
  const encounter = obterEncontro(message.guild.id);
  const isPrefix = /^[!/$]/.test(content);
  if (encounter && encounter.channelId === message.channelId && !isPrefix && correspondeNome(encounter, content)) {
    const resultado = capturar(message.guild.id, message.channelId, message.author.id, content);
    if (resultado.ok) {
      await message.reply({ embeds: [criarEmbedCaptura(resultado, message.author)] });
    } else if (resultado.motivo === 'escapou') {
      await message.reply(`😿 ${message.author}, **${resultado.pokemon.namePt}** escapou da Pokébola! Tente novamente.`);
    }
    return;
  }
  if (isPrefix) return;

  const config = obterConfig(message.guild.id);
  if (!config.enabled || config.muted) return;
  if (config.channels.length && !config.channels.includes(String(message.channelId))) return;
  const preferencias = obterPreferencias(message.author.id);
  if (!reivindicarTentativaSpawn(message.guild.id, message.channelId, preferencias.incenseUntil)) return;
  const pokemon = await sortearPokemon();
  pokemon.shiny = Math.random() < 1 / 4096;
  const image = pokemon.shiny ? pokemon.shinyImageUrl || pokemon.imageUrl : pokemon.imageUrl;
  pokemon.imageUrl = image || pokemon.imageUrl;
  if (pokemon.shiny && pokemon.animatedUrl) {
    pokemon.animatedUrl = pokemon.animatedUrl.replace(/\/animated\/(\d+)\.gif$/, '/animated/shiny/$1.gif');
  }
  const embed = {
    color: pokemon.shiny ? 0xffd700 : 0xf2a7c8,
    title: pokemon.shiny ? '✨ Um Pokémon brilhante apareceu!' : '✨ Um Pokémon selvagem apareceu!',
    description:
      `**${pokemon.namePt}** apareceu! Use \`/pokemon capturar\` ou digite o nome para tentar capturar.\n` +
      `⏳ O encontro desaparece em **10 minutos**${pokemon.types.length ? `\n🏷️ Tipo: ${pokemon.types.join(' · ')}` : ''}`,
    image: { url: pokemon.animatedUrl || pokemon.imageUrl },
    footer: { text: `Pokédex #${String(pokemon.id).padStart(4, '0')} · Mila Pokémon` },
  };
  if (!embed.image.url) delete embed.image;
  const users = obterUsuariosParaAviso(message.guild.id, pokemon.id);
  const payload = {
    embeds: [embed],
    allowedMentions: { parse: [], users },
  };
  if (users.length) payload.content = `🔔 Favorito encontrado: ${users.map((id) => `<@${id}>`).join(' ')}`;

  try {
    const posted = await message.channel.send(payload);
    registrarEncontro(message.guild.id, message.channelId, pokemon, posted.id);
  } catch (erro) {
    console.error(`[Pokémon] Não consegui publicar encontro no servidor ${message.guild.id}:`, erro?.message || erro);
    throw erro;
  }
}

function criarEmbedCaptura(resultado, user) {
  const { pokemon, ball, cosmetic } = resultado;
  return {
    color: cosmetic?.cor || (pokemon.shiny ? 0xffd700 : 0x7ed6a5),
    title: pokemon.shiny ? '✨ Captura brilhante!' : 'Pokémon capturado!',
    description:
      `${user} capturou **${pokemon.namePt}**${pokemon.name !== pokemon.namePt ? ` (\`${pokemon.name}\`)` : ''}!\n` +
      `🏷️ Pokédex #${String(pokemon.id).padStart(4, '0')}\n` +
      `🎯 Pokébola: ${ball?.emoji || '🔴'} ${ball?.nome || 'Pokébola'}\n` +
      (cosmetic ? `🎨 Moldura: ${cosmetic.nome}\n` : '') +
      `\nVeja sua coleção com \`/pokemon colecao\`.`,
    image: pokemon.animatedUrl || pokemon.imageUrl ? { url: pokemon.animatedUrl || pokemon.imageUrl } : undefined,
    footer: { text: `Mila Pokémon · ${pokemon.shiny ? 'Brilhante!' : 'boa captura ♡'}` },
  };
}

module.exports = {
  MAX_POKEMON_ID,
  ARCEUS_ID,
  ENCONTRO_TTL_MS,
  INCENSO_MS,
  CATEGORIAS,
  MISSOES,
  listarItens,
  listarCategorias,
  buscarItem,
  normalizarNome,
  obterConfig,
  salvarConfig,
  atualizarCanal,
  obterPreferencias,
  salvarPreferencias,
  comprar,
  comprarLote,
  obterInventario,
  usarItem,
  equiparItem,
  listarFavoritos,
  alterarFavorito,
  listarMissoes,
  reivindicarMissao,
  garantirArceusDoCriador,
  obterUsuariosParaAviso,
  correspondeNome,
  capturar,
  obterEncontro,
  registrarEncontro,
  reivindicarTentativaSpawn,
  listarColecao,
  ranking,
  rankingServidor,
  obterPerfil,
  obterPokemon,
  sortearPokemon,
  processarMensagem,
  criarEmbedCaptura,
};
