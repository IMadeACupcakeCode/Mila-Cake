// ═══════════════════════════════════════════════════════════════════════════
//  GUERRA DE CARTAS — motor puro (sem discord.js)
//  Baralho, mãos, combate, efeitos e IA. A interface vive em commands/guerra.js.
// ═══════════════════════════════════════════════════════════════════════════

const FACCOES = {
  blockbuster: {
    id: 'blockbuster',
    nome: 'Blockbuster',
    emoji: '🇺🇸',
    icone: '🎬',
    cor: 0x3B82F6,
    lema: 'Cinema, TV e pop americano.',
    forteContra: 'viral',
    fracoContra: 'cult',
  },
  viral: {
    id: 'viral',
    nome: 'Viral',
    emoji: '🌐',
    icone: '🌐',
    cor: 0xA855F7,
    lema: 'Memes globais que ninguém consegue explicar.',
    forteContra: 'brasil',
    fracoContra: 'blockbuster',
  },
  brasil: {
    id: 'brasil',
    nome: 'Brasil',
    emoji: '🇧🇷',
    icone: '🇧🇷',
    cor: 0x22C55E,
    lema: 'Humor, várzea e coração brasileiro.',
    forteContra: 'cult',
    fracoContra: 'viral',
  },
  cult: {
    id: 'cult',
    nome: 'Cult',
    emoji: '🕹️',
    icone: '🕹️',
    cor: 0xF59E0B,
    lema: 'Clássicos da internet e da cultura nerd.',
    forteContra: 'blockbuster',
    fracoContra: 'brasil',
  },
};

const ORDEM_FACCOES = ['blockbuster', 'viral', 'brasil', 'cult'];

const RARIDADES = {
  comum: { nome: 'Comum', emoji: '⚪', cor: 0x9CA3AF },
  rara: { nome: 'Rara', emoji: '🔵', cor: 0x38BDF8 },
  epica: { nome: 'Épica', emoji: '🟣', cor: 0xA855F7 },
  lendaria: { nome: 'Lendária', emoji: '🟡', cor: 0xFACC15 },
  mitica: { nome: 'Mítica', emoji: '🔴', cor: 0xFB7185 },
};

const EFEITOS = {
  burn: {
    id: 'burn',
    nome: 'Burn',
    emoji: '🔥',
    descricao: 'Aplica queimadura por 2 turnos (4 de dano por turno).',
  },
  armor: {
    id: 'armor',
    nome: 'Escudo',
    emoji: '🛡️',
    descricao: 'Reduz em 30% o dano recebido por 2 turnos.',
  },
  drain: {
    id: 'drain',
    nome: 'Dreno',
    emoji: '💧',
    descricao: 'Cura 35% do dano causado.',
  },
  stun: {
    id: 'stun',
    nome: 'Atordoamento',
    emoji: '⚡',
    descricao: 'Faz o adversário perder o próximo turno.',
  },
  heavy: {
    id: 'heavy',
    nome: 'Golpe Pesado',
    emoji: '💥',
    descricao: 'Aumenta o dano da carta em 45%.',
  },
  multi: {
    id: 'multi',
    nome: 'Acerto Múltiplo',
    emoji: '🌀',
    descricao: 'Aumenta o dano da carta em 65%.',
  },
  heal: {
    id: 'heal',
    nome: 'Cura Crossover',
    emoji: '💚',
    descricao: 'Cura o atacante em 60% do dano causado.',
  },
};

