// ══════════════════════════════════════════════════════════════
// 🎪 JOGO DA FORCA — COMPLETO
// ══════════════════════════════════════════════════════════════

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { criarEmbed } = require('./theme');
const { registrarVitoria, obterRanking, obterJogador } = require('./forcaStore');

// ── Cores ──
const COR = {
  PADRAO: 0xD4A017,
  ACERTO: 0x2ECC71,
  ERRO: 0xE74C3C,
  INFO: 0x3498DB,
  OURO: 0xFFD700,
  PRATA: 0xC0C0C0,
  BRONZE: 0xCD7F32,
};

// ── Dificuldades (do mais difícil ao mais fácil) ──
const DIFICULDADES = [
  { id: 'desista', nome: '💔 Desista', maxErros: 1, desc: 'UM erro. É isso. Só para os corajosos.' },
  { id: 'doom', nome: '💀 DOOM', maxErros: 3, desc: '3 erros. Palavras complexas e raras.' },
  { id: 'pablo', nome: '🎨 Pablo', maxErros: 6, desc: '6 erros. Só palavras surreais! Apenas 3 palpites.' },
  { id: 'dificil', nome: '🔥 Difícil', maxErros: 4, desc: '4 erros. Palavras de 7+ letras.' },
  { id: 'normal', nome: '⚖️ Normal', maxErros: 5, desc: '5 erros. Palavras variadas.' },
  { id: 'facil', nome: '🌱 Fácil', maxErros: 6, desc: '6 erros. Palavras curtas e comuns.' },
];

// ── Palavras ──
const PALAVRAS = {
  facil: [
    'CASA','SOL','LUA','AMOR','GATO','LIVRO','CHUVA','NOITE','TEMPO','ESCOLA',
    'FESTA','BRISA','MANHA','ESTRELA','NUVEM','FLOR','PAZ','SONHO','MAR','FOGO',
    'PONTE','DADO','ROSA','MEL','RISO','FADA','VAGA','SEDE','POTE','NOME',
    'SOPA','BOLA','SAPO','REDE','PATO','MAPA','LOBO','MINA','CURA','PULO',
    'LAPIS','VASO','TATU','BOTA','SINO','MONTE','CACHORRO','AMIGO','MESA',
    'JANELA','CADEIRA','LAMPADA','ESPELHO','RELÓGIO','SOMBRA','ESTRADA',
    'ÁRVORE','PLANTA','SEMENTE','JARDIM','FLORESTA','CAMPINHO','BARULHO',
    'TROVAO','ESCURO','CLARO','QUENTE','FRIO','PESSOA','COISA','BESTEIRA',
  ],
  normal: [
    'FREDDY','BONNIE','CHICA','FOXY','CIRCO','PALHAÇO','MAGICO','DOMADOR',
    'ELEFANTE','PIPOCA','CHAPÉU','BIGODE','CARROCEL','FANTASIA','MASCARA',
    'MIMICA','TRAPEZIO','PLATEIA','PICADEIRO','ACROBATA','CARNAVAL',
    'CORDABAMBA','MALABARISTA','MONIKA','SAYORI','NATSUKI','YURI','POEMA',
    'ANIMATRONIC','NIGHTGUARD','PIZZERIA','JUMPSCARE','MUSICBOX','SPRINGTRAP',
    'MANGLE','PUPPET','MARIONETE','FAZBEAR','ALGODAODOCE','CARRUSEL',
    'ARQUIBANCADA','LITERATURA','CLUBE','VERSO','PROSA','CATARSE',
    'CHAOS','CARNIVAL','SHOWTIME','BOSS','TICKET','FRICK','BASED','SIGMA',
    'RIZZ','NOOB','OHIO','NPC','DELULU','GOATED','SKIBIDI','GIGACHAD','AURA',
  ],
  dificil: [
    'SPRINGTRAP','FUNTIME','CIRCUSBABY','ENNARD','REMNANT','FAZCOINS',
    'SHADOWFREDDY','PHANTOM','CREPUSCULO','PENUMBRA','SERENDIPIDADE',
    'EPIFANIA','PARADOXO','ENIGMA','LABIRINTO','NEBLINA','CARMESIM',
    'ESMERALDA','ASTRAL','ETÉREO','BARROCO','CACOFONIA','EUFEMISMO',
    'SURREAL','DISFORME','ABERRAÇÃO','DILEMA','SIMULACRO','MELANCOLIA',
    'ALUCINAÇÃO','VERTIGEM','CRIPTOGRAFIA','QUIMERICO','INEFÁVEL',
    'WILLIAMAFTON','MICHAELAFTON','LITERATURECLUB','ABSOLUTESOLVER',
    'EXTERMINATION','INQUIETAÇÃO','AMBIVALENCIA','BENEVOLENCIA','PRODIGIO',
    'PERENIDADE','BIZARRO','INSOLITO','ANOMALIA','FENOMENO',
  ],
  pablo: [
    'SURREALISTICO','INEFÁVEL','QUIXOTESCO','ABSTRUSO','PENUMBRA',
    'CREPUSCULO','SERENDIPIDADE','QUIMÉRICO','EPIFANIA','PARADOXO',
    'ENIGMA','NEBLINA','CARMESIM','ETÉREO','BARROCO','CACOFONIA',
    'EUFEMISMO','ENLEVO','SURREAL','DISFORME','ABERRAÇÃO','PRODIGIO',
    'SIMULACRO','ESTRANHEZA','INQUIETAÇÃO','AMBIVALENCIA','MELANCOLIA',
    'NOSTALGIA','SURREALIDADE','ALUCINAÇÃO','VERTIGEM','PERSISTENCIA',
    'ATÁVICO','BENEVOLENCIA','DESLUMBRANTE','PEREGRINAÇÃO','AMBIGUIDADE',
    'ELOCUÇÃO','DESASSOSSEGO','ABISMAL','QUIMERA','EFEMERO','SONAMBULO',
    'TRANSCENDER','METAFISICA','CONTEMPLAR','EFERVESCENCIA','LACUNA',
    'INOMINAVEL','INABALAVEL','DESAMPARO','EMPATIA','MISTERIOSO',
    'IMPRESSIONANTE','MAGNIFICO','CATARTICO','MARAVILHOSAMENTE',
  ],
  doom: [
    'SERIALDESIGNATION','DISASSEMBLYDRONE','ABSOLUTESOLVER','GOLDENFREDDY',
    'BALLOONBOY','FUNTIMEFREDDY','CIRCUSBABY','SURREALIDADE','CRIPTOGRAFIA',
    'LABIRINTICO','TRANSCENDER','METAFISICA','EFERVESCENCIA','INQUIETAÇÃO',
    'QUIMÉRICO','SERENDIPIDADE','EXTERMINATION','PRIZECORNER',
    'DISSOCIATION','DISORIENTATION','OBLITERATION','ELOCUÇÃO',
  ],
};
PALAVRAS.desista = [].concat(...Object.values(PALAVRAS));

