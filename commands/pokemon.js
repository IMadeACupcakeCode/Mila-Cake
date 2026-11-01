const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const pokemon = require('../utils/pokemon');
const typeChart = require('../utils/typeChart');
const pokemonBattle = require('../utils/pokemonBattle');
const batalhas = require('../utils/pokemonBattleCommand');
const db = require('../utils/db');
const criador = require('../utils/criador');
const { isStaff } = require('../utils/perms');
const theme = require('../utils/economyTheme');
const { THEME } = require('../utils/theme');

const TEMPO_SESSAO_MS = 5 * 60 * 1000;
const ITENS_LOJA_POR_PAGINA = 5;
const PERFIL_COLECAO_POR_PAGINA = 1;
const PERFIL_MOCHILA_POR_PAGINA = 8;
const PERFIL_NAVEGACAO_MS = 5 * 60 * 1000;
const TIPO = { subcommand: 1, string: 3, integer: 4, boolean: 5, user: 6, channel: 7 };
const CATEGORIAS_LOJA = [
  { label: 'Todas as categorias', value: 'todas', emoji: '🛍️' },
  ...pokemon.CATEGORIAS.map((categoria) => ({
    label: categoria.nome,
    value: categoria.id,
    emoji: categoria.emoji,
    description: categoria.descricao.slice(0, 100),
  })),
];

