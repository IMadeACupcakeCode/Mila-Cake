const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const pokemon = require('../utils/pokemon');
const pokemonBattle = require('../utils/pokemonBattle');
const batalhas = require('../utils/pokemonBattleCommand');
const db = require('../utils/db');
const criador = require('../utils/criador');
const { isStaff } = require('../utils/perms');
const theme = require('../utils/economyTheme');
const { THEME } = require('../utils/theme');

const TEMPO_SESSAO_MS = 5 * 60 * 1000;
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
      options: [{ type: TIPO.user, name: 'usuario', description: 'Coleção de outra pessoa', required: false }],
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
        value: 'A equipe precisa ativar o sistema com `/pokemon configurar ativo:true`. Cada mensagem elegível pode gerar um encontro conforme a chance configurada; o intervalo mínimo vale para o servidor inteiro. Há apenas um encontro ativo por servidor, por até 10 minutos. Canais podem ser limitados pela equipe.',
      },
      {
        name: '🎯 2 · Como capturar',
        value: 'Quando aparecer um Pokémon, digite o nome em português ou o nome internacional no mesmo canal, ou use `/pokemon capturar`. Um palpite errado não encerra o encontro. Se ele escapar, a Pokébola não é consumida; em uma captura, a bola especial equipada é consumida.',
      },
      {
        name: '✨ 3 · Chance e raridades',
        value: 'A chance varia conforme a espécie. Great Ball e Ultra Ball melhoram a chance de captura; o Incenso aumenta por 30 minutos a chance de aparecer um encontro quando você conversa. Pokémon brilhantes são raros (1 em 4096) e têm destaque especial.',
      },
      {
        name: '📖 4 · Perfil, coleção e rankings',
        value: '`/pokemon perfil [usuario]` mostra capturas, espécies diferentes, brilhantes e posições nos rankings. `/pokemon colecao [usuario]` lista os Pokémon capturados. `/pokemon ranking` mostra este servidor; escolha `Global` para comparar treinadores de todos os servidores da Mila.',
      },
      {
        name: '🛍️ 5 · Loja e inventário',
        value: '`/pokemon loja` abre um catálogo privado com categorias, carrinho e confirmação. Há Pokébolas clássicas, estratégicas, Apricorn e raras, além de incenso e molduras. Use `/pokemon inventario`, `/pokemon usar` e `/pokemon equipar` para gerenciar seus itens.',
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
        value: '`/pokemon info` consulta uma espécie e `/pokemon manual` abre este guia. A equipe pode ajustar encontros em `/pokemon configurar` e `/pokemon canal`. Por prefixo: `$pokemon canal` lista; `$pokemon canal adicionar` usa o canal atual; `$pokemon canal #canal` escolhe outro.',
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
        value: '`/pokemon ginasio desafio` abre um desafio contra uma equipe controlada pela Mila; o tamanho padrão é 3 (de 2 a 6). Para conquistar a insígnia, vença e leve ao menos um Pokémon da lista específica do ginásio. `/pokemon insignias [usuario]` e o perfil mostram as conquistas. Convites e partidas em andamento são temporários e não sobrevivem à reinicialização do bot.',
      },
    ]
  );
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