// ── Estados ativos ──
const JOGOS = new Map(); // channelId → gameState

// ── Desenho da Forca ──
function desenharForca(erros, maxErros) {
  const estagio = Math.min(erros, 6);
  const partes = [
    '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
  ];
  return partes[estagio] || partes[6];
}

function escolherPalavra(dificuldade) {
  const lista = PALAVRAS[dificuldade] || PALAVRAS.normal;
  return lista[Math.floor(Math.random() * lista.length)].toUpperCase();
}

// ══════════════════════════════════════════════════════════════
// EMBED DO JOGO
// ══════════════════════════════════════════════════════════════

function criarEmbedJogo(game, revelar = false) {
  const palavraMostrar = revelar
    ? game.palavra
    : game.palavra.split('').map(l => game.acertos.has(l) ? l : '⬜').join(' ');

  const forca = desenharForca(game.erros, game.maxErros);
  const letrasErradas = game.errosLetras.length
    ? game.errosLetras.map(l => l.startsWith('💬') ? l : `~~${l}~~`).join(' ')
    : 'Nenhuma';

  let descricao = [
    forca,
    '',
    `**📌 Palavra:** \`${palavraMostrar}\``,
    `**📏 Letras:** ${game.palavra.length}`,
    '',
    `**❌ Erros:** ${game.erros}/${game.maxErros}`,
    `**🔤 Erradas:** ${letrasErradas}`,
    '',
  ];

  // Info de jogadores (aparece em TODOS os modos)
  if (game.jogadores && game.jogadores.length > 1) {
    // Multiplayer
    const placar = game.jogadores.map(j =>
      `${j.id === game.vez?.id ? '⭐' : '👤'} **${j.tag}** — ${j.pontos || 0} pts`
    ).join('\n');
    descricao.push(`**👥 Jogadores:**\n${placar}`);
    if (!game.terminou) {
      descricao.push(`**🎯 Vez de:** <@${game.vez?.id}>`);
    }
    if (game.modo === 'competitivo') {
      descricao.push(`**🎯 Rodada:** ${game.rodadaAtual}/${game.totalRodadas}`);
    }
    if (game.modo === 'cooperativo') {
      descricao.push(`**📊 Palavras:** ${game.palavrasAcertadas || 0}/${game.palavrasTotal}`);
      descricao.push(`**🎯 Dificuldade:** ${DIFICULDADES.find(d => d.id === game.dificuldadeAtual)?.nome || game.dificuldade}`);
    }
  } else {
    // Solo
    descricao.push('👤 **Modo Solo** — você contra a máquina!');
    if (game.palpitesRestantes !== null) {
      descricao.push(`**💬 Palpites restantes:** ${'⭐'.repeat(game.palpitesRestantes)}`);
    }
    if (game.modo === 'cooperativo') {
      descricao.push(`**📊 Palavras:** ${game.palavrasAcertadas || 0}/${game.palavrasTotal}`);
      descricao.push(`**🎯 Dificuldade:** ${DIFICULDADES.find(d => d.id === game.dificuldadeAtual)?.nome || game.dificuldade}`);
    }
  }

  let titulo = '🎪 Jogo da Forca';
  if (game.terminou) {
    titulo = game.venceu ? '🎉 VITÓRIA!' : '💀 DERROTA!';
    if (game.modo === 'competitivo' && game.jogadores.length > 1) {
      if (game.gameOver) {
        const vencedor = game.jogadores.reduce((a, b) => (a.pontos || 0) > (b.pontos || 0) ? a : b);
        titulo = `🏆 ${vencedor.tag} VENCEU A PARTIDA!`;
      } else if (game.venceu && game.ganhadorRodada) {
        titulo = `⭐ ${game.ganhadorRodada} venceu esta rodada!`;
      }
    }
  } else {
    const dif = DIFICULDADES.find(d => d.id === game.dificuldade);
    titulo = `🎪 Forca — ${dif?.nome || 'Normal'}${game.modo === 'competitivo' ? ' ⚔️ Vs' : game.modo === 'cooperativo' ? ' 🤝 Coop' : ''}`;
  }

  const cor = game.terminou ? (game.venceu ? COR.ACERTO : COR.ERRO) : COR.PADRAO;
  const rodape = game.terminou
    ? `A palavra era: ${game.palavra}`
    : `${game.modo === 'competitivo' ? 'Clique nas letras na sua vez' : 'Clique nas letras para palpitar'}`;

  return criarEmbed({ titulo, descricao: descricao.filter(Boolean).join('\n'), cor, rodape: `${rodape} • Mila Bot` });
}