const data = {
  name: 'pokemon',
  description: 'Encontros, capturas, coleção, favoritos e loja Pokémon',
  options: [
    { type: TIPO.subcommand, name: 'admin', description: 'Lista de comandos de admin e configuração' },
    { type: TIPO.subcommand, name: 'manual', description: 'Manual completo: regras, comandos, captura e itens' },
    { type: TIPO.subcommand, name: 'ajuda', description: 'Mostra o manual do jogo' },
    {
      type: TIPO.subcommand,
      name: 'capturar',
      description: 'Tente capturar o Pokémon que apareceu',
      options: [{ type: TIPO.string, name: 'pokemon', description: 'Nome para tentar adivinhar', required: false }],
    },
    {
      type: TIPO.subcommand,
      name: 'colecao',
      description: 'Veja sua coleção de Pokémon',
      options: [
        { type: TIPO.user, name: 'usuario', description: 'Coleção de outra pessoa', required: false },
        { type: TIPO.string, name: 'escopo', description: 'Coleção global ou deste servidor', required: false, choices: [{ name: 'Global', value: 'global' }, { name: 'Este servidor', value: 'servidor' }] },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'perfil',
      description: 'Veja seu perfil Pokémon ou o de alguém deste servidor',
      options: [{ type: TIPO.user, name: 'usuario', description: 'Pessoa cujo perfil você quer ver', required: false }],
    },
    {
      type: TIPO.subcommand,
      name: 'favorito',
      description: 'Adicione ou remova um Pokémon favorito neste servidor',
      options: [
        { type: TIPO.string, name: 'acao', description: 'O que fazer', required: true, choices: [{ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }] },
        { type: TIPO.string, name: 'pokemon', description: 'Nome ou número na Pokédex', required: true },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'avisos',
      description: 'Configure pings pessoais e alertas de favoritos',
      options: [
        { type: TIPO.boolean, name: 'ping', description: 'Permitir que alertas marquem você', required: false },
        { type: TIPO.boolean, name: 'favoritos', description: 'Receber alertas de favoritos', required: false },
      ],
    },
    { type: TIPO.subcommand, name: 'favoritos', description: 'Lista seus favoritos neste servidor' },
    { type: TIPO.subcommand, name: 'loja', description: 'Explore a loja Pokémon e compre pelo carrinho' },
    { type: TIPO.subcommand, name: 'missoes', description: 'Acompanhe missões e resgate Pokébolas como recompensa' },
    {
      type: TIPO.subcommand,
      name: 'comprar',
      description: 'Compre um item com açúcares',
      options: [{ type: TIPO.string, name: 'item', description: 'ID ou nome do item (veja /pokemon loja)', required: true }],
    },
    { type: TIPO.subcommand, name: 'inventario', description: 'Veja seus itens Pokémon' },
    {
      type: TIPO.subcommand,
      name: 'usar',
      description: 'Consuma um item',
      options: [{ type: TIPO.string, name: 'item', description: 'Item consumível', required: true, choices: [{ name: '🪻 Incenso · 30 min', value: 'incenso' }] }],
    },
    {
      type: TIPO.subcommand,
      name: 'equipar',
      description: 'Escolha sua Pokébola ou moldura',
      options: [{ type: TIPO.string, name: 'item', description: 'ID ou nome do item que você possui', required: true }],
    },
    {
      type: TIPO.subcommand,
      name: 'configurar',
      description: 'Configure os encontros deste servidor (equipe)',
      options: [
        { type: TIPO.boolean, name: 'ativo', description: 'Ativa ou desativa encontros', required: false },
        { type: TIPO.boolean, name: 'silenciar', description: 'Silencia ou reativa encontros', required: false },
        { type: TIPO.integer, name: 'chance', description: 'Chance por mensagem, de 1 a 100%', required: false, min_value: 1, max_value: 100 },
        { type: TIPO.integer, name: 'intervalo', description: 'Intervalo mínimo entre encontros, em minutos (1–1440)', required: false, min_value: 1, max_value: 1440 },
        { type: TIPO.integer, name: 'intervalo_segundos', description: 'Segundos adicionais ao intervalo (0–59)', required: false, min_value: 0, max_value: 59 },        { type: TIPO.string, name: 'raridade', description: 'Frequência de Pokémon raros e lendários', required: false, choices: [{ name: 'Conservadora', value: 'conservadora' }, { name: 'Equilibrada', value: 'equilibrada' }, { name: 'Generosa', value: 'generosa' }] },
        { type: TIPO.integer, name: 'shiny_chance', description: 'Denominador da chance shiny (ex.: 4096 = 1 em 4096)', required: false, min_value: 1, max_value: 100000 },
        { type: TIPO.string, name: 'preset', description: 'Aplicar uma configuração pronta', required: false, choices: Object.entries(pokemon.PRESETS_CONFIG).map(([value, preset]) => ({ name: preset.nome, value })) },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'canal',
      description: 'Liste ou escolha os canais de encontro (equipe)',
      options: [
        { type: TIPO.string, name: 'acao', description: 'Adicionar, remover ou listar canais', required: true, choices: [{ name: 'Adicionar', value: 'adicionar' }, { name: 'Remover', value: 'remover' }, { name: 'Listar', value: 'listar' }] },
        { type: TIPO.channel, name: 'canal', description: 'Canal de texto (obrigatório para adicionar/remover)', required: false, channel_types: [0, 5] },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'info',
      description: 'Consulte a Pokédex',
      options: [{ type: TIPO.string, name: 'pokemon', description: 'Nome ou número na Pokédex', required: true }],
    },
    {
      type: TIPO.subcommand,
      name: 'pokedex',
      description: 'Consulte a Pokédex pelo nome ou apelido oficial',
      options: [{ type: TIPO.string, name: 'pokemon', description: 'Nickname ou número na Pokédex', required: true }],
    },
    {
      type: TIPO.subcommand,
      name: 'upar',
      description: 'Veja XP e nível de uma captura (ID, nome ou posição na lista)',
      options: [{ type: TIPO.string, name: 'captura', description: 'ID, nome ou posição da captura na sua coleção', required: true, min_length: 1 }],
    },
    {
      type: TIPO.subcommand,
      name: 'evoluir',
      description: 'Evolua uma captura usando um item compatível',
      options: [
        { type: TIPO.integer, name: 'captura', description: 'ID da captura mostrado na coleção', required: true, min_value: 1 },
        { type: TIPO.string, name: 'destino', description: 'ID ou nome da evolução desejada', required: true },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'ranking',
      description: 'Veja o ranking Pokémon deste servidor ou global',
      options: [{
        type: TIPO.string,
        name: 'escopo',
        description: 'Escolha o ranking',
        required: false,
        choices: [{ name: 'Este servidor', value: 'servidor' }, { name: 'Global (todos os servidores)', value: 'global' }],
      }],
    },
    {
      type: TIPO.subcommand,
      name: 'duelo',
      description: 'Desafie alguém para uma batalha Pokémon',
      options: [
        { type: TIPO.user, name: 'usuario', description: 'Pessoa que você quer desafiar', required: true },
        {
          type: TIPO.integer,
          name: 'tamanho',
          description: 'Pokémon por equipe; 1 é duelo solo',
          required: false,
          choices: Array.from({ length: 6 }, (_, index) => ({ name: `${index + 1} Pokémon`, value: index + 1 })),
        },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'ginasio',
      description: 'Desafie um ginásio PvE por uma insígnia',
      options: [
        {
          type: TIPO.string,
          name: 'desafio',
          description: 'Ginásio que você quer desafiar',
          required: true,
          choices: pokemonBattle.GYMS.map((gym) => ({ name: gym.nome, value: gym.id })),
        },
        {
          type: TIPO.integer,
          name: 'tamanho',
          description: 'Pokémon na sua equipe (2 a 6; padrão: 3)',
          required: false,
          choices: [2, 3, 4, 5, 6].map((value) => ({ name: `${value} Pokémon`, value })),
        },
      ],
    },
    {
      type: TIPO.subcommand,
      name: 'insignias',
      description: 'Veja suas insígnias ou as de outra pessoa',
      options: [{ type: TIPO.user, name: 'usuario', description: 'Treinador cujas insígnias você quer ver', required: false }],
    },
  ],
};

function embed(titulo, descricao, cor = THEME.corPrincipal, imagem = null, rodape = 'Mila Pokémon', thumbnail = null, campos = []) {
  const decorated = `${THEME.div.bolinhas}\n\n${descricao}\n\n${THEME.div.bolinhas}`;
  return theme.janela({
    titulo,
    descricao: decorated,
    cor,
    imagem,
    thumbnail,
    rodape,
    campos,
  });
}

function cardCaptura(resultado, user) {
  const capture = pokemon.criarEmbedCaptura(resultado, user);
  return embed(
    capture.title,
    capture.description,
    capture.color,
    capture.image?.url,
    capture.footer?.text || 'Mila Pokémon · boa captura ♡',
    user.displayAvatarURL?.({ size: 128 })
  );
}

function responderTexto(ctx, titulo, descricao, cor = THEME.corPrincipal, ephemeral = true) {
  return responder(ctx, { embeds: [embed(titulo, descricao, cor)] }, ephemeral);
}

function responder(ctx, payload, ephemeral = false) {
  if (ctx.isSlash) {
    if (ctx.interaction.deferred || ctx.interaction.replied) return ctx.interaction.editReply(payload);
    return ctx.interaction.reply({ ...payload, ephemeral });
  }
  return ctx.reply(payload);
}

function helpEmbed() {
  return embed(
    'Manual de Mila Pokémon',
    'Seu guia de captura, coleção, itens e rankings. Todos os comandos funcionam com `/pokemon ...` e também com `$pokemon ...`.',
    THEME.corPrincipal,
    null,
    'Mila Pokémon · manual do treinador',
    null,
    [
      {
        name: '🌿 1 · Encontros',
        value: 'Servidores novos já vêm com encontros ativos. Cada mensagem elegível pode gerar um encontro conforme a chance configurada; o intervalo mínimo começa depois que o Pokémon é publicado e vale para o servidor inteiro. Há apenas um encontro ativo por servidor, por até 10 minutos. Canais podem ser limitados pela equipe.',
      },
      {
        name: '🎯 2 · Como capturar',
        value: 'Quando aparecer um Pokémon, digite o nome em português ou o nome internacional no mesmo canal, ou use `/pokemon capturar`. Um palpite errado não encerra o encontro. Se ele escapar, a Pokébola não é consumida; em uma captura, a bola especial equipada é consumida.',
      },
      {
        name: '✨ 3 · Chance e raridades',
        value: 'A raridade é baseada na taxa de captura da espécie; os moderadores podem escolher um preset para ajustar a frequência de espécies raras. O preset nunca cancela um encontro que já passou pela chance configurada. A chance shiny pode ser ajustada separadamente. Great Ball e Ultra Ball melhoram a captura; Incenso aumenta por 30 minutos a chance de encontro.',
      },
      {
        name: '📖 4 · Perfil, coleção e rankings',
        value: '`/pokemon perfil [usuario]` abre um painel com status, mochila, coleção e insígnias. `/pokemon colecao [usuario]` mostra cada captura com sprite animado e páginas clicáveis; escolha a coleção global ou a deste servidor.',
      },
      {
        name: '🛍️ 5 · Loja e inventário',
        value: '`/pokemon loja` abre um catálogo privado com categorias, carrinho e confirmação. Além de Pokébolas, incenso e molduras, há pedras e catalisadores de evolução. Use `/pokemon evoluir captura destino` e o ID da captura mostrado na coleção.',
      },
      {
        name: '🧭 6 · Missões',
        value: '`/pokemon missoes` mostra objetivos permanentes e diários. Complete-os e resgate Pokébolas, inclusive itens especiais. O progresso acompanha sua coleção global e a missão diária renova à meia-noite UTC.',
      },
      {
        name: '⭐ 7 · Favoritos e avisos',
        value: 'Use `/pokemon favorito` para adicionar/remover uma espécie e `/pokemon favoritos` para ver sua lista neste servidor. Em `/pokemon avisos`, ative tanto os pings pessoais quanto os alertas de favoritos se quiser ser mencionada. Ambos começam desligados.',
      },
      {
        name: '📖 8 · Pokédex e atalhos',
        value: '`/pokemon pokedex` (ou `/pokemon info`) consulta por nickname ou número. Prefixos rápidos: `$pokemon dex`, `$pokemon meus`, `$pokemon evo`. Novos servidores já começam com encontros configurados; a equipe pode usar os presets `tranquilo`, `aventura`, `silencio` e `padrao` em `/pokemon configurar`.',
      },
      {
        name: '🏆 Sobre as classificações',
        value: 'O perfil e o ranking Global contam toda a coleção da pessoa. O ranking deste servidor conta apenas capturas feitas nele desde que a Mila passou a registrar o servidor da captura; capturas antigas continuam no perfil e no global.',
      },
      {
        name: '⚔️ 9 · Batalhas e insígnias',
        value: '`/pokemon duelo usuario tamanho` cria um desafio PvP; escolha 1 Pokémon ou equipes de 2 a 6. `tamanho:1` é o duelo solo. Cada lado escolhe da própria coleção; o nível é normalizado para 50. Golpes, tipos, atributos, precisão, PP, trocas e alguns status afetam a partida. Habilidades, itens equipados, clima e mecânicas competitivas avançadas ainda não fazem parte deste formato.',
      },
      {
        name: '🏅 10 · Ginásios',
        value: '`/pokemon ginasio desafio` abre um desafio contra uma equipe controlada pela Mila; o tamanho padrão é 3 (de 2 a 6). Para conquistar a insígnia, vença e leve ao menos um Pokémon da lista específica do ginásio. `/pokemon insignias [usuario]` e a aba Insígnias do perfil mostram desafios e conquistas, com navegação por páginas. Convites e partidas em andamento são temporários e não sobrevivem à reinicialização do bot.',
      },
    ]
  );
}

const SECOES_MANUAL = [
  { name: '🌿 1 · Encontros', value: 'Servidores novos já vêm com encontros ativos. Cada mensagem elegível pode gerar um encontro conforme a chance configurada; o intervalo mínimo começa depois que o Pokémon é publicado e vale para o servidor inteiro. Há apenas um encontro ativo por servidor, por até 10 minutos. Canais podem ser limitados pela equipe.' },
  { name: '🎯 2 · Como capturar', value: 'Quando aparecer um Pokémon, digite o nome em português ou o nome internacional no mesmo canal, ou use `/pokemon capturar`. Um palpite errado não encerra o encontro. Se ele escapar, a Pokébola não é consumida; em uma captura, a bola especial equipada é consumida.' },
  { name: '✨ 3 · Chance e raridades', value: 'A raridade é baseada na taxa de captura da espécie; os moderadores podem escolher um preset para ajustar a frequência de espécies raras. O preset nunca cancela um encontro que já passou pela chance configurada. A chance shiny pode ser ajustada separadamente. Great Ball e Ultra Ball melhoram a captura; Incenso aumenta por 30 minutos a chance de encontro.' },
  { name: '📖 4 · Perfil, coleção e rankings', value: '`/pokemon perfil [usuario]` abre um painel com status, mochila, coleção e insígnias. `/pokemon colecao [usuario]` mostra cada captura com sprite animado e páginas clicáveis; escolha a coleção global ou a deste servidor.' },
  { name: '🛍️ 5 · Loja e inventário', value: '`/pokemon loja` abre um catálogo privado com categorias, carrinho e confirmação. Além de Pokébolas, incenso e molduras, há pedras e catalisadores de evolução. Use `/pokemon comprar item` para comprar direto, `/pokemon inventario` para ver a mochila, `/pokemon usar item` para consumíveis (incenso), `/pokemon equipar item` para equipar bolas/cosméticos e `/pokemon evoluir captura destino` com a pedra certa (ex.: pedra_agua para Vaporeon). Itens de evolução são consumidos ao evoluir; se faltar o item, a evolução é cancelada e o item não é perdido.' },
  { name: '🧭 6 · Missões', value: '`/pokemon missoes` mostra objetivos permanentes e diários. Complete-os e resgate Pokébolas, inclusive itens especiais. O progresso acompanha sua coleção global e a missão diária renova à meia-noite UTC.' },
  { name: '⭐ 7 · Favoritos e avisos', value: 'Use `/pokemon favorito` para adicionar/remover uma espécie e `/pokemon favoritos` para ver sua lista neste servidor. Em `/pokemon avisos`, ative tanto os pings pessoais quanto os alertas de favoritos se quiser ser mencionada. Ambos começam desligados.' },
  { name: '📖 8 · Pokédex e atalhos', value: '`/pokemon pokedex` (ou `/pokemon info`) consulta por nickname ou número. Prefixos rápidos: `$pokemon dex`, `$pokemon meus`, `$pokemon evo`. Novos servidores já começam com encontros configurados; a equipe pode usar os presets `tranquilo`, `aventura`, `silencio` e `padrao` em `/pokemon configurar`.' },
  { name: '🏆 Sobre as classificações', value: 'O perfil e o ranking Global contam toda a coleção da pessoa. O ranking deste servidor conta apenas capturas feitas nele desde que a Mila passou a registrar o servidor da captura; capturas antigas continuam no perfil e no global.' },
  { name: '🧬 11 · Naturezas e status', value: 'Cada captura recebe uma natureza aleatória (Carinhoso, Feroz, Tímido, Robusto, Astuto, Calmo) que altera HP, Ataque, Defesa e Velocidade. Ao ver sua própria coleção, o embed mostra HP, Ataque, Defesa, Velocidade, Natureza, Tipos e Fraquezas. Use as reações ◀️▶️ para folhear a coleção; o embed atualiza a cada página.' },
  { name: '⚔️ 9 · Batalhas e insígnias', value: '`/pokemon duelo usuario tamanho` cria um desafio PvP; escolha 1 Pokémon ou equipes de 2 a 6. `tamanho:1` é o duelo solo. Cada lado escolhe da própria coleção; o nível é normalizado para 50. Golpes, tipos, atributos, precisão, PP, trocas e alguns status afetam a partida.' },
  { name: '🏅 10 · Ginásios', value: '`/pokemon ginasio desafio` abre um desafio contra uma equipe controlada pela Mila; o tamanho padrão é 3 (de 2 a 6). Para conquistar a insígnia, vença e leve ao menos um Pokémon da lista específica do ginásio. `/pokemon insignias [usuario]` e a aba Insígnias do perfil mostram desafios e conquistas.' },
];

function paginasManual() {
  const paginas = [];
  paginas.push(embed(
    'Manual de Mila Pokémon',
    'Seu guia de captura, coleção, itens e rankings. Todos os comandos funcionam com `/pokemon ...` e também com `$pokemon ...`.',
    THEME.corPrincipal,
    null,
    'Mila Pokémon · manual do treinador',
    null,
    [
      { name: 'Seções', value: SECOES_MANUAL.map((s) => s.name).join(' · '), inline: false },
      { name: 'Como navegar', value: 'Use os botões ◀️ ▶️ para folhear. Cada página traz uma seção do manual.', inline: false },
    ]
  ));
  for (let i = 0; i < SECOES_MANUAL.length; i += 2) {
    const campos = SECOES_MANUAL.slice(i, i + 2);
    paginas.push(embed(
      'Manual Pokémon',
      campos.map((c) => `**${c.name}**\n${c.value}`).join('\n\n'),
      THEME.corPrincipal,
      null,
      `Mila Pokémon · página ${paginas.length + 1}/${Math.ceil(SECOES_MANUAL.length / 2) + 1}`,
      null,
      []
    ));
  }
  return paginas;
}

function botoesManual(indice, total) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('manual_first').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(indice === 0),
    new ButtonBuilder().setCustomId('manual_prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(indice === 0),
    new ButtonBuilder().setCustomId('manual_next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(indice >= total - 1),
    new ButtonBuilder().setCustomId('manual_last').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(indice >= total - 1),
  );
}

async function abrirManual(ctx) {
  const paginas = paginasManual();
  let pagina = 0;
  const render = () => ({ embeds: [paginas[pagina]], components: [botoesManual(pagina, paginas.length)] });
  const mensagem = await ctx.interaction.reply({ ...render(), fetchReply: true });
  const collector = mensagem.createMessageComponentCollector({ time: 120000, filter: (i) => i.user.id === ctx.user.id });
  collector.on('collect', async (i) => {
    if (i.customId === 'manual_first') pagina = 0;
    else if (i.customId === 'manual_prev') pagina = Math.max(0, pagina - 1);
    else if (i.customId === 'manual_next') pagina = Math.min(paginas.length - 1, pagina + 1);
    else if (i.customId === 'manual_last') pagina = paginas.length - 1;
    await i.update(render());
  });
  collector.on('end', async () => {
    try { await mensagem.edit({ components: [] }); } catch {}
  });
}

function formatarUltimaCaptura(captura) {
  if (!captura) return 'Nenhuma captura registrada.';
  return `${captura.shiny ? '✨ ' : ''}**${captura.name_pt}** · #${String(captura.pokemon_id).padStart(4, '0')} · <t:${Math.floor(captura.caught_at / 1000)}:R>`;
}

function perfilEmbed(alvo, guildId) {
  const perfil = pokemon.obterPerfil(alvo.id, guildId);
  const favoritos = perfil.favorites.length
    ? perfil.favorites.slice(0, 5).map((item) => item.name_pt).join(', ')
    : 'Nenhum neste servidor';
  const bola = perfil.equippedBall
    ? `${perfil.equippedBall.emoji} ${perfil.equippedBall.nome}`
    : '🔴 Pokébola comum';
  const moldura = perfil.equippedCosmetic?.nome || 'Nenhuma';
  const incenso = perfil.incenseUntil > Date.now()
    ? `Ativo até <t:${Math.floor(perfil.incenseUntil / 1000)}:R>`
    : 'Inativo';
  const insignias = pokemonBattle.listarInsignias(alvo.id);
  const obtidas = insignias.filter((item) => item.obtida);
  return embed(
    `Perfil Pokémon · ${alvo.globalName || alvo.username || 'Treinador'}`,
    `<@${alvo.id}> · treinador da Mila`,
    THEME.corBubblegum,
    null,
    'Mila Pokémon · perfil do treinador',
    alvo.displayAvatarURL?.({ size: 256 }),
    [
      {
        name: '🌎 Coleção global',
        value: `**${perfil.global.total}** capturas · **${perfil.global.species}** espécies · **${perfil.global.shinies}** brilhantes\nRanking global: **${perfil.globalPosition ? `#${perfil.globalPosition}` : 'sem classificação'}**`,
      },
      {
        name: '🏠 Neste servidor',
        value: `**${perfil.servidor.total}** capturas · **${perfil.servidor.species}** espécies · **${perfil.servidor.shinies}** brilhantes\nRanking do servidor: **${perfil.guildPosition ? `#${perfil.guildPosition}` : 'sem classificação'}**`,
      },
      ...(perfil.arceusExclusivo ? [{
        name: '🌟 Presente global exclusivo',
        value: 'Arceus faz parte da sua coleção global e está disponível no seu perfil em todos os servidores da Mila. Capturado com uma Master Ball.',
      }] : []),
      { name: '🕰️ Captura mais recente', value: formatarUltimaCaptura(perfil.latestGlobal), inline: true },
      { name: '🧺 Equipamento e mochila', value: `${bola} · moldura: ${moldura}\nItens: **${perfil.inventoryCount}** · Incenso: ${incenso}`, inline: true },
      { name: '⭐ Favoritos deste servidor', value: favoritos },
      {
        name: '🏅 Insígnias',
        value: obtidas.length
          ? `${obtidas.length}/${insignias.length} · ${obtidas.slice(0, 3).map((item) => item.nome).join(', ')}${obtidas.length > 3 ? ` e mais ${obtidas.length - 3}` : ''}`
          : `0/${insignias.length} · use \`/pokemon ginasio\` para começar`,
      },
    ]
  );
}

function paginasPerfil(alvo, aba) {
  if (aba === 'colecao') {
    const colecao = pokemon.listarColecao(alvo.id, 1);
    return Math.max(1, Math.ceil(colecao.total / PERFIL_COLECAO_POR_PAGINA));
  }
  if (aba === 'mochila') {
    return Math.max(1, Math.ceil(pokemon.obterInventario(alvo.id).itens.length / PERFIL_MOCHILA_POR_PAGINA));
  }
  if (aba === 'insignias') {
    return Math.max(1, Math.ceil(pokemonBattle.GYMS.length / 4));
  }
  return 1;
}

function perfilStatusEmbed(alvo, guildId) {
  const perfil = pokemon.obterPerfil(alvo.id, guildId);
  const inventario = pokemon.obterInventario(alvo.id);
  const preferencias = inventario.preferencias;
  const insignias = pokemonBattle.listarInsignias(alvo.id);
  const obtidas = insignias.filter((item) => item.obtida);
  const favoritos = perfil.favorites.length
    ? perfil.favorites.map((item) => item.name_pt).join(', ')
    : 'Nenhum favorito neste servidor';
  return embed(
    `Status Pokémon · ${alvo.globalName || alvo.username || 'Treinador'}`,
    'Resumo das preferências e atividades recentes do treinador.',
    THEME.corSecundario,
    null,
    'Mila Pokémon · status do treinador',
    alvo.displayAvatarURL?.({ size: 128 }),
    [
      { name: '🕰️ Captura recente', value: formatarUltimaCaptura(perfil.latestGlobal) },
      { name: '✨ Incenso', value: perfil.incenseUntil > Date.now() ? `Ativo até <t:${Math.floor(perfil.incenseUntil / 1000)}:R>` : 'Inativo', inline: true },
      { name: '🏅 Insígnias', value: `${obtidas.length}/${insignias.length} conquistadas`, inline: true },
      { name: '⭐ Favoritos', value: favoritos },
      {
        name: '🔔 Alertas',
        value: `Pings pessoais: **${preferencias.pingEnabled ? 'ativados' : 'desativados'}**\nAvisos de favoritos: **${preferencias.favoriteAlerts ? 'ativados' : 'desativados'}**`,
      },
    ]
  );
}

function perfilMochilaEmbed(alvo, pagina) {
  const inventario = pokemon.obterInventario(alvo.id);
  const totalPaginas = Math.max(1, Math.ceil(inventario.itens.length / PERFIL_MOCHILA_POR_PAGINA));
  const paginaSegura = Math.max(0, Math.min(totalPaginas - 1, pagina));
  const itens = inventario.itens.slice(
    paginaSegura * PERFIL_MOCHILA_POR_PAGINA,
    (paginaSegura + 1) * PERFIL_MOCHILA_POR_PAGINA
  );
  const bola = pokemon.buscarItem(inventario.preferencias.equippedBall);
  const cosmetico = pokemon.buscarItem(inventario.preferencias.equippedCosmetic);
  const linhas = itens.length
    ? itens.map((item) => `${item.emoji} **${item.nome}** × ${item.quantidade}`).join('\n')
    : 'A mochila está vazia. Visite `/pokemon loja` para começar sua coleção de itens.';
  return embed(
    `Mochila · ${alvo.globalName || alvo.username || 'Treinador'}`,
    `Página ${paginaSegura + 1}/${totalPaginas} · ${inventario.itens.length} itens diferentes`,
    THEME.corDado,
    null,
    'Mila Pokémon · inventário',
    alvo.displayAvatarURL?.({ size: 128 }),
    [
      { name: '🎒 Itens', value: linhas },
      { name: '⚙️ Equipamento', value: `Pokébola: ${bola ? `${bola.emoji} ${bola.nome}` : '🔴 Pokébola comum'}\nCosmético: ${cosmetico ? `${cosmetico.emoji} ${cosmetico.nome}` : 'Nenhum'}` },
      { name: '🧭 Atalhos', value: '`/pokemon loja` · `/pokemon usar` · `/pokemon equipar`' },
    ]
  );
}

function perfilColecaoEmbed(alvo, pagina, guildId = null, proprio = false) {
  const total = pokemon.listarColecao(alvo.id, 1, 0, guildId).total;
  const totalPaginas = Math.max(1, Math.ceil(total / PERFIL_COLECAO_POR_PAGINA));
  const paginaSegura = Math.max(0, Math.min(totalPaginas - 1, pagina));
  const dados = pokemon.listarColecao(
    alvo.id,
    PERFIL_COLECAO_POR_PAGINA,
    paginaSegura * PERFIL_COLECAO_POR_PAGINA,
    guildId
  );
  const scope = guildId ? 'deste servidor' : 'global';
  if (!dados.pokemon.length) {
    return [embed(
      `Coleção ${scope} · ${alvo.globalName || alvo.username || 'Treinador'}`,
      'Ainda não há Pokémon nesta coleção. Capture um encontro para começar!',
      THEME.corBubblegum,
      null,
      'Mila Pokémon · coleção do treinador',
      alvo.displayAvatarURL?.({ size: 128 })
    )];
  }
  return dados.pokemon.slice(0, 1).map((item, index) => {
    const image = pokemon.spriteUrl(item.pokemon_id, Boolean(item.shiny), item.species_name);
    const species = pokemon.obterPokemonCacheSync(item.pokemon_id);
    const types = species?.types || [];
    const nature = pokemon.obterNatureza ? pokemon.obterNatureza(item.nature) : { nome: item.nature || 'Carinhoso' };
    const status = pokemon.calcularStatusPokemon(item, species);
    const fracas = typeChart.fraquezas(types);
    const fracasTxt = fracas.length ? fracas.map((f) => `${f.tipo} (x${f.mult})`).join(', ') : 'Nenhuma';
    let descricao = `Nv. ${item.level} · Captura **${index + 1 + paginaSegura * PERFIL_COLECAO_POR_PAGINA}/${dados.total}** · coleção ${scope}\nID da captura: \`${item.id}\``;
    const campos = [];
    if (proprio) {
      descricao += `\nNatureza: **${status.natureza}**`;
      campos.push({ name: 'Natureza', value: status.natureza, inline: true });
      campos.push({ name: 'HP', value: `${status.hp}`, inline: true });
      campos.push({ name: 'Ataque', value: `${status.ataque}`, inline: true });
      campos.push({ name: 'Defesa', value: `${status.defesa}`, inline: true });
      campos.push({ name: 'Velocidade', value: `${status.velocidade}`, inline: true });
      campos.push({ name: 'Fraquezas', value: fracasTxt, inline: false });
      if (types.length) campos.push({ name: 'Tipos', value: types.join(', '), inline: true });
    }
    return embed(
      `${item.shiny ? '✨ ' : ''}${item.name_pt} · #${String(item.pokemon_id).padStart(4, '0')}`,
      descricao,
      item.shiny ? 0xffd700 : THEME.corBubblegum,
      image,
      `Mila Pokémon · página ${paginaSegura + 1}/${totalPaginas} · ${dados.species} espécies`,
      null,
      campos
    );
  });
}

function paginasColecao(alvo, guildId = null) {
  const dados = pokemon.listarColecao(alvo.id, 1, 0, guildId);
  return Math.max(1, Math.ceil(dados.total / PERFIL_COLECAO_POR_PAGINA));
}

function botoesColecao(pagina, totalPaginas) {
  if (totalPaginas <= 1) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pokemon_colecao_anterior')
      .setLabel('Anterior')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagina === 0),
    new ButtonBuilder()
      .setCustomId('pokemon_colecao_proxima')
      .setLabel('Próximo')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagina >= totalPaginas - 1)
  )];
}

async function abrirColecao(ctx, alvo, guildId = null) {
  let paginaAtual = 0;
  const totalPaginas = paginasColecao(alvo, guildId);
  const payload = {
    embeds: perfilColecaoEmbed(alvo, paginaAtual, guildId, alvo.id === ctx.user.id),
    components: botoesColecao(paginaAtual, totalPaginas),
  };
  let mensagem = ctx.isSlash
    ? await ctx.interaction.reply({ ...payload, fetchReply: true })
    : await ctx.reply(payload);
  if (!mensagem?.createMessageComponentCollector && ctx.isSlash) {
    mensagem = await ctx.interaction.fetchReply();
  }
  const suportaReacoes = Boolean(mensagem?.createReactionCollector && typeof mensagem.react === 'function');
  if (!mensagem?.createMessageComponentCollector && !suportaReacoes) {
    if (totalPaginas === 1) return mensagem;
    throw new Error('Não foi possível iniciar a navegação da coleção Pokémon.');
  }
  if (mensagem.createMessageComponentCollector) {
    const coletor = mensagem.createMessageComponentCollector({ time: PERFIL_NAVEGACAO_MS });
    coletor.on('collect', async (componente) => {
      try {
        if (componente.user.id !== ctx.user.id) {
          await componente.reply({ content: 'Só quem abriu esta coleção pode navegar pelas páginas.', ephemeral: true });
          return;
        }
        const deslocamento = componente.customId === 'pokemon_colecao_anterior' ? -1 : 1;
        paginaAtual = Math.max(0, Math.min(totalPaginas - 1, paginaAtual + deslocamento));
        await componente.update({
          embeds: perfilColecaoEmbed(alvo, paginaAtual, guildId, alvo.id === ctx.user.id),
          components: botoesColecao(paginaAtual, totalPaginas),
        });
      } catch (erro) {
        console.error('[Pokémon] Falha ao navegar pela coleção:', erro?.message || erro);
        if (!componente.replied && !componente.deferred) {
          await componente.reply({ content: 'Não consegui abrir esta página da coleção. Tente novamente.', ephemeral: true });
        }
      }
    });
    coletor.on('end', async () => {
      try {
        await mensagem.edit({ components: [] });
      } catch (erro) {
        console.error('[Pokémon] Não consegui encerrar os controles da coleção:', erro?.message || erro);
      }
    });
  }
  if (totalPaginas > 1 && mensagem.createReactionCollector && typeof mensagem.react === 'function') {
    let reactionsReady = false;
    try {
      await mensagem.react('◀️');
      await mensagem.react('▶️');
      reactionsReady = true;
    } catch (erro) {
      console.error('[Pokémon] Não consegui adicionar reações à coleção; os botões continuam disponíveis:', erro?.message || erro);
    }
    if (reactionsReady) {
      const reactions = mensagem.createReactionCollector({
        time: PERFIL_NAVEGACAO_MS,
        filter: (reaction, user) =>
          user.id === ctx.user.id && !user.bot && ['◀️', '▶️'].includes(reaction.emoji.name),
      });
      reactions.on('collect', async (reaction, user) => {
        try {
          if (reaction.partial) await reaction.fetch();
          paginaAtual = Math.max(0, Math.min(
            totalPaginas - 1,
            paginaAtual + (reaction.emoji.name === '◀️' ? -1 : 1)
          ));
          await mensagem.edit({
            embeds: perfilColecaoEmbed(alvo, paginaAtual, guildId, alvo.id === ctx.user.id),
            components: botoesColecao(paginaAtual, totalPaginas),
          });
          await reaction.users.remove(user.id);
        } catch (erro) {
          console.error('[Pokémon] Falha ao navegar a coleção por reação:', erro?.message || erro);
        }
      });
      reactions.on('end', async () => {
        try {
          await mensagem.reactions.removeAll();
        } catch (erro) {
          console.error('[Pokémon] Não consegui remover as reações expiradas da coleção:', erro?.message || erro);
        }
      });
    }
  }
  return mensagem;
}

function montarBotoesPerfil(aba, pagina, totalPaginas) {
  const abas = [
    ['resumo', 'Perfil'],
    ['status', 'Status'],
    ['mochila', 'Mochila'],
    ['colecao', 'Coleção'],
    ['insignias', 'Insígnias'],
  ];
  const componentes = [new ActionRowBuilder().addComponents(abas.map(([id, label]) =>
    new ButtonBuilder()
      .setCustomId(`pokemon_perfil_aba_${id}`)
      .setLabel(label)
      .setStyle(aba === id ? ButtonStyle.Primary : ButtonStyle.Secondary)
  ))];
  if (totalPaginas > 1) {
    componentes.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pokemon_perfil_anterior')
        .setLabel('Anterior')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 0),
      new ButtonBuilder()
        .setCustomId('pokemon_perfil_proxima')
        .setLabel('Próximo')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina >= totalPaginas - 1)
    ));
  }
  return componentes;
}

