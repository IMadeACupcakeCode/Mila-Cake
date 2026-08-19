const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const { criarEmbed, THEME } = require('./theme');

const COR_FALA = 0xD4A017;

// Mapa de sessões ativas (guildId → userId + estado)
const sessoes = new Map();

// ══════════════════════════════════════════════════════════════
// EMBED E BOTÕES DO PAINEL PRINCIPAL
// ══════════════════════════════════════════════════════════════

function criarEmbedFalar() {
  return criarEmbed({
    titulo: '💬 Fala da Lua 🌙',
    descricao: [
      '✧ ﾟ･ ✦ ･ ｡･ﾟ ✧ ﾟ･ ✦ ･ ｡･ﾟ ✧',
      '',
      '💬 **O que deseja que eu diga?** 💬',
      '',
      '✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
      '',
      '💬 **Aqui mesmo** — Falo neste canal',
      '📢 **Outro canal** — Escolho um canal com busca',
      '✉️ **DM** — Envio para alguém no privado',
      '',
      '✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
      '',
      '💡 **Direto:** `$say #canal mensagem`',
      '💡 **Direto:** `$say mensagem` (aqui mesmo)',
    ].join('\n'),
    cor: COR_FALA,
    rodape: '✧ ⎯ ੭ ⋆｡°✩ Mila Bot — o que deseja dizer?',
  });
}

function criarBotoesFalar() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('say_aqui')
        .setLabel('💬 Aqui mesmo')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('say_canal')
        .setLabel('📢 Outro canal')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('say_dm')
        .setLabel('✉️ DM')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('say_cancelar')
        .setLabel('✖️ Cancelar')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ══════════════════════════════════════════════════════════════
// MODO DIRETO: $say texto  ou  $say #canal texto
// ══════════════════════════════════════════════════════════════