// ══════════════════════════════════════════════════════════════
// BOTÕES
// ══════════════════════════════════════════════════════════════

function criarBotoesJogo(game) {
  // Retorna ActionRows prontas — no máximo 5, sem estourar limites do Discord
  const linhas = [];

  // ── Linha 1: Tentar Letra + Palpite + Desistir ──
  const linha1 = new ActionRowBuilder();

  if (game.terminou && !game.gameOver && game.modo === 'competitivo') {
    linha1.addComponents(
      new ButtonBuilder().setCustomId('forca_proxima_rodada').setLabel('▶️ Próx Rodada').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('forca_encerrar_partida').setLabel('🏁 Encerrar').setStyle(ButtonStyle.Danger),
    );
  } else if (game.terminou && !game.gameOver && game.modo === 'cooperativo') {
    linha1.addComponents(
      new ButtonBuilder().setCustomId('forca_proxima_palavra').setLabel('▶️ Próx Palavra').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('forca_encerrar_coop').setLabel('🏁 Encerrar').setStyle(ButtonStyle.Danger),
    );
  } else if (game.terminou && game.gameOver && game.modo === 'cooperativo') {
    linha1.addComponents(
      new ButtonBuilder().setCustomId('forca_ver_estatisticas').setLabel(`📊 ${game.palavrasAcertadas || 0} palavras`).setStyle(ButtonStyle.Primary).setDisabled(true),
    );
  } else if (!game.terminou) {
    linha1.addComponents(
      new ButtonBuilder().setCustomId('forca_letra').setLabel('🔤 Tentar Letra').setStyle(ButtonStyle.Primary).setDisabled(game.terminou),
      new ButtonBuilder().setCustomId('forca_palpite').setLabel('💬 Palpite').setStyle(ButtonStyle.Success).setDisabled(game.terminou),
      new ButtonBuilder().setCustomId('forca_desistir').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Secondary).setDisabled(game.terminou),
    );
  } else {
    linha1.addComponents(
      new ButtonBuilder().setCustomId('forca_revelar').setLabel('👁️ Revelar').setStyle(ButtonStyle.Danger),
    );
  }
  linhas.push(linha1);

  return linhas;
}

// ══════════════════════════════════════════════════════════════
// INICIAR JOGO
// ══════════════════════════════════════════════════════════════