function montarTelaPerfil(alvo, guildId, aba, pagina) {
  const totalPaginas = paginasPerfil(alvo, aba);
  const paginaSegura = Math.max(0, Math.min(totalPaginas - 1, pagina));
  const embeds = {
    resumo: perfilEmbed(alvo, guildId),
    status: perfilStatusEmbed(alvo, guildId),
    mochila: perfilMochilaEmbed(alvo, paginaSegura),
    colecao: perfilColecaoEmbed(alvo, paginaSegura, null, false),
    insignias: batalhas.montarEmbedInsignias(alvo, paginaSegura),
  };
  return {
    embeds: Array.isArray(embeds[aba]) ? embeds[aba] : [embeds[aba] || embeds.resumo],
    components: montarBotoesPerfil(embeds[aba] ? aba : 'resumo', paginaSegura, totalPaginas),
    allowedMentions: { parse: [] },
  };
}

async function abrirPerfil(ctx, alvo, guildId) {
  let abaAtual = 'resumo';
  let paginaAtual = 0;
  const payload = montarTelaPerfil(alvo, guildId, abaAtual, paginaAtual);
  let mensagem = ctx.isSlash
    ? await ctx.interaction.reply({ ...payload, fetchReply: true })
    : await ctx.reply(payload);
  if (!mensagem?.createMessageComponentCollector && ctx.isSlash) {
    mensagem = await ctx.interaction.fetchReply();
  }
  if (!mensagem?.createMessageComponentCollector) {
    throw new Error('Não foi possível iniciar os controles do perfil Pokémon.');
  }
  const coletor = mensagem.createMessageComponentCollector({ time: PERFIL_NAVEGACAO_MS });
  coletor.on('collect', async (componente) => {
    try {
      if (componente.user.id !== ctx.user.id) {
        await componente.reply({ content: 'Só quem abriu este perfil pode navegar pelos seus controles.', ephemeral: true });
        return;
      }
      if (componente.customId.startsWith('pokemon_perfil_aba_')) {
        abaAtual = componente.customId.slice('pokemon_perfil_aba_'.length);
        paginaAtual = 0;
      } else if (componente.customId === 'pokemon_perfil_anterior' || componente.customId === 'pokemon_perfil_proxima') {
        const totalPaginas = paginasPerfil(alvo, abaAtual);
        const deslocamento = componente.customId === 'pokemon_perfil_anterior' ? -1 : 1;
        paginaAtual = Math.max(0, Math.min(totalPaginas - 1, paginaAtual + deslocamento));
      } else {
        await componente.reply({ content: 'Este controle do perfil não é reconhecido.', ephemeral: true });
        return;
      }
      await componente.update(montarTelaPerfil(alvo, guildId, abaAtual, paginaAtual));
    } catch (erro) {
      console.error('[Pokémon] Falha ao navegar pelo perfil:', erro?.message || erro);
      if (!componente.replied && !componente.deferred) {
        await componente.reply({ content: 'Não consegui abrir esta seção do perfil. Tente novamente.', ephemeral: true });
      }
    }
  });
  coletor.on('end', async () => {
    try {
      await mensagem.edit({ components: [] });
    } catch (erro) {
      console.error('[Pokémon] Não consegui encerrar os controles do perfil:', erro?.message || erro);
    }
  });
  return mensagem;
}