// ── Cartas base ─────────────────────────────────────────────────────────────
// `arteUrl` é usada apenas pelo scripts/fetch-guerra-art.js. Em runtime a arte
// é enviada como anexo local, então o jogo funciona mesmo sem internet.
const CARTAS = [
  // 🇺🇸 Blockbuster
  {
    id: 'anakin',
    nome: 'Anakin',
    titulo: 'I Have the High Ground',
    faccao: 'blockbuster',
    raridade: 'lendaria',
    custo: 3,
    danoMin: 18,
    danoMax: 27,
    efeito: 'burn',
    arte: 'anakin.jpg',
    arteUrl: 'https://i.imgflip.com/5c7lwq.png',
    legenda: 'Você subestimou o meu poder... e o terreno alto.',
    credito: 'Anakin Padme 4 Panel · Imgflip',
  },
  {
    id: 'gru',
    nome: 'Gru',
    titulo: "Gru's Plan",
    faccao: 'blockbuster',
    raridade: 'epica',
    custo: 2,
    danoMin: 12,
    danoMax: 19,
    efeito: 'stun',
    arte: 'gru.jpg',
    arteUrl: 'https://i.imgflip.com/26jxvz.jpg',
    legenda: 'Primeiro eu faço o plano. Depois eu esqueço o plano.',
    credito: "Gru's Plan · Imgflip",
  },
  {
    id: 'spongebob',
    nome: 'SpongeBob',
    titulo: 'Breath In, Boi',
    faccao: 'blockbuster',
    raridade: 'rara',
    custo: 2,
    danoMin: 10,
    danoMax: 17,
    efeito: 'drain',
    arte: 'spongebob.jpg',
    arteUrl: 'https://i.imgflip.com/1otk96.jpg',
    legenda: 'Respira fundo, boi. O meme é eterno.',
    credito: 'Mocking SpongeBob · Imgflip',
  },
  {
    id: 'drake',
    nome: 'Drake',
    titulo: 'Hotline Rejeitada',
    faccao: 'blockbuster',
    raridade: 'comum',
    custo: 1,
    danoMin: 6,
    danoMax: 12,
    efeito: 'armor',
    arte: 'drake.jpg',
    arteUrl: 'https://i.imgflip.com/30b1gx.jpg',
    legenda: 'Hotline Bling: rejeitou o ataque, aceitou a defesa.',
    credito: 'Drake Hotline Bling · Imgflip',
  },
  {
    id: 'cinema',
    nome: 'Absolute Cinema',
    titulo: 'Isso É Cinema',
    faccao: 'blockbuster',
    raridade: 'mitica',
    custo: 3,
    danoMin: 20,
    danoMax: 30,
    efeito: 'burn',
    arte: 'cinema.jpg',
    arteUrl: 'https://i.imgflip.com/8d317n.png',
    legenda: 'ISSO É CINEMA. Absolute cinema.',
    credito: 'Absolute Cinema · Imgflip',
  },

  // 🌐 Viral
  {
    id: 'distracted',
    nome: 'Distracted Boyfriend',
    titulo: 'Olha a Distração',
    faccao: 'viral',
    raridade: 'epica',
    custo: 2,
    danoMin: 11,
    danoMax: 18,
    efeito: 'stun',
    arte: 'distracted.jpg',
    arteUrl: 'https://i.imgflip.com/1ur9b0.jpg',
    legenda: 'Olha a distração. Funciona toda vez.',
    credito: 'Distracted Boyfriend · Imgflip',
  },
  {
    id: 'cat',
    nome: 'Woman Yelling at Cat',
    titulo: 'Discussão no Grupo',
    faccao: 'viral',
    raridade: 'rara',
    custo: 2,
    danoMin: 12,
    danoMax: 20,
    efeito: 'burn',
    arte: 'cat.jpg',
    arteUrl: 'https://i.imgflip.com/345v97.jpg',
    legenda: 'A mulher grita, o gato julga. O chat concorda.',
    credito: 'Woman Yelling At Cat · Imgflip',
  },
  {
    id: 'pikachu',
    nome: 'Surprised Pikachu',
    titulo: 'Surpresa Elétrica',
    faccao: 'viral',
    raridade: 'comum',
    custo: 1,
    danoMin: 6,
    danoMax: 12,
    efeito: 'stun',
    arte: 'pikachu.jpg',
    arteUrl: 'https://i.imgflip.com/2kbn1e.jpg',
    legenda: 'Surpreso? Eu também.',
    credito: 'Surprised Pikachu · Imgflip',
  },
  {
    id: 'fine',
    nome: 'This Is Fine',
    titulo: 'Tá Tudo Bem',
    faccao: 'viral',
    raridade: 'rara',
    custo: 2,
    danoMin: 9,
    danoMax: 16,
    efeito: 'armor',
    arte: 'fine.jpg',
    arteUrl: 'https://i.imgflip.com/wxica.jpg',
    legenda: 'Tá tudo bem. Tá tudo bem. TÁ TUDO BEM.',
    credito: 'This Is Fine · Imgflip',
  },
  {
    id: 'brain',
    nome: 'Expanding Brain',
    titulo: 'Galaxy Brain',
    faccao: 'viral',
    raridade: 'lendaria',
    custo: 3,
    danoMin: 15,
    danoMax: 24,
    efeito: 'drain',
    arte: 'brain.jpg',
    arteUrl: 'https://i.imgflip.com/1jwhww.jpg',
    legenda: 'Quanto mais brilho, mais dano. Lógica de internet.',
    credito: 'Expanding Brain · Imgflip',
  },

  // 🇧🇷 Brasil
  {
    id: 'nazare',
    nome: 'Nazaré',
    titulo: 'Confusa Tática',
    faccao: 'brasil',
    raridade: 'mitica',
    custo: 2,
    danoMin: 10,
    danoMax: 17,
    efeito: 'stun',
    arte: 'nazare.jpg',
    arteUrl: 'https://i.imgflip.com/1n1gyg.jpg',
    legenda: 'Nazaré não entendeu nada — e é aí que ela ataca.',
    credito: 'Nazaré Confusa · Imgflip',
  },
  {
    id: 'luva',
    nome: 'Luva de Pedreiro',
    titulo: 'Receba!',
    faccao: 'brasil',
    raridade: 'lendaria',
    custo: 3,
    danoMin: 18,
    danoMax: 28,
    efeito: 'drain',
    arte: 'luva.jpg',
    arteUrl: 'https://i.imgflip.com/8g5y9u.jpg',
    legenda: 'RECEBA! O golpe mais honesto do futebol de várzea.',
    credito: 'Luva de Pedreiro · Imgflip',
  },
  {
    id: 'capivara',
    nome: 'Giga Capivara',
    titulo: 'Calma Inabalável',
    faccao: 'brasil',
    raridade: 'epica',
    custo: 2,
    danoMin: 8,
    danoMax: 14,
    efeito: 'armor',
    arte: 'capivara.jpg',
    arteUrl: 'https://i.imgflip.com/5odwlr.jpg',
    legenda: 'Calma. A capivara já resolveu coisas piores.',
    credito: 'Giga Capybara · Imgflip',
  },
  {
    id: 'caramelo',
    nome: 'Cachorro Caramelo',
    titulo: 'Fiel Escudeiro',
    faccao: 'brasil',
    raridade: 'comum',
    custo: 1,
    danoMin: 6,
    danoMax: 11,
    efeito: 'armor',
    arte: 'caramelo.jpg',
    arteUrl: 'https://i.imgflip.com/55enl5.jpg',
    legenda: 'Patrimônio nacional, lealdade infinita.',
    credito: 'Vira-lata · Imgflip',
  },
  {
    id: 'joelma',
    nome: 'Joelma',
    titulo: 'Rindo de Mim Mesma',
    faccao: 'brasil',
    raridade: 'rara',
    custo: 3,
    danoMin: 16,
    danoMax: 25,
    efeito: 'drain',
    arte: 'joelma.jpg',
    arteUrl: 'https://i.imgflip.com/3bm0ge.jpg',
    legenda: 'Rindo de mim mesma enquanto o adversário perde a pose.',
    credito: 'Laughing With Myself · Imgflip',
  },

  // 🕹️ Cult
  {
    id: 'shrek',
    nome: 'Shrek',
    titulo: 'Swamp Smash',
    faccao: 'cult',
    raridade: 'lendaria',
    custo: 3,
    danoMin: 17,
    danoMax: 26,
    efeito: 'burn',
    arte: 'shrek.jpg',
    arteUrl: 'https://i.imgflip.com/2hiv1g.jpg',
    legenda: 'Alguém disse... pântano?',
    credito: 'Shrek For Five Minutes · Imgflip',
  },
  {
    id: 'doge',
    nome: 'Doge & Cheems',
    titulo: 'Such Defesa',
    faccao: 'cult',
    raridade: 'epica',
    custo: 2,
    danoMin: 10,
    danoMax: 16,
    efeito: 'armor',
    arte: 'doge.jpg',
    arteUrl: 'https://i.imgflip.com/43a45p.png',
    legenda: 'Such defesa. Very wow. Muito escudo.',
    credito: 'Buff Doge vs. Cheems · Imgflip',
  },
  {
    id: 'spiderman',
    nome: 'Spider-Man',
    titulo: 'Apontando o Clone',
    faccao: 'cult',
    raridade: 'rara',
    custo: 2,
    danoMin: 12,
    danoMax: 19,
    efeito: 'stun',
    arte: 'spiderman.jpg',
    arteUrl: 'https://i.imgflip.com/1tkjq9.jpg',
    legenda: 'Aponta para o adversário. Aponta para você. Ninguém sabe quem é o clone.',
    credito: 'Spider Man Triple · Imgflip',
  },
  {
    id: 'rollsafe',
    nome: 'Roll Safe',
    titulo: 'Pensa Nisso',
    faccao: 'cult',
    raridade: 'rara',
    custo: 2,
    danoMin: 9,
    danoMax: 15,
    efeito: 'armor',
    arte: 'rollsafe.jpg',
    arteUrl: 'https://i.imgflip.com/1h7in3.jpg',
    legenda: 'Não pode perder se não entrar no ringue. Pensa nisso.',
    credito: 'Roll Safe Think About It · Imgflip',
  },
  {
    id: 'handshake',
    nome: 'Epic Handshake',
    titulo: 'Acordo Selado',
    faccao: 'cult',
    raridade: 'mitica',
    custo: 3,
    danoMin: 15,
    danoMax: 24,
    efeito: 'drain',
    arte: 'handshake.jpg',
    arteUrl: 'https://i.imgflip.com/28j0te.jpg',
    legenda: 'Acordo selado: metade do dano, metade da cura.',
    credito: 'Epic Handshake · Imgflip',
  },
];