async function iniciarJogo(interaction, config) {
  const { dificuldade, modo, jogadores } = config;
  const maxErros = DIFICULDADES.find(d => d.id === dificuldade)?.maxErros || 6;
  const palavra = escolherPalavra(dificuldade);

  const game = {
    palavra,
    acertos: new Set(),
    erros: 0,
    maxErros,
    usadas: new Set(),
    errosLetras: [],
    dificuldade,
    terminou: false,
    venceu: false,
    gameOver: false,
    modo: modo || 'maquina',
    palpitesRestantes: dificuldade === 'pablo' ? 3 : null,
    // Multiplayer
    jogadores: jogadores || [{ id: interaction.user.id, tag: interaction.user.tag }],
    vez: jogadores?.[0] || { id: interaction.user.id, tag: interaction.user.tag },
    indiceVez: 0,
    ganhadorRodada: null,
    // Competitivo
    rodadaAtual: 1,
    totalRodadas: 2,
    // Cooperativo
    palavrasAcertadas: 0,
    palavrasTotal: 0,
    dificuldadeAtual: dificuldade,
    dificuldadesOrdenadas: null,
    palavrasAcertadasLista: [],
    palavrasErradasLista: [],
  };

  // Cooperativo: prepara lista de TODAS as palavras
  if (modo === 'cooperativo') {
    const ordemDifs = Object.keys(PALAVRAS);
    // Começa da dificuldade escolhida
    const idxInicio = ordemDifs.indexOf(dificuldade);
    game.dificuldadesOrdenadas = [...ordemDifs.slice(idxInicio), ...ordemDifs.slice(0, idxInicio)];
    game.dificuldadeAtual = game.dificuldadesOrdenadas[0];
    game.rodadaAtual = 1;
    game.palavrasTotal = Object.values(PALAVRAS).reduce((s, arr) => s + arr.length, 0);
    // A palavra já foi escolhida com a dificuldade inicial
  }

  const channelId = interaction.channelId || interaction.channel?.id;
  const embed = criarEmbedJogo(game);

  // Envia indicador de turno para multiplayer
  let turnMsgId = null;
  if (game.modo === 'competitivo' || game.modo === 'amigos_coop') {
    const turnEmbed = criarEmbedTurno(game);
    const turnMsg = await interaction.channel.send({ embeds: [turnEmbed] });
    turnMsgId = turnMsg.id;
  }

  const componentes = criarBotoesJogo(game);

  const reply = await interaction.editReply({ embeds: [embed], components: componentes });
  JOGOS.set(channelId, { game, msgId: reply.id, turnMsgId });
}

// ══════════════════════════════════════════════════════════════
// PROCESSAR LETRA
// ══════════════════════════════════════════════════════════════