function rankingEmbed(lista, escopo) {
  const descricao = lista.length
    ? lista.map((entry, index) => `**${index + 1}.** <@${entry.user_id}> · **${entry.total}** capturas · ${entry.species} espécies`).join('\n')
    : 'Ainda não há capturas neste ranking. Participe de um encontro e seja a primeira pessoa no placar!';
  return embed(
    escopo === 'global' ? 'Ranking Pokémon · Global' : 'Ranking Pokémon · Servidor',
    descricao,
    THEME.corSecundario,
    null,
    escopo === 'global' ? 'Mila Pokémon · todos os servidores' : 'Mila Pokémon · capturas deste servidor'
  );
}

function saldoDisponivel(userId) {
  return criador.ehCriador(userId)
    ? criador.PONTOS_INFINITOS
    : Number(db.getUsuario(userId).acucares) || 0;
}

function itensDoCarrinho(carrinho) {
  return [...carrinho.entries()]
    .map(([id, quantidade]) => ({ item: pokemon.buscarItem(id), quantidade }))
    .filter((linha) => linha.item);
}

function itensDaCategoriaPokemon(categoria) {
  return pokemon.listarCategorias()
    .filter((grupo) => categoria === 'todas' || grupo.id === categoria)
    .flatMap((grupo) => grupo.itens);
}

function paginasLojaPokemon(categoria) {
  return Math.max(1, Math.ceil(itensDaCategoriaPokemon(categoria).length / ITENS_LOJA_POR_PAGINA));
}

function montarLojaEmbed({ user, categoria, pagina = 0, saldo, selecionado, carrinho, aviso }) {
  const itens = itensDaCategoriaPokemon(categoria);
  const totalPaginas = paginasLojaPokemon(categoria);
  const itensPagina = itens.slice(pagina * ITENS_LOJA_POR_PAGINA, (pagina + 1) * ITENS_LOJA_POR_PAGINA);
  const linhasCarrinho = itensDoCarrinho(carrinho);
  const total = linhasCarrinho.reduce((soma, linha) => soma + linha.item.preco * linha.quantidade, 0);
  const resumo = linhasCarrinho.length
    ? linhasCarrinho.map(({ item, quantidade }) =>
      `${item.emoji} **${item.nome}** × ${quantidade} · ${theme.formatarNumero(item.preco * quantidade)} 🍬`
    ).join('\n')
    : 'Seu carrinho está vazio. Escolha um item e adicione antes de finalizar.';
  const itemSelecionado = selecionado ? pokemon.buscarItem(selecionado) : null;
  const campos = [
    {
      name: `🛍️ Catálogo · página ${pagina + 1}/${totalPaginas}`,
      value: `Mostrando ${itensPagina.length} de ${itens.length} itens${categoria !== 'todas' ? ` em **${pokemon.CATEGORIAS.find((item) => item.id === categoria)?.nome || categoria}**` : ''}.`,
    },
    ...itensPagina.map((item) => ({
      name: `${item.emoji} ${item.nome}`,
      value: `${theme.formatarNumero(item.preco)} 🍬 · ${item.descricao}`,
    })),
  ];
  campos.push({ name: '🧺 Seu carrinho', value: resumo });

  return theme.janela({
    titulo: 'Loja Pokémon da Mila',
    descricao: [
      `Saldo disponível: **${theme.formatarNumero(saldo)} 🍬**`,
      itemSelecionado
        ? `Selecionado: ${itemSelecionado.emoji} **${itemSelecionado.nome}** · ${theme.formatarNumero(itemSelecionado.preco)} 🍬\n${itemSelecionado.descricao}`
        : totalPaginas > 1
          ? 'Escolha uma categoria e um item. Use **Anterior/Próximo** para navegar por todo o catálogo.'
          : 'Escolha um item, confira o carrinho e confirme somente quando estiver tudo certo.',
      `**Total do carrinho:** ${theme.formatarNumero(total)} 🍬`,
      aviso || '',
    ].filter(Boolean).join('\n\n'),
    cor: aviso ? THEME.corErro : THEME.corDado,
    thumbnail: user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Pokémon · compras seguras, com confirmação',
    campos,
  });
}

function montarLojaComponentes({ categoria, pagina = 0, selecionado, carrinho }) {
  const categoriaMenu = new StringSelectMenuBuilder()
    .setCustomId('pokemon_loja_categoria')
    .setPlaceholder('1 · Escolha uma categoria')
    .addOptions(CATEGORIAS_LOJA.map((item) => ({
      ...item,
      default: item.value === categoria,
    })));
  const itens = itensDaCategoriaPokemon(categoria);
  const totalPaginas = paginasLojaPokemon(categoria);
  const itensPagina = itens.slice(pagina * ITENS_LOJA_POR_PAGINA, (pagina + 1) * ITENS_LOJA_POR_PAGINA);
  const itemMenu = new StringSelectMenuBuilder()
    .setCustomId('pokemon_loja_item')
    .setPlaceholder('2 · Escolha um item')
    .addOptions(itensPagina.map((item) => ({
      label: item.nome.slice(0, 100),
      value: item.id,
      description: `${theme.formatarNumero(item.preco)} Açúcares · ${item.descricao}`.slice(0, 100),
      emoji: item.emoji,
      default: item.id === selecionado,
    })));
  const componentes = [
    new ActionRowBuilder().addComponents(categoriaMenu),
    new ActionRowBuilder().addComponents(itemMenu),
  ];
  if (totalPaginas > 1) {
    componentes.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pokemon_loja_pagina_anterior')
        .setLabel('Anterior')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 0),
      new ButtonBuilder()
        .setCustomId('pokemon_loja_pagina_proxima')
        .setLabel('Próximo')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina >= totalPaginas - 1)
    ));
  }
  componentes.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pokemon_loja_adicionar')
        .setLabel('Adicionar ao carrinho')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!selecionado),
      new ButtonBuilder()
        .setCustomId('pokemon_loja_limpar')
        .setLabel('Limpar carrinho')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(carrinho.size === 0)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pokemon_loja_finalizar')
        .setLabel('Finalizar compra')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(carrinho.size === 0),
      new ButtonBuilder()
        .setCustomId('pokemon_loja_fechar')
        .setLabel('Fechar loja')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Secondary)
    ),
  );
  return componentes;
}