function montarLojaEmbed({ user, categoria, saldo, selecionado, carrinho, aviso }) {
  const grupos = pokemon.listarCategorias()
    .filter((grupo) => categoria === 'todas' || grupo.id === categoria);
  const linhasCarrinho = itensDoCarrinho(carrinho);
  const total = linhasCarrinho.reduce((soma, linha) => soma + linha.item.preco * linha.quantidade, 0);
  const resumo = linhasCarrinho.length
    ? linhasCarrinho.map(({ item, quantidade }) =>
      `${item.emoji} **${item.nome}** × ${quantidade} · ${theme.formatarNumero(item.preco * quantidade)} 🍬`
    ).join('\n')
    : 'Seu carrinho está vazio. Escolha um item e adicione antes de finalizar.';
  const itemSelecionado = selecionado ? pokemon.buscarItem(selecionado) : null;
  const campos = grupos.map((grupo) => ({
    name: `${grupo.emoji} ${grupo.nome}`,
    value: grupo.itens.map((item) =>
      `${item.emoji} **${item.nome}** · ${theme.formatarNumero(item.preco)} 🍬\n${item.descricao}`
    ).join('\n\n'),
  }));
  campos.push({ name: '🧺 Seu carrinho', value: resumo });

  return theme.janela({
    titulo: 'Loja Pokémon da Mila',
    descricao: [
      `Saldo disponível: **${theme.formatarNumero(saldo)} 🍬**`,
      itemSelecionado
        ? `Selecionado: ${itemSelecionado.emoji} **${itemSelecionado.nome}** · ${theme.formatarNumero(itemSelecionado.preco)} 🍬\n${itemSelecionado.descricao}`
        : categoria === 'todas'
          ? 'Escolha uma categoria e um item. O seletor do Discord mostra até 25 opções; filtre por categoria para acessar o catálogo completo.'
          : 'Escolha um item. Confira o carrinho e confirme somente quando estiver tudo certo.',
      `**Total do carrinho:** ${theme.formatarNumero(total)} 🍬`,
      aviso || '',
    ].filter(Boolean).join('\n\n'),
    cor: aviso ? THEME.corErro : THEME.corDado,
    thumbnail: user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Pokémon · compras seguras, com confirmação',
    campos,
  });
}

function montarLojaComponentes({ categoria, selecionado, carrinho }) {
  const categoriaMenu = new StringSelectMenuBuilder()
    .setCustomId('pokemon_loja_categoria')
    .setPlaceholder('1 · Escolha uma categoria')
    .addOptions(CATEGORIAS_LOJA.map((item) => ({
      ...item,
      default: item.value === categoria,
    })));
  const grupos = pokemon.listarCategorias()
    .filter((grupo) => categoria === 'todas' || grupo.id === categoria);
  const itens = grupos.flatMap((grupo) => grupo.itens);
  const itemMenu = new StringSelectMenuBuilder()
    .setCustomId('pokemon_loja_item')
    .setPlaceholder('2 · Escolha um item')
    .addOptions(itens.slice(0, 25).map((item) => ({
      label: item.nome.slice(0, 100),
      value: item.id,
      description: `${theme.formatarNumero(item.preco)} Açúcares · ${item.descricao}`.slice(0, 100),
      emoji: item.emoji,
      default: item.id === selecionado,
    })));
  return [
    new ActionRowBuilder().addComponents(categoriaMenu),
    new ActionRowBuilder().addComponents(itemMenu),
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
  ];
}