async function processarLetra(interaction, letra) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao || sessao.game.terminou)
    return interaction.reply({ content: '❌ Nenhum jogo ativo ou já terminou.', ephemeral: true });

  const game = sessao.game;

  // Verifica vez
  if ((game.modo === 'competitivo' || game.modo === 'amigos_coop') && interaction.user.id !== game.vez.id) {
    return interaction.reply({ content: `⏳ Não é sua vez! Aguarde **${game.vez.tag}**.`, ephemeral: true });
  }

  if (game.usadas.has(letra))
    return interaction.reply({ content: `❌ Letra **${letra}** já usada!`, ephemeral: true });

  game.usadas.add(letra);

  if (game.palavra.includes(letra)) {
    game.acertos.add(letra);
    if (game.palavra.split('').every(l => game.acertos.has(l))) {
      game.terminou = true;
      game.venceu = true;
      game.ganhadorRodada = interaction.user.tag;

      // Registra vitória se for modo normal
      if (game.modo === 'maquina') {
        registrarVitoria(interaction.user.id, interaction.user.tag, 'maquina', game.dificuldade);
      }
    }
  } else {
    game.erros++;
    game.errosLetras.push(letra);
    if (game.erros >= game.maxErros) {
      game.terminou = true;
      game.venceu = false;
    }
  }

  // Avança vez em multiplayer
  if ((game.modo === 'competitivo' || game.modo === 'amigos_coop') && !game.terminou) {
    game.indiceVez = (game.indiceVez + 1) % game.jogadores.length;
    game.vez = game.jogadores[game.indiceVez];
  }

  await atualizarJogo(interaction, sessao);
  try {
    // ModalSubmitInteraction precisa de reply(), ButtonInteraction usa deferUpdate()
    if (interaction.isModalSubmit?.()) {
      await interaction.reply({ content: game.terminou ? '🎪 Finalizado!' : '✅ Letra registrada!', ephemeral: true });
    } else {
      await interaction.deferUpdate();
    }
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// MODAL DE LETRA
// ══════════════════════════════════════════════════════════════

async function abrirModalLetra(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao || sessao.game.terminou)
    return interaction.reply({ content: '❌ Jogo não ativo ou já terminou.', ephemeral: true });

  const game = sessao.game;
  if ((game.modo === 'competitivo' || game.modo === 'amigos_coop') && interaction.user.id !== game.vez.id) {
    return interaction.reply({ content: `⏳ Aguarde **${game.vez.tag}** jogar.`, ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('forca_modal_letra')
    .setTitle('🔤 Tentar uma Letra');

  const letrasUsadas = [...game.usadas].sort().join(', ') || 'Nenhuma';
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('forca_input_letra')
        .setLabel(`📝 Digite UMA letra (A-Z)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Usadas: ${letrasUsadas}`)
        .setMaxLength(1)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function processarModalLetra(interaction) {
  const input = interaction.fields.getTextInputValue('forca_input_letra').toUpperCase().trim();
  if (!input || !/^[A-Z]$/.test(input)) {
    return interaction.reply({ content: '❌ Digite apenas UMA letra de A a Z!', ephemeral: true });
  }
  await processarLetra(interaction, input);
}

// ══════════════════════════════════════════════════════════════
// PALPITE
// ══════════════════════════════════════════════════════════════

async function abrirModalPalpite(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao || sessao.game.terminou)
    return interaction.reply({ content: '❌ Jogo não ativo ou já terminou.', ephemeral: true });

  const game = sessao.game;

  if ((game.modo === 'competitivo' || game.modo === 'amigos_coop') && interaction.user.id !== game.vez.id) {
    return interaction.reply({ content: `⏳ Aguarde **${game.vez.tag}** jogar.`, ephemeral: true });
  }

  if (game.dificuldade === 'pablo' && game.palpitesRestantes !== null && game.palpitesRestantes <= 0) {
    return interaction.reply({ content: '❌ Sem palpites restantes no modo Pablo!', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId('forca_modal_palpite')
    .setTitle('💬 Palpite — Palavra Inteira');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('forca_input_palpite')
        .setLabel('📝 Digite a palavra completa:')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: SPRINGTRAP, CIRCO, AMOR...')
        .setMaxLength(30)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function processarPalpite(interaction) {
  const palpite = interaction.fields.getTextInputValue('forca_input_palpite').toUpperCase().trim();
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao || sessao.game.terminou)
    return interaction.reply({ content: '❌ Jogo não ativo.', ephemeral: true });

  const game = sessao.game;
  if (!palpite) return interaction.reply({ content: '❌ Digite algo!', ephemeral: true });

  if (game.dificuldade === 'pablo' && game.palpitesRestantes !== null) game.palpitesRestantes--;

  if (palpite === game.palavra) {
    game.terminou = true;
    game.venceu = true;
    game.ganhadorRodada = interaction.user.tag;
    for (const l of game.palavra) game.acertos.add(l);

    if (game.modo === 'maquina') {
      registrarVitoria(interaction.user.id, interaction.user.tag, 'maquina', game.dificuldade);
    }
  } else {
    game.erros++;
    if (!game.errosLetras.includes(`💬${palpite}`)) game.errosLetras.push(`💬${palpite}`);
    if (game.erros >= game.maxErros) { game.terminou = true; game.venceu = false; }
  }

  if ((game.modo === 'competitivo' || game.modo === 'amigos_coop') && !game.terminou) {
    game.indiceVez = (game.indiceVez + 1) % game.jogadores.length;
    game.vez = game.jogadores[game.indiceVez];
  }

  await atualizarJogo(interaction, sessao);
  // Responde ao modal submit para não travar
  try {
    await interaction.reply({ content: game.terminou ? '🎪 Palpite finalizado!' : '✅ Letra contada!', ephemeral: true });
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// ATUALIZAR
// ══════════════════════════════════════════════════════════════

// ── Embed de indicador de turno ──
function criarEmbedTurno(game) {
  if (!game.vez) return null;
  const descricao = [
    '```',
    '╔══════════════════════════════╗',
    '║      🎯 VEZ DE JOGAR        ║',
    '╚══════════════════════════════╝',
    '```',
    '',
    `<@${game.vez.id}>`,
    '',
    '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
    '',
    `📌 **Rodada ${game.rodadaAtual || 1}/${game.totalRodadas || 2}**`,
    game.jogadores?.map(j =>
      `${j.id === game.vez.id ? '⭐' : '👤'} **${j.tag}** — ${j.pontos || 0} pts`
    ).join('\n') || '',
    '',
    '🎯 **Clique nas letras abaixo para jogar!**',
  ].join('\n');

  return criarEmbed({
    titulo: '🎪 Jogo da Forca — ⚔️ Vs Amigos',
    descricao,
    cor: game.modo === 'competitivo' ? COR.INFO : COR.PADRAO,
    rodape: '🎪 Jogo da Forca • Mila Bot',
  });
}

async function atualizarJogo(interaction, sessao) {
  const game = sessao.game;
  const embed = criarEmbedJogo(game);

  // Atualiza indicador de turno para multiplayer
  if ((game.modo === 'competitivo' || game.modo === 'amigos_coop') && sessao.turnMsgId) {
    const turnEmbed = criarEmbedTurno(game);
    try {
      const turnMsg = await interaction.channel.messages.fetch(sessao.turnMsgId);
      await turnMsg.edit({ embeds: [turnEmbed], content: game.terminou ? null : `<@${game.vez.id}>` });
    } catch {
      // Se falhou, tenta enviar novo
      try {
        const newTurnMsg = await interaction.channel.send({ embeds: [turnEmbed], content: game.terminou ? null : `<@${game.vez.id}>` });
        sessao.turnMsgId = newTurnMsg.id;
      } catch {}
    }
  }

  const componentes = criarBotoesJogo(game);

  try {
    const msg = await interaction.channel.messages.fetch(sessao.msgId);
    await msg.edit({ embeds: [embed], components: componentes });
  } catch {
    const msg = await interaction.channel.send({ embeds: [embed], components: componentes });
    sessao.msgId = msg.id;
  }

  if (game.terminou) setTimeout(() => JOGOS.delete(interaction.channelId), 300_000);
}

// ══════════════════════════════════════════════════════════════
// AÇÕES PÓS-RODADA
// ══════════════════════════════════════════════════════════════

async function proximaRodada(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao) return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true });

  const game = sessao.game;

  if (game.modo === 'competitivo') {
    if (game.rodadaAtual >= game.totalRodadas) {
      // Fim da partida
      game.gameOver = true;
      game.terminou = true;
      const vencedor = game.jogadores.reduce((a, b) => (a.pontos || 0) > (b.pontos || 0) ? a : b);
      // Registra vitória
      registrarVitoria(vencedor.id, vencedor.tag, 'competitivo', game.dificuldade);
      return atualizarJogo(interaction, sessao);
    }

    // Nova rodada
    game.rodadaAtual++;
    game.palavra = escolherPalavra(game.dificuldade);
    game.acertos = new Set();
    game.erros = 0;
    game.usadas = new Set();
    game.errosLetras = [];
    game.terminou = false;
    game.venceu = false;
    game.ganhadorRodada = null;
    game.vez = game.jogadores[0];
    game.indiceVez = 0;
    if (game.dificuldade === 'pablo') game.palpitesRestantes = 3;

    await atualizarJogo(interaction, sessao);
    try { await interaction.deferUpdate(); } catch {}
  }
}

async function encerrarPartida(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao) return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true });

  const game = sessao.game;
  game.gameOver = true;
  game.terminou = true;

  if (game.modo === 'competitivo') {
    const vencedor = game.jogadores.reduce((a, b) => (a.pontos || 0) > (b.pontos || 0) ? a : b);
    registrarVitoria(vencedor.id, vencedor.tag, 'competitivo', game.dificuldade);
  } else if (game.modo === 'cooperativo') {
    // Cada jogador ganha X vitórias
    for (const j of game.jogadores) {
      registrarVitoria(j.id, j.tag, 'cooperativo', 'normal');
    }
  }

  await atualizarJogo(interaction, sessao);
  try { await interaction.deferUpdate(); } catch {}
}

async function proximaPalavraCoop(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao) return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true });

  const game = sessao.game;

  // Lista de palavras da dificuldade atual
  const palavrasAtuais = PALAVRAS[game.dificuldadeAtual] || [];
  const tentarPalavra = () => {
    const p = palavrasAtuais[Math.floor(Math.random() * palavrasAtuais.length)].toUpperCase();
    return p !== game.palavra ? p : tentarPalavra();
  };

  // Se não tem mais palavras ou mudou de dificuldade
  game.palavrasAcertadas = (game.palavrasAcertadas || 0) + 1;
  game.palavra = tentarPalavra();
  game.acertos = new Set();
  game.erros = 0;
  game.usadas = new Set();
  game.errosLetras = [];
  game.terminou = false;
  game.venceu = false;
  if (game.dificuldade === 'pablo') game.palpitesRestantes = 3;

  // Verifica se mudou de dificuldade
  // A cada 3 palavras acertadas (ou a cada 5 tentativas), sobe de dificuldade
  const totalAcumulado = game.palavrasAcertadas || 0;
  const difIndex = Math.min(Math.floor(totalAcumulado / 3), game.dificuldadesOrdenadas.length - 1);
  game.dificuldadeAtual = game.dificuldadesOrdenadas[difIndex];
  game.dificuldade = game.dificuldadeAtual;
  const difObj = DIFICULDADES.find(d => d.id === game.dificuldadeAtual);
  game.maxErros = difObj?.maxErros || 6;

  await atualizarJogo(interaction, sessao);
  try { await interaction.deferUpdate(); } catch {}
}