async function abrirLojaPokemon(ctx) {
  const { user } = ctx;
  const estado = { categoria: 'todas', pagina: 0, selecionado: null, carrinho: new Map(), finalizando: false, comprada: false };
  const render = (aviso = '') => ({
    embeds: [montarLojaEmbed({
      user,
      saldo: saldoDisponivel(user.id),
      ...estado,
      aviso,
    })],
    components: montarLojaComponentes(estado),
  });
  const mensagem = ctx.isSlash
    ? await ctx.interaction.reply({ ...render(), ephemeral: true, fetchReply: true })
    : await ctx.reply(render());
  if (!mensagem?.createMessageComponentCollector) {
    throw new Error('Não foi possível iniciar os controles da loja Pokémon.');
  }
  const collector = mensagem.createMessageComponentCollector({
    time: TEMPO_SESSAO_MS,
    filter: (componente) => componente.user.id === user.id,
  });

  collector.on('collect', async (componente) => {
    try {
      if (estado.finalizando) {
        await componente.reply({ content: 'Sua compra já está sendo processada.', ephemeral: true });
        return;
      }
      if (componente.customId === 'pokemon_loja_categoria') {
        estado.categoria = componente.values[0];
        estado.pagina = 0;
        estado.selecionado = null;
        await componente.update(render());
        return;
      }
      if (componente.customId === 'pokemon_loja_pagina_anterior' || componente.customId === 'pokemon_loja_pagina_proxima') {
        const totalPaginas = paginasLojaPokemon(estado.categoria);
        const deslocamento = componente.customId === 'pokemon_loja_pagina_anterior' ? -1 : 1;
        estado.pagina = Math.max(0, Math.min(totalPaginas - 1, estado.pagina + deslocamento));
        estado.selecionado = null;
        await componente.update(render());
        return;
      }
      if (componente.customId === 'pokemon_loja_item') {
        const item = pokemon.buscarItem(componente.values[0]);
        if (!item || !itensDaCategoriaPokemon(estado.categoria)
          .slice(estado.pagina * ITENS_LOJA_POR_PAGINA, (estado.pagina + 1) * ITENS_LOJA_POR_PAGINA)
          .some((catalogoItem) => catalogoItem.id === item.id)) {
          await componente.update(render('Esse item não pertence à categoria selecionada. Escolha um item do catálogo.'));
          return;
        }
        estado.selecionado = item.id;
        await componente.update(render());
        return;
      }
      if (componente.customId === 'pokemon_loja_fechar') {
        collector.stop('fechada');
        await componente.update({
          embeds: [embed('Loja Pokémon fechada', 'Nenhuma compra foi feita. Volte quando quiser continuar sua aventura.', THEME.corSecundario)],
          components: [],
        });
        return;
      }
      if (componente.customId === 'pokemon_loja_limpar') {
        estado.carrinho.clear();
        await componente.update(render('Carrinho limpo. Suas escolhas foram removidas.'));
        return;
      }
      if (componente.customId === 'pokemon_loja_adicionar') {
        if (!estado.selecionado) {
          await componente.update(render('Selecione um item antes de adicioná-lo ao carrinho.'));
          return;
        }
        if (!estado.carrinho.has(estado.selecionado) && estado.carrinho.size >= 10) {
          await componente.update(render('O carrinho comporta até 10 itens diferentes. Finalize ou limpe o carrinho para continuar.'));
          return;
        }
        const quantidade = estado.carrinho.get(estado.selecionado) || 0;
        if (quantidade >= 99) {
          await componente.update(render('Limite de 99 unidades por item atingido nesta compra.'));
          return;
        }
        estado.carrinho.set(estado.selecionado, quantidade + 1);
        const item = pokemon.buscarItem(estado.selecionado);
        await componente.update(render(`${item.emoji} **${item.nome}** foi adicionado ao carrinho.`));
        return;
      }
      if (componente.customId === 'pokemon_loja_finalizar') {
        const itens = itensDoCarrinho(estado.carrinho);
        if (!itens.length) {
          await componente.update(render('Adicione ao menos um item antes de finalizar.'));
          return;
        }
        estado.finalizando = true;
        const compra = pokemon.comprarLote(user.id, itens.map(({ item, quantidade }) => ({
          itemId: item.id,
          quantidade,
        })));
        if (!compra.ok) {
          estado.finalizando = false;
          const aviso = compra.motivo === 'sem_saldo'
            ? `Saldo insuficiente: faltam **${theme.formatarNumero(compra.total - compra.saldo)} 🍬**. Você tem **${theme.formatarNumero(compra.saldo)} 🍬**.`
            : 'Não foi possível validar o carrinho. Confira os itens e tente novamente.';
          await componente.update(render(aviso));
          return;
        }
        estado.comprada = true;
        collector.stop('comprada');
        const recibo = compra.itens.map(({ item, quantidade }) =>
          `${item.emoji} **${item.nome}** × ${quantidade} · ${theme.formatarNumero(item.preco * quantidade)} 🍬`
        ).join('\n');
        await componente.update({
          embeds: [embed(
            'Pedido Pokémon confirmado!',
            `Sua compra foi adicionada à mochila.\n\n**Total:** ${theme.formatarNumero(compra.total)} 🍬\n**Saldo restante:** ${theme.formatarNumero(compra.saldo)} 🍬`,
            THEME.corSucesso,
            null,
            'Mila Pokémon · pedido concluído',
            user.displayAvatarURL?.({ size: 128 }),
            [{ name: '🧺 Itens', value: recibo }]
          )],
          components: [],
        });
      }
    } catch (erro) {
      if (componente.customId === 'pokemon_loja_finalizar' && !estado.comprada) estado.finalizando = false;
      console.error('[Pokémon] Falha ao processar a loja:', erro?.message || erro);
      if (!componente.replied && !componente.deferred) {
        await componente.reply({
          embeds: [embed('A loja teve um imprevisto', 'Não consegui concluir essa ação. Tente novamente ou use `/pokemon comprar`.', THEME.corErro)],
          ephemeral: true,
        });
      }
    }
  });

  collector.on('end', async (_coletadas, motivo) => {
    if (motivo === 'comprada' || motivo === 'fechada') return;
    try {
      await mensagem.edit({
        content: '⏳ A sessão da loja Pokémon expirou. Abra `/pokemon loja` para continuar.',
        components: [],
      });
    } catch (erro) {
      console.error('[Pokémon] Não consegui encerrar os controles da loja:', erro?.message || erro);
    }
  });
}

function montarMissoesEmbed(user, now, selecionada, aviso = '') {
  const missoes = pokemon.listarMissoes(user.id, now);
  const linhas = missoes.map((missao) => {
    const status = missao.resgatada
      ? '✅ Recompensa resgatada'
      : missao.concluida
        ? '🎁 Pronta para resgatar'
        : '🔒 Em andamento';
    const barra = theme.barra(missao.progresso, missao.meta, 8);
    return {
      name: `${missao.recompensaItem.emoji} ${missao.nome}`,
      value: `${missao.descricao}\n${barra} **${missao.progresso}/${missao.meta}** · ${status}\nRecompensa: **${missao.recompensaItem.nome}** · ${missao.periodo}`,
    };
  });
  const atual = missoes.find((missao) => missao.id === selecionada);
  return theme.janela({
    titulo: 'Missões Pokémon',
    descricao: [
      'Complete objetivos e resgate Pokébolas para sua mochila. O progresso é compartilhado entre servidores.',
      atual ? `Selecionada: **${atual.nome}** · recompensa **${atual.recompensaItem.nome}**.` : 'Selecione uma missão para resgatar a recompensa quando ela estiver pronta.',
      aviso || '',
    ].filter(Boolean).join('\n\n'),
    cor: aviso ? THEME.corErro : THEME.corLembrete,
    thumbnail: user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Pokémon · missão diária renova à meia-noite UTC',
    campos: linhas,
  });
}