// ── Especiais crossover (EUA + Brasil) ──────────────────────────────────────
const ESPECIAIS = [
  {
    id: 'sp_nazare_anakin',
    nome: 'Nazaré & Anakin',
    titulo: 'Confusão no High Ground',
    faccao: 'brasil',
    raridade: 'mitica',
    custo: 3,
    danoMin: 20,
    danoMax: 32,
    efeito: 'heavy',
    arte: 'nazare.jpg',
    legenda: '“Você subestimou meu poder.” “Eu não entendi nada.”',
    credito: 'Crossover Guerra de Cartas · Imgflip',
  },
  {
    id: 'sp_capivara_doge',
    nome: 'Capivara & Doge',
    titulo: 'Calma Based',
    faccao: 'brasil',
    raridade: 'mitica',
    custo: 3,
    danoMin: 14,
    danoMax: 24,
    efeito: 'heal',
    arte: 'capivara.jpg',
    legenda: 'Such calma. Very capivara. Muito equilíbrio.',
    credito: 'Crossover Guerra de Cartas · Imgflip',
  },
  {
    id: 'sp_luva_bernie',
    nome: 'Luva & Bernie',
    titulo: 'Receba o Apoio',
    faccao: 'brasil',
    raridade: 'mitica',
    custo: 3,
    danoMin: 18,
    danoMax: 28,
    efeito: 'multi',
    arte: 'luva.jpg',
    legenda: 'I am once again asking for... RECEBA!',
    credito: 'Crossover Guerra de Cartas · Imgflip',
  },
  {
    id: 'sp_caramelo_shrek',
    nome: 'Caramelo & Shrek',
    titulo: 'Amizade do Pântano',
    faccao: 'cult',
    raridade: 'mitica',
    custo: 3,
    danoMin: 16,
    danoMax: 26,
    efeito: 'heal',
    arte: 'caramelo.jpg',
    legenda: 'Todo ogro precisa de um caramelo. Todo caramelo precisa de um pântano.',
    credito: 'Crossover Guerra de Cartas · Imgflip',
  },
];