// ══════════════════════════════════════════════════════════════
// REGRAS
// ══════════════════════════════════════════════════════════════

function criarEmbedRegras() {
  const modos = DIFICULDADES.map(d => `${d.nome}: ${d.desc}`).join('\n');
  return criarEmbed({
    titulo: '📖 Regras do Jogo da Forca',
    descricao: [
      '```╔══════════════════════════════╗',
      '║    📖 REGRAS DA FORCA       ║',
      '╚══════════════════════════════╝```',
      '',
      '🎯 **Objetivo:** Descobrir a palavra antes de completar o boneco.',
      '',
      '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
      '',
      '🎮 **Modos de Jogo:**',
      '',
      '🤖 **Vs Máquina** — Jogue sozinho contra o bot',
      '',
      '⚔️ **Vs Amigos (Competitivo)** — 2 rodadas. Quem acertar',
      '   mais palavras vence! Convite via `$forca vs @amigo`',
      '',
      '🤝 **Cooperativo** — Todos juntos contra todas as palavras!',
      '   Começa na dificuldade escolhida e avança por todas.',
      '   Convite via `$forca vs @amigo`',
      '',
      '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
      '',
      `**📊 Dificuldades:**\n${modos}`,
      '',
      '💡 **Modo Pablo:** 3 palpites de palavra apenas!',
      '💡 **Desista:** 1 erro e morreu!',
      '',
      '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
      '',
      '🎮 **Como Jogar:**',
      '• Clique nas letras A–Z para tentar',
      '• 💬 **Palpite** — Tente a palavra inteira',
      '• Cada erro adiciona parte do boneco',
      '',
      '📊 **Ranking:** Use `$forca ranking` para ver',
      '   as pontuações de todos os modos!',
    ].join('\n'),
    cor: COR.INFO,
    rodape: '🎪 Jogo da Forca • Mila Bot',
  });
}