function montarMissoesComponentes(userId, now, selecionada) {
  const missoes = pokemon.listarMissoes(userId, now);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('pokemon_missao_selecionar')
    .setPlaceholder('Escolha uma missão')
    .addOptions(missoes.map((missao) => ({
      label: missao.nome,
      value: missao.id,
      description: `${missao.progresso}/${missao.meta} · ${missao.recompensaItem.nome}`.slice(0, 100),
      emoji: missao.recompensaItem.emoji,
      default: missao.id === selecionada,
    })));
  const atual = missoes.find((missao) => missao.id === selecionada);
  return [
    new ActionRowBuilder().addComponents(menu),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pokemon_missao_resgatar')
        .setLabel('Resgatar recompensa')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!atual?.concluida || atual.resgatada),
      new ButtonBuilder()
        .setCustomId('pokemon_missao_fechar')
        .setLabel('Fechar')
        .setEmoji('✖️')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function abrirMissoes(ctx) {
  const { user } = ctx;
  const now = Date.now();
  const estado = { selecionada: pokemon.listarMissoes(user.id, now)[0]?.id || null };
  const render = (aviso = '') => ({
    embeds: [montarMissoesEmbed(user, Date.now(), estado.selecionada, aviso)],
    components: montarMissoesComponentes(user.id, Date.now(), estado.selecionada),
  });
  const mensagem = ctx.isSlash
    ? await ctx.interaction.reply({ ...render(), ephemeral: true, fetchReply: true })
    : await ctx.reply(render());
  if (!mensagem?.createMessageComponentCollector) {
    throw new Error('Não foi possível iniciar os controles das missões Pokémon.');
  }
  const collector = mensagem.createMessageComponentCollector({
    time: TEMPO_SESSAO_MS,
    filter: (componente) => componente.user.id === user.id,
  });
  collector.on('collect', async (componente) => {
    try {
      if (componente.customId === 'pokemon_missao_selecionar') {
        estado.selecionada = componente.values[0];
        await componente.update(render());
        return;
      }
      if (componente.customId === 'pokemon_missao_fechar') {
        collector.stop('fechada');
        await componente.update({
          embeds: [embed('Missões fechadas', 'Seu progresso está salvo. Volte quando quiser resgatar suas recompensas.', THEME.corSecundario)],
          components: [],
        });
        return;
      }
      if (componente.customId === 'pokemon_missao_resgatar') {
        const resultado = pokemon.reivindicarMissao(user.id, estado.selecionada);
        let aviso = resultado.ok
          ? `${resultado.recompensa.emoji} **${resultado.recompensa.nome}** adicionada à sua mochila!`
          : resultado.motivo === 'ja_resgatada'
            ? 'Essa recompensa já foi resgatada neste período.'
            : resultado.motivo === 'progresso_insuficiente'
              ? `Ainda faltam capturas para concluir **${resultado.missao.nome}**.`
              : 'Essa missão não está disponível.';
        if (resultado.ok && resultado.xpPokemon && resultado.xpPokemon.length) {
          aviso += `\\n\\n⬆️ XP Pokémon: ${resultado.xpPokemon.join(', ')}`;
        }
        await componente.update(render(aviso));
      }
    } catch (erro) {
      console.error('[Pokémon] Falha ao processar missão:', erro?.message || erro);
      if (!componente.replied && !componente.deferred) {
        await componente.reply({
          embeds: [embed('Não consegui atualizar a missão', 'Tente novamente em alguns instantes.', THEME.corErro)],
          ephemeral: true,
        });
      }
    }
  });
  collector.on('end', async (_coletadas, motivo) => {
    if (motivo === 'fechada') return;
    try {
      await mensagem.edit({
        content: '⏳ A sessão de missões expirou. Abra `/pokemon missoes` para continuar.',
        components: [],
      });
    } catch (erro) {
      console.error('[Pokémon] Não consegui encerrar os controles das missões:', erro?.message || erro);
    }
  });
}

function mensagemFalhaCaptura(resultado) {
  if (!resultado) return 'Não consegui concluir a captura.';
  const mensagens = {
    sem_encontro: 'Não há Pokémon esperando captura agora.',
    expirado: 'Esse encontro já acabou. Aguarde o próximo!',
    canal_errado: 'O encontro está acontecendo em outro canal.',
    nome_errado: 'Esse não é o Pokémon do encontro. Tente novamente!',
    escapou: resultado?.pokemon?.namePt
      ? `**${resultado?.pokemon?.namePt}** escapou! Sua chance era ${resultado?.chance ?? 0}%. A tentativa não consumiu sua Pokébola.`
      : 'O Pokémon escapou! A tentativa não consumiu sua Pokébola.',
    bola_indisponivel: 'Sua Pokébola equipada acabou. Tente outra vez com a Pokébola comum.',
    arceus_exclusivo: 'Arceus é um Pokémon exclusivo do perfil do criador e não aparece em encontros.',
  };
  return mensagens[resultado.motivo] || 'Não consegui concluir a captura.';
}

function descricaoConfig(config) {
  const canais = config.channels.length ? config.channels.map((id) => `<#${id}>`).join(', ') : 'todos os canais de texto';
  const rarityNames = { conservadora: 'conservadora', equilibrada: 'equilibrada', generosa: 'generosa' };
  const minutos = Math.round(config.cooldownMs / 60_000);
  const segundos = Math.round((config.cooldownMs % 60_000) / 1000);
  const intervaloStr = segundos > 0 ? `${minutos > 0 ? minutos + ' min ' : ''}${segundos} s` : (minutos > 0 ? minutos + ' min' : '0 min');
  return [
    `Ativo: **${config.enabled ? 'sim' : 'não'}**`,
    `Silenciado: **${config.muted ? 'sim' : 'não'}**`,
    `Chance: **${config.spawnChance}%** por mensagem`,
    `Intervalo mínimo: **${intervaloStr}**`,
    `Raridade: **${rarityNames[config.rarityMode] || 'equilibrada'}** · Shiny: **1 em ${config.shinyChance}**`,
    `Canais: ${canais}`,
  ].join('\n');
}

function exigeEquipe(ctx) {
  return isStaff(ctx.member);
}

// Resolve uma captura do usuário por ID do banco, posição na lista (1-based) ou nome.
function resolverCaptura(userId, identificador) {
  if (!identificador) return null;
  const colecao = pokemon.listarColecao(userId, 250).pokemon;
  if (!colecao.length) return null;

  const texto = String(identificador).trim();

  // 1) Tenta por ID exato do banco (número que bate com collection.id)
  const porId = colecao.find((item) => String(item.id) === texto);
  if (porId) return porId;

  // 2) Se for número puro, trata como posição 1-based na lista (recentes primeiro)
  if (/^\d+$/.test(texto)) {
    const posicao = Number(texto);
    if (posicao >= 1 && posicao <= colecao.length) {
      return colecao[posicao - 1];
    }
    return null;
  }

  // 3) Busca por nome (name_pt ou species_name), case insensitive, exato ou contém
  const lower = texto.toLowerCase();
  const porNome = colecao.find(
    (item) =>
      String(item.name_pt || '').toLowerCase() === lower ||
      String(item.species_name || '').toLowerCase() === lower
  );
  if (porNome) return porNome;

  const porNomeContido = colecao.find(
    (item) =>
      String(item.name_pt || '').toLowerCase().includes(lower) ||
      String(item.species_name || '').toLowerCase().includes(lower)
  );
  return porNomeContido || null;
}

async function executar(ctx) {
  const { action, user, guildId, channelId, client, options } = ctx;
  if (criador.ehCriador(user)) pokemon.garantirArceusDoCriador(user);
  switch (action) {
    case 'manual':
    case 'ajuda':
      return abrirManual(ctx);

    case 'capturar': {
      const resultado = pokemon.capturar(guildId, channelId, user.id, options.getString('pokemon') || '');
      if (!resultado.ok) return responder(ctx, { embeds: [embed('Tentativa de captura', mensagemFalhaCaptura(resultado), resultado.motivo === 'escapou' ? THEME.corSecundario : THEME.corErro, null, 'Mila Pokémon · encontro selvagem', user.displayAvatarURL?.({ size: 128 }))] }, true);
      return responder(ctx, { embeds: [cardCaptura(resultado, user)] });
    }

    case 'colecao': {
      const alvo = options.getUser('usuario') || user;
      return abrirColecao(ctx, alvo, options.getString('escopo') === 'servidor' ? guildId : null);
    }

    case 'perfil': {
      const alvo = options.getUser('usuario') || user;
      return abrirPerfil(ctx, alvo, guildId);
    }

    case 'favorito': {
      const actionName = options.getString('acao');
      const alvo = options.getString('pokemon');
      if (!alvo) return responderTexto(ctx, 'Pokémon não informado', 'Digite o nome ou número que aparece na Pokédex.', THEME.corErro);
      if (ctx.isSlash) await ctx.interaction.deferReply({ ephemeral: true });
      const species = await pokemon.obterPokemon(alvo);
      if (!species) return responderTexto(ctx, 'Pokémon não encontrado', 'Confira o nome ou número na Pokédex e tente novamente.', THEME.corErro);
      const result = pokemon.alterarFavorito(guildId, user.id, actionName, species);
      if (!result.ok) {
        return responderTexto(ctx, 'Favoritos', actionName === 'adicionar' ? 'Esse Pokémon já está nos seus favoritos.' : 'Esse Pokémon não estava nos seus favoritos.', THEME.corSecundario);
      }
      return responderTexto(ctx, 'Favoritos atualizados', actionName === 'adicionar' ? `⭐ **${species.namePt}** foi adicionado aos favoritos deste servidor.` : `⭐ **${species.namePt}** foi removido dos favoritos.`, THEME.corSucesso);
    }

    case 'favoritos': {
      const lista = pokemon.listarFavoritos(guildId, user.id);
      const descricao = lista.length
        ? lista.map((item) => `⭐ **${item.name_pt}** · #${String(item.pokemon_id).padStart(4, '0')}`).join('\n')
        : 'Você ainda não favoritou nenhum Pokémon neste servidor. Use `/pokemon favorito` para adicionar.';
      return responder(ctx, { embeds: [embed('Seus favoritos', descricao, THEME.corSecundario, null, 'Mila Pokémon · favoritos do servidor', user.displayAvatarURL?.({ size: 128 }))] }, true);
    }

    case 'avisos': {
      const ping = options.getBoolean('ping');
      const favorites = options.getBoolean('favoritos');
      const patch = {};
      if (ping !== null) patch.pingEnabled = ping;
      if (favorites !== null) patch.favoriteAlerts = favorites;
      const prefs = Object.keys(patch).length ? pokemon.salvarPreferencias(user.id, patch) : pokemon.obterPreferencias(user.id);
      return responder(ctx, {
        embeds: [embed(
          'Preferências de alertas',
          `Pings pessoais: **${prefs.pingEnabled ? 'ativados' : 'desativados'}**\nAlertas de favoritos: **${prefs.favoriteAlerts ? 'ativados' : 'desativados'}**\n\nOs pings começam desligados; você pode mudar isso a qualquer momento.`,
          THEME.corLembrete,
          null,
          'Mila Pokémon · sua privacidade primeiro',
          user.displayAvatarURL?.({ size: 128 }),
          [{ name: 'Como funciona', value: 'Você só é mencionada para espécies favoritas quando ativa os dois controles.' }]
        )],
      }, true);
    }

  case 'upar':
  case 'evoluir': {
      const collectionId = options.getInteger('captura');
      const requestedDestination = options.getString('destino');
      const owned = pokemon.listarColecao(user.id, 250).pokemon.find((item) => item.id === collectionId);
      if (!owned) return responderTexto(ctx, 'Captura não encontrada', 'Confira o ID da captura na sua coleção global e tente novamente.', THEME.corErro);
      const evolutions = pokemon.listarEvolucoes(owned.pokemon_id);
      const destination = evolutions.find((item) =>
        String(item.destino) === String(requestedDestination) ||
        pokemon.normalizarNome(item.nome) === pokemon.normalizarNome(requestedDestination)
      );
      if (!destination) {
        const species = pokemon.obterPokemonCacheSync(owned.pokemon_id);
        const namePt = owned.name_pt || species?.namePt || 'Desconhecido';
        const evolucaoTxt = evolutions.length
          ? evolutions.map((e) => `➡️ **${e.nome}** \`(ID ${e.destino})\` · precisa de ${e.item?.emoji || '🍬'} **${e.item?.nome || 'item'}**`).join('\n')
          : 'Esta espécie ainda não possui evolução implementada.';
        const instrucoes = `Para evoluir **${namePt}** (captura \`${collectionId}\`), use:\n\n` +
          (evolutions.length
            ? `\`/pokemon upar ${collectionId} <nome_da_evolucao>\`\nEx.: \`/pokemon upar ${collectionId} Raichu\`\n\nOu pelo ID do destino: \`/pokemon upar ${collectionId} ${evolutions[0].destino}\``
            : 'Não há evolução disponível para esta espécie.');
        return responder(ctx, {
          embeds: [embed(
            'Como evoluir este Pokémon?',
            `**${namePt}** · Captura \`${collectionId}\` · Nível ${owned.level} · ID da espécie \`${owned.pokemon_id}\`\n\n${evolucaoTxt}\n\n${instrucoes}`,
            THEME.corPrincipal,
            pokemon.spriteUrl(owned.pokemon_id, Boolean(owned.shiny), owned.species_name),
            'Mila Pokémon · evolução · guia rápido',
            null,
            [
              { name: 'Evoluções possíveis', value: evolucaoTxt || 'Nenhuma.', inline: false },
              { name: 'Como fazer', value: instrucoes, inline: false },
            ]
          )],
        }, true);
      }
      const result = pokemon.evoluirPokemon(user.id, collectionId, destination.destino);
      if (!result.ok) {
        let message = '';
        if (result.motivo === 'sem_item') message = `Você precisa de ${result.item?.emoji || '🍬'} **${result.item?.nome || 'o item de evolução'}** para evoluir. Confira seu inventário com \`/pokemon inventario\`. Verifique também se o item está equipado corretamente.`;
        else if (result.motivo === 'pokemon_nao_encontrado') message = 'Essa captura não existe na sua coleção. Confira o ID da captura com \`/pokemon colecao\` e tente novamente.';
        else if (result.motivo === 'evolucao_indisponivel') message = 'Esta espécie ainda não possui uma evolução implementada neste jogo, ou o destino informado está incorreto. Use o ID correto da evolução.';
        else if (result.motivo === 'pokemon_invalido') message = 'O ID da captura é inválido. Digite um número inteiro positivo.';
        else message = 'Não foi possível evoluir esta captura. Motivo: **' + (result.motivo || 'desconhecido') + '**. Verifique se você tem o item necessário, se o ID está correto e se a evolução existe.';
        return responderTexto(ctx, 'Evolução não concluída', message, THEME.corErro);
      }
      return responder(ctx, {
        embeds: [embed(
          'Uma evolução aconteceu!',
          `${result.shiny ? '✨ ' : ''}Sua captura evoluiu para **${result.pokemon.nome}**!\n\nItem consumido: ${result.item.emoji} **${result.item.nome}** · ID da captura: \`${collectionId}\``,
          result.shiny ? 0xffd700 : THEME.corSucesso,
          pokemon.spriteUrl(result.pokemon.destino, result.shiny),
          'Mila Pokémon · evolução',
          user.displayAvatarURL?.({ size: 128 })
        )],
      }, true);
    }

    case 'loja':
      return abrirLojaPokemon(ctx);

    case 'missoes':
      return abrirMissoes(ctx);

    case 'comprar': {
      const itemId = options.getString('item');
      const resultado = pokemon.comprar(user.id, itemId);
      if (!resultado.ok) {
        const descricao = resultado.motivo === 'sem_saldo'
          ? `Você tem **${resultado.saldo} 🍬**, mas **${resultado.item.nome}** custa **${resultado.item.preco} 🍬**.`
          : 'Esse item não está disponível. Abra `/pokemon loja` para conferir o catálogo.';
        return responder(ctx, { embeds: [embed('Compra não concluída', descricao, THEME.corErro, null, 'Mila Pokémon · loja', user.displayAvatarURL?.({ size: 128 }))] }, true);
      }
      return responder(ctx, { embeds: [embed(
        'Compra concluída!',
        `${resultado.item.emoji} **${resultado.item.nome}** foi adicionado ao inventário.\nSaldo: **${theme.formatarNumero(resultado.saldo)} 🍬**`,
        THEME.corSucesso,
        null,
        'Mila Pokémon · obrigada pela compra ♡',
        user.displayAvatarURL?.({ size: 128 }),
        [{ name: 'Item', value: resultado.item.descricao }, { name: 'Preço', value: `${theme.formatarNumero(resultado.item.preco)} 🍬`, inline: true }]
      )] }, true);
    }

    case 'inventario': {
      const inventario = pokemon.obterInventario(user.id);
      const linhas = inventario.itens.map((item) => `${item.emoji} **${item.nome}** × ${item.quantidade}`);
      const ball = pokemon.buscarItem(inventario.preferencias.equippedBall);
      const cosmetic = pokemon.buscarItem(inventario.preferencias.equippedCosmetic);
      const incense = Math.max(0, inventario.preferencias.incenseUntil - Date.now());
      const descricao = linhas.length ? linhas.join('\n') : 'Sua mochila está vazia.';
      const campos = [
        { name: 'Pokébola equipada', value: `${ball?.emoji || '🔴'} ${ball?.nome || 'Pokébola comum'}`, inline: true },
        { name: 'Moldura equipada', value: cosmetic?.nome || 'Nenhuma', inline: true },
        { name: 'Incenso', value: incense ? `Ativo por mais ${Math.ceil(incense / 60_000)} min` : 'Inativo', inline: true },
      ];
      return responder(ctx, { embeds: [embed('Inventário Pokémon', descricao, THEME.corLembrete, null, 'Mila Pokémon · sua mochila', user.displayAvatarURL?.({ size: 128 }), campos)] }, true);
    }

    case 'usar': {
      const itemId = options.getString('item');
      const resultado = pokemon.usarItem(user.id, itemId);
      if (!resultado.ok) {
        const mensagem = resultado.motivo === 'sem_item' ? 'Você não tem esse item no inventário.' : 'Esse item não pode ser usado agora.';
        return responderTexto(ctx, 'Item não utilizado', mensagem, THEME.corErro);
      }
      return responder(ctx, { embeds: [embed('Incenso ativado!', `🪻 Seus encontros ficam mais frequentes até <t:${Math.floor(resultado.expiresAt / 1000)}:R>.`, THEME.corSucesso, null, 'Mila Pokémon · aroma de aventura', user.displayAvatarURL?.({ size: 128 }))] }, true);
    }

    case 'equipar': {
      const resultado = pokemon.equiparItem(user.id, options.getString('item'));
      if (!resultado.ok) {
        const mensagem = resultado.motivo === 'sem_item' ? 'Você precisa ter esse item no inventário antes de equipá-lo.' : 'Esse item não pode ser equipado.';
        return responderTexto(ctx, 'Item não equipado', mensagem, THEME.corErro);
      }
      return responder(ctx, { embeds: [embed('Equipamento atualizado', `✨ Equipado: ${resultado.item?.emoji || '🔴'} **${resultado.item?.nome || 'Pokébola comum'}**.`, THEME.corSucesso, null, 'Mila Pokémon · pronto para a aventura', user.displayAvatarURL?.({ size: 128 }))] }, true);
    }

    case 'configurar': {
      if (!exigeEquipe(ctx)) return responderTexto(ctx, 'Acesso restrito', 'Somente a equipe pode configurar os encontros deste servidor.', THEME.corErro);
      const atual = pokemon.obterConfig(guildId);
      const patch = {};
      const ativo = options.getBoolean('ativo');
      const silenciar = options.getBoolean('silenciar');
      const chance = options.getInteger('chance');
      const intervalo = options.getInteger('intervalo');
      const intervaloSegundos = options.getInteger('intervalo_segundos');
      const preset = options.getString('preset');
      const raridade = options.getString('raridade');
      const shinyChance = options.getInteger('shiny_chance');
      if (options.configError) return responderTexto(ctx, 'Configuração inválida', options.configError, THEME.corErro);
      if (chance !== null && (!Number.isInteger(chance) || chance < 1 || chance > 100)) {
        return responderTexto(ctx, 'Chance inválida', 'Use um número inteiro de **1 a 100**.', THEME.corErro);
      }
      if (intervalo !== null && (!Number.isInteger(intervalo) || intervalo < 0 || intervalo > 1440 || (intervalo === 0 && (intervaloSegundos === null || intervaloSegundos <= 0)))) {
        return responderTexto(ctx, 'Intervalo inválido', 'Use 0 a 1440 minutos (ex.: `20`, `1min`, `1min 20sec`) ou apenas segundos com `intervalo_segundos`.', THEME.corErro);
      }
      if (intervaloSegundos !== null && (!Number.isInteger(intervaloSegundos) || intervaloSegundos < 0 || intervaloSegundos > 59)) {
        return responderTexto(ctx, 'Segundos inválidos', 'Use um número inteiro de **0 a 59 segundos**.', THEME.corErro);
      }
      if (raridade !== null && !['conservadora', 'equilibrada', 'generosa'].includes(raridade)) {
        return responderTexto(ctx, 'Raridade inválida', 'Escolha `conservadora`, `equilibrada` ou `generosa`.', THEME.corErro);
      }
      if (shinyChance !== null && (!Number.isInteger(shinyChance) || shinyChance < 1 || shinyChance > 100_000)) {
        return responderTexto(ctx, 'Chance shiny inválida', 'Use um denominador inteiro entre **1 e 100000**.', THEME.corErro);
      }
      if (preset !== null && !pokemon.PRESETS_CONFIG[preset]) {
        return responderTexto(ctx, 'Preset não encontrado', 'Use `padrao`, `tranquilo`, `aventura` ou `silencio`.', THEME.corErro);
      }
      if (ativo !== null) patch.enabled = ativo;
      if (silenciar !== null) patch.muted = silenciar;
      if (chance !== null) patch.spawnChance = chance;
      if (intervalo !== null || intervaloSegundos !== null) {
        const minutos = intervalo !== null ? intervalo : (intervaloSegundos !== null ? 0 : Math.floor((atual.cooldownMs || 60_000) / 60_000));
        const segundos = intervaloSegundos !== null ? intervaloSegundos : Math.floor(((atual.cooldownMs || 60_000) % 60_000) / 1000);
        patch.cooldownMs = (minutos * 60 + segundos) * 1000;
      }
      if (raridade !== null) patch.rarityMode = raridade;
      if (shinyChance !== null) patch.shinyChance = shinyChance;
      let config = atual;
      if (preset) config = pokemon.aplicarPreset(guildId, preset);
      if (Object.keys(patch).length) config = pokemon.salvarConfig(guildId, patch);
      return responder(ctx, { embeds: [embed('Configuração Pokémon', descricaoConfig(config), THEME.corMyspace, null, 'Mila Pokémon · painel da equipe')] }, true);
    }

    case 'canal': {
      if (!exigeEquipe(ctx)) return responderTexto(ctx, 'Acesso restrito', 'Somente a equipe pode configurar os canais de encontro.', THEME.corErro);
      const actionName = options.getString('acao') || 'listar';
      const channel = options.getChannel('canal');
      if (actionName !== 'listar' && !channel) {
        return responderTexto(
          ctx,
          'Escolha um canal',
          'No slash, selecione um canal na opção `canal`. Por prefixo: `$pokemon canal adicionar` usa o canal atual, ou `$pokemon canal #canal` escolhe outro.',
          THEME.corErro
        );
      }
      const configAnterior = pokemon.obterConfig(guildId);
      const estavaPermitido = configAnterior.channels.includes(String(channel?.id));
      const channels = pokemon.atualizarCanal(guildId, actionName, channel?.id);
      const config = pokemon.obterConfig(guildId);
      const descricao = actionName === 'listar'
        ? channels.length ? `Encontros permitidos em:\n${channels.map((id) => `<#${id}>`).join('\n')}` : 'Sem restrições: encontros podem aparecer em qualquer canal de texto.'
        : actionName === 'adicionar'
          ? `${estavaPermitido ? 'Canal já estava permitido:' : 'Canal adicionado:'} <#${channel.id}>.\n\n${descricaoConfig(config)}`
          : `${estavaPermitido ? 'Canal removido:' : 'Canal já não estava na lista:'} <#${channel.id}>.\n\n${descricaoConfig(config)}`;
      return responder(ctx, { embeds: [embed('Canais de encontro', descricao, THEME.corMyspace, null, 'Mila Pokémon · canais permitidos')] }, true);
    }

    case 'info':
    case 'pokedex': {
      const alvo = options.getString('pokemon');
      if (ctx.isSlash) await ctx.interaction.deferReply({ ephemeral: true });
      const species = await pokemon.obterPokemon(alvo);
      if (!species) return responderTexto(ctx, 'Pokémon não encontrado', 'Não encontrei essa espécie na Pokédex. Confira o nome ou número e tente novamente.', THEME.corErro);
      const tipo = species.types.length ? species.types.join(' · ') : 'Não informado';
      return responder(ctx, {
        embeds: [embed(
          `${species.namePt} · #${String(species.id).padStart(4, '0')}`,
          `Espécie **${species.namePt}** registrada na Pokédex da Mila.`,
          THEME.corPrincipal,
          species.animatedUrl || species.imageUrl,
          'Mila Pokémon · Pokédex',
          user.displayAvatarURL?.({ size: 128 }),
          [
            { name: 'Nome internacional', value: `\`${species.name}\``, inline: true },
            { name: 'Taxa base de captura', value: `**${species.captureRate}/255**`, inline: true },
            { name: 'Tipos', value: tipo, inline: true },
          ]
        )],
      }, true);
    }

    case 'ranking': {
      const escopo = options.getString('escopo') === 'global' ? 'global' : 'servidor';
      const lista = escopo === 'global' ? pokemon.ranking() : pokemon.rankingServidor(guildId);
      return responder(ctx, { embeds: [rankingEmbed(lista, escopo)], allowedMentions: { parse: [] } });
    }

    case 'duelo':
      return batalhas.iniciarDuelo(ctx, options.getUser('usuario'), options.getInteger('tamanho') || 1);

    case 'ginasio':
      return batalhas.iniciarGinasio(ctx, options.getString('desafio'), options.getInteger('tamanho') || 3);

    case 'insignias':
      return batalhas.listarInsigniasCommand(ctx, options.getUser('usuario'));

    case 'admin':
      return responder(ctx, { embeds: [embedAdminPokemon()], allowedMentions: { parse: [] } }, true);

    default: {
      const comandos = ['manual','ajuda','capturar','colecao','perfil','favorito','loja','missoes','comprar','inventario','usar','equipar','configurar','canal','info','pokedex','upar','evoluir','ranking','duelo','ginasio','insignias'];
      const digitado = String(options.getSubcommand ? options.getSubcommand() : action || '').toLowerCase();
      const proximos = comandos.filter((c) => c.includes(digitado) || digitado.includes(c)).slice(0, 5);
      const sugestao = proximos.length ? `\n\n**Próximos:** ${proximos.map((c) => '`' + c + '`').join(' · ')}` : '';
      return responder(ctx, { embeds: [embed('Comando não entendido', `Não reconheci \`${digitado || 'isso'}\` como subcomando Pokemon. Use \`$pokemon manual\` para ver tudo, ou escolha: manual, ajuda, capturar, colecao, perfil, loja, inventario, comprar, usar, equipar, configurar, info, pokedex, ranking, duelo, ginasio.${sugestao}`, THEME.corErro, null, 'Mila Pokémon · subcomando não encontrado')], allowedMentions: { parse: [] } }, true);
    }
  }
}

function boolDoTexto(valor) {
  if (['on', 'ligar', 'sim', 'true', '1', 'ativar'].includes(String(valor).toLowerCase())) return true;
  if (['off', 'desligar', 'nao', 'não', 'false', '0', 'desativar'].includes(String(valor).toLowerCase())) return false;
  return null;
}

function resolverCanalPrefixo(texto, message) {
  const mention = message.mentions?.channels?.first?.();
  if (mention && (!texto || String(texto).includes(mention.id))) {
    return [0, 5].includes(mention.type) ? mention : null;
  }
  const alvo = String(texto || '').trim().replace(/^#/, '');
  if (!alvo) return message.channel || (message.channelId ? { id: message.channelId } : null);
  const id = alvo.match(/^<#?(\d+)>?$/)?.[1];
  const canais = message.guild?.channels?.cache;
  if (id) {
    const canal = canais?.get?.(id);
    return canal && [0, 5].includes(canal.type) ? canal : null;
  }
  const nome = alvo.toLocaleLowerCase();
  if (typeof canais?.find === 'function') {
    return canais.find((canal) => [0, 5].includes(canal.type) && canal.name?.toLocaleLowerCase() === nome) || null;
  }
  return Array.from(canais?.values?.() || []).find(
    (canal) => [0, 5].includes(canal.type) && canal.name?.toLocaleLowerCase() === nome
  ) || null;
}

function parseIntervaloTexto(texto) {
  const str = String(texto || '').toLowerCase();
  let minutos = 0, segundos = 0;
  const m = str.match(/(\d+)\s*(min|m|minuto|minutos)/i);
  const s = str.match(/(\d+)\s*(sec|s|seg|segundos)/i);
  if (m) minutos = parseInt(m[1], 10);
  if (s) segundos = parseInt(s[1], 10);
  // Se não há sufixo de segundos, e há apenas um número, é minutos
  const apenasNumero = str.trim().match(/^\d+$/);
  if (apenasNumero && !m && !s) minutos = parseInt(apenasNumero[0], 10);
  return { minutos: Math.max(0, minutos), segundos: Math.max(0, segundos) };
}

function embedAdminPokemon() {
  const tema = require('../utils/economyTheme').temaDe({ guildId: null });
  return theme.janela({
    tema,
    titulo: '⚙️ Painel de Admin Pokémon',
    descricao: 'Comandos de equipe para gerenciar encontros, coleções, itens e resets deste servidor.\n\n' +
      '• `configurar` — Ajusta chance, intervalo (ex.: `1min 20sec`), raridade, shiny_chance, ativo, silenciar, preset\n' +
      '• `canal` — Lista / adiciona / remove canais (`adicionar #canal`)\n' +
      '• `manual` / `ajuda` — Manual completo\n' +
      '• `ranking` — Ranking global ou deste servidor\n' +
      '• `ginasio` / `duelo` / `insignias` — Ginásio, duelo e insígnias\n\n' +
      'Resets disponíveis:\n' +
      '• `/reset-economia` — Zera economia e mochila de loja (não afeta Pokémon)\n' +
      '• `/reset-pokemon` — Seleção interativa: coleções, itens Pokémon, preferências, economia (opcional)',
    cor: THEME.corPrincipal,
    thumbnail: null,
    autorNome: `${tema.icone} Mila • Equipe`,
    autorIcone: null,
    campos: [
      { name: 'Configurar encontros', value: '`ativo` · `silenciar` · `chance` · `intervalo` · `intervalo_segundos` · `raridade` · `shiny_chance` · `preset`', inline: false },
      { name: 'Reset selecionável', value: '`/reset-pokemon` (botões para escolher o que resetar) · `/reset-economia` (apenas loja/saldo)', inline: false },
    ],
    rodape: 'Mila Pokémon · equipe · admin interativo',
  });
}

function opcoesPrefixo(action, args, message) {
  const valores = {};
  const texto = args.join(' ').trim();
  if (action === 'configurar') {
    const raw = args.join(' ').trim();
    // Se contém min/sec ou apenas números, tentar interpretar intervalo
    if (raw.match(/(min|sec|m|s|\d+\s*min)/i) || /^\d+$/.test(raw)) {
      const parsed = parseIntervaloTexto(raw);
      if (parsed.minutos > 0 || parsed.segundos > 0) {
        valores.intervalo = parsed.minutos || null;
        valores.intervalo_segundos = parsed.segundos || null;
      }
    }
  }
  if (action === 'capturar' || action === 'info' || action === 'pokedex') valores.pokemon = texto || null;
  if (action === 'colecao') {
    const scope = String(args[0] || '').toLowerCase();
    valores.escopo = scope === 'servidor' ? 'servidor' : 'global';
    valores.usuario = message.mentions?.users?.first?.() || null;
  }
  if (action === 'perfil') valores.usuario = message.mentions?.users?.first?.() || null;
  if (action === 'evoluir') {
    valores.captura = Number(args[0]) || null;
    valores.destino = args.slice(1).join(' ').trim() || null;
  }
  if (action === 'upar') {
    valores.captura = Number(args[0]) || null;
  }
  if (action === 'duelo') {
    valores.usuario = message.mentions?.users?.first?.() || null;
    const tamanho = args.find((item) => /^\d+$/.test(item));
    valores.tamanho = tamanho ? Number(tamanho) : 1;
  }
  if (action === 'ginasio') {
    const nome = pokemon.normalizarNome(args.find((item) => !/^\d+$/.test(item)) || '');
    const ginasio = pokemonBattle.GYMS.find((item) =>
      item.id === nome.replace(/\s+/g, '-') ||
      pokemon.normalizarNome(item.nome) === nome
    );
    valores.desafio = ginasio?.id || args.find((item) => !/^\d+$/.test(item)) || null;
    const tamanho = args.find((item) => /^\d+$/.test(item));
    valores.tamanho = tamanho ? Number(tamanho) : 3;
  }
  if (action === 'insignias') valores.usuario = message.mentions?.users?.first?.() || null;
  if (action === 'ranking') valores.escopo = String(args[0] || '').toLocaleLowerCase() === 'global' ? 'global' : 'servidor';
  if (action === 'favorito') {
    valores.acao = args[0] === 'remover' || args[0] === 'tirar' ? 'remover' : 'adicionar';
    valores.pokemon = args.slice(1).join(' ').trim() || null;
  }
  if (action === 'avisos') {
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = args[i].toLowerCase();
      const value = boolDoTexto(args[i + 1]);
      if (key === 'ping' && value !== null) valores.ping = value;
      if (['favorito', 'favoritos'].includes(key) && value !== null) valores.favoritos = value;
    }
  }
  if (action === 'comprar' || action === 'usar' || action === 'equipar') valores.item = texto || null;
  if (action === 'configurar') {
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].toLowerCase();
      const value = args[i + 1];
      if (value === undefined) {
        valores.configError = `Informe um valor para \`${key}\`.`;
        continue;
      }
      if (key === 'ativo') {
        valores.ativo = boolDoTexto(value);
        if (valores.ativo === null) valores.configError = 'Use `ativo on` ou `ativo off`.';
      }
      if (['silenciar', 'silencio'].includes(key)) {
        valores.silenciar = boolDoTexto(value);
        if (valores.silenciar === null) valores.configError = 'Use `silenciar on` ou `silenciar off`.';
      }
      if (key === 'chance') valores.chance = Number(value);
      if (['intervalo', 'cooldown'].includes(key)) {
        const parsed = parseIntervaloTexto(value);
        valores.intervalo = parsed.minutos || null;
        valores.intervalo_segundos = parsed.segundos || null;
      }
      if (['raridade', 'rarity'].includes(key)) valores.raridade = value.toLowerCase();
      if (['shiny', 'shiny_chance'].includes(key)) valores.shiny_chance = Number(value);
      if (key === 'preset') valores.preset = value.toLowerCase();
    }
  }
  if (action === 'canal') {
    const primeira = String(args[0] || '').toLocaleLowerCase();
    const acoes = {
      add: 'adicionar',
      adicionar: 'adicionar',
      lista: 'listar',
      list: 'listar',
      listar: 'listar',
      ver: 'listar',
      del: 'remover',
      remove: 'remover',
      remover: 'remover',
      tirar: 'remover',
    };
    const acaoExplicita = acoes[primeira];
    const alvo = acaoExplicita ? args.slice(1).join(' ').trim() : args.join(' ').trim();
    valores.acao = acaoExplicita || (alvo ? 'adicionar' : 'listar');
    const canal = resolverCanalPrefixo(alvo, message);
    valores.canal = canal?.id || null;
  }
  return valores;
}