async function abrirLojaPokemon(ctx) {
  const { user } = ctx;
  const estado = { categoria: 'todas', selecionado: null, carrinho: new Map(), finalizando: false, comprada: false };
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
        estado.selecionado = null;
        await componente.update(render());
        return;
      }
      if (componente.customId === 'pokemon_loja_item') {
        const item = pokemon.buscarItem(componente.values[0]);
        if (!item || (estado.categoria !== 'todas' && item.categoria !== estado.categoria)) {
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
        const aviso = resultado.ok
          ? `${resultado.recompensa.emoji} **${resultado.recompensa.nome}** adicionada à sua mochila!`
          : resultado.motivo === 'ja_resgatada'
            ? 'Essa recompensa já foi resgatada neste período.'
            : resultado.motivo === 'progresso_insuficiente'
              ? `Ainda faltam capturas para concluir **${resultado.missao.nome}**.`
              : 'Essa missão não está disponível.';
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
  const mensagens = {
    sem_encontro: 'Não há Pokémon esperando captura agora.',
    expirado: 'Esse encontro já acabou. Aguarde o próximo!',
    canal_errado: 'O encontro está acontecendo em outro canal.',
    nome_errado: 'Esse não é o Pokémon do encontro. Tente novamente!',
    escapou: `**${resultado.pokemon.namePt}** escapou! Sua chance era ${resultado.chance}%. A tentativa não consumiu sua Pokébola.`,
    bola_indisponivel: 'Sua Pokébola equipada acabou. Tente outra vez com a Pokébola comum.',
    arceus_exclusivo: 'Arceus é um Pokémon exclusivo do perfil do criador e não aparece em encontros.',
  };
  return mensagens[resultado.motivo] || 'Não consegui concluir a captura.';
}

function descricaoConfig(config) {
  const canais = config.channels.length ? config.channels.map((id) => `<#${id}>`).join(', ') : 'todos os canais de texto';
  return [
    `Ativo: **${config.enabled ? 'sim' : 'não'}**`,
    `Silenciado: **${config.muted ? 'sim' : 'não'}**`,
    `Chance: **${config.spawnChance}%** por mensagem`,
    `Intervalo mínimo: **${Math.round(config.cooldownMs / 60_000)} min**`,
    `Canais: ${canais}`,
  ].join('\n');
}

function exigeEquipe(ctx) {
  return isStaff(ctx.member);
}

async function executar(ctx) {
  const { action, user, guildId, channelId, client, options } = ctx;
  if (criador.ehCriador(user)) pokemon.garantirArceusDoCriador(user);
  switch (action) {
    case 'manual':
    case 'ajuda':
      return responder(ctx, { embeds: [helpEmbed()] }, true);

    case 'capturar': {
      const resultado = pokemon.capturar(guildId, channelId, user.id, options.getString('pokemon') || '');
      if (!resultado.ok) return responder(ctx, { embeds: [embed('Tentativa de captura', mensagemFalhaCaptura(resultado), resultado.motivo === 'escapou' ? THEME.corSecundario : THEME.corErro, null, 'Mila Pokémon · encontro selvagem', user.displayAvatarURL?.({ size: 128 }))] }, true);
      return responder(ctx, { embeds: [cardCaptura(resultado, user)] });
    }

    case 'colecao': {
      const alvo = options.getUser('usuario') || user;
      const dados = pokemon.listarColecao(alvo.id);
      const linhas = dados.pokemon.map((item) =>
        `${item.shiny ? '✨ ' : ''}**${item.name_pt}** · #${String(item.pokemon_id).padStart(4, '0')} · Nv. ${item.level}`
      );
      const descricao = linhas.length ? linhas.join('\n') : 'Ainda não há Pokémon nesta coleção. Capture um encontro para começar!';
      return responder(ctx, {
        embeds: [embed(
          `Coleção de ${alvo.username || alvo.globalName || 'treinador'}`,
          `${descricao}\n\n**Capturados:** ${dados.total} · **Espécies:** ${dados.species}`,
          THEME.corBubblegum,
          alvo.displayAvatarURL?.({ size: 256 })
        )],
      });
    }

    case 'perfil': {
      const alvo = options.getUser('usuario') || user;
      return responder(ctx, {
        embeds: [perfilEmbed(alvo, guildId)],
        allowedMentions: { parse: [] },
      });
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
      if (options.configError) return responderTexto(ctx, 'Configuração inválida', options.configError, THEME.corErro);
      if (chance !== null && (!Number.isInteger(chance) || chance < 1 || chance > 100)) {
        return responderTexto(ctx, 'Chance inválida', 'Use um número inteiro de **1 a 100**.', THEME.corErro);
      }
      if (intervalo !== null && (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 1440)) {
        return responderTexto(ctx, 'Intervalo inválido', 'Use um número inteiro de **1 a 1440 minutos**.', THEME.corErro);
      }
      if (ativo !== null) patch.enabled = ativo;
      if (silenciar !== null) patch.muted = silenciar;
      if (chance !== null) patch.spawnChance = chance;
      if (intervalo !== null) patch.cooldownMs = intervalo * 60_000;
      const config = Object.keys(patch).length ? pokemon.salvarConfig(guildId, patch) : atual;
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

    case 'info': {
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

    default:
      return responder(ctx, { embeds: [helpEmbed()] }, true);
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

function opcoesPrefixo(action, args, message) {
  const valores = {};
  const texto = args.join(' ').trim();
  if (action === 'capturar' || action === 'info') valores.pokemon = texto || null;
  if (action === 'colecao' || action === 'perfil') valores.usuario = message.mentions?.users?.first?.() || null;
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
      if (['intervalo', 'cooldown'].includes(key)) valores.intervalo = Number(value);
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
    colecao: 'colecao',
    coleção: 'colecao',
    perfil: 'perfil',
    profile: 'perfil',
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
    rankingEmbed,
    montarLojaEmbed,
    montarLojaComponentes,
    montarMissoesEmbed,
    montarMissoesComponentes,
    opcoesPrefixo,
    resolverCanalPrefixo,
    montarEmbedInsignias: batalhas.montarEmbedInsignias,
  },
};