// ══════════════════════════════════════════════════════════════
// RANKING
// ══════════════════════════════════════════════════════════════

function criarEmbedRanking(tipo = 'total') {
  const lista = obterRanking(tipo);

  const medalhas = ['🥇', '🥈', '🥉'];

  const linhas = lista.length
    ? lista.map((j, i) =>
        `${medalhas[i] || `${i + 1}.`} **${j.tag}** — ` +
        `Total: ${j.total} | 🤖 ${j.maquina} | ⚔️ ${j.competitivo} | 🤝 ${j.cooperativo}`
      ).join('\n')
    : 'Nenhuma partida registrada ainda!';

  const titulos = {
    total: '📊 Ranking Geral',
    maquina: '🤖 Ranking Vs Máquina',
    competitivo: '⚔️ Ranking Vs Amigos',
    cooperativo: '🤝 Ranking Cooperativo',
  };

  return criarEmbed({
    titulo: titulos[tipo] || '📊 Ranking',
    descricao: [
      '```╔══════════════════════════════╗',
      '║       🏆 RANKING FORCA      ║',
      '╚══════════════════════════════╝```',
      '',
      linhas,
      '',
      '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
      '',
      'Use os botões abaixo para filtrar!',
    ].join('\n'),
    cor: COR.OURO,
    rodape: '🎪 Jogo da Forca • Ranking • Mila Bot',
  });
}

function criarBotoesRanking() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('forca_rank_total').setLabel('📊 Geral').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('forca_rank_maquina').setLabel('🤖 Máquina').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('forca_rank_competitivo').setLabel('⚔️ Vs').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('forca_rank_cooperativo').setLabel('🤝 Coop').setStyle(ButtonStyle.Success),
  );
}

// ══════════════════════════════════════════════════════════════
// PAINEL INICIAL
// ══════════════════════════════════════════════════════════════

function criarSelectModo() {
  return new StringSelectMenuBuilder()
    .setCustomId('forca_select_modo')
    .setPlaceholder('🎮 Selecione o modo...')
    .addOptions([
      { label: '🤖 Vs Máquina', value: 'maquina', description: 'Jogue sozinho contra o bot', emoji: '🤖' },
      { label: '⚔️ Vs Amigos (Competitivo)', value: 'competitivo', description: '2 rodadas, quem acertar mais vence', emoji: '⚔️' },
      { label: '🤝 Cooperativo', value: 'cooperativo', description: 'Todos juntos contra todas as palavras', emoji: '🤝' },
    ]);
}