async function executePrefix(message, args, client) {
  const aliases = {
    ajuda: 'ajuda',
    manual: 'manual',
    guia: 'manual',
    missoes: 'missoes',
    missões: 'missoes',
    missions: 'missoes',
    capture: 'capturar',
    capturar: 'capturar',
    captura: 'capturar',
    colecao: 'colecao',
    coleção: 'colecao',
    pokemons: 'colecao',
    meus: 'colecao',
    perfil: 'perfil',
    profile: 'perfil',
    dex: 'pokedex',
    pokedex: 'pokedex',
    info: 'pokedex',
    evoluir: 'evoluir',
    evo: 'evoluir',
    upar: 'upar',
    mochila: 'inventario',
    inv: 'inventario',
    itens: 'inventario',
    bolsa: 'inventario',
    adm: 'admin',
    fav: 'favoritos',
    canais: 'canal',
    config: 'configurar',
    status: 'configurar',
    rank: 'ranking',
    batalhar: 'duelo',
    batalha: 'duelo',
    batalhas: 'duelo',
    duel: 'duelo',
    ginásio: 'ginasio',
    gym: 'ginasio',
    badge: 'insignias',
    insígnia: 'insignias',
    insígnias: 'insignias',
  };
  const action = aliases[String(args[0] || '').toLowerCase()] || String(args[0] || 'ajuda').toLowerCase();
  const parsed = opcoesPrefixo(action, args.slice(1), message);
  const options = {
    getString: (name) => parsed[name] == null ? null : String(parsed[name]),
    getInteger: (name) => parsed[name] == null ? null : Number(parsed[name]),
    getBoolean: (name) => parsed[name] == null ? null : Boolean(parsed[name]),
    getUser: (name) => parsed[name] || null,
    getChannel: (name) => parsed[name] ? { id: parsed[name] } : null,
    configError: parsed.configError || null,
  };
  const interaction = {
    deferred: false,
    replied: false,
    reply: async (payload) => {
      interaction.replied = true;
      return message.reply(payload);
    },
    deferReply: async () => {
      interaction.deferred = true;
      return null;
    },
    editReply: (payload) => message.reply(payload),
  };
  return executar({
    action,
    user: message.author,
    guildId: message.guildId,
    channelId: message.channelId,
    member: message.member,
    client,
    options,
    interaction,
    isSlash: false,
    reply: (payload) => message.reply(payload),
  });
}

module.exports = {
  data,
  meta: { guildOnly: true },
  async execute(interaction, client) {
    return executar({
      action: interaction.options.getSubcommand(),
      user: interaction.user,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      member: interaction.member,
      client,
      options: interaction.options,
      interaction,
      isSlash: true,
    });
  },
  executePrefix,
  tratarComponente: batalhas.tratarComponente,
  internals: {
    embed,
    cardCaptura,
    helpEmbed,
    perfilEmbed,
    perfilStatusEmbed,
    perfilMochilaEmbed,
    perfilColecaoEmbed,
    paginasColecao,
    botoesColecao,
    montarBotoesPerfil,
    montarTelaPerfil,
    rankingEmbed,
    montarLojaEmbed,
    montarLojaComponentes,
    paginasLojaPokemon,
    ITENS_LOJA_POR_PAGINA,
    montarMissoesEmbed,
    montarMissoesComponentes,
    opcoesPrefixo,
    resolverCanalPrefixo,
    montarEmbedInsignias: batalhas.montarEmbedInsignias,
  },
};
