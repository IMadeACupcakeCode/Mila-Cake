const db = require('./db');
const criador = require('./criador');
const typeChart = require('./typeChart');
const crypto = require('node:crypto');

const database = db.db;
const MAX_POKEMON_ID = 1025;
const NATURES = [
  { nome: 'Carinhoso', hp: 1.1, ataque: 0.95, defesa: 1.05, velocidade: 1 },
  { nome: 'Feroz', hp: 0.95, ataque: 1.15, defesa: 0.95, velocidade: 1.05 },
  { nome: 'Tímido', hp: 1, ataque: 0.9, defesa: 1, velocidade: 1.2 },
  { nome: 'Robusto', hp: 1.15, ataque: 1, defesa: 1.1, velocidade: 0.9 },
  { nome: 'Astuto', hp: 0.95, ataque: 1.05, defesa: 0.95, velocidade: 1.1 },
  { nome: 'Calmo', hp: 1.1, ataque: 0.9, defesa: 1.1, velocidade: 0.95 },
];
function natureAleatoria() { return NATURES[Math.floor(Math.random() * NATURES.length)].nome; }
function obterPokemonCacheSync(id) {
  try {
    const row = sql.cachedSpecies.get(Number(id));
    if (!row) return null;
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}
function obterNatureza(nome) { return NATURES.find((n) => n.nome === nome) || NATURES[0]; }

const ARCEUS_ID = 493;
const MISSINGNO_ID = 9001;
const ENCONTRO_TTL_MS = 10 * 60 * 1000;
const INCENSO_MS = 30 * 60 * 1000;
const API_TIMEOUT_MS = 10_000;
const SPAWN_RESERVATION_MS = 2 * 60 * 1000;
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

const PRESETS_CONFIG = {
  padrao: {
    nome: 'Aventura equilibrada',
    enabled: true,
    muted: false,
    spawnChance: 3,
    cooldownMs: 15 * 60 * 1000,
    shinyChance: 4096,
    rarityMode: 'equilibrada',
  },
  tranquilo: {
    nome: 'Tranquilo',
    enabled: true,
    muted: false,
    spawnChance: 2,
    cooldownMs: 30 * 60 * 1000,
    shinyChance: 4096,
    rarityMode: 'conservadora',
  },
  aventura: {
    nome: 'Aventura',
    enabled: true,
    muted: false,
    spawnChance: 5,
    cooldownMs: 10 * 60 * 1000,
    shinyChance: 2048,
    rarityMode: 'generosa',
  },
  silencio: {
    nome: 'Silencioso',
    enabled: false,
    muted: true,
    spawnChance: 3,
    cooldownMs: 15 * 60 * 1000,
    shinyChance: 4096,
    rarityMode: 'equilibrada',
  },
};

const EVOLUCOES = [
  { origem: 133, destino: 134, nome: 'Vaporeon', item: 'pedra_agua' },
  { origem: 133, destino: 135, nome: 'Jolteon', item: 'pedra_trovao' },
  { origem: 133, destino: 136, nome: 'Flareon', item: 'pedra_fogo' },
  { origem: 133, destino: 196, nome: 'Espeon', item: 'laco_amizade' },
  { origem: 133, destino: 197, nome: 'Umbreon', item: 'pedra_lunar' },
  { origem: 133, destino: 470, nome: 'Leafeon', item: 'pedra_folha' },
  { origem: 133, destino: 471, nome: 'Glaceon', item: 'pedra_gelo' },
  { origem: 133, destino: 700, nome: 'Sylveon', item: 'fita_fada' },
  { origem: 35, destino: 36, nome: 'Clefable', item: 'pedra_lunar' },
  { origem: 37, destino: 38, nome: 'Ninetales', item: 'pedra_fogo' },
  { origem: 58, destino: 59, nome: 'Arcanine', item: 'pedra_fogo' },
  { origem: 61, destino: 62, nome: 'Poliwrath', item: 'pedra_agua' },
  { origem: 61, destino: 186, nome: 'Politoed', item: 'pedra_rei' },
  { origem: 70, destino: 71, nome: 'Victreebel', item: 'pedra_folha' },
  { origem: 44, destino: 45, nome: 'Vileplume', item: 'pedra_folha' },
  { origem: 44, destino: 182, nome: 'Bellossom', item: 'pedra_solar' },
  { origem: 102, destino: 103, nome: 'Exeggutor', item: 'pedra_folha' },
  { origem: 271, destino: 272, nome: 'Ludicolo', item: 'pedra_agua' },
  { origem: 274, destino: 275, nome: 'Shiftry', item: 'pedra_folha' },
  { origem: 406, destino: 407, nome: 'Roserade', item: 'pedra_brilhante' },
  { origem: 548, destino: 549, nome: 'Lilligant', item: 'pedra_solar' },
  { origem: 546, destino: 547, nome: 'Whimsicott', item: 'pedra_solar' },
  { origem: 25, destino: 26, nome: 'Raichu', item: 'pedra_trovao' },
  { origem: 79, destino: 199, nome: 'Slowking', item: 'pedra_rei' },
  { origem: 117, destino: 230, nome: 'Kingdra', item: 'escama_dragao' },
  { origem: 123, destino: 212, nome: 'Scizor', item: 'revestimento_metal' },
  { origem: 95, destino: 208, nome: 'Steelix', item: 'revestimento_metal' },
  { origem: 137, destino: 233, nome: 'Porygon2', item: 'upgrade' },
  { origem: 233, destino: 474, nome: 'Porygon-Z', item: 'disco_duvidoso' },
  { origem: 356, destino: 477, nome: 'Dusknoir', item: 'tecido_ceifador' },
  { origem: 112, destino: 464, nome: 'Rhyperior', item: 'protetor' },
  { origem: 125, destino: 466, nome: 'Electivire', item: 'eletrizador' },
  { origem: 126, destino: 467, nome: 'Magmortar', item: 'magmatizador' },
  { origem: 215, destino: 461, nome: 'Weavile', item: 'garra_afiada' },
  { origem: 207, destino: 472, nome: 'Gliscor', item: 'presa_afiada' },
  { origem: 349, destino: 350, nome: 'Milotic', item: 'escama_bela' },
  { origem: 682, destino: 683, nome: 'Aromatisse', item: 'saquinho_perfumado' },
  { origem: 684, destino: 685, nome: 'Slurpuff', item: 'doce_batido' },
  { origem: 366, destino: 367, nome: 'Huntail', item: 'dente_abissal' },
  { origem: 366, destino: 368, nome: 'Gorebyss', item: 'escama_abissal' },
  { origem: 789, destino: 790, nome: 'Cosmoem', item: 'pedra_lunar', nivel: 43 },
  { origem: 790, destino: 791, nome: 'Solgaleo', item: 'pedra_solar', nivel: 53 },
  { origem: 790, destino: 792, nome: 'Lunala', item: 'pedra_lunar', nivel: 53 },
];

const CATEGORIAS = [
  { id: 'basicas', nome: 'Clássicas', emoji: '🔴', descricao: 'Pokébolas do dia a dia e modelos especiais.' },
  { id: 'situacionais', nome: 'Estratégicas', emoji: '🎯', descricao: 'Bolas com bônus para a aventura.' },
  { id: 'apricorn', nome: 'Apricorn', emoji: '🌰', descricao: 'Bolas artesanais e colecionáveis.' },
  { id: 'raras', nome: 'Raras', emoji: '✨', descricao: 'Bolas especiais e difíceis de encontrar.' },
  { id: 'consumiveis', nome: 'Consumíveis', emoji: '🪻', descricao: 'Itens de uso temporário.' },
  { id: 'evolucao', nome: 'Evolução', emoji: '💎', descricao: 'Pedras e itens para evoluir Pokémon.' },
  { id: 'cosmeticos', nome: 'Cosméticos', emoji: '🎨', descricao: 'Personalize a aparência das capturas.' },
  { id: 'cura', nome: 'Cura', emoji: '🧪', descricao: 'Poções e remédios para restaurar a vida e curar status.' },
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
  { id: 'pedra_fogo', nome: 'Pedra de Fogo', emoji: '🔥', preco: 2200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Pokémon compatíveis, como Eevee, Vulpix e Growlithe.' },
  { id: 'pedra_agua', nome: 'Pedra de Água', emoji: '💧', preco: 2200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Pokémon compatíveis, como Eevee, Poliwhirl e Lombre.' },
  { id: 'pedra_trovao', nome: 'Pedra do Trovão', emoji: '⚡', preco: 2400, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Pokémon compatíveis, como Eevee e Pikachu.' },
  { id: 'pedra_folha', nome: 'Pedra de Folha', emoji: '🍃', preco: 2200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Pokémon compatíveis, como Eevee, Gloom e Weepinbell.' },
  { id: 'pedra_lunar', nome: 'Pedra da Lua', emoji: '🌙', preco: 2400, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Pokémon compatíveis e Eevee para Umbreon.' },
  { id: 'pedra_gelo', nome: 'Pedra de Gelo', emoji: '❄️', preco: 2600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Eevee para Glaceon.' },
  { id: 'pedra_solar', nome: 'Pedra Solar', emoji: '☀️', preco: 2600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Pokémon compatíveis, incluindo Gloom, Cottonee e Petilil.' },
  { id: 'pedra_brilhante', nome: 'Pedra Brilhante', emoji: '✨', preco: 2800, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Roselia para Roserade.' },
  { id: 'laco_amizade', nome: 'Laço da Amizade', emoji: '🤝', preco: 3200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Ajuda Eevee a evoluir para Espeon.' },
  { id: 'fita_fada', nome: 'Fita de Fada', emoji: '🎀', preco: 3200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Ajuda Eevee a evoluir para Sylveon.' },
  { id: 'pedra_rei', nome: 'Pedra do Rei', emoji: '👑', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Catalisador para evoluções especiais de Poliwhirl e Slowpoke.' },
  { id: 'escama_dragao', nome: 'Escama de Dragão', emoji: '🐉', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Seadra para Kingdra.' },
  { id: 'revestimento_metal', nome: 'Revestimento Metálico', emoji: '🔩', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Onix para Steelix e Scyther para Scizor.' },
  { id: 'upgrade', nome: 'Upgrade', emoji: '💿', preco: 4600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Porygon para Porygon2.' },
  { id: 'disco_duvidoso', nome: 'Disco Duvidoso', emoji: '📀', preco: 5200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Porygon2 para Porygon-Z.' },
  { id: 'tecido_ceifador', nome: 'Tecido Ceifador', emoji: '🧵', preco: 4600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Dusclops para Dusknoir.' },
  { id: 'protetor', nome: 'Protetor', emoji: '🛡️', preco: 4600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Rhydon para Rhyperior.' },
  { id: 'eletrizador', nome: 'Eletrizador', emoji: '🔋', preco: 4600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Electabuzz para Electivire.' },
  { id: 'magmatizador', nome: 'Magmatizador', emoji: '🌋', preco: 4600, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Magmar para Magmortar.' },
  { id: 'garra_afiada', nome: 'Garra Afiada', emoji: '🗡️', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Sneasel para Weavile.' },
  { id: 'presa_afiada', nome: 'Presa Afiada', emoji: '🦷', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Gligar para Gliscor.' },
  { id: 'escama_bela', nome: 'Escama Bela', emoji: '🐚', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Feebas para Milotic.' },
  { id: 'saquinho_perfumado', nome: 'Saquinho Perfumado', emoji: '🌸', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Spritzee para Aromatisse.' },
  { id: 'doce_batido', nome: 'Doce Batido', emoji: '🍬', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Swirlix para Slurpuff.' },
  { id: 'dente_abissal', nome: 'Dente Abissal', emoji: '🦈', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Clamperl para Huntail.' },
  { id: 'escama_abissal', nome: 'Escama Abissal', emoji: '🌊', preco: 4200, tipo: 'evolucao', categoria: 'evolucao', descricao: 'Evolui Clamperl para Gorebyss.' },
  { id: 'moldura_morango', nome: 'Moldura Morango', emoji: '🍓', preco: 3500, tipo: 'cosmetico', categoria: 'cosmeticos', cor: 0xff80ab, descricao: 'Uma moldura rosa para suas capturas.' },
  { id: 'moldura_aurora', nome: 'Moldura Aurora', emoji: '🌌', preco: 6500, tipo: 'cosmetico', categoria: 'cosmeticos', cor: 0x8e9bff, descricao: 'Uma moldura cósmica para suas capturas.' },
  { id: 'moldura_limao', nome: 'Moldura Limão', emoji: '🍋', preco: 5000, tipo: 'cosmetico', categoria: 'cosmeticos', cor: 0x9bd36a, descricao: 'Uma moldura verde para suas capturas.' },
  { id: 'pocao', nome: 'Poção', emoji: '🧪', preco: 300, tipo: 'cura', categoria: 'cura', curaHp: 20, descricao: 'Recupera 20 HP de um Pokémon.' },
  { id: 'superpocao', nome: 'Super Poção', emoji: '🧴', preco: 700, tipo: 'cura', categoria: 'cura', curaHp: 50, descricao: 'Recupera 50 HP de um Pokémon.' },
  { id: 'hiperpocao', nome: 'Hiper Poção', emoji: '⚗️', preco: 1500, tipo: 'cura', categoria: 'cura', curaHp: 120, descricao: 'Recupera 120 HP de um Pokémon.' },
  { id: 'pocao_maxima', nome: 'Poção Máxima', emoji: '💠', preco: 2800, tipo: 'cura', categoria: 'cura', curaHp: 9999, descricao: 'Recupera todo o HP de um Pokémon.' },
  { id: 'antidoto', nome: 'Antídoto', emoji: '💚', preco: 200, tipo: 'cura', categoria: 'cura', curaStatus: ['poison'], descricao: 'Cura o veneno de um Pokémon.' },
  { id: 'cura_paralisia', nome: 'Cura Paralisia', emoji: '💛', preco: 200, tipo: 'cura', categoria: 'cura', curaStatus: ['paralysis'], descricao: 'Cura a paralisia de um Pokémon.' },
  { id: 'cura_queimadura', nome: 'Cura Queimadura', emoji: '🧊', preco: 250, tipo: 'cura', categoria: 'cura', curaStatus: ['burn'], descricao: 'Cura a queimadura de um Pokémon.' },
  { id: 'cura_sono', nome: 'Despertar', emoji: '⏰', preco: 250, tipo: 'cura', categoria: 'cura', curaStatus: ['sleep'], descricao: 'Acorda um Pokémon adormecido.' },
  { id: 'cura_gelo', nome: 'Descongelante', emoji: '🔥', preco: 250, tipo: 'cura', categoria: 'cura', curaStatus: ['freeze'], descricao: 'Descongela um Pokémon congelado.' },
  { id: 'cura_total', nome: 'Cura Total', emoji: '🌈', preco: 900, tipo: 'cura', categoria: 'cura', curaStatus: ['poison', 'paralysis', 'burn', 'sleep', 'freeze'], descricao: 'Cura qualquer status negativo de um Pokémon.' },
  { id: 'reviver', nome: 'Reviver', emoji: '💖', preco: 2000, tipo: 'cura', categoria: 'cura', revive: true, descricao: 'Revive um Pokémon desmaiado com metade do HP máximo.' },
  { id: 'doce_raro', nome: 'Doce Raro', emoji: '🍬', preco: 1000, tipo: 'xp', categoria: 'cura', xp: 1000, descricao: 'Concede 1000 XP a um Pokémon.' },
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
    channels_json TEXT NOT NULL DEFAULT '[]',
    rarity_mode TEXT NOT NULL DEFAULT 'equilibrada',
    shiny_chance INTEGER NOT NULL DEFAULT 4096,
    encounter_ttl_ms INTEGER NOT NULL DEFAULT 600000
  );
  CREATE TABLE IF NOT EXISTS pokemon_spawn_state (
    guild_id TEXT PRIMARY KEY,
    last_spawn_at INTEGER NOT NULL DEFAULT 0,
    pending_token TEXT,
    pending_until INTEGER NOT NULL DEFAULT 0
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
    incense_until INTEGER NOT NULL DEFAULT 0,
    team_json TEXT
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

const spawnStateColumns = new Set(database.prepare('PRAGMA table_info(pokemon_spawn_state)').all().map((column) => column.name));
if (!spawnStateColumns.has('pending_token')) {
  database.exec('ALTER TABLE pokemon_spawn_state ADD COLUMN pending_token TEXT');
}
if (!spawnStateColumns.has('pending_until')) {
  database.exec('ALTER TABLE pokemon_spawn_state ADD COLUMN pending_until INTEGER NOT NULL DEFAULT 0');
}

const configColumns = new Set(database.prepare('PRAGMA table_info(pokemon_server_config)').all().map((column) => column.name));
if (!configColumns.has('rarity_mode')) {
  database.exec("ALTER TABLE pokemon_server_config ADD COLUMN rarity_mode TEXT NOT NULL DEFAULT 'equilibrada'");
}
if (!configColumns.has('shiny_chance')) {
  database.exec('ALTER TABLE pokemon_server_config ADD COLUMN shiny_chance INTEGER NOT NULL DEFAULT 4096');
}
if (!configColumns.has('encounter_ttl_ms')) {
  database.exec('ALTER TABLE pokemon_server_config ADD COLUMN encounter_ttl_ms INTEGER NOT NULL DEFAULT 600000');
}

const collectionColumns = new Set(database.prepare('PRAGMA table_info(pokemon_collection)').all().map((column) => column.name));
if (!collectionColumns.has('guild_id')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN guild_id TEXT');
}
if (!collectionColumns.has('xp')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN xp INTEGER NOT NULL DEFAULT 0');
}
if (!collectionColumns.has('nature')) {
  database.exec("ALTER TABLE pokemon_collection ADD COLUMN nature TEXT");
}
if (!collectionColumns.has('hp_atual')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN hp_atual INTEGER');
}
if (!collectionColumns.has('status')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN status TEXT');
}
if (!collectionColumns.has('status_turns')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN status_turns INTEGER NOT NULL DEFAULT 0');
}
if (!collectionColumns.has('moves_json')) {
  database.exec('ALTER TABLE pokemon_collection ADD COLUMN moves_json TEXT');
}
const encounterColumns = new Set(database.prepare('PRAGMA table_info(pokemon_encounters)').all().map((column) => column.name));
if (!encounterColumns.has('level')) {
  database.exec('ALTER TABLE pokemon_encounters ADD COLUMN level INTEGER NOT NULL DEFAULT 1');
}
const preferenceColumns = new Set(database.prepare('PRAGMA table_info(pokemon_user_preferences)').all().map((column) => column.name));
if (!preferenceColumns.has('team_json')) {
  database.exec('ALTER TABLE pokemon_user_preferences ADD COLUMN team_json TEXT');
}
database.exec('CREATE INDEX IF NOT EXISTS idx_pokemon_collection_guild ON pokemon_collection(guild_id, user_id, caught_at DESC)');

const sql = {
  config: database.prepare('SELECT * FROM pokemon_server_config WHERE guild_id = ?'),
  upsertConfig: database.prepare(`
    INSERT INTO pokemon_server_config
      (guild_id, enabled, muted, spawn_chance, cooldown_ms, channels_json, rarity_mode, shiny_chance, encounter_ttl_ms)
    VALUES (@guild_id, @enabled, @muted, @spawn_chance, @cooldown_ms, @channels_json, @rarity_mode, @shiny_chance, @encounter_ttl_ms)
    ON CONFLICT(guild_id) DO UPDATE SET
      enabled = excluded.enabled, muted = excluded.muted, spawn_chance = excluded.spawn_chance,
      cooldown_ms = excluded.cooldown_ms, channels_json = excluded.channels_json,
      rarity_mode = excluded.rarity_mode, shiny_chance = excluded.shiny_chance,
      encounter_ttl_ms = excluded.encounter_ttl_ms
  `),
  state: database.prepare('SELECT last_spawn_at, pending_token, pending_until FROM pokemon_spawn_state WHERE guild_id = ?'),
  reserveSpawn: database.prepare(`
    INSERT INTO pokemon_spawn_state (guild_id, last_spawn_at, pending_token, pending_until)
    VALUES (@guild_id, 0, @token, @expires_at)
    ON CONFLICT(guild_id) DO UPDATE SET
      pending_token = excluded.pending_token, pending_until = excluded.pending_until
  `),
  finishSpawn: database.prepare(`
    UPDATE pokemon_spawn_state
       SET last_spawn_at = ?, pending_token = NULL, pending_until = 0
     WHERE guild_id = ? AND pending_token = ?
  `),
  releaseSpawn: database.prepare(`
    UPDATE pokemon_spawn_state SET pending_token = NULL, pending_until = 0
     WHERE guild_id = ? AND pending_token = ?
  `),
  encounter: database.prepare('SELECT * FROM pokemon_encounters WHERE guild_id = ?'),
  upsertEncounter: database.prepare(`
    INSERT INTO pokemon_encounters
      (guild_id, channel_id, pokemon_id, species_name, name_pt, capture_rate, types_json,
       image_url, animated_url, shiny, level, expires_at, message_id)
    VALUES (@guild_id, @channel_id, @pokemon_id, @species_name, @name_pt, @capture_rate, @types_json,
       @image_url, @animated_url, @shiny, @level, @expires_at, @message_id)
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id, pokemon_id = excluded.pokemon_id,
      species_name = excluded.species_name, name_pt = excluded.name_pt,
      capture_rate = excluded.capture_rate, types_json = excluded.types_json,
      image_url = excluded.image_url, animated_url = excluded.animated_url,
      shiny = excluded.shiny, level = excluded.level, expires_at = excluded.expires_at, message_id = excluded.message_id
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
    SELECT id, pokemon_id, species_name, name_pt, shiny, level, xp, caught_at, ball_id, cosmetic_id, nature, hp_atual, status, status_turns, moves_json
      FROM pokemon_collection WHERE user_id = ? ORDER BY caught_at DESC, id DESC LIMIT ? OFFSET ?
  `),
  collectionByGuild: database.prepare(`
    SELECT id, pokemon_id, species_name, name_pt, shiny, level, xp, caught_at, ball_id, cosmetic_id, nature, hp_atual, status, status_turns, moves_json
      FROM pokemon_collection WHERE user_id = ? AND guild_id = ?
      ORDER BY caught_at DESC, id DESC LIMIT ? OFFSET ?
  `),
  collectionCount: database.prepare('SELECT COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species FROM pokemon_collection WHERE user_id = ?'),
  collectionCountByGuild: database.prepare(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT pokemon_id) AS species
      FROM pokemon_collection WHERE user_id = ? AND guild_id = ?
  `),
  collectionEntry: database.prepare(`
    SELECT id, user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, xp, nature, hp_atual, status, status_turns, moves_json
      FROM pokemon_collection WHERE id = ? AND user_id = ?
  `),
  evolveCollectionEntry: database.prepare(`
    UPDATE pokemon_collection SET pokemon_id = ?, species_name = ?, name_pt = ?
      WHERE id = ? AND user_id = ? AND pokemon_id = ?
  `),
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
  return {
    // Encontros começam desligados: só ativam quando a equipe escolher um
    // canal com `$configurar pokemon #canal` (ou `$p canal adicionar`).
    enabled: false,
    muted: false,
    spawnChance: 3,
    cooldownMs: 15 * 60 * 1000,
    channels: [],
    rarityMode: 'equilibrada',
    shinyChance: 4096,
    encounterTtlMs: 10 * 60 * 1000,
  };
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
    rarityMode: row.rarity_mode || 'equilibrada',
    shinyChance: row.shiny_chance || 4096,
    encounterTtlMs: row.encounter_ttl_ms || 10 * 60 * 1000,
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
    if (!Number.isInteger(cooldown) || cooldown < 1_000 || cooldown > 24 * 60 * 60 * 1000) {
      throw new RangeError('O intervalo deve ficar entre 1 segundo e 24 horas.');
    }
    config.cooldownMs = cooldown;
  }
  if (patch.rarityMode !== undefined) {
    if (!['conservadora', 'equilibrada', 'generosa'].includes(patch.rarityMode)) {
      throw new RangeError('Escolha uma configuração de raridade válida.');
    }
    config.rarityMode = patch.rarityMode;
  }
  if (patch.shinyChance !== undefined) {
    const shinyChance = Number(patch.shinyChance);
    if (!Number.isInteger(shinyChance) || shinyChance < 1 || shinyChance > 100_000) {
      throw new RangeError('A chance shiny deve ser um denominador entre 1 e 100000.');
    }
    config.shinyChance = shinyChance;
  }
  if (patch.channels !== undefined) {
    if (!Array.isArray(patch.channels) || patch.channels.some((id) => !/^\d{5,25}$/.test(String(id)))) {
      throw new TypeError('A lista de canais é inválida.');
    }
    config.channels = [...new Set(patch.channels.map(String))];
  }
  if (patch.encounterTtlMs !== undefined) {
    const ttl = Number(patch.encounterTtlMs);
    if (!Number.isInteger(ttl) || ttl < 5_000 || ttl > 60 * 60 * 1000) {
      throw new RangeError('A duração do encontro deve ficar entre 5 segundos e 1 hora.');
    }
    config.encounterTtlMs = ttl;
  }
  sql.upsertConfig.run({
    guild_id: String(guildId),
    enabled: Number(config.enabled),
    muted: Number(config.muted),
    spawn_chance: config.spawnChance,
    cooldown_ms: config.cooldownMs,
    channels_json: JSON.stringify(config.channels),
    rarity_mode: config.rarityMode,
    shiny_chance: config.shinyChance,
    encounter_ttl_ms: config.encounterTtlMs,
  });
  return config;
}

function aplicarPreset(guildId, presetId) {
  const preset = PRESETS_CONFIG[String(presetId || '').toLowerCase()];
  if (!preset) throw new RangeError('Preset Pokémon desconhecido.');
  return salvarConfig(guildId, {
    ...preset,
    channels: obterConfig(guildId).channels,
  });
}

function atualizarCanal(guildId, action, channelId) {
  const config = obterConfig(guildId);
  if (action === 'listar') return config.channels;
  if (!channelId || !/^\d{5,25}$/.test(String(channelId))) throw new TypeError('Informe um canal válido.');
  const channels = new Set(config.channels);
  if (action === 'adicionar') channels.add(String(channelId));
  else if (action === 'remover') channels.delete(String(channelId));
  else throw new TypeError('Ação de canal inválida.');
  const lista = [...channels];
  // Configurar o primeiro canal liga os encontros automaticamente; remover
  // o último desliga, porque sem canal não há onde os Pokémon aparecerem.
  if (action === 'adicionar') {
    return salvarConfig(guildId, { channels: lista, enabled: true, muted: false }).channels;
  }
  return salvarConfig(guildId, { channels: lista, ...(lista.length ? {} : { enabled: false }) }).channels;
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
    team: row.team_json ? JSON.parse(row.team_json) : [],
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
  if (patch.team !== undefined) preferencias.team = Array.isArray(patch.team) ? patch.team : [];
  database.prepare(`
    UPDATE pokemon_user_preferences
       SET ping_enabled = ?, favorite_alerts = ?, equipped_ball = ?, equipped_cosmetic = ?, incense_until = ?, team_json = ?
     WHERE user_id = ?
  `).run(
    Number(preferencias.pingEnabled),
    Number(preferencias.favoriteAlerts),
    preferencias.equippedBall,
    preferencias.equippedCosmetic,
    preferencias.incenseUntil,
    JSON.stringify(preferencias.team || []),
    String(userId)
  );
  return preferencias;
}

function obterTime(userId, guildId = null) {
  const prefs = obterPreferencias(userId);
  const slots = Array.isArray(prefs.team) ? prefs.team : [];
  const colecao = listarColecao(userId, 250, 0, guildId).pokemon;
  const porId = new Map(colecao.map((item) => [Number(item.id), item]));
  return slots
    .map((id) => porId.get(Number(id)))
    .filter(Boolean);
}

function salvarTime(userId, guildId = null, slots = []) {
  const ids = [...new Set((slots || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 7);
  const prefs = salvarPreferencias(userId, { team: ids });
  return ids;
}

function limparTime(userId) {
  return salvarPreferencias(userId, { team: [] });
}
function salvarGolpes(userId, collectionId, moves) {
  const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
  if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };
  const lista = Array.isArray(moves) ? [...new Set(moves.map((item) => String(item).trim()).filter(Boolean))].slice(0, 4) : [];
  database.prepare('UPDATE pokemon_collection SET moves_json = ? WHERE id = ? AND user_id = ?')
    .run(JSON.stringify(lista), Number(collectionId), String(userId));
  return { ok: true, moves: lista };
}

function liberarPokemon(userId, collectionId) {
  const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
  if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };
  if (Number(captura.pokemon_id) === ARCEUS_ID && criador.ehCriador(userId)) {
    return { ok: false, motivo: 'exclusivo_criador' };
  }
  if (Number(captura.pokemon_id) === MISSINGNO_ID && criador.ehCriador(userId)) {
    return { ok: false, motivo: 'exclusivo_criador' };
  }
  const species = obterPokemonCacheSync(captura.pokemon_id);
  const captureRate = Math.max(1, Number(species?.captureRate) || 45);
  const tipos = Array.isArray(species?.types) ? species.types.length : 1;
  const base = Math.max(1, Math.round(Number(captura.level) * 8 * (255 / (captureRate + 1)) * (1 + 0.12 * (tipos - 1))));
  const prefs = obterPreferencias(userId);
  const team = Array.isArray(prefs.team) ? prefs.team.filter((id) => Number(id) !== Number(collectionId)) : [];
  salvarPreferencias(userId, { team });
  database.prepare('DELETE FROM pokemon_collection WHERE id = ? AND user_id = ?').run(Number(collectionId), String(userId));
  let recompensa = 0;
  if (Math.random() < 0.6) {
    recompensa = base;
    try { db.addAcucares(userId, recompensa); } catch { /* ignora */ }
  }
  return { ok: true, pokemon: captura, recompensa, base };
}

function doarPokemon(userId, recipientId, collectionId) {
  if (String(userId) === String(recipientId)) return { ok: false, motivo: 'mesmo_usuario' };
  const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
  if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };
  if (Number(captura.pokemon_id) === ARCEUS_ID && criador.ehCriador(userId)) {
    return { ok: false, motivo: 'exclusivo_criador' };
  }
  if (Number(captura.pokemon_id) === MISSINGNO_ID && criador.ehCriador(userId)) {
    return { ok: false, motivo: 'exclusivo_criador' };
  }
  const transacao = database.transaction(() => {
    const atual = database.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(Number(collectionId));
    if (!atual || String(atual.user_id) !== String(userId)) {
      return { ok: false, motivo: 'mudou_de_dono' };
    }
    const prefs = obterPreferencias(userId);
    const team = Array.isArray(prefs.team) ? prefs.team.filter((id) => Number(id) !== Number(collectionId)) : [];
    salvarPreferencias(userId, { team });
    database.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?').run(String(recipientId), Number(collectionId));
    return { ok: true, pokemon: captura };
  });
  return transacao();
}
function golpesSalvos(captura) {
  if (!captura?.moves_json) return null;
  try { return JSON.parse(captura.moves_json); } catch { return null; }
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

function consumirItem(userId, itemId) {
  const changes = database.prepare('UPDATE pokemon_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ? AND quantity > 0').run(String(userId), String(itemId)).changes;
  return changes === 1;
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

    // ── XP de Pokémon por completar missão ──
    const xpPorMissao = 500;
    const colecao = listarColecao(userId, 250).pokemon;
    const xpResultados = [];
    for (const poke of colecao) {
      const resultadoXp = ganharXpPokemon(userId, Number(poke.id), xpPorMissao);
      if (resultadoXp.ok && resultadoXp.subiu) {
        xpResultados.push(`${poke.name_pt || poke.species_name} → nível ${resultadoXp.nivelNovo} ⬆️`);
      }
    }

    return {
      ok: true,
      missao: atual,
      recompensa: buscarItem(missao.recompensa),
      xpPokemon: xpResultados,
    };
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
    const existenteMissing = database.prepare(`
      SELECT id FROM pokemon_collection
       WHERE pokemon_id = ? AND user_id IN (${idsCriador.map(() => '?').join(',')})
       ORDER BY caught_at ASC, id ASC LIMIT 1
    `).get(MISSINGNO_ID, ...idsCriador);
    if (!existenteMissing) {
      database.prepare(`
        INSERT INTO pokemon_collection
          (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id, cosmetic_id, moves_json)
        VALUES (?, NULL, ?, 'missingno', 'MissingNo.', 0, 100, ?, 'masterball', NULL, ?)
      `).run(solicitanteId || idsCriador[0], MISSINGNO_ID, now, JSON.stringify(['gaster-blaster', 'command-block', 'mordida-de-87', 'slenderman']));
    }
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
    if (Number(pokemon.id) === MISSINGNO_ID && !criador.ehCriador(userId)) return { ok: false, motivo: 'exclusivo_criador', pokemon };
    if (Number(pokemon.id) === ARCEUS_ID && (!usaBola || usaBola.id !== 'masterball')) return { ok: false, motivo: 'precisa_masterball', pokemon };
    // Arceus agora pode ser capturado publicamente.

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
    const nature = natureAleatoria();
    const result = database.prepare(`
      INSERT INTO pokemon_collection
        (user_id, guild_id, pokemon_id, species_name, name_pt, shiny, level, caught_at, ball_id, cosmetic_id, nature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(String(userId), String(guildId), row.pokemon_id, row.species_name, row.name_pt, row.shiny, Math.max(1, Math.min(100, Number(row.level) || 1)), now, ballId, cosmetic?.id || null, nature);
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
    level: Math.max(1, Math.min(100, Number(row.level) || 1)),
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
  if (!guildId || !channelId || !pokemon || !Number.isInteger(Number(pokemon.id)) || Number(pokemon.id) < 1 || (Number(pokemon.id) > MAX_POKEMON_ID && Number(pokemon.id) !== MISSINGNO_ID)) {
    throw new TypeError('Encontro inválido.');
  }
  if (Number(pokemon.id) === ARCEUS_ID) {
    // Arceus agora pode aparecer em encontros.
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
    level: pokemon.level,
  });
  if (!info.name || !info.namePt) throw new TypeError('O encontro precisa ter nomes válidos.');
  const config = obterConfig(guildId);
  const expiresAt = now + (config.encounterTtlMs || ENCONTRO_TTL_MS);
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
    level: info.level,
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
    // Sem canal configurado não há encontros: o padrão é ficar desligado
    // esperando a equipe escolher onde os Pokémon podem aparecer.
    if (!config.channels.length) return false;
    if (!config.channels.includes(String(channelId))) return false;
    const active = sql.encounter.get(String(guildId));
    if (active && active.expires_at > now) return false;
    if (active) sql.deleteEncounter.run(String(guildId));
    const state = sql.state.get(String(guildId));
    if (state?.pending_token && state.pending_until > now) return false;
    if (state?.last_spawn_at > 0 && now - state.last_spawn_at < config.cooldownMs) return false;
    const chance = Math.min(1, config.spawnChance / 100 * (incenseUntil > now ? 1.5 : 1));
    if (random() >= chance) return false;
    const token = crypto.randomBytes(12).toString('hex');
    sql.reserveSpawn.run({
      guild_id: String(guildId),
      token,
      expires_at: now + SPAWN_RESERVATION_MS,
    });
    return token;
  });
  return claim.immediate();
}

function confirmarTentativaSpawn(guildId, token, now = Date.now()) {
  if (!guildId || !token) throw new TypeError('Servidor e reserva são obrigatórios para confirmar o encontro.');
  return sql.finishSpawn.run(Number(now) || Date.now(), String(guildId), String(token)).changes === 1;
}

function liberarTentativaSpawn(guildId, token) {
  if (!guildId || !token) return false;
  return sql.releaseSpawn.run(String(guildId), String(token)).changes === 1;
}

const CHANCES_RARIDADE = {
  conservadora: { comum: 1, incomum: 0.45, raro: 0.2, lendario: 0.05 },
  equilibrada: { comum: 1, incomum: 0.75, raro: 0.45, lendario: 0.2 },
  generosa: { comum: 1, incomum: 0.95, raro: 0.8, lendario: 0.55 },
};

function ajustarRaridadePokemon(pokemon, rarityMode, random = Math.random) {
  const chances = CHANCES_RARIDADE[rarityMode];
  if (!chances) throw new RangeError(`Configuração de raridade inválida: ${rarityMode}.`);
  const raridade = classificarRaridade(pokemon.captureRate);
  if (random() < chances[raridade.id]) return pokemon;

  const comuns = FallbackPokemon.filter((item) => classificarRaridade(item.captureRate).id === 'comum');
  if (!comuns.length) throw new Error('Não há espécies comuns disponíveis para completar o encontro.');
  const indice = Math.min(comuns.length - 1, Math.floor(Math.max(0, random()) * comuns.length));
  console.info(`[Pokémon] A raridade "${rarityMode}" selecionou uma espécie comum em vez de ${pokemon.name}.`);
  return carregarFallback(comuns[indice].id);
}

function listarColecao(userId, limit = 20, offset = 0, guildId = null) {
  const safeLimit = Math.max(1, Math.min(250, Number(limit) || 20));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const normalizar = (lista) => (lista || []).map((item) => ({
    ...item,
    nature: item.nature || NATURES[item.id % NATURES.length].nome,
  }));
  if (guildId) {
    return {
      pokemon: normalizar(sql.collectionByGuild.all(String(userId), String(guildId), safeLimit, safeOffset)),
      ...sql.collectionCountByGuild.get(String(userId), String(guildId)),
    };
  }
  return {
    pokemon: normalizar(sql.collection.all(String(userId), safeLimit, safeOffset)),
    ...sql.collectionCount.get(String(userId)),
  };
}

function calcularStatusPokemon(captura, species) {
  const nature = obterNatureza(captura?.nature);
  const base = species?.stats || {};
  const level = Math.max(1, Number(captura?.level) || 1);
  const hpBase = Number(base.hp) || 45;
  const atkBase = Number(base.attack) || 49;
  const defBase = Number(base.defense) || 49;
  const spdBase = Number(base.speed) || 45;
  const stat = (valor, hp = false) => Math.floor(((2 * valor + 31) * level) / 100) + (hp ? level + 10 : 5);
  return {
    natureza: nature.nome,
    hp: Math.round(stat(hpBase, true) * nature.hp),
    ataque: Math.round(stat(atkBase) * nature.ataque),
    defesa: Math.round(stat(defBase) * nature.defesa),
    velocidade: Math.round(stat(spdBase) * nature.velocidade),
  };
}

const STATUS_VITAIS = {
  burn: { nome: 'Queimado', emoji: '🔥', cor: 0xff7a45 },
  poison: { nome: 'Envenenado', emoji: '☠️', cor: 0x9b59b6 },
  paralysis: { nome: 'Paralisado', emoji: '⚡', cor: 0xf1c40f },
  sleep: { nome: 'Dormindo', emoji: '💤', cor: 0x5dade2 },
  freeze: { nome: 'Congelado', emoji: '❄️', cor: 0x85c1e9 },
};

function estadoVidaPokemon(captura, species) {
  const status = calcularStatusPokemon(captura, species);
  const hpMax = Math.max(1, status.hp);
  const hpBruto = captura?.hp_atual;
  const hp = hpBruto === null || hpBruto === undefined
    ? hpMax
    : Math.max(0, Math.min(hpMax, Math.round(Number(hpBruto) || 0)));
  const chave = captura?.status || null;
  return {
    hp,
    hpMax,
    desmaiado: hp <= 0,
    status: chave,
    statusNome: STATUS_VITAIS[chave]?.nome || null,
    statusEmoji: STATUS_VITAIS[chave]?.emoji || null,
  };
}

function salvarVidaPokemon(userId, collectionId, { hp, status, statusTurns } = {}) {
  const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
  if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };
  const species = obterPokemonCacheSync(captura.pokemon_id);
  const vida = estadoVidaPokemon(captura, species);
  const novoHp = hp === undefined ? vida.hp : Math.max(0, Math.min(vida.hpMax, Math.round(Number(hp) || 0)));
  const novoStatus = status === undefined ? captura.status : status;
  const novosTurnos = statusTurns === undefined ? Number(captura.status_turns) || 0 : Math.max(0, Number(statusTurns) || 0);
  database.prepare('UPDATE pokemon_collection SET hp_atual = ?, status = ?, status_turns = ? WHERE id = ? AND user_id = ?')
    .run(novoHp, novoStatus || null, novosTurnos, Number(collectionId), String(userId));
  return { ok: true, hp: novoHp, hpMax: vida.hpMax, status: novoStatus || null };
}

function definirStatusPokemon(userId, collectionId, status, turns = 0) {
  return salvarVidaPokemon(userId, collectionId, { status: status || null, statusTurns: turns });
}

function usarCuraPokemon(userId, collectionId, itemId) {
  const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
  if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };
  const item = buscarItem(itemId);
  if (!item || item.tipo !== 'cura') return { ok: false, motivo: 'item_invalido' };
  if ((sql.inventoryItem.get(String(userId), item.id)?.quantity || 0) < 1) return { ok: false, motivo: 'sem_item', item };
  const species = obterPokemonCacheSync(captura.pokemon_id);
  const vida = estadoVidaPokemon(captura, species);
  let hp = vida.hp;
  let status = vida.status;
  let curouAlgo = false;
  if (item.revive) {
    if (!vida.desmaiado) return { ok: false, motivo: 'nao_desmaiado', item };
    hp = Math.max(1, Math.floor(vida.hpMax / 2));
    status = null;
    curouAlgo = true;
  } else {
    if (item.curaHp) {
      const alvo = Math.min(vida.hpMax, hp + item.curaHp);
      if (alvo > hp) { hp = alvo; curouAlgo = true; }
    }
    if (Array.isArray(item.curaStatus) && status && item.curaStatus.includes(status)) {
      status = null;
      curouAlgo = true;
    }
  }
  if (!curouAlgo) return { ok: false, motivo: 'sem_efeito', item, hp, hpMax: vida.hpMax, status };
  if (sql.useInventory.run(String(userId), item.id).changes !== 1) return { ok: false, motivo: 'sem_item', item };
  const salvo = salvarVidaPokemon(userId, collectionId, { hp, status, statusTurns: 0 });
  return { ok: true, item, hp: salvo.hp, hpMax: salvo.hpMax, status: salvo.status, pokemon: captura };
}

const EVOLUCAO_ITEM_MAP = {
  'fire-stone': 'pedra_fogo',
  'water-stone': 'pedra_agua',
  'thunder-stone': 'pedra_trovao',
  'leaf-stone': 'pedra_folha',
  'moon-stone': 'pedra_lunar',
  'sun-stone': 'pedra_solar',
  'dawn-stone': 'pedra_brilhante',
  'dusk-stone': 'pedra_crepusculo',
  'shiny-stone': 'pedra_brilhante',
  'ice-stone': 'pedra_gelo',
  'kings-rock': 'pedra_rei',
  'metal-coat': 'revestimento_metal',
  'dragon-scale': 'escama_dragao',
  'upgrade': 'upgrade',
  'dubious-disc': 'disco_duvidoso',
  'reaper-cloth': 'tecido_ceifador',
  'protector': 'protetor',
  'electirizer': 'eletrizador',
  'magmarizer': 'magmatizador',
  'razor-claw': 'garra_afiada',
  'razor-fang': 'presa_afiada',
  'prism-scale': 'escama_bela',
  'sachet': 'saquinho_perfumado',
  'whipped-dream': 'doce_batido',
  'deep-sea-tooth': 'dente_abissal',
  'deep-sea-scale': 'escama_abissal',
};

const cacheEvolucoes = new Map();

async function obterEvolucoes(pokemonId) {
  const id = Number(pokemonId);
  if (cacheEvolucoes.has(id)) return cacheEvolucoes.get(id);
  let resultado = EVOLUCOES.filter((evolucao) => evolucao.origem === id).map((evolucao) => ({
    ...evolucao,
    item: buscarItem(evolucao.item),
    nivel: Number(evolucao.nivel) || 1,
  }));

  try {
    const speciesData = await buscarJson(`${API_BASE}/pokemon-species/${id}`);
    if (speciesData?.evolution_chain?.url) {
      const chainData = await buscarJson(speciesData.evolution_chain.url);
      const todas = [];
      const coletar = async (node) => {
        const origemId = Number(String(node.species?.url || '').match(/\/(\d+)\/?$/)?.[1]);
        for (const evo of node.evolves_to || []) {
          const destinoId = Number(String(evo.species?.url || '').match(/\/(\d+)\/?$/)?.[1]);
          if (!destinoId) continue;
          const detalhe = (evo.evolution_details || [])[0] || {};
          const itemMap = detalhe.item?.name ? EVOLUCAO_ITEM_MAP[detalhe.item.name] : null;
          const item = itemMap ? buscarItem(itemMap) : null;
          const nivel = Number(detalhe.min_level) || 1;
          const infoDestino = await obterPokemon(String(destinoId));
          const nomeDestino = infoDestino?.namePt || evo.species.name;
          todas.push({
            origem: origemId,
            destino: destinoId,
            nome: nomeDestino,
            item: item,
            nivel,
            trigger: detalhe.trigger?.name || 'level-up',
          });
          await coletar(evo);
        }
      };
      await coletar(chainData.chain);
      const dinamicas = todas.filter((e) => e.origem === id);
      if (dinamicas.length) resultado = dinamicas;
    }
  } catch (erro) {
    console.warn(`[Pokémon] Não consegui consultar a cadeia de evolução de #${id}:`, erro?.message || erro);
  }

  const unicos = [];
  const vistos = new Set();
  for (const e of resultado) {
    if (vistos.has(e.destino)) continue;
    vistos.add(e.destino);
    unicos.push({ ...e, item: e.item, nivel: Number(e.nivel) || 1 });
  }
  cacheEvolucoes.set(id, unicos);
  return unicos;
}

async function listarEvolucoes(pokemonId) {
  return obterEvolucoes(pokemonId);
}

async function evoluirPokemon(userId, collectionId, destinationId) {
  if (!userId || !Number.isInteger(Number(collectionId)) || Number(collectionId) < 1) {
    return { ok: false, motivo: 'pokemon_invalido' };
  }
  const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
  if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };
  const evolucoes = await obterEvolucoes(captura.pokemon_id);
  const evolucao = evolucoes.find((item) => item.destino === Number(destinationId));
  if (!evolucao) return { ok: false, motivo: 'evolucao_indisponivel' };
  const nivelRequerido = Number(evolucao.nivel) || 1;
  if (Number(captura.level) < nivelRequerido) {
    return { ok: false, motivo: 'nivel_insuficiente', nivelRequerido, item: evolucao.item };
  }
  const item = typeof evolucao.item === 'string' ? buscarItem(evolucao.item) : evolucao.item;
  const semItem = !item;
  const executar = database.transaction(() => {
    if (!semItem) {
      const consumido = sql.useInventory.run(String(userId), item.id);
      if (consumido.changes !== 1) return { ok: false, motivo: 'sem_item', item };
    }
    const atualizado = sql.evolveCollectionEntry.run(
      evolucao.destino,
      normalizarNome(evolucao.nome),
      evolucao.nome,
      Number(collectionId),
      String(userId),
      evolucao.origem
    );
    if (atualizado.changes !== 1) throw new Error('A captura mudou durante a evolução; nenhuma alteração foi aplicada.');
    return { ok: true, pokemon: evolucao, item: semItem ? null : item, shiny: Boolean(captura.shiny) };
  });
  return executar.immediate();
}

// ── XP e nível de Pokémon capturado ───────────────────────────────────
function xpNecessarioParaNivel(level) {
  const n = Math.max(1, Number(level) || 1);
  return n * 1000; // cada nível custa level * 1000 XP
}

function ganharXpPokemon(userId, collectionId, quantidade) {
  const qtd = Math.max(0, Number(quantidade) || 0);
  if (qtd === 0) return { ok: true, nivelAntigo: 1, nivelNovo: 1, subiu: false, xpGanho: 0, xp: 0, nivel: 1, proximo: xpNecessarioParaNivel(1) };

  const executar = database.transaction(() => {
    const captura = sql.collectionEntry.get(Number(collectionId), String(userId));
    if (!captura) return { ok: false, motivo: 'pokemon_nao_encontrado' };

    const nivelAntigo = Number(captura.level) || 1;
    const xpAntigo = Number(captura.xp) || 0;
    let novoXp = xpAntigo + qtd;
    let novoNivel = nivelAntigo;
    let subiu = false;

    while (novoXp >= xpNecessarioParaNivel(novoNivel) && novoNivel < 100) {
      novoXp -= xpNecessarioParaNivel(novoNivel);
      novoNivel += 1;
      subiu = true;
    }
    if (novoNivel >= 100) {
      novoNivel = 100;
      novoXp = 0;
    }

    const atualizado = database.prepare(`
      UPDATE pokemon_collection SET level = ?, xp = ? WHERE id = ? AND user_id = ?
    `).run(novoNivel, novoXp, Number(collectionId), String(userId));

    return {
      ok: atualizado.changes === 1,
      nivelAntigo,
      nivelNovo: novoNivel,
      subiu,
      xpGanho: qtd,
      xp: novoXp,
      nivel: novoNivel,
      proximo: xpNecessarioParaNivel(novoNivel),
    };
  });

  return executar.immediate();
}

function classificarRaridade(captureRate) {
  const taxa = Number(captureRate) || 45;
  if (taxa <= 3) return { id: 'lendario', nome: 'Lendário', emoji: '🌟' };
  if (taxa <= 45) return { id: 'raro', nome: 'Raro', emoji: '💎' };
  if (taxa <= 120) return { id: 'incomum', nome: 'Incomum', emoji: '✨' };
  return { id: 'comum', nome: 'Comum', emoji: '🍃' };
}

function spriteUrl(pokemonId, shiny = false, speciesName = null) {
  const id = Number(pokemonId);
  if (id === MISSINGNO_ID) return 'https://upload.wikimedia.org/wikipedia/commons/archive/6/62/20140124140453%21MissingNo.png';
  if (!Number.isInteger(id) || id < 1 || id > MAX_POKEMON_ID) return null;
  if (id <= 649) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${shiny ? 'shiny/' : ''}${id}.gif`;
  }
  const slug = String(speciesName || '').toLowerCase();
  if (/^[a-z0-9-]+$/.test(slug)) {
    return `https://play.pokemonshowdown.com/sprites/${shiny ? 'ani-shiny' : 'ani'}/${slug}.gif`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'other/official-artwork/shiny/' : 'other/official-artwork/'}${id}.png`;
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
    stats: { hp: 45, attack: 49, defense: 49, 'special-attack': 65, 'special-defense': 65, speed: 45 },
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
  if (texto === 'missingno' || texto === 'missingno.' || texto === String(MISSINGNO_ID)) {
    return {
      id: MISSINGNO_ID,
      name: 'missingno',
      namePt: 'MissingNo.',
      captureRate: 3,
      types: ['normal', 'flying'],
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/archive/6/62/20140124140453%21MissingNo.png',
      animatedUrl: null,
      shinyImageUrl: null,
      shiny: false,
    };
  }
  if (texto === 'arceus' || texto === '493') {
    // allow normal fetch; no early return
  }
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
      stats: (pokemonData.stats || []).reduce((acc, entry) => {
        acc[entry.stat.name] = Number(entry.base_stat) || 0;
        return acc;
      }, {}),
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

function sortearNivelSelvagem(pokemon, random = Math.random) {
  const captura = Math.max(1, Math.min(255, Number(pokemon?.captureRate) || 45));
  const raridade = 1 - captura / 255;
  const base = 1 + Math.floor(random() * 100);
  const bonus = Math.round(raridade * 25);
  return Math.max(1, Math.min(100, base + bonus));
}

async function sortearPokemon(random = Math.random) {
  const valor = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
  const candidato = 1 + Math.floor(valor * (MAX_POKEMON_ID - 1));
    const id = candidato;
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
      await message.reply(`😿 ${message.author}, **${resultado?.pokemon?.namePt || 'O Pokémon'}** escapou da Pokébola! Tente novamente.`);
    }
    return;
  }
  if (isPrefix) return;

  // XP passivo: cada mensagem dá um pouco de XP a um Pokémon da coleção.
  const colecaoXp = listarColecao(message.author.id, 250).pokemon;
  if (colecaoXp.length) {
    const escolhido = colecaoXp[Math.floor(Math.random() * colecaoXp.length)];
    const resultadoXp = ganharXpPokemon(message.author.id, Number(escolhido.id), 5);
    if (resultadoXp.ok && resultadoXp.subiu) {
      await message.channel.send({
        content: `⬆️ **${escolhido.name_pt}** subiu para o nível **${resultadoXp.nivelNovo}**!`,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  }

  const config = obterConfig(message.guild.id);
  if (!config.enabled || config.muted) return;
  if (!config.channels.length) return;
  if (!config.channels.includes(String(message.channelId))) return;
  const preferencias = obterPreferencias(message.author.id);
  const reservation = reivindicarTentativaSpawn(message.guild.id, message.channelId, preferencias.incenseUntil);
  if (!reservation) return;
  let published = false;
  try {
    let pokemon = await sortearPokemon();
    pokemon = ajustarRaridadePokemon(pokemon, config.rarityMode);
    const rarity = classificarRaridade(pokemon.captureRate);
    pokemon.rarity = rarity;
    pokemon.level = sortearNivelSelvagem(pokemon);
    pokemon.shiny = Math.random() < 1 / config.shinyChance;
    const image = pokemon.shiny ? pokemon.shinyImageUrl || pokemon.imageUrl : pokemon.imageUrl;
    pokemon.imageUrl = image || pokemon.imageUrl;
    if (pokemon.shiny && pokemon.animatedUrl) {
      pokemon.animatedUrl = pokemon.animatedUrl.replace(/\/animated\/(\d+)\.gif$/, '/animated/shiny/$1.gif');
    }
    const ttlMs = config.encounterTtlMs || 10 * 60 * 1000;
  const ttlMin = Math.floor(ttlMs / 60_000);
  const ttlSeg = Math.floor((ttlMs % 60_000) / 1000);
  const ttlStr = ttlSeg > 0 ? `${ttlMin > 0 ? ttlMin + ' min ' : ''}${ttlSeg} s` : `${ttlMin} min`;
  const embed = {
      color: pokemon.shiny ? 0xffd700 : 0xf2a7c8,
      title: pokemon.shiny ? '✨ Um Pokémon brilhante apareceu!' : '✨ Um Pokémon selvagem apareceu!',
      description:
        `**${pokemon.namePt}** selvagem apareceu! **Nível ${pokemon.level}**.\nUse \`/pokemon capturar\` ou digite o nome para tentar capturar.\n` +
        `${rarity.emoji} Raridade: **${rarity.nome}** · ⏳ O encontro desaparece em **${ttlStr}**${pokemon.types.length ? `\n🏷️ Tipo: ${pokemon.types.join(' · ')}` : ''}`,
      image: { url: pokemon.animatedUrl || pokemon.imageUrl },
      footer: { text: `Pokédex #${String(pokemon.id).padStart(4, '0')} · Nível ${pokemon.level} · Mila Pokémon` },
    };
    if (!embed.image.url) delete embed.image;
    const users = obterUsuariosParaAviso(message.guild.id, pokemon.id);
    const payload = {
      embeds: [embed],
      allowedMentions: { parse: [], users },
    };
    if (users.length) payload.content = `🔔 Favorito encontrado: ${users.map((id) => `<@${id}>`).join(' ')}`;

    const posted = await message.channel.send(payload);
    registrarEncontro(message.guild.id, message.channelId, pokemon, posted.id);
    if (!confirmarTentativaSpawn(message.guild.id, reservation)) {
      throw new Error('A reserva do encontro expirou antes de confirmar o cooldown.');
    }
    published = true;
  } catch (erro) {
    console.error(`[Pokémon] Não consegui criar ou publicar encontro no servidor ${message.guild.id}:`, erro?.message || erro);
    throw erro;
  } finally {
    if (!published) liberarTentativaSpawn(message.guild.id, reservation);
  }
}

function criarEmbedCaptura(resultado, user) {
  const { pokemon, ball, cosmetic } = resultado;
  return {
    color: cosmetic?.cor || (pokemon.shiny ? 0xffd700 : 0x7ed6a5),
    title: pokemon.shiny ? '✨ Captura brilhante!' : 'Pokémon capturado!',
    description:
      `${user} capturou **${pokemon.namePt}**${pokemon.name !== pokemon.namePt ? ` (\`${pokemon.name}\`)` : ''}!\n` +
      `🏷️ Pokédex #${String(pokemon.id).padStart(4, '0')} · Nível **${pokemon.level || 1}**\n` +
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
  PRESETS_CONFIG,
  MISSOES,
  listarItens,
  listarCategorias,
  buscarItem,
  normalizarNome,
  obterConfig,
  salvarConfig,
  aplicarPreset,
  atualizarCanal,
  obterPreferencias,
  salvarPreferencias,
  obterTime,
  salvarTime,
  limparTime,
  salvarGolpes,
  golpesSalvos,
  liberarPokemon,
  doarPokemon,
  comprar,
  comprarLote,
  obterInventario,
  consumirItem,
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
  confirmarTentativaSpawn,
  liberarTentativaSpawn,
  listarColecao,
  listarEvolucoes,
  evoluirPokemon,
  xpNecessarioParaNivel,
  ganharXpPokemon,
  classificarRaridade,
  ajustarRaridadePokemon,
  spriteUrl,
  ranking,
  rankingServidor,
  obterPerfil,
  obterPokemon,
  sortearPokemon,
  processarMensagem,
  calcularStatusPokemon,
  obterNatureza,
  obterPokemonCacheSync,
  criarEmbedCaptura,
  NATURES,
  STATUS_VITAIS,
  sortearNivelSelvagem,
  natureAleatoria,
  estadoVidaPokemon,
  salvarVidaPokemon,
  definirStatusPokemon,
  usarCuraPokemon,
};