function criarSelectDificuldade() {
  return new StringSelectMenuBuilder()
    .setCustomId('forca_select_dificuldade')
    .setPlaceholder('📊 Selecione a dificuldade...')
    .addOptions(DIFICULDADES.map(d => ({ label: d.nome, value: d.id, description: d.desc })));
}

// ══════════════════════════════════════════════════════════════
// SISTEMA DE CONVITE ($forca vs @jogador)
// ══════════════════════════════════════════════════════════════

async function criarConvite(interaction, dificuldade, modo, convidados) {
  const nomes = convidados.map(m => m.user.tag).join(', ');
  const difNome = DIFICULDADES.find(d => d.id === dificuldade)?.nome || 'Normal';

  const embed = criarEmbed({
    titulo: '🎪 Convite para Jogo da Forca!',
    descricao: [
      '```╔══════════════════════════════╗',
      '║        🎪 CONVITE            ║',
      '╚══════════════════════════════╝```',
      '',
      `👤 **Anfitrião:** ${interaction.user.tag}`,
      `👥 **Convidados:** ${nomes}`,
      `🎮 **Modo:** ${modo === 'competitivo' ? '⚔️ Competitivo' : '🤝 Cooperativo'}`,
      `📊 **Dificuldade:** ${difNome}`,
      '',
      '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
      '',
      'Deseja aceitar o convite?',
      'Ambos precisam aceitar para começar!',
    ].join('\n'),
    cor: COR.INFO,
    rodape: '🎪 Jogo da Forca • Convite • Mila Bot',
  });

  const aceitos = new Set();

  const conviteMsg = await interaction.channel.send({
    content: convidados.map(m => `${m}`).join(' '),
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('forca_convite_aceitar')
          .setLabel('✅ Aceitar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('forca_convite_recusar')
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });

  const todos = [interaction.user, ...convidados.map(m => m.user)];
  const coletor = conviteMsg.createMessageComponentCollector({
    time: 120_000,
    filter: (i) => todos.some(u => u.id === i.user.id),
  });

  coletor.on('collect', async (i) => {
    if (i.customId === 'forca_convite_aceitar') {
      aceitos.add(i.user.id);
      if (aceitos.size >= todos.length) {
        coletor.stop('todos_aceitaram');
        await conviteMsg.edit({
          content: '✅ **Todos aceitaram!** Começando a partida...',
          components: [],
        });
        const criando = await interaction.channel.send('🎪 **Preparando o picadeiro...**');
        await iniciarJogo(
          { ...interaction, editReply: (o) => criando.edit(o), channelId: interaction.channelId, channel: interaction.channel },
          {
            dificuldade,
            modo,
            jogadores: todos.map(u => ({ id: u.id, tag: u.tag, pontos: 0 })),
          }
        );
      } else {
        await i.reply({ content: `✅ **${i.user.tag}** aceitou! (${aceitos.size}/${todos.length})`, ephemeral: true });
      }
    } else if (i.customId === 'forca_convite_recusar') {
      coletor.stop('recusou');
      await conviteMsg.edit({
        content: `❌ **${i.user.tag}** recusou o convite. Partida cancelada.`,
        components: [],
      });
    }
  });

  coletor.on('end', async (_, reason) => {
    if (reason === 'time') {
      try { await conviteMsg.edit({ content: '⏰ **Tempo esgotado.** Convite cancelado.', components: [] }); } catch {}
    }
  });
}

// ══════════════════════════════════════════════════════════════
// DESISTIR / REVELAR
// ══════════════════════════════════════════════════════════════

async function desistir(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao || sessao.game.terminou)
    return interaction.reply({ content: '❌ Nenhum jogo ativo ou já terminou.', ephemeral: true });
  sessao.game.terminou = true;
  sessao.game.venceu = false;
  await atualizarJogo(interaction, sessao);
}

async function revelarPalavra(interaction) {
  const sessao = JOGOS.get(interaction.channelId);
  if (!sessao || !sessao.game.terminou)
    return interaction.reply({ content: '❌ O jogo ainda não terminou.', ephemeral: true });
  const embed = criarEmbedJogo(sessao.game, true);
  await interaction.update({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════

module.exports = {
  COR,
  DIFICULDADES,
  JOGOS,
  criarEmbedRegras,
  criarEmbedJogo,
  criarEmbedTurno,
  criarEmbedRanking,
  criarBotoesRanking,
  criarSelectModo,
  criarSelectDificuldade,
  criarBotoesJogo,
  iniciarJogo,
  processarLetra,
  abrirModalLetra,
  processarModalLetra,
  abrirModalPalpite,
  processarPalpite,
  atualizarJogo,
  proximaRodada,
  encerrarPartida,
  proximaPalavraCoop,
  desistir,
  revelarPalavra,
  criarConvite,
  obterRanking,
  obterJogador,
};
