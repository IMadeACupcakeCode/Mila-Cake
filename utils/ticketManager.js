const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { criarEmbed, THEME } = require('./theme');
const path = require('path');
const { obterConfig, salvarConfig } = require('./ticketStore');

// Risco original: JSON.parse sem sanitização podia ser explorado via
// prototype pollution (__proto__, constructor, prototype) se o tópico
// do canal fosse manipulado com conteúdo malicioso.
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function safeJsonParse(str) {
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of Object.keys(parsed)) {
        if (DANGEROUS_KEYS.has(key)) {
          // Remove a chave perigosa antes de retornar
          delete parsed[key];
        }
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

// ── Cores Mila ──
const CORES = {
  DESTAQUE: 0xFF69B4,   // hot pink
  PRINCIPAL: 0xFF9FF3,  // bubblegum
  SECUNDARIO: 0x8B5CF6, // myspace purple
  SUCESSO: 0x39FF14,    // lime
  ALERTA: 0xFF0044,     // red CRT
  INFO: 0x00CED1,       // turquoise aqua
};

// ── Categorias do Ticket (apenas as solicitadas) ──
const CATEGORIAS = [
  { emoji: '⚠️', nome: 'Denúncias', valor: 'ticket_denuncias', cor: 0xFF0044 },
  { emoji: '🤝', nome: 'Parcerias', valor: 'ticket_parcerias', cor: 0x39FF14 },
  { emoji: '❓', nome: 'Outro', valor: 'ticket_outro', cor: 0x95A5A6 },
];

// Mapeamento das categorias fornecidas pelo usuário
const CATEGORIAS_POR_ID = {
  '1530639687675412570': 'ticket_denuncias',
  '1530642750830284891': 'ticket_parcerias',
  '1530643389484109905': 'ticket_outro',
};

const CATEGORIA_POR_VALOR = {};
for (const [catId, valor] of Object.entries(CATEGORIAS_POR_ID)) {
  CATEGORIA_POR_VALOR[valor] = catId;
}

// ── Botões do painel ──
function criarBotoesPainel() {
  const linhas = [];
  let linha = new ActionRowBuilder();
  let count = 0;

  for (const cat of CATEGORIAS) {
    const btn = new ButtonBuilder()
      .setCustomId(cat.valor)
      .setLabel(cat.nome)
      .setEmoji(cat.emoji)
      .setStyle(ButtonStyle.Secondary);

    linha.addComponents(btn);
    count++;

    if (count === 5) {
      linhas.push(linha);
      linha = new ActionRowBuilder();
      count = 0;
    }
  }

  if (count > 0) linhas.push(linha);
  return linhas;
}

// ── Embed principal do Painel ──
function criarEmbedPainel() {
  const imagemPath = path.join(__dirname, '..', 'imagens', 'Ticket.gif');

  const descricao = [
    '```',
    '╔══════════════════════════════╗',
    '║     ⋆｡°✩  MILA TICKETS ♡   ║',
    '╚══════════════════════════════╝',
    '```',
    '',
    'Oie, meu favorito~ ♡',
    'Precisa de ajuda? É só escolher',
    'uma categoria aqui embaixo. 💕',
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    '**Escolha uma das categorias abaixo**',
    'e nossa equipe vai te atender rapidinho!',
    '',
    '~ ⋆ ★ ⋆ ~',
  ].join('\n');

  const embed = criarEmbed({
    titulo: '🎫 Mila Tickets ♡',
    descricao,
    cor: CORES.DESTAQUE,
    rodape: 'Sempre cuidando de você, meu favorito~ ♡',
    image: 'attachment://Ticket.gif',
  });

  return { embed, arquivo: imagemPath };
}

// ── Embed de Ticket Aberto ──
function criarEmbedTicketAberto(usuario, categoria, contador) {
  const descricao = [
    '```',
    '╔══════════════════════════════╗',
    '║    SEU TICKET FOI ABERTO ♡   ║',
    '╚══════════════════════════════╝',
    '```',
    '',
    '```ini',
    `[ Ticket #${String(contador).padStart(4, '0')} ]`,
    '```',
    '',
    `👤 **Aberto por:** ${usuario}`,
    `🏷️ **Categoria:** ${categoria.emoji} ${categoria.nome}`,
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    'Seu chamado foi criado com sucesso! ✨',
    'Em breve nossa equipe vai te atender.',
    '',
    'Enquanto isso, descreva seu problema',
    'com todos os detalhes~ 💕',
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    '**Aguarde, logo logo vou cuidar de você~ ♡**',
  ].join('\n');

  const embed = criarEmbed({
    titulo: `🎫 Ticket Aberto — ${categoria.emoji} ${categoria.nome}`,
    descricao,
    cor: categoria.cor || CORES.PRINCIPAL,
    rodape: `Mila Bot • Ticket #${String(contador).padStart(4, '0')}`,
    image: 'attachment://Ticket.gif',
  });

  return embed;
}

// ── Embed de Ticket Reivindicado ──
function criarEmbedTicketReivindicado(usuario, categoria, contador, staffMember) {
  const descricao = [
    '```',
    '╔══════════════════════════════╗',
    '║   UM ATENDENTE ASSUMIU! ♡   ║',
    '╚══════════════════════════════╝',
    '```',
    '',
    '```ini',
    `[ Ticket #${String(contador).padStart(4, '0')} ]`,
    '```',
    '',
    `👤 **Aberto por:** ${usuario}`,
    `🏷️ **Categoria:** ${categoria.emoji} ${categoria.nome}`,
    `🎫 **Atendente:** ${staffMember}`,
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    'Já tenho alguém cuidando de você! ✨',
    '',
    'O staff acima **assumiu** seu ticket',
    'e vai te ajudar pessoalmente.',
  ].join('\n');

  const embed = criarEmbed({
    titulo: `🎫 Ticket Atendido — ${categoria.emoji} ${categoria.nome}`,
    descricao,
    cor: CORES.SUCESSO,
    rodape: `Mila Bot • Ticket #${String(contador).padStart(4, '0')} • Atendido`,
    image: 'attachment://Ticket.gif',
  });

  return embed;
}

// ── Embed de Ticket Fechado ──
function criarEmbedTicketFechado(ticketInfo) {
  const descricao = [
    '```',
    '╔══════════════════════════════╗',
    '║      TICKET FECHADO ♡       ║',
    '╚══════════════════════════════╝',
    '```',
    '',
    '```ini',
    `[ Ticket #${String(ticketInfo.contador).padStart(4, '0')} ]`,
    '```',
    '',
    `👤 **Aberto por:** ${ticketInfo.usuarioTag}`,
    `🏷️ **Categoria:** ${ticketInfo.categoriaEmoji} ${ticketInfo.categoriaNome}`,
    ticketInfo.staffTag ? `🎫 **Atendido por:** ${ticketInfo.staffTag}` : '',
    ticketInfo.fechadoPor ? `🔒 **Fechado por:** ${ticketInfo.fechadoPor}` : '',
    ticketInfo.motivo ? `📝 **Motivo:** ${ticketInfo.motivo}` : '',
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    'O ticket foi fechado. ♡',
    '',
    'Se precisar de algo, é só abrir outro!',
    'Tô sempre aqui, viu~ 💕',
  ].filter(Boolean).join('\n');

  const embed = criarEmbed({
    titulo: `🎫 Ticket Fechado — ${ticketInfo.categoriaEmoji} ${ticketInfo.categoriaNome}`,
    descricao,
    cor: CORES.ALERTA,
    rodape: `Mila Bot • Ticket #${String(ticketInfo.contador).padStart(4, '0')} • Fechado`,
    image: 'attachment://Ticket.gif',
  });

  return embed;
}

// ── Botões de ação do ticket ──
function criarBotoesTicket(reivindicado = false) {
  const row = new ActionRowBuilder();

  const btnFechar = new ButtonBuilder()
    .setCustomId('ticket_fechar')
    .setLabel('🔒 Fechar Ticket')
    .setStyle(ButtonStyle.Danger);

  const btnReivindicar = new ButtonBuilder()
    .setCustomId('ticket_reivindicar')
    .setLabel('🎫 Atender Ticket')
    .setStyle(ButtonStyle.Success)
    .setDisabled(reivindicado);

  const btnConvidar = new ButtonBuilder()
    .setCustomId('ticket_invite')
    .setLabel('📬 Convidar')
    .setStyle(ButtonStyle.Primary);

  const btnRemover = new ButtonBuilder()
    .setCustomId('ticket_remove')
    .setLabel('🚫 Remover')
    .setStyle(ButtonStyle.Danger);

  row.addComponents(btnFechar, btnReivindicar, btnConvidar, btnRemover);
  return row;
}

// ── Busca categoria pelo valor do customId ──
function buscarCategoria(valor) {
  return CATEGORIAS.find((c) => c.valor === valor);
}

// ── Resolve categoria específica para o ticket ──
function resolverCategoriaEId(ticketValor, cfg) {
  const categoria = buscarCategoria(ticketValor);
  if (!categoria) return null;

  const categoriaId = cfg.categoriasPorTipo?.[ticketValor] || CATEGORIA_POR_VALOR[ticketValor] || cfg.categoriaId;
  return { categoria, categoriaId };
}

// ── Cria o canal do ticket ──
async function criarTicket(interaction, client) {
  const guildId = interaction.guildId;
  const cfg = obterConfig(guildId);
  const ticketValor = interaction.customId;

  const resultado = resolverCategoriaEId(ticketValor, cfg);
  if (!resultado) {
    return interaction.reply({
      content: '❌ Categoria de ticket inválida.',
      ephemeral: true,
    });
  }

  const { categoria, categoriaId } = resultado;

  if (!categoriaId) {
    return interaction.reply({
      content: '❌ Esta categoria de tickets não foi configurada. Peça a um staff para configurar.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  cfg.contador = (cfg.contador || 0) + 1;
  salvarConfig(guildId, cfg);

  const contador = cfg.contador;
  const nomeCanal = `ticket-${String(contador).padStart(4, '0')}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const permissoes = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  // Adiciona cargos de staff
  const cargosStaff = cfg.cargosStaff?.length > 0 ? cfg.cargosStaff : [];
  for (const roleId of cargosStaff) {
    permissoes.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  try {
    const canal = await interaction.guild.channels.create({
      name: nomeCanal,
      type: ChannelType.GuildText,
      parent: categoriaId,
      permissionOverwrites: permissoes,
      topic: `Ticket #${String(contador).padStart(4, '0')} — ${categoria.nome} — Aberto por ${interaction.user.tag}`,
    });

    const embedTicket = criarEmbedTicketAberto(interaction.user, categoria, contador);
    const botoes = criarBotoesTicket(false);
    const msgTicket = await canal.send({
      content: `${cargosStaff.map((id) => `<@&${id}>`).join(' ')}`,
      embeds: [embedTicket],
      components: [botoes],
      allowedMentions: { parse: ['roles'] },
      files: [{
        attachment: path.join(__dirname, '..', 'imagens', 'Ticket.gif'),
        name: 'Ticket.gif',
      }],
    });

    const ticketInfo = {
      channelId: canal.id,
      messageId: msgTicket.id,
      userId: interaction.user.id,
      usuarioTag: interaction.user.tag,
      contador,
      categoriaValor: categoria.valor,
      categoriaNome: categoria.nome,
      categoriaEmoji: categoria.emoji,
      staffId: null,
      staffTag: null,
      abertoEm: Date.now(),
    };

    await canal.setTopic(JSON.stringify(ticketInfo));

    await interaction.editReply({
      content: `✅ **Ticket #${String(contador).padStart(4, '0')}** criado! Acesse: ${canal}`,
      ephemeral: true,
    });
  } catch (erro) {
    console.error('Erro ao criar ticket:', erro);
    await interaction.editReply({
      content: '❌ Ocorreu um erro ao criar o ticket. Verifique se tenho permissões para criar canais.',
      ephemeral: true,
    });
  }
}

// ── Reivindicar Ticket ──
async function reivindicarTicket(interaction, client) {
  const guildId = interaction.guildId;
  const cfg = obterConfig(guildId);
  const cargosStaff = cfg.cargosStaff?.length > 0 ? cfg.cargosStaff : [];

  const memberRoles = interaction.member.roles.cache.map((r) => r.id);
  const isStaff = memberRoles.some((r) => cargosStaff.includes(r)) ||
    interaction.member.permissions.has('Administrator') ||
    interaction.member.permissions.has('ManageGuild');

  if (!isStaff) {
    return interaction.reply({
      content: '❌ Apenas membros da **staff** podem atender tickets!',
      ephemeral: true,
    });
  }

  try {
    const mensagem = interaction.message;
    const embedAtual = mensagem.embeds[0];
    if (!embedAtual) return;

    const topic = interaction.channel.topic;
    let ticketInfo;
    try {
      ticketInfo = safeJsonParse(topic);
    } catch {
      return interaction.reply({ content: '❌ Erro ao ler informações do ticket.', ephemeral: true });
    }

    ticketInfo.staffId = interaction.user.id;
    ticketInfo.staffTag = interaction.user.tag;

    await interaction.channel.setTopic(JSON.stringify(ticketInfo));

    const categoria = buscarCategoria(ticketInfo.categoriaValor) || {
      emoji: ticketInfo.categoriaEmoji,
      nome: ticketInfo.categoriaNome,
      cor: CORES.PRINCIPAL,
    };

    const embedReivindicado = criarEmbedTicketReivindicado(
      ticketInfo.usuarioTag,
      categoria,
      ticketInfo.contador,
      interaction.user
    );

    const botoes = criarBotoesTicket(true);

    await mensagem.edit({
      embeds: [embedReivindicado],
      components: [botoes],
      files: [{
        attachment: path.join(__dirname, '..', 'imagens', 'Ticket.gif'),
        name: 'Ticket.gif',
      }],
    });

    await interaction.reply({
      content: `🎫 **${interaction.user}** está cuidando deste ticket!`,
      ephemeral: false,
    });
  } catch (erro) {
    console.error('Erro ao reivindicar ticket:', erro);
    await interaction.reply({
      content: '❌ Erro ao atender. Tente novamente.',
      ephemeral: true,
    });
  }
}

// ── Embed de Confirmação de Fechamento ──
function criarEmbedConfirmarFechamento(ticketInfo) {
  const descricao = [
    '```',
    '╔══════════════════════════════╗',
    '║   TEM CERTEZA DE QUERER     ║',
    '║      FECHAR? ♡              ║',
    '╚══════════════════════════════╝',
    '```',
    '',
    '```ini',
    `[ Ticket #${String(ticketInfo.contador).padStart(4, '0')} ]`,
    '```',
    '',
    `👤 **Aberto por:** ${ticketInfo.usuarioTag || 'Desconhecido'}`,
    `🏷️ **Categoria:** ${ticketInfo.categoriaEmoji || '❓'} ${ticketInfo.categoriaNome || 'Desconhecido'}`,
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    '⚠️ **Deseja realmente fechar este ticket?**',
    '',
    'Após confirmar, o canal será removido',
    'em alguns segundos.',
    '',
    'Você pode **adicionar um motivo**',
    'clicando no botão abaixo.',
  ].join('\n');

  return criarEmbed({
    titulo: '🔒 Confirmar Fechamento',
    descricao,
    cor: CORES.ALERTA,
    rodape: `Mila Bot • Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
  });
}

// ── Botões de confirmação ──
function criarBotoesConfirmarFechamento() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_fechar_confirmar')
      .setLabel('🔒 Sim, fechar')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_fechar_motivo')
      .setLabel('📝 Fechar com motivo')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_fechar_cancelar')
      .setLabel('✖️ Cancelar')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Fechar Ticket com confirmação ──
async function fecharTicket(interaction, client) {
  try {
    const topic = interaction.channel.topic;
    let ticketInfo;
    try {
      ticketInfo = safeJsonParse(topic);
    } catch {
      ticketInfo = { contador: 0, categoriaEmoji: '❓', categoriaNome: 'Desconhecido', usuarioTag: 'Desconhecido', staffTag: null };
    }

    // Risco original: qualquer usuário com acesso ao canal podia iniciar o
    // fechamento do ticket. Exige staff ou o próprio dono do ticket.
    const guildId = interaction.guildId;
    const cfg = obterConfig(guildId);
    const isOwner = ticketInfo && String(ticketInfo.userId) === String(interaction.user.id);
    if (!isTicketStaff(interaction.member, cfg) && !isOwner) {
      return interaction.reply({
        embeds: [
          criarEmbed({ titulo: 'Sem permissão', descricao: 'Apenas staff ou o dono do ticket pode fechar.', cor: THEME.corErro }),
        ],
        ephemeral: true,
      });
    }

    const embed = criarEmbedConfirmarFechamento(ticketInfo);
    await interaction.reply({
      embeds: [embed],
      components: [criarBotoesConfirmarFechamento()],
      ephemeral: true,
    });
  } catch (erro) {
    console.error('Erro ao abrir confirmação:', erro);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Erro ao processar.', ephemeral: true });
    }
  }
}

// ── Gera transcript do ticket ──
async function gerarTranscript(channel, ticketInfo) {
  try {
    const mensagens = await channel.messages.fetch({ limit: 100 });
    const msgs = Array.from(mensagens.values())
      .filter(m => !m.author.bot || m.author.id === channel.client.user.id)
      .reverse();

    const nomeArquivo = `transcript-ticket-${String(ticketInfo.contador || 0).padStart(4, '0')}-${Date.now()}.txt`;

    const cabecalho = [
      '╔══════════════════════════════════════════╗',
      '║     ⋆｡°✩ TRANSCRIPT DO TICKET ♡        ║',
      '╚══════════════════════════════════════════╝',
      '',
      `Ticket #${String(ticketInfo.contador || 0).padStart(4, '0')}`,
      `Aberto por: ${ticketInfo.usuarioTag || 'Desconhecido'}`,
      `Categoria: ${ticketInfo.categoriaEmoji || '❓'} ${ticketInfo.categoriaNome || 'Desconhecido'}`,
      ticketInfo.staffTag ? `Atendido por: ${ticketInfo.staffTag}` : '',
      ticketInfo.motivo ? `Motivo do fechamento: ${ticketInfo.motivo}` : '',
      `Fechado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      '════════════════════════════════════════════',
      '',
    ].filter(Boolean).join('\n');

    const corpo = msgs.map(m => {
      const data = m.createdAt.toLocaleString('pt-BR');
      const autor = m.author.tag;
      const conteudo = m.content || '(embed/sticker)';
      if (m.attachments.size > 0) {
        const anexos = m.attachments.map(a => `[Anexo: ${a.url}]`).join(' ');
        return `[${data}] ${autor}: ${conteudo} ${anexos}`;
      }
      return `[${data}] ${autor}: ${conteudo}`;
    }).join('\n');

    const rodape = [
      '',
      '════════════════════════════════════════════',
      '',
      `Total de mensagens: ${msgs.length}`,
      `Gerado por ⋆｡°✩ Mila Bot`,
      '♡ Fim do transcript ~',
    ].join('\n');

    const conteudo = cabecalho + '\n' + corpo + '\n' + rodape;

    const pastaT = path.join(__dirname, '..', 'data', 'transcripts');
    if (!require('fs').existsSync(pastaT)) {
      require('fs').mkdirSync(pastaT, { recursive: true });
    }

    const caminho = path.join(pastaT, nomeArquivo);
    require('fs').writeFileSync(caminho, conteudo, 'utf-8');

    return caminho;
  } catch (erro) {
    console.error('Erro ao gerar transcript:', erro);
    return null;
  }
}

// ── Executa o fechamento ──
async function executarFechamento(interaction, motivo = null) {
  try {
    // Usa deferReply() para ModalSubmit, deferUpdate() para Button
    if (interaction.isModalSubmit()) {
      await interaction.deferReply({ ephemeral: true });
    } else {
      await interaction.deferUpdate();
    }

    const topic = interaction.channel.topic;
    let ticketInfo;
    try {
      ticketInfo = safeJsonParse(topic);
    } catch {
      ticketInfo = { contador: 0, categoriaEmoji: '❓', categoriaNome: 'Desconhecido', usuarioTag: 'Desconhecido', staffTag: null };
    }

    // Risco original: any user who reached this handler could execute the
    // actual channel deletion. Double-check staff/owner before proceeding.
    const guildId = interaction.guildId;
    const cfg = obterConfig(guildId);
    const isOwner = ticketInfo && String(ticketInfo.userId) === String(interaction.user.id);
    if (!isTicketStaff(interaction.member, cfg) && !isOwner) {
      try {
        await interaction.editReply({
          content: '🚫 Sem permissão: apenas staff ou o dono do ticket pode fechar.',
          embeds: [],
          components: [],
        });
      } catch {}
      return;
    }

    ticketInfo.fechadoPor = interaction.user.tag;
    ticketInfo.motivo = motivo;

    await interaction.channel.setTopic(JSON.stringify(ticketInfo));

    // Gera o transcript antes de fechar
    const caminhoTranscript = await gerarTranscript(interaction.channel, ticketInfo);

    const embedFechado = criarEmbedTicketFechado(ticketInfo);

    const files = [{
      attachment: path.join(__dirname, '..', 'imagens', 'Ticket.gif'),
      name: 'Ticket.gif',
    }];

    // Anexa o transcript se foi gerado com sucesso
    if (caminhoTranscript) {
      files.push({
        attachment: caminhoTranscript,
        name: `transcript-${String(ticketInfo.contador || 0).padStart(4, '0')}.txt`,
      });
    }

    await interaction.channel.send({
      embeds: [embedFechado],
      files,
    });

    const msgFechamento = interaction.isModalSubmit()
      ? '🔒 **Fechando ticket**... O canal será removido em **10 segundos**.'
      : motivo
        ? `🔒 **Fechando ticket** — Motivo: \`${motivo}\`\nO canal será removido em **10 segundos**.`
        : '🔒 **Fechando ticket**... O canal será removido em **10 segundos**.';

    if (interaction.isModalSubmit()) {
      await interaction.editReply({ content: msgFechamento });
    } else {
      await interaction.editReply({
        content: msgFechamento,
        embeds: [],
        components: [],
      });
    }

    await interaction.channel.permissionOverwrites.edit(ticketInfo.userId, {
      ViewChannel: false,
    });

    setTimeout(async () => {
      try {
        await interaction.channel.delete('Ticket fechado.');
      } catch {}
    }, 10000);
  } catch (erro) {
    console.error('Erro ao fechar ticket:', erro);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Erro ao fechar.', ephemeral: true });
    }
  }
}

// ── Envia o painel ──
async function enviarPainel(message, client) {
  const guildId = message.guildId;
  const cfg = obterConfig(guildId);

  const { embed, arquivo } = criarEmbedPainel();
  const botoes = criarBotoesPainel();

  await message.channel.send({
    embeds: [embed],
    components: botoes,
    files: [{
      attachment: arquivo,
      name: 'Ticket.gif',
    }],
  });

  await message.reply({ content: '✅ **Painel de Tickets** enviado com sucesso!', ephemeral: true });
}

// ── Convidar Usuário ao Ticket ──
async function convidarUsuario(message, userId) {
  const ticketChannel = message.channel;

  if (ticketChannel.type !== ChannelType.GuildText) {
    return message.reply('❌ Este comando só pode ser usado em canais de texto.');
  }

  if (!ticketChannel.topic) {
    return message.reply('❌ Este canal não parece ser um ticket válido. Use o comando em um canal de ticket.');
  }

  let ticketInfo;
  try {
    ticketInfo = safeJsonParse(ticketChannel.topic) || {};
  } catch (error) {
    return message.reply('❌ Erro ao ler informações do ticket.');
  }

  if (!ticketInfo || (!ticketInfo.userId && !ticketInfo.contador)) {
    return message.reply('❌ Este canal não é um ticket válido.');
  }

  const cfgConvite = obterConfig(message.guildId);
  if (!isTicketStaff(message.member, cfgConvite) && String(ticketInfo.userId) !== String(message.author.id)) {
    return message.reply('❌ Apenas **staff** ou o **dono do ticket** podem convidar usuários.');
  }

  const user = await message.guild.members.fetch(userId).catch(() => null);
  if (!user) {
    return message.reply('❌ Usuário não encontrado no servidor.');
  }

  try {
    await ticketChannel.permissionOverwrites.create(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });
  } catch (err) {
    const existingOverwrite = ticketChannel.permissionOverwrites?.get(userId);
    if (existingOverwrite) {
      await existingOverwrite.edit({
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }
  }

  await message.reply(`✅ ${user} foi convidado para visualizar o ticket.`);

  try {
    await user.send(`📬 Você foi convidado para visualizar um ticket no servidor **${message.guild.name}**. Canal: ${ticketChannel}`);
  } catch (error) {
    console.log(`Não foi possível enviar DM para ${user.user.tag}:`, error.message);
  }
}

// ── Embed interativo de convite ──
function criarEmbedConvidar(ticketInfo, ticketChannel) {
  const invitedList = [];
  if (ticketChannel.permissionOverwrites?.cache) {
    for (const [id, overwrite] of ticketChannel.permissionOverwrites.cache) {
      if (overwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
        const member = ticketChannel.guild.members.cache.get(id);
        if (member && !member.user.bot) {
          invitedList.push(member.user.tag);
        }
      }
    }
  }

  const descricao = [
    '🎫 **⸻⸻⸻ CONVITE ⸻⸻⸻** 🎫',
    '',
    `📌 **Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
    `👤 **Aberto por:** ${ticketInfo.usuarioTag || 'Desconhecido'}`,
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    'Use os botões abaixo para **convidar** um membro',
    'para este ticket. Apenas **staff** pode convidar.',
    '',
    invitedList.length > 0
      ? `👥 **Convidados atuais:**\n${invitedList.map(t => `• ${t}`).join('\n')}`
      : '👥 **Ninguém foi convidado ainda.**',
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
  ].join('\n');

  const embed = criarEmbed({
    titulo: `📬 Convidar — Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
    descricao,
    cor: CORES.INFO,
    rodape: `Mila Bot • Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
  });

  return embed;
}

// ── Botões do painel de convite ──
function criarBotoesConvite() {
  const linha = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_invite_search')
      .setLabel('🔍 Buscar por Nome')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_invite_role')
      .setLabel('👥 Buscar por Cargo')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_invite_fechar')
      .setLabel('✖️ Fechar')
      .setStyle(ButtonStyle.Secondary),
  );
  return [linha];
}

// ── Verifica se membro é staff ──
function isTicketStaff(member, cfg) {
  if (!member) return false;
  const temPermissao = member.permissions?.has('Administrator') || member.permissions?.has('ManageGuild');
  if (temPermissao) return true;
  const cargosStaff = cfg.cargosStaff?.length > 0 ? cfg.cargosStaff : [];
  const memberRoles = member.roles.cache.map((r) => r.id);
  return memberRoles.some((r) => cargosStaff.includes(r));
}

// ── Concede permissão no ticket ──
async function addUserToTicket(channel, userId) {
  try {
    await channel.permissionOverwrites.create(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  } catch (err) {
    const existing = channel.permissionOverwrites.cache?.get(userId);
    if (existing) {
      await existing.edit({
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    } else {
      throw err;
    }
  }
}

// ── Painel interativo de convite (prefix) ──
async function enviarPainelConvidar(message, client) {
  const guildId = message.guildId;
  const cfg = obterConfig(guildId);
  const ticketChannel = message.channel;

  if (!isTicketStaff(message.member, cfg)) {
    return message.reply('❌ Apenas **staff** pode convidar usuários para tickets!');
  }

  if (!ticketChannel.topic) {
    return message.reply('❌ Este canal não é um ticket válido.');
  }

  let ticketInfo;
  try {
    ticketInfo = safeJsonParse(ticketChannel.topic) || {};
  } catch {
    return message.reply('❌ Erro ao ler informações do ticket.');
  }

  const embed = criarEmbedConvidar(ticketInfo, ticketChannel);
  await message.reply({
    embeds: [embed],
    components: criarBotoesConvite(),
  });
}

// ── Painel interativo de convite (embed + botoes + modais) ──
async function convidarInterativo(interaction, client) {
  const guildId = interaction.guildId;
  const cfg = obterConfig(guildId);
  const ticketChannel = interaction.channel;

  if (!isTicketStaff(interaction.member, cfg)) {
    return interaction.reply({
      content: '❌ Apenas **staff** pode convidar usuários para tickets!',
      ephemeral: true,
    });
  }

  if (!ticketChannel.topic) {
    return interaction.reply({
      content: '❌ Este canal não é um ticket válido.',
      ephemeral: true,
    });
  }

  let ticketInfo;
  try {
    ticketInfo = safeJsonParse(ticketChannel.topic) || {};
  } catch {
    return interaction.reply({
      content: '❌ Erro ao ler informações do ticket.',
      ephemeral: true,
    });
  }

  const embed = criarEmbedConvidar(ticketInfo, ticketChannel);
  await interaction.reply({
    embeds: [embed],
    components: criarBotoesConvite(),
    ephemeral: true,
  });
}

// ── Buscar por Nome (modal) ──
async function abrirModalBusca(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticket_invite_modal_busca')
    .setTitle('🔍 Buscar Membro');

  const nomeInput = new TextInputBuilder()
    .setCustomId('ticket_invite_nome')
    .setLabel('Digite o nome ou apelido do membro:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Nikki, João, Maria...')
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(nomeInput));
  await interaction.showModal(modal);
}

// ── Buscar por Cargo (menu) ──
async function mostrarCargos(interaction) {
  const guild = interaction.guild;
  const roles = guild.roles.cache
    .filter((r) => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position);

  const options = [];
  for (const [, role] of roles) {
    if (options.length >= 25) break;
    options.push({
      label: role.name.slice(0, 100),
      value: role.id,
      emoji: '👥',
      description: `${role.members.size} membro(s)`,
    });
  }

  if (options.length === 0) {
    return interaction.update({
      content: '❌ Nenhum cargo disponível no servidor.',
      embeds: [],
      components: [],
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_invite_role_select')
    .setPlaceholder('🎭 Selecione um cargo...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const voltarBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_invite_back')
      .setLabel('◀ Voltar')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    content: null,
    embeds: [],
    components: [row, voltarBtn],
  });
}

// ── Mostra membros de um cargo ──
async function mostrarMembrosDoCargo(interaction) {
  const roleId = interaction.values[0];
  const guild = interaction.guild;
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return interaction.update({
      content: '❌ Cargo não encontrado.',
      components: [],
    });
  }

  const channel = interaction.channel;
  const invitedIds = new Set();
  if (channel.permissionOverwrites?.cache) {
    for (const [id, ow] of channel.permissionOverwrites.cache) {
      if (ow.allow.has(PermissionFlagsBits.ViewChannel)) invitedIds.add(id);
    }
  }

  const members = role.members
    .filter((m) => !m.user.bot && !invitedIds.has(m.id) && m.id !== channel.guild.ownerId)
    .sort((a, b) => a.user.username.localeCompare(b.user.username));

  if (members.size === 0) {
    return interaction.update({
      content: `❌ Todos os membros do cargo **${role.name}** já estão no ticket ou não há membros disponíveis.`,
      components: [],
    });
  }

  const options = [];
  for (const [, member] of members) {
    if (options.length >= 25) break;
    options.push({
      label: (member.nickname || member.user.username).slice(0, 100),
      value: member.id,
      description: member.user.tag.slice(0, 100),
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_invite_member_select')
    .setPlaceholder(`👤 Membro de @${role.name}...`)
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const voltarBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_invite_back_roles')
      .setLabel('◀ Voltar aos cargos')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    content: `🎭 **Cargo:** ${role}\nSelecione o membro para convidar:`,
    components: [row, voltarBtn],
  });
}

// ── Processa busca por nome ──
async function processarBuscaNome(interaction) {
  const nome = interaction.fields.getTextInputValue('ticket_invite_nome').toLowerCase().trim();
  const guild = interaction.guild;

  const channel = interaction.channel;
  const invitedIds = new Set();
  if (channel.permissionOverwrites?.cache) {
    for (const [id, ow] of channel.permissionOverwrites.cache) {
      if (ow.allow.has(PermissionFlagsBits.ViewChannel)) invitedIds.add(id);
    }
  }

  const members = guild.members.cache
    .filter((m) => {
      if (m.user.bot) return false;
      if (invitedIds.has(m.id)) return false;
      const nomeCompleto = `${m.user.username} ${m.displayName} ${m.user.tag}`.toLowerCase();
      return nomeCompleto.includes(nome);
    })
    .sort((a, b) => a.user.username.localeCompare(b.user.username));

  if (members.size === 0) {
    return interaction.reply({
      content: `❌ Nenhum membro encontrado para \`${nome}\`. Tente outro nome.`,
      ephemeral: true,
    });
  }

  if (members.size === 1) {
    const member = members.first();
    try {
      await addUserToTicket(channel, member.id);
      await interaction.reply({
        content: `✅ **${member.user.tag}** foi convidado para o ticket!`,
        ephemeral: true,
      });
      try {
        await member.send(`📬 Você foi convidado para visualizar um ticket no servidor **${guild.name}**. Canal: ${channel}`);
      } catch {}
      return;
    } catch (err) {
      return interaction.reply({
        content: `❌ Erro ao convidar: ${err.message}`,
        ephemeral: true,
      });
    }
  }

  const options = [];
  for (const [, member] of members) {
    if (options.length >= 25) break;
    options.push({
      label: (member.nickname || member.user.username).slice(0, 100),
      value: member.id,
      description: member.user.tag.slice(0, 100),
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_invite_user_select')
    .setPlaceholder('👤 Selecione o membro...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const voltarBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_invite_back')
      .setLabel('◀ Voltar')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: `🔍 Encontrei **${members.size}** membro(s) para \`${nome}\`. Selecione:`,
    components: [row, voltarBtn],
    ephemeral: true,
  });
}

// ── Convida usuário selecionado ──
async function convidarPorSelecao(interaction) {
  // O customId pode ser reaproveitado: nunca confie apenas no menu ter sido
  // enviado para staff. Revalida quem está clicando.
  const cfg = obterConfig(interaction.guildId);
  if (!isTicketStaff(interaction.member, cfg)) {
    return interaction.reply({ content: '❌ Apenas **staff** pode convidar usuários para tickets!', ephemeral: true }).catch(() => {});
  }
  const userId = interaction.values[0];
  const channel = interaction.channel;

  try {
    const member = await interaction.guild.members.fetch(userId);
    await addUserToTicket(channel, userId);

    await interaction.update({
      content: `✅ **${member.user.tag}** foi convidado para o ticket!`,
      components: [],
      embeds: [],
    });

    try {
      await member.send(`📬 Você foi convidado para visualizar um ticket no servidor **${interaction.guild.name}**. Canal: ${channel}`);
    } catch {}
  } catch (err) {
    await interaction.update({
      content: `❌ Erro ao convidar: ${err.message}`,
      components: [],
    });
  }
}

// ── Comando $ticket config (prefix) ──
async function configurarTicket(message, args, client) {
  const guildId = message.guildId;

  if (args[0] === 'config') {
    const categoriaId = args[1]?.replace(/[<#>]/g, '') || '';
    const categoria = message.guild.channels.cache.get(categoriaId);

    if (!categoria || categoria.type !== ChannelType.GuildCategory) {
      return message.reply('❌ Especifique uma **categoria** válida: `$ticket config #categoria`');
    }

    const cfg = obterConfig(guildId);
    cfg.categoriaId = categoriaId;
    salvarConfig(guildId, cfg);

    return message.reply(`✅ **Categoria padrão de Tickets definida:** ${categoria.name}`);
  }

  if (args[0] === 'categoria' && args[1]) {
    const tipo = args[1].toLowerCase();
    const categoriaId = args[2]?.replace(/[<#>]/g, '') || '';

    const tipoValido = CATEGORIAS.find(c => c.valor === `ticket_${tipo}` || c.nome.toLowerCase() === tipo);
    if (!tipoValido) {
      return message.reply('❌ Tipo inválido. Use: denuncias, parcerias, outro');
    }

    const categoria = message.guild.channels.cache.get(categoriaId);
    if (!categoria || categoria.type !== ChannelType.GuildCategory) {
      return message.reply(`❌ Especifique uma categoria válida: \`$ticket categoria ${tipo} #categoria\``);
    }

    const cfg = obterConfig(guildId);
    cfg.categoriasPorTipo = cfg.categoriasPorTipo || {};
    cfg.categoriasPorTipo[`ticket_${tipo}`] = categoriaId;
    salvarConfig(guildId, cfg);

    return message.reply(`✅ **Categoria para \`${tipo}\` definida:** ${categoria.name}`);
  }

  if (args[0] === 'staff' && args[1] === 'add') {
    const roleId = args[2]?.replace(/[<@&>]/g, '') || '';
    const role = message.guild.roles.cache.get(roleId);

    if (!role) return message.reply('❌ Especifique um cargo: `$ticket staff add @cargo`');

    const cfg = obterConfig(guildId);
    if (!cfg.cargosStaff.includes(roleId)) {
      cfg.cargosStaff.push(roleId);
      salvarConfig(guildId, cfg);
    }

    return message.reply(`✅ **Cargo adicionado à staff de tickets:** ${role}`);
  }

  if (args[0] === 'staff' && args[1] === 'remove') {
    const roleId = args[2]?.replace(/[<@&>]/g, '') || '';

    const cfg = obterConfig(guildId);
    cfg.cargosStaff = cfg.cargosStaff.filter((id) => id !== roleId);
    salvarConfig(guildId, cfg);

    return message.reply(`✅ Cargo removido da staff de tickets.`);
  }

  if (args[0] === 'invite') {
    const userId = args[1]?.replace(/[<@!]/g, '') || '';
    if (!userId) {
      return message.reply('❌ Especifique um usuário: `$ticket invite @usuario`');
    }
    return convidarUsuario(message, userId);
  }

  if (args[0] === 'ver') {
    const cfg = obterConfig(guildId);
    const categoria = cfg.categoriaId ? message.guild.channels.cache.get(cfg.categoriaId) : null;
    const cargos = cfg.cargosStaff.map((id) => {
      const role = message.guild.roles.cache.get(id);
      return role ? `${role}` : `\`${id}\``;
    }).join(', ') || '`Nenhum`';

    const linhas = CATEGORIAS.map((cat) => {
      const id = cfg.categoriasPorTipo?.[cat.valor] || CATEGORIA_POR_VALOR[cat.valor];
      const canal = id ? message.guild.channels.cache.get(id) : null;
      return `${cat.emoji} **${cat.nome}:** ${canal ? canal.name : '`Não definida`'}`;
    }).join('\n');

    const descricao = [
      `**📂 Categoria padrão:** ${categoria ? categoria.name : '`Não definida`'}`,
      '',
      linhas,
      '',
      `**👥 Cargos Staff:** ${cargos}`,
      `**🔢 Tickets criados:** ${cfg.contador || 0}`,
    ].join('\n');

    const embed = criarEmbed({
      titulo: '🎫 Configuração dos Tickets',
      descricao,
      cor: CORES.DESTAQUE,
      rodape: 'Use: $ticket config, $ticket categoria, $ticket staff add/remove',
    });

    return message.reply({ embeds: [embed] });
  }

  // Help
  const embed = criarEmbed({
    titulo: '🎫 Comandos de Ticket',
    descricao: [
      '`$ticket` — Envia o painel de tickets',
      '`$ticket config #categoria` — Define a categoria padrão',
      '`$ticket categoria <tipo> #categoria` — Define categoria por tipo',
      '`$ticket staff add @cargo` — Adiciona cargo à staff',
      '`$ticket staff remove @cargo` — Remove cargo da staff',
      '`$ticket invite @usuario` — Convida um usuário',
      '`$ticket remove @usuario` — Remove um usuário',
      '`$ticket ver` — Ver configuração atual',
      '`$fechar` — Fecha o ticket deste canal',
    ].join('\n'),
    cor: CORES.DESTAQUE,
    rodape: 'Mila Bot',
  });

  return message.reply({ embeds: [embed] });
}

// ── Embed interativo de remoção ──
function criarEmbedRemover(ticketInfo, ticketChannel) {
  const invitedList = [];
  if (ticketChannel.permissionOverwrites?.cache) {
    for (const [id, overwrite] of ticketChannel.permissionOverwrites.cache) {
      if (overwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
        const member = ticketChannel.guild.members.cache.get(id);
        if (member && !member.user.bot) {
          invitedList.push(member.user.tag);
        }
      }
    }
  }

  const descricao = [
    '🚫 **⸻⸻⸻ REMOVER ACESSO ⸻⸻⸻** 🚫',
    '',
    `📌 **Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
    `👤 **Aberto por:** ${ticketInfo.usuarioTag || 'Desconhecido'}`,
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    '',
    'Use os botões abaixo para **remover** um membro',
    'deste ticket. Apenas **staff** pode remover.',
    '',
    invitedList.length > 0
      ? `👥 **Com acesso atual:**\n${invitedList.map(t => `• ${t}`).join('\n')}`
      : '👥 **Ninguém além do dono tem acesso.**',
    '',
    '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
  ].join('\n');

  const embed = criarEmbed({
    titulo: `🚫 Remover — Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
    descricao,
    cor: CORES.ALERTA,
    rodape: `Mila Bot • Ticket #${String(ticketInfo.contador).padStart(4, '0')}`,
  });

  return embed;
}

// ── Botões do painel de remoção ──
function criarBotoesRemover() {
  const linha = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_remove_search')
      .setLabel('🔍 Buscar por Nome')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_remove_role')
      .setLabel('👥 Buscar por Cargo')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_remove_fechar')
      .setLabel('✖️ Fechar')
      .setStyle(ButtonStyle.Secondary),
  );
  return [linha];
}

// ── Painel interativo de remoção (prefix) ──
async function enviarPainelRemover(message, client) {
  const guildId = message.guildId;
  const cfg = obterConfig(guildId);
  const ticketChannel = message.channel;

  if (!message.member?.permissions?.has('Administrator')) {
    return message.reply('❌ Apenas **administradores** podem remover usuários dos tickets!');
  }

  if (!ticketChannel.topic) {
    return message.reply('❌ Este canal não é um ticket válido.');
  }

  let ticketInfo;
  try {
    ticketInfo = safeJsonParse(ticketChannel.topic) || {};
  } catch {
    return message.reply('❌ Erro ao ler informações do ticket.');
  }

  const embed = criarEmbedRemover(ticketInfo, ticketChannel);
  await message.reply({
    embeds: [embed],
    components: criarBotoesRemover(),
  });
}

// ── Painel interativo de remoção (slash) ──
async function removerInterativo(interaction, client) {
  const guildId = interaction.guildId;
  const cfg = obterConfig(guildId);
  const ticketChannel = interaction.channel;

  if (!interaction.member?.permissions?.has('Administrator')) {
    return interaction.reply({
      content: '❌ Apenas **administradores** podem remover usuários dos tickets!',
      ephemeral: true,
    });
  }

  if (!ticketChannel.topic) {
    return interaction.reply({
      content: '❌ Este canal não é um ticket válido.',
      ephemeral: true,
    });
  }

  let ticketInfo;
  try {
    ticketInfo = safeJsonParse(ticketChannel.topic) || {};
  } catch {
    return interaction.reply({
      content: '❌ Erro ao ler informações do ticket.',
      ephemeral: true,
    });
  }

  const embed = criarEmbedRemover(ticketInfo, ticketChannel);
  await interaction.reply({
    embeds: [embed],
    components: criarBotoesRemover(),
    ephemeral: true,
  });
}

// ── Buscar por Nome (modal) — remoção ──
async function abrirModalBuscaRemover(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ticket_remove_modal_busca')
    .setTitle('🔍 Buscar Membro para Remover');

  const nomeInput = new TextInputBuilder()
    .setCustomId('ticket_remove_nome')
    .setLabel('Digite o nome ou apelido do membro:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Nikki, João, Maria...')
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(nomeInput));
  await interaction.showModal(modal);
}

// ── Processa busca por nome — remoção ──
async function processarBuscaNomeRemover(interaction) {
  const nome = interaction.fields.getTextInputValue('ticket_remove_nome').toLowerCase().trim();
  const guild = interaction.guild;
  const channel = interaction.channel;

  const accessIds = new Set();
  if (channel.permissionOverwrites?.cache) {
    for (const [id, ow] of channel.permissionOverwrites.cache) {
      if (ow.allow.has(PermissionFlagsBits.ViewChannel)) accessIds.add(id);
    }
  }

  const members = guild.members.cache
    .filter((m) => {
      if (m.user.bot) return false;
      if (!accessIds.has(m.id)) return false;
      const nomeCompleto = `${m.user.username} ${m.displayName} ${m.user.tag}`.toLowerCase();
      return nomeCompleto.includes(nome);
    })
    .sort((a, b) => a.user.username.localeCompare(b.user.username));

  if (members.size === 0) {
    return interaction.reply({
      content: `❌ Nenhum membro com esse nome tem acesso ao ticket.`,
      ephemeral: true,
    });
  }

  if (members.size === 1) {
    const member = members.first();
    const ticketInfo = safeJsonParse(channel.topic) || {};

    if (member.id === ticketInfo.userId) {
      return interaction.reply({
        content: '❌ Não é possível remover o **dono do ticket**.',
        ephemeral: true,
      });
    }

    try {
      await channel.permissionOverwrites.edit(member.id, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
      });
      await interaction.reply({
        content: `🚫 **${member.user.tag}** foi removido do ticket!`,
        ephemeral: true,
      });
      try {
        await member.send(`🚫 Você foi removido do ticket **#${String(ticketInfo.contador).padStart(4, '0')}** no servidor **${guild.name}**.`);
      } catch {}
      return;
    } catch (err) {
      return interaction.reply({
        content: `❌ Erro ao remover: ${err.message}`,
        ephemeral: true,
      });
    }
  }

  const options = [];
  for (const [, member] of members) {
    if (options.length >= 25) break;
    options.push({
      label: (member.nickname || member.user.username).slice(0, 100),
      value: member.id,
      description: member.user.tag.slice(0, 100),
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_remove_user_select')
    .setPlaceholder('👤 Selecione quem remover...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const voltarBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_remove_back')
      .setLabel('◀ Voltar')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: `🔍 Encontrei **${members.size}** membro(s) com acesso. Selecione quem remover:`,
    components: [row, voltarBtn],
    ephemeral: true,
  });
}

// ── Mostrar cargos — remoção ──
async function mostrarCargosRemover(interaction) {
  const guild = interaction.guild;
  const roles = guild.roles.cache
    .filter((r) => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position);

  const options = [];
  for (const [, role] of roles) {
    if (options.length >= 25) break;
    options.push({
      label: role.name.slice(0, 100),
      value: role.id,
      emoji: '👥',
      description: `${role.members.size} membro(s)`,
    });
  }

  if (options.length === 0) {
    return interaction.update({
      content: '❌ Nenhum cargo disponível no servidor.',
      embeds: [],
      components: [],
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_remove_role_select')
    .setPlaceholder('🎭 Selecione um cargo...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const voltarBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_remove_back')
      .setLabel('◀ Voltar')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    content: null,
    embeds: [],
    components: [row, voltarBtn],
  });
}

// ── Mostra membros de um cargo que estão no ticket ──
async function mostrarMembrosDoCargoRemover(interaction) {
  const roleId = interaction.values[0];
  const guild = interaction.guild;
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return interaction.update({
      content: '❌ Cargo não encontrado.',
      components: [],
    });
  }

  const channel = interaction.channel;
  const accessIds = new Set();
  if (channel.permissionOverwrites?.cache) {
    for (const [id, ow] of channel.permissionOverwrites.cache) {
      if (ow.allow.has(PermissionFlagsBits.ViewChannel)) accessIds.add(id);
    }
  }

  const members = role.members
    .filter((m) => !m.user.bot && accessIds.has(m.id))
    .sort((a, b) => a.user.username.localeCompare(b.user.username));

  if (members.size === 0) {
    return interaction.update({
      content: `❌ Nenhum membro do cargo **${role.name}** tem acesso a este ticket.`,
      components: [],
    });
  }

  const options = [];
  for (const [, member] of members) {
    if (options.length >= 25) break;
    options.push({
      label: (member.nickname || member.user.username).slice(0, 100),
      value: member.id,
      description: member.user.tag.slice(0, 100),
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_remove_member_select')
    .setPlaceholder(`👤 Remover de @${role.name}...`)
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  const voltarBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_remove_back_roles')
      .setLabel('◀ Voltar aos cargos')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    content: `🎭 **Cargo:** ${role}\nSelecione o membro para remover:`,
    components: [row, voltarBtn],
  });
}

// ── Remove usuário selecionado ──
async function removerPorSelecao(interaction) {
  const cfg = obterConfig(interaction.guildId);
  if (!isTicketStaff(interaction.member, cfg)) {
    return interaction.reply({ content: '❌ Apenas **staff** pode remover usuários de tickets!', ephemeral: true }).catch(() => {});
  }
  const userId = interaction.values[0];
  const channel = interaction.channel;

  try {
    const ticketInfo = safeJsonParse(channel.topic) || {};

    if (userId === ticketInfo.userId) {
      return interaction.update({
        content: '❌ Não é possível remover o **dono do ticket**.',
        components: [],
        embeds: [],
      });
    }

    const member = await interaction.guild.members.fetch(userId);

    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
    });

    await interaction.update({
      content: `🚫 **${member.user.tag}** foi removido do ticket!`,
      components: [],
      embeds: [],
    });

    try {
      await member.send(`🚫 Você foi removido do ticket **#${String(ticketInfo.contador).padStart(4, '0')}** no servidor **${interaction.guild.name}**.`);
    } catch {}
  } catch (err) {
    await interaction.update({
      content: `❌ Erro ao remover: ${err.message}`,
      components: [],
    });
  }
}

// ── Remover Usuário do Ticket (via @menção direta) ──
async function removerUsuario(message, userId) {
  const ticketChannel = message.channel;

  if (ticketChannel.type !== ChannelType.GuildText) {
    return message.reply('❌ Este comando só pode ser usado em canais de texto.');
  }

  if (!ticketChannel.topic) {
    return message.reply('❌ Este canal não parece ser um ticket válido. Use o comando em um canal de ticket.');
  }

  let ticketInfo;
  try {
    ticketInfo = safeJsonParse(ticketChannel.topic) || {};
  } catch {
    return message.reply('❌ Erro ao ler informações do ticket.');
  }

  if (!ticketInfo || (!ticketInfo.userId && !ticketInfo.contador)) {
    return message.reply('❌ Este canal não é um ticket válido.');
  }

  // Staff pode remover qualquer um; o dono do ticket pode remover convidados
  // do próprio ticket (mas nunca a si mesmo, checado abaixo).
  const cfg = obterConfig(message.guildId);
  const autorizado = isTicketStaff(message.member, cfg) || String(ticketInfo.userId) === String(message.author.id);
  if (!autorizado) {
    return message.reply('❌ Apenas **staff** ou o **dono do ticket** podem remover usuários.');
  }

  if (userId === ticketInfo.userId) {
    return message.reply('❌ Não é possível remover o **dono do ticket**.');
  }

  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return message.reply('❌ Usuário não encontrado no servidor.');
  }

  const overwrite = ticketChannel.permissionOverwrites.cache?.get(userId);
  const hasAccess = overwrite?.allow?.has(PermissionFlagsBits.ViewChannel);

  if (!hasAccess) {
    return message.reply(`❌ ${member} não tem acesso a este ticket.`);
  }

  try {
    await ticketChannel.permissionOverwrites.edit(userId, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
    });
  } catch (err) {
    return message.reply(`❌ Erro ao remover usuário: ${err.message}`);
  }

  await message.reply(`🚫 ${member} foi removido do ticket.`);

  try {
    await member.send(`🚫 Você foi removido do ticket **#${String(ticketInfo.contador).padStart(4, '0')}** no servidor **${message.guild.name}**.`);
  } catch {
    console.log(`Não foi possível enviar DM para ${member.user.tag}: DM fechada.`);
  }
}

module.exports = {
  CATEGORIAS,
  CORES,
  CATEGORIAS_POR_ID,
  CATEGORIA_POR_VALOR,
  criarEmbedPainel,
  criarBotoesPainel,
  criarEmbedTicketAberto,
  criarEmbedTicketReivindicado,
  criarEmbedTicketFechado,
  criarBotoesTicket,
  criarEmbedConvidar,
  criarBotoesConvite,
  buscarCategoria,
  resolverCategoriaEId,
  criarTicket,
  reivindicarTicket,
  fecharTicket,
  enviarPainel,
  configurarTicket,
  convidarUsuario,
  convidarInterativo,
  enviarPainelConvidar,
  abrirModalBusca,
  mostrarCargos,
  mostrarMembrosDoCargo,
  processarBuscaNome,
  convidarPorSelecao,
  removerUsuario,
  criarEmbedRemover,
  criarBotoesRemover,
  enviarPainelRemover,
  removerInterativo,
  abrirModalBuscaRemover,
  processarBuscaNomeRemover,
  mostrarCargosRemover,
  mostrarMembrosDoCargoRemover,
  removerPorSelecao,
  executarFechamento,
  criarEmbedConfirmarFechamento,
  criarBotoesConfirmarFechamento,
};