const CARTA_POR_ID = new Map(CARTAS.map((c) => [c.id, c]));
const ESPECIAL_POR_ID = new Map(ESPECIAIS.map((c) => [c.id, c]));

const HP_MAX = 100;
const PONTOS_INICIAIS = 4;
const PONTOS_MAX = 8;
const MAO_INICIAL = 4;
const MAO_MAX = 5;
const TURNOS_MAX = 40;

function rand(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function embaralhar(lista, rng = Math.random) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function criarBaralho(rng = Math.random) {
  return embaralhar(CARTAS, rng);
}

function criarJogador({ id, nome, avatar, isBot = false, faccao, rng = Math.random }) {
  const faccaoEscolhida = faccao && FACCOES[faccao] ? faccao : ORDEM_FACCOES[Math.floor(rng() * ORDEM_FACCOES.length)];
  return {
    id,
    nome,
    avatar,
    isBot,
    faccao: faccaoEscolhida,
    hp: HP_MAX,
    hpMax: HP_MAX,
    pontos: PONTOS_INICIAIS,
    statuses: [],
    mao: [],
    baralho: criarBaralho(rng),
    descarte: [],
    cargas: 0,
    caixaAberta: false,
    cartasJogadas: 0,
    danoTotal: 0,
  };
}

function comprar(jogador, quantidade = 1) {
  let compradas = 0;
  for (let i = 0; i < quantidade; i++) {
    if (jogador.mao.length >= MAO_MAX) break;
    if (!jogador.baralho.length) {
      if (!jogador.descarte.length) break;
      jogador.baralho = embaralhar(jogador.descarte);
      jogador.descarte = [];
    }
    const carta = jogador.baralho.pop();
    if (!carta) break;
    jogador.mao.push(carta);
    compradas++;
  }
  return compradas;
}

function descartar(jogador, carta) {
  jogador.descarte.push(carta);
  jogador.mao = jogador.mao.filter((c) => c.id !== carta.id);
}

function vantagemContra(carta, alvo) {
  const faccao = FACCOES[carta.faccao];
  return Boolean(faccao && faccao.forteContra === alvo.faccao);
}

function sinergia(carta, jogador) {
  return carta.faccao === jogador.faccao;
}

function calcularDano({ atacante, defensor, carta, rng = Math.random }) {
  let dano = rand(carta.danoMin, carta.danoMax, rng);
  const marcas = [];

  if (sinergia(carta, atacante)) {
    dano = Math.floor(dano * 1.1);
    marcas.push({ tipo: 'sinergia', texto: `Sinergia ${FACCOES[atacante.faccao].emoji} +10%` });
  }
  if (vantagemContra(carta, defensor)) {
    dano = Math.floor(dano * 1.25);
    marcas.push({ tipo: 'vantagem', texto: `Vantagem de facção +25%` });
  }
  const critico = rng() < 0.12;
  if (critico) {
    dano = Math.floor(dano * 1.5);
    marcas.push({ tipo: 'critico', texto: 'ACERTO CRÍTICO! +50%' });
  }
  if (carta.efeito === 'heavy') {
    dano = Math.floor(dano * 1.45);
    marcas.push({ tipo: 'especial', texto: 'Golpe pesado +45%' });
  }
  if (carta.efeito === 'multi') {
    dano = Math.floor(dano * 1.65);
    marcas.push({ tipo: 'especial', texto: 'Acerto múltiplo +65%' });
  }

  const escudo = defensor.statuses.find((s) => s.tipo === 'armor');
  if (escudo) {
    const reducao = Math.max(2, Math.floor(dano * 0.3));
    dano = Math.max(0, dano - reducao);
    marcas.push({ tipo: 'escudo', texto: `Escudo absorveu ${reducao}` });
  }

  return { dano, critico, marcas };
}

function aplicarEfeito({ atacante, defensor, carta, dano }) {
  const linhas = [];
  if (carta.efeito === 'burn') {
    defensor.statuses.push({ tipo: 'burn', turnos: 2, dano: 4 });
    linhas.push('🔥 Queimadura aplicada por 2 turnos.');
  } else if (carta.efeito === 'armor') {
    atacante.statuses.push({ tipo: 'armor', turnos: 2 });
    linhas.push('🛡️ Escudo erguido por 2 turnos.');
  } else if (carta.efeito === 'drain') {
    const cura = Math.min(12, Math.floor(dano * 0.35));
    atacante.hp = Math.min(atacante.hpMax, atacante.hp + cura);
    linhas.push(`💧 Dreno curou ${cura} de HP.`);
  } else if (carta.efeito === 'stun') {
    defensor.statuses.push({ tipo: 'stun', turnos: 1 });
    linhas.push('⚡ Atordoado: perde o próximo turno.');
  } else if (carta.efeito === 'heal') {
    const cura = Math.min(20, Math.floor(dano * 0.6));
    atacante.hp = Math.min(atacante.hpMax, atacante.hp + cura);
    linhas.push(`💚 Cura crossover: +${cura} HP.`);
  }
  return linhas;
}

function resolverAtaque({ atacante, defensor, carta, rng = Math.random }) {
  const { dano, critico, marcas } = calcularDano({ atacante, defensor, carta, rng });
  defensor.hp = Math.max(0, defensor.hp - dano);
  atacante.pontos = Math.max(0, atacante.pontos - carta.custo);
  atacante.cartasJogadas += 1;
  atacante.danoTotal += dano;
  descartar(atacante, carta);
  comprar(atacante, 1);
  const efeitos = aplicarEfeito({ atacante, defensor, carta, dano });

  return {
    dano,
    critico,
    marcas,
    efeitos,
    abateu: defensor.hp <= 0,
  };
}

function processarInicioTurno(jogador) {
  const linhas = [];
  let atordoado = false;
  const restantes = [];
  for (const status of jogador.statuses) {
    if (status.tipo === 'burn') {
      jogador.hp = Math.max(0, jogador.hp - status.dano);
      linhas.push(`🔥 ${jogador.nome} sofreu ${status.dano} de queimadura.`);
    }
    if (status.tipo === 'stun') {
      atordoado = true;
      linhas.push(`⚡ ${jogador.nome} está atordoado e perde o turno.`);
    }
    if (status.tipo === 'armor') {
      linhas.push(`🛡️ ${jogador.nome} está protegido pelo escudo.`);
    }
    status.turnos -= 1;
    if (status.turnos > 0) restantes.push(status);
  }
  jogador.statuses = restantes;
  return { linhas, atordoado, morreu: jogador.hp <= 0 };
}

function defender(jogador) {
  const antes = jogador.pontos;
  jogador.pontos = Math.min(PONTOS_MAX, jogador.pontos + 2);
  const comprou = comprar(jogador, 1);
  return {
    pontosGanhos: jogador.pontos - antes,
    comprou,
  };
}

function abrirCaixa(jogador, especial, rng = Math.random) {
  if (jogador.caixaAberta) return null;
  jogador.caixaAberta = true;
  jogador.cargas += 1;
  jogador.pontos = Math.min(PONTOS_MAX, jogador.pontos + 1);
  const sorteada = especial || ESPECIAIS[Math.floor(rng() * ESPECIAIS.length)];
  jogador.especialGuardado = sorteada;
  return sorteada;
}

function resolverEspecial({ atacante, defensor, especial, rng = Math.random }) {
  if (atacante.cargas < 1) return null;
  if (atacante.pontos < 3) return null;
  atacante.cargas -= 1;
  atacante.especialGuardado = null;
  return resolverAtaque({ atacante, defensor, carta: especial, rng });
}

function escolherAcaoBot({ bot, alvo, rng = Math.random }) {
  const acessiveis = bot.mao.filter((c) => c.custo <= bot.pontos);
  const podeEspecial = bot.cargas > 0 && bot.pontos >= 3;
  const vidaBaixa = bot.hp / bot.hpMax < 0.3;

  if (podeEspecial && rng() < (vidaBaixa ? 0.75 : 0.4)) {
    return { tipo: 'especial', especial: bot.especialGuardado || ESPECIAIS[Math.floor(rng() * ESPECIAIS.length)] };
  }
  if (!bot.caixaAberta && rng() < 0.28) {
    return { tipo: 'caixa' };
  }
  if (!acessiveis.length) {
    return { tipo: 'defender' };
  }
  // Escolhe a carta com maior dano esperado; se estiver com pouca vida, prioriza escudo/dreno.
  const pontuada = acessiveis
    .map((carta) => {
      let pontos = (carta.danoMin + carta.danoMax) / 2;
      if (carta.efeito === 'armor' || carta.efeito === 'drain') pontos += vidaBaixa ? 10 : 3;
      if (vantagemContra(carta, alvo)) pontos += 6;
      if (sinergia(carta, bot)) pontos += 3;
      return { carta, pontos };
    })
    .sort((a, b) => b.pontos - a.pontos);

  // 15% de aleatoriedade para o bot não ficar previsível.
  const escolhida = rng() < 0.15
    ? acessiveis[Math.floor(rng() * acessiveis.length)]
    : pontuada[0].carta;
  return { tipo: 'atacar', carta: escolhida };
}

function barraHp(hp, hpMax, tamanho = 12) {
  const cheio = Math.max(0, Math.min(tamanho, Math.round((hp / hpMax) * tamanho)));
  const emoji = hp / hpMax > 0.5 ? '🟩' : hp / hpMax > 0.25 ? '🟨' : '🟥';
  return `${emoji.repeat(cheio)}${'⬛'.repeat(tamanho - cheio)}`;
}

function descreverStatus(statuses) {
  if (!statuses || !statuses.length) return '✨ Sem status ativo';
  return statuses
    .map((s) => {
      if (s.tipo === 'burn') return `🔥 Queimadura (${s.turnos})`;
      if (s.tipo === 'armor') return `🛡️ Escudo (${s.turnos})`;
      if (s.tipo === 'stun') return `⚡ Atordoado (${s.turnos})`;
      return s.tipo;
    })
    .join(' · ');
}

function descreverCarta(carta) {
  const faccao = FACCOES[carta.faccao];
  const efeito = EFEITOS[carta.efeito];
  return `${faccao.emoji} **${carta.nome}** · \`${carta.custo}⚡\` · \`${carta.danoMin}–${carta.danoMax}\` · ${efeito ? efeito.emoji : '✨'} ${efeito ? efeito.nome : 'Especial'}`;
}

function resumoFaccao(faccaoId) {
  const f = FACCOES[faccaoId];
  if (!f) return '';
  return `${f.emoji} **${f.nome}** · forte contra ${FACCOES[f.forteContra].emoji} ${FACCOES[f.forteContra].nome}`;
}

module.exports = {
  FACCOES,
  ORDEM_FACCOES,
  RARIDADES,
  EFEITOS,
  CARTAS,
  ESPECIAIS,
  CARTA_POR_ID,
  ESPECIAL_POR_ID,
  HP_MAX,
  PONTOS_INICIAIS,
  PONTOS_MAX,
  MAO_INICIAL,
  MAO_MAX,
  TURNOS_MAX,
  rand,
  embaralhar,
  criarBaralho,
  criarJogador,
  comprar,
  descartar,
  vantagemContra,
  sinergia,
  calcularDano,
  resolverAtaque,
  processarInicioTurno,
  defender,
  abrirCaixa,
  resolverEspecial,
  escolherAcaoBot,
  barraHp,
  descreverStatus,
  descreverCarta,
  resumoFaccao,
};