async function falarDireto(message, args) {
  // Verifica permissão de admin
  if (!message.member?.permissions?.has('Administrator')) {
    return message.reply('❌ Apenas **administradores** podem usar o comando `$say`.');
  }

  if (!args.length) {
    return enviarPainelFalar(message);
  }

  const texto = args.join(' ').trim();
  if (!texto) return message.reply('❌ Escreva algo para eu falar!');

  // Verifica se o primeiro argumento é um canal: #canal
  const canalMatch = texto.match(/^<#(\d+)>\s*(.*)/);
  if (canalMatch) {
    const canalId = canalMatch[1];
    const mensagem = canalMatch[2].trim();

    if (!mensagem) return message.reply('❌ Escreva uma mensagem depois do canal! Ex: `$say #geral Olá pessoal`');

    const canal = message.guild.channels.cache.get(canalId);
    if (!canal || canal.type !== ChannelType.GuildText) {
      return message.reply('❌ Este canal não existe ou não é um canal de texto.');
    }
    if (!canal.viewable) {
      return message.reply('❌ Não tenho acesso a este canal.');
    }

    const embed = criarEmbed({
      titulo: '💬 ⋆｡°✩ Mila Bot',
      descricao: mensagem,
      cor: COR_FALA,
      rodape: 'Mila Bot',
    });

    try {
      await canal.send({ embeds: [embed] });
      await message.reply({ content: `✅ Mensagem enviada para ${canal}!`, ephemeral: true });
    } catch (err) {
      await message.reply(`❌ Erro ao enviar para ${canal}: ${err.message}`);
    }
    return;
  }

  // Modo normal: fala aqui e apaga a mensagem
  const embed = criarEmbed({
    titulo: '💬 ⋆｡°✩ Mila Bot',
    descricao: texto,
    cor: COR_FALA,
    rodape: 'Mila Bot',
  });

  try {
    await message.delete();
    await message.channel.send({ embeds: [embed] });
  } catch {
    await message.channel.send({ embeds: [embed] });
    if (message.deletable) await message.delete().catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════
// MODO PAINEL (prefix e slash)
// ══════════════════════════════════════════════════════════════

async function enviarPainelFalar(message) {
  // Verifica permissão de admin
  if (!message.member?.permissions?.has('Administrator')) {
    return message.reply('❌ Apenas **administradores** podem usar o comando `$say`.');
  }

  const embed = criarEmbedFalar();
  const reply = await message.reply({
    embeds: [embed],
    components: criarBotoesFalar(),
    fetchReply: true,
  });
  sessoes.set(reply.id, { userId: message.author.id, guildId: message.guildId });
  setTimeout(() => sessoes.delete(reply.id), 120_000);
}

async function falarInterativo(interaction) {
  const embed = criarEmbedFalar();
  await interaction.reply({
    embeds: [embed],
    components: criarBotoesFalar(),
    ephemeral: true,
  });
  sessoes.set(interaction.id, { userId: interaction.user.id, guildId: interaction.guildId });
  setTimeout(() => sessoes.delete(interaction.id), 120_000);
}

// ══════════════════════════════════════════════════════════════
// SELEÇÃO DE CANAL POR CATEGORIA
// ══════════════════════════════════════════════════════════════

async function mostrarCategorias(interaction) {
  if (!verificarSessao(interaction)) return;
  const guild = interaction.guild;

  // Agrupa canais de texto por categoria
  const categorias = new Map(); // categoryId → { nome, canais[] }
  const semCategoria = [];

  for (const [, ch] of guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText && c.viewable)
    .sort((a, b) => a.position - b.position)) {

    const catId = ch.parentId || 'none';
    if (catId === 'none') {
      semCategoria.push(ch);
    } else {
      if (!categorias.has(catId)) {
        const cat = guild.channels.cache.get(catId);
        categorias.set(catId, { nome: cat?.name || 'Sem nome', canais: [] });
      }
      categorias.get(catId).canais.push(ch);
    }
  }

  // Monta select de categorias
  const options = [];
  for (const [catId, cat] of categorias) {
    if (options.length >= 24) break; // deixa 1 slot pra "Sem categoria"
    options.push({
      label: `📁 ${cat.nome}`.slice(0, 100),
      value: `cat_${catId}`,
      description: `${cat.canais.length} canal(is)`,
    });
  }
  if (semCategoria.length && options.length < 25) {
    options.push({
      label: '📁 Sem Categoria',
      value: 'cat_none',
      description: `${semCategoria.length} canal(is)`,
    });
  }

  if (!options.length) {
    return interaction.update({
      content: '❌ Nenhum canal de texto disponível.',
      components: [],
      embeds: [],
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('say_select_categoria')
    .setPlaceholder('📁 Selecione uma categoria...')
    .addOptions(options);

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('say_buscar_canal')
      .setLabel('🔍 Buscar canal por nome')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('say_voltar')
      .setLabel('◀ Voltar')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds: [criarEmbedSelecionarCanal()],
    components: [new ActionRowBuilder().addComponents(select), botoes],
  });
}

function criarEmbedSelecionarCanal() {
  return criarEmbed({
    titulo: '📢 Escolher Canal',
    descricao: [
      'Selecione uma **categoria** para ver os canais,',
      'ou use a **busca** para encontrar pelo nome.',
      '',
      '✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
      '💡 Você também pode usar:',
      '`$say #canal mensagem` direto!',
    ].join('\n'),
    cor: COR_FALA,
    rodape: '✧ ⎯ ੭ ⋆｡°✩ Mila Bot',
  });
}

async function mostrarCanaisDaCategoria(interaction) {
  const catKey = interaction.values[0];
  const catId = catKey.replace('cat_', '');
  const guild = interaction.guild;

  let canais;
  if (catId === 'none') {
    canais = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText && c.viewable && !c.parentId)
      .sort((a, b) => a.position - b.position);
  } else {
    canais = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText && c.viewable && c.parentId === catId)
      .sort((a, b) => a.position - b.position);
  }

  if (!canais.size) {
    return interaction.update({
      content: '❌ Esta categoria não tem canais de texto visíveis.',
      components: [],
      embeds: [],
    });
  }

  const options = [];
  for (const [, c] of canais) {
    if (options.length >= 25) break;
    options.push({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📢' });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('say_select_canal')
    .setPlaceholder('📢 Selecione o canal...')
    .addOptions(options);

  let nomeCategoria = catId === 'none' ? 'Sem Categoria' : (guild.channels.cache.get(catId)?.name || 'Categoria');
  const descricao = canais.size > 25
    ? `📁 **${nomeCategoria}** — Mostrando 25 de ${canais.size} canais (limite do Discord). Use a busca para encontrar exato.`
    : `📁 **${nomeCategoria}** — ${canais.size} canal(is) disponível(is):`;

  await interaction.update({
    embeds: [criarEmbed({
      titulo: `📁 ${nomeCategoria}`,
      descricao,
      cor: COR_FALA,
      rodape: 'Mila Bot',
    })],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('say_buscar_canal')
          .setLabel('🔍 Buscar por nome')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('say_voltar_categorias')
          .setLabel('◀ Voltar às categorias')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

// ══════════════════════════════════════════════════════════════
// BUSCA DE CANAL POR NOME (MODAL)
// ══════════════════════════════════════════════════════════════

async function abrirBuscaCanal(interaction) {
  if (!verificarSessao(interaction)) return;

  const modal = new ModalBuilder()
    .setCustomId('say_busca_canal_modal')
    .setTitle('🔍 Buscar Canal');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('say_busca_nome')
        .setLabel('Digite o nome do canal ou categoria:')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: geral, suporte, chat-livre...')
        .setMaxLength(100)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function processarBuscaCanal(interaction) {
  const termo = interaction.fields.getTextInputValue('say_busca_nome').toLowerCase().trim();
  const guild = interaction.guild;

  const encontrados = guild.channels.cache
    .filter(c =>
      c.type === ChannelType.GuildText &&
      c.viewable &&
      c.name.toLowerCase().includes(termo),
    )
    .sort((a, b) => a.position - b.position);

  if (!encontrados.size) {
    return interaction.reply({
      content: `❌ Nenhum canal encontrado com \`${termo}\`.`,
      ephemeral: true,
    });
  }

  const options = [];
  for (const [, c] of encontrados) {
    if (options.length >= 25) break;
    const prefixo = c.parent ? `[${c.parent.name}] ` : '';
    options.push({
      label: `${prefixo}#${c.name}`.slice(0, 100),
      value: c.id,
      emoji: '📢',
      description: c.parent ? `📁 ${c.parent.name}` : 'Sem categoria',
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('say_select_canal')
    .setPlaceholder('📢 Selecione o canal...')
    .addOptions(options);

  const sufixo = encontrados.size > 25 ? ` (mostrando 25 de ${encontrados.size})` : '';

  await interaction.reply({
    embeds: [criarEmbed({
      titulo: `🔍 Resultados para "${termo}"${sufixo}`,
      descricao: encontrados.size === 1
        ? 'Apenas 1 canal encontrado. Selecione abaixo ou cancele.'
        : `${encontrados.size} canal(is) encontrado(s). Selecione abaixo:`,
      cor: COR_FALA,
      rodape: 'Mila Bot',
    })],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('say_voltar_categorias')
          .setLabel('◀ Voltar às categorias')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('say_cancelar_preview')
          .setLabel('✖️ Cancelar')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
    ephemeral: true,
  });
}

// ══════════════════════════════════════════════════════════════
// MODAIS DE CONTEÚDO
// ══════════════════════════════════════════════════════════════

async function abrirModalAqui(interaction) {
  if (!verificarSessao(interaction)) return;

  const modal = new ModalBuilder()
    .setCustomId('say_modal_aqui')
    .setTitle('💬 Falar Aqui');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('say_conteudo')
        .setLabel('💬 O que devo dizer?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escreva aqui a mensagem que eu falarei...')
        .setMaxLength(2000)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function abrirModalCanal(interaction) {
  const channelId = interaction.values?.[0];
  if (!channelId) return;

  const modal = new ModalBuilder()
    .setCustomId(`say_modal_canal_${channelId}`)
    .setTitle('📢 Falar em Canal');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('say_conteudo')
        .setLabel('💬 O que devo dizer?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escreva aqui a mensagem que eu falarei...')
        .setMaxLength(2000)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function abrirModalDM(interaction) {
  if (!verificarSessao(interaction)) return;

  const modal = new ModalBuilder()
    .setCustomId('say_modal_dm')
    .setTitle('✉️ Falar via DM');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('say_dm_user')
        .setLabel('👤 Nome ou ID do usuário')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Nikki, joao_123, 123456789...')
        .setMaxLength(100)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('say_conteudo')
        .setLabel('💬 O que devo dizer?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escreva aqui a mensagem (até 2000 caracteres)...')
        .setMaxLength(2000)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

// ══════════════════════════════════════════════════════════════
// PREVIEW
// ══════════════════════════════════════════════════════════════

async function mostrarPreview(interaction) {
  const customId = interaction.customId;
  const conteudo = interaction.fields.getTextInputValue('say_conteudo');

  let destino = 'aqui';
  let alvoId = '0';
  let destinoTexto = '💬 **Aqui mesmo**';

  if (customId === 'say_modal_dm') {
    destino = 'dm';
    const userInput = interaction.fields.getTextInputValue('say_dm_user').trim();

    const membros = interaction.guild.members.cache;
    let alvo = membros.find(m =>
      m.user.username.toLowerCase() === userInput.toLowerCase() ||
      m.displayName.toLowerCase() === userInput.toLowerCase() ||
      m.user.tag.toLowerCase() === userInput.toLowerCase() ||
      m.id === userInput,
    );

    if (!alvo) {
      return interaction.reply({
        content: `❌ Não encontrei ninguém chamado \`${userInput}\` no servidor.`,
        ephemeral: true,
      });
    }

    alvoId = alvo.id;
    destinoTexto = `✉️ **DM para ${alvo.user.tag}**`;
  } else if (customId.startsWith('say_modal_canal_')) {
    destino = 'canal';
    alvoId = customId.replace('say_modal_canal_', '');
    const canal = interaction.guild.channels.cache.get(alvoId);
    destinoTexto = canal
      ? `📢 **#${canal.name}**${canal.parent ? ` (${canal.parent.name})` : ''}`
      : '📢 **Canal**';
  }

  const embed = criarEmbed({
    titulo: '📝 Preview — Confirme o Envio',
    descricao: [
      `**Destino:** ${destinoTexto}`,
      '',
      '✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
      '',
      conteudo,
      '',
      '✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
      '',
      'Tudo certo? Confirma o envio abaixo.',
    ].join('\n'),
    cor: COR_FALA,
    rodape: '✧ ⎯ ੭ ⋆｡°✩ Mila Bot — revise antes de enviar',
  });

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`say_enviar_${destino}_${alvoId}`)
      .setLabel('✅ Enviar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('say_cancelar_preview')
      .setLabel('✖️ Cancelar')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    embeds: [embed],
    components: [botoes],
    ephemeral: true,
  });
}

// ══════════════════════════════════════════════════════════════
// ENVIO
// ══════════════════════════════════════════════════════════════

async function confirmarEnvio(interaction) {
  const partes = interaction.customId.split('_');
  const destino = partes[2];
  const alvoId = partes.slice(3).join('_');

  const desc = interaction.message.embeds[0]?.description || '';
  const match = desc.match(/✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n([\s\S]*?)\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦/);
  const conteudo = match ? match[1].trim() : '';

  if (!conteudo) {
    return interaction.update({
      content: '❌ Mensagem vazia.',
      embeds: [],
      components: [],
    });
  }

  const embedEnvio = criarEmbed({
    titulo: '💬 ⋆｡°✩ Mila Bot',
    descricao: conteudo,
    cor: COR_FALA,
    rodape: 'Mila Bot',
  });

  try {
    if (destino === 'aqui') {
      await interaction.channel.send({ embeds: [embedEnvio] });
    } else if (destino === 'canal' && alvoId && alvoId !== '0') {
      const canal = await interaction.guild.channels.fetch(alvoId).catch(() => null);
      if (!canal) {
        return interaction.update({
          content: '❌ Canal não encontrado ou não tenho acesso.',
          embeds: [],
          components: [],
        });
      }
      await canal.send({ embeds: [embedEnvio] });
    } else if (destino === 'dm' && alvoId && alvoId !== '0') {
      const user = await interaction.client.users.fetch(alvoId).catch(() => null);
      if (!user) {
        return interaction.update({
          content: '❌ Usuário não encontrado.',
          embeds: [],
          components: [],
        });
      }
      await user.send({ embeds: [embedEnvio] });
    } else {
      return interaction.update({
        content: '❌ Destino inválido.',
        embeds: [],
        components: [],
      });
    }

    await interaction.update({
      content: `✅ **Mensagem enviada para ${destinoTexto(destino, alvoId, interaction)} com sucesso!**`,
      embeds: [],
      components: [],
    });
  } catch (err) {
    await interaction.update({
      content: `❌ Erro ao enviar: ${err.message}`,
      embeds: [],
      components: [],
    });
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function verificarSessao(interaction) {
  const msgId = interaction.message?.id || interaction.id;
  const sessao = sessoes.get(msgId);
  if (sessao && interaction.user.id !== sessao.userId) {
    interaction.reply({
      content: '❌ Apenas quem usou o comando pode interagir com este painel.',
      ephemeral: true,
    }).catch(() => {});
    return false;
  }
  return true;
}

function destinoTexto(destino, alvoId, interaction) {
  if (destino === 'aqui') return 'aqui';
  if (destino === 'canal') {
    const c = interaction.guild?.channels.cache.get(alvoId);
    return c ? `#${c.name}` : 'canal';
  }
  if (destino === 'dm') return 'DM';
  return destino;
}

module.exports = {
  COR_FALA,
  criarEmbedFalar,
  criarBotoesFalar,
  falarDireto,
  enviarPainelFalar,
  falarInterativo,
  mostrarCategorias,
  mostrarCanaisDaCategoria,
  abrirBuscaCanal,
  processarBuscaCanal,
  abrirModalAqui,
  abrirModalCanal,
  abrirModalDM,
  mostrarPreview,
  confirmarEnvio,
  verificarSessao,
};
