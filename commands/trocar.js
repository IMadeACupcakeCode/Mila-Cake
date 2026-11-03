// 🔄 Troca de Pokémon entre treinadores.
// Fluxo: escolher Pokémon → escolher o do outro → os dois confirmam → troca concluída.
// Funciona por slash (`/trocar`) e por prefixo (`$p troca` ou `$troca`).
const pokemon = require('../utils/pokemon');
const db = require('../utils/db');
const { THEME } = require('../utils/theme');
const { criarEmbed } = require('../utils/theme');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const TEMPO_TROCA_MS = 3 * 60 * 1000;

function barraVida(vida) {
  const pct = Math.max(0, Math.min(1, vida.hp / Math.max(1, vida.hpMax)));
  const cheio = Math.round(pct * 10);
  return `${'█'.repeat(cheio)}${'░'.repeat(10 - cheio)} ${vida.hp}/${vida.hpMax}`;
}

function descreverCaptura(captura) {
  if (!captura) return 'Nenhum Pokémon escolhido';
  const species = pokemon.obterPokemonCacheSync(captura.pokemon_id);
  const vida = pokemon.estadoVidaPokemon(captura, species);
  const status = vida.statusNome ? ` · ${vida.statusEmoji} ${vida.statusNome}` : '';
  return `**${captura.name_pt}** \`#${captura.id}\` · Nv.${captura.level} · \`${barraVida(vida)}\`${status}`;
}

function colecaoDoUsuario(userId, guildId) {
  const doServidor = pokemon.listarColecao(userId, 250, 0, guildId).pokemon;
  return doServidor.length ? doServidor : pokemon.listarColecao(userId, 250).pokemon;
}

function normalizar(texto) {
  return pokemon.normalizarNome(String(texto || ''));
}

// Aceita ID da captura, posição na lista, nome em português ou nome oficial.
function acharCaptura(userId, guildId, texto) {
  const colecao = colecaoDoUsuario(userId, guildId);
  const alvo = String(texto || '').trim();
  if (!alvo) return { colecao, captura: null };
  const porId = colecao.find((item) => String(item.id) === alvo);
  if (porId) return { colecao, captura: porId };
  const indice = Number(alvo);
  if (Number.isInteger(indice) && indice >= 1 && indice <= colecao.length) {
    return { colecao, captura: colecao[indice - 1] };
  }
  const desejado = normalizar(alvo);
  const captura = colecao.find((item) =>
    normalizar(item.name_pt) === desejado ||
    normalizar(item.species_name) === desejado ||
    normalizar(item.name_pt).includes(desejado) ||
    normalizar(item.species_name).includes(desejado)
  );
  return { colecao, captura: captura || null };
}

function listaResumida(colecao, limite = 8) {
  return colecao.slice(0, limite).map((item, indice) => {
    const species = pokemon.obterPokemonCacheSync(item.pokemon_id);
    const vida = pokemon.estadoVidaPokemon(item, species);
    const status = vida.statusNome ? ` ${vida.statusEmoji}` : '';
    return `\`${indice + 1}.\` **${item.name_pt}** \`#${item.id}\` · Nv.${item.level} · ${vida.hp}/${vida.hpMax} HP${status}`;
  }).join('\n');
}

function embedGuia(user, alvo = null) {
  const minhas = colecaoDoUsuario(user.id, null).slice(0, 5);
  const campos = [
    {
      name: 'Como usar',
      value: [
        '`$p troca @pessoa <meu pokémon> [pokémon dela]`',
        '`/trocar usuario:@pessoa meu:<nome ou ID> dele:<opcional>`',
        '',
        'Também aceita a **posição** na sua lista: `$p troca @pessoa 1`.',
      ].join('\n'),
      inline: false,
    },
    {
      name: 'Como funciona',
      value: [
        '1️⃣ Você escolhe um Pokémon da sua coleção.',
        '2️⃣ A outra pessoa escolhe um Pokémon dela.',
        '3️⃣ **Os dois** confirmam nos botões.',
        '4️⃣ Só então a troca é concluída.',
        '',
        '❌ Se alguém recusar, ninguém perde nada. A vida e o status viajam com o Pokémon.',
      ].join('\n'),
      inline: false,
    },
  ];
  if (minhas.length) {
    campos.push({
      name: 'Seus Pokémon (primeiros 5)',
      value: minhas.map((item) => `**${item.name_pt}** \`#${item.id}\` · Nv.${item.level}`).join('\n'),
      inline: false,
    });
  }
  return criarEmbed({
    titulo: alvo ? '🔄 Troca de Pokémon' : '🔄 Como trocar Pokémon',
    descricao: alvo
      ? `Você quer trocar com **${alvo.globalName || alvo.username || 'outro treinador'}**. Escolha abaixo qual Pokémon oferecer.`
      : 'A troca é feita em etapas e só acontece quando **as duas pessoas confirmam**.',
    cor: THEME.corPrincipal,
    thumbnail: user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Pokémon · troca segura',
    campos,
  });
}

function montarEmbed({ user, alvo, meu, dele, confirmacoes, status }) {
  const confirmouIniciador = confirmacoes.has(user.id);
  const confirmouAlvo = confirmacoes.has(alvo.id);
  const linhas = [
    status || 'Escolham os Pokémon e confirmem a troca.',
    '',
    `🟣 **${user.globalName || user.username}** oferece:\n${meu ? descreverCaptura(meu) : '⚠️ escolha um Pokémon seu'}`,
    '',
    `🔵 **${alvo.globalName || alvo.username}** oferece:\n${dele ? descreverCaptura(dele) : '⚠️ escolha um Pokémon seu'}`,
    '',
    `${confirmouIniciador ? '✅' : '⬜'} ${user.globalName || user.username} confirmou`,
    `${confirmouAlvo ? '✅' : '⬜'} ${alvo.globalName || alvo.username} confirmou`,
  ];
  return criarEmbed({
    titulo: '🔄 Troca de Pokémon',
    descricao: linhas.join('\n'),
    cor: confirmouIniciador && confirmouAlvo ? THEME.corSucesso : THEME.corPrincipal,
    thumbnail: alvo.displayAvatarURL?.({ size: 128 }) || user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Só os dois treinadores podem usar os botões · 3 minutos',
  });
}

function montarComponentes({ estado, user, alvo, encerrada = false }) {
  if (encerrada) return [];
  const rows = [];
  const menuMeu = new StringSelectMenuBuilder()
    .setCustomId('troca_meu')
    .setPlaceholder('Seu Pokémon para oferecer')
    .addOptions(estado.colecaoIniciador.slice(0, 25).map((item) => {
      const species = pokemon.obterPokemonCacheSync(item.pokemon_id);
      const vida = pokemon.estadoVidaPokemon(item, species);
      return {
        label: `${item.name_pt} · Nv.${item.level}`,
        description: `#${item.id} · ${vida.hp}/${vida.hpMax} HP${vida.statusNome ? ` · ${vida.statusNome}` : ''}`.slice(0, 100),
        value: String(item.id),
        emoji: item.pokemon_id === estado.meu?.pokemon_id ? '🟣' : '🎒',
        default: estado.meu?.id === item.id,
      };
    }));
  rows.push(new ActionRowBuilder().addComponents(menuMeu));

  if (estado.colecaoAlvo.length) {
    const menuDele = new StringSelectMenuBuilder()
      .setCustomId('troca_dele')
      .setPlaceholder(`Pokémon de ${alvo.globalName || alvo.username}`)
      .addOptions(estado.colecaoAlvo.slice(0, 25).map((item) => {
        const species = pokemon.obterPokemonCacheSync(item.pokemon_id);
        const vida = pokemon.estadoVidaPokemon(item, species);
        return {
          label: `${item.name_pt} · Nv.${item.level}`,
          description: `#${item.id} · ${vida.hp}/${vida.hpMax} HP${vida.statusNome ? ` · ${vida.statusNome}` : ''}`.slice(0, 100),
          value: String(item.id),
          emoji: '🔵',
          default: estado.dele?.id === item.id,
        };
      }));
    rows.push(new ActionRowBuilder().addComponents(menuDele));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('troca_aceitar').setLabel('Aceitar troca').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('troca_recusar').setLabel('Recusar').setEmoji('❌').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}

function trocarDonos(meu, dele, user, alvo) {
  const transacao = db.db.transaction(() => {
    const meuAtual = db.db.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(Number(meu.id));
    const deleAtual = db.db.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(Number(dele.id));
    if (!meuAtual || !deleAtual) return { ok: false, motivo: 'sumiu' };
    if (String(meuAtual.user_id) !== String(user.id) || String(deleAtual.user_id) !== String(alvo.id)) {
      return { ok: false, motivo: 'mudou_de_dono' };
    }
    db.db.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?').run(String(alvo.id), Number(meu.id));
    db.db.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?').run(String(user.id), Number(dele.id));
    return { ok: true };
  });
  return transacao();
}

async function iniciarTroca(ctx, { alvo, meuTexto, deleTexto }) {
  const { user, guildId } = ctx;
  const responder = async (payload, ephemeral = false) => {
    if (ctx.isSlash) {
      if (ctx.interaction.deferred || ctx.interaction.replied) return ctx.interaction.editReply(payload);
      return ctx.interaction.reply({ ...payload, ephemeral, fetchReply: true });
    }
    return ctx.channel.send ? ctx.channel.send(payload) : ctx.message.reply(payload);
  };

  if (!alvo) {
    return responder({ embeds: [embedGuia(user)] }, true);
  }
  if (alvo.bot) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'Não troco com bots',
        descricao: 'Escolha um treinador de verdade. Exemplo:\n\n`$p troca @pessoa Pikachu`\n`/trocar usuario:@pessoa meu:Pikachu`',
        cor: THEME.corErro,
        thumbnail: user.displayAvatarURL?.({ size: 128 }),
        rodape: 'Mila Pokémon · troca',
      })],
    }, true);
  }
  if (alvo.id === user.id) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'Troca consigo mesmo?',
        descricao: 'Você não pode trocar um Pokémon com você mesmo. Marque outra pessoa:\n\n`$p troca @pessoa <seu pokémon>`',
        cor: THEME.corErro,
        rodape: 'Mila Pokémon · troca',
      })],
    }, true);
  }

  const colecaoIniciador = colecaoDoUsuario(user.id, guildId);
  if (!colecaoIniciador.length) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'Sua coleção está vazia',
        descricao: 'Você precisa capturar Pokémon antes de trocar. Use `/pokemon capturar` durante um encontro ou digite o nome do Pokémon selvagem no chat.',
        cor: THEME.corLembrete,
        rodape: 'Mila Pokémon · troca',
      })],
    }, true);
  }

  const { captura: meuInicial } = acharCaptura(user.id, guildId, meuTexto);
  const { captura: deleInicial } = acharCaptura(alvo.id, guildId, deleTexto);
  const estado = {
    colecaoIniciador,
    colecaoAlvo: colecaoDoUsuario(alvo.id, guildId),
    meu: meuInicial || null,
    dele: deleInicial || null,
    confirmacoes: new Set(),
  };

  if (!estado.colecaoAlvo.length) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'A outra pessoa não tem Pokémon',
        descricao: `**${alvo.globalName || alvo.username}** ainda não capturou nenhum Pokémon, então não há o que receber na troca.`,
        cor: THEME.corLembrete,
        rodape: 'Mila Pokémon · troca',
      })],
    }, true);
  }

  const montarPayload = (status) => ({
    embeds: [montarEmbed({
      user,
      alvo,
      meu: estado.meu,
      dele: estado.dele,
      confirmacoes: estado.confirmacoes,
      status,
    })],
    components: montarComponentes({ estado, user, alvo }),
    allowedMentions: { parse: [] },
  });

  let mensagem = null;
  if (ctx.isSlash) {
    if (ctx.interaction.deferred || ctx.interaction.replied) {
      mensagem = await ctx.interaction.editReply(montarPayload());
    } else {
      mensagem = await ctx.interaction.reply({ ...montarPayload(), fetchReply: true });
    }
  } else {
    const canal = ctx.channel || ctx.message?.channel;
    mensagem = await canal.send(montarPayload());
  }
  if (!mensagem?.createMessageComponentCollector) return mensagem;

  const coletor = mensagem.createMessageComponentCollector({
    time: TEMPO_TROCA_MS,
    filter: (interacao) => [user.id, alvo.id].includes(interacao.user.id),
  });

  let encerrada = false;
  const encerrar = async (status, cor, motivo) => {
    if (encerrada) return;
    encerrada = true;
    coletor.stop(motivo);
    const embed = criarEmbed({
      titulo: status,
      descricao: `**${user.globalName || user.username}** ↔ **${alvo.globalName || alvo.username}**\n\n${status === 'Troca concluída!'
        ? `🟣 ${descreverCaptura(estado.meu)}\nagora é de **${alvo.globalName || alvo.username}**.\n\n🔵 ${descreverCaptura(estado.dele)}\nagora é de **${user.globalName || user.username}**.`
        : 'Nenhum Pokémon foi movido. Vocês podem tentar de novo quando quiserem.'}`,
      cor,
      thumbnail: alvo.displayAvatarURL?.({ size: 128 }) || user.displayAvatarURL?.({ size: 128 }),
      rodape: 'Mila Pokémon · troca segura',
    });
    try {
      await mensagem.edit({ embeds: [embed], components: [] });
    } catch { /* a mensagem pode ter sido apagada */ }
  };

  coletor.on('collect', async (interacao) => {
    try {
      if (encerrada) return;
      if (interacao.isStringSelectMenu?.() && interacao.customId === 'troca_meu') {
        if (interacao.user.id !== user.id) {
          return interacao.reply({ content: 'Só quem iniciou a troca escolhe esse lado.', ephemeral: true });
        }
        const escolhido = estado.colecaoIniciador.find((item) => String(item.id) === interacao.values[0]);
        if (escolhido) estado.meu = escolhido;
        return interacao.update(montarPayload());
      }
      if (interacao.isStringSelectMenu?.() && interacao.customId === 'troca_dele') {
        if (interacao.user.id !== alvo.id) {
          return interacao.reply({ content: 'Esse lado é do outro treinador. Ele escolhe o próprio Pokémon.', ephemeral: true });
        }
        const escolhido = estado.colecaoAlvo.find((item) => String(item.id) === interacao.values[0]);
        if (escolhido) estado.dele = escolhido;
        return interacao.update(montarPayload());
      }
      if (interacao.customId === 'troca_recusar') {
        return encerrar('Troca cancelada', THEME.corSecundario, 'recusada');
      }
      if (interacao.customId === 'troca_aceitar') {
        if (!estado.meu) {
          return interacao.reply({ content: 'Escolha primeiro qual Pokémon você vai oferecer.', ephemeral: true });
        }
        if (!estado.dele) {
          return interacao.reply({ content: 'O outro treinador ainda precisa escolher o Pokémon dele.', ephemeral: true });
        }
        if (!estado.confirmacoes.has(interacao.user.id)) {
          estado.confirmacoes.add(interacao.user.id);
        }
        if (estado.confirmacoes.size < 2) {
          return interacao.update(montarPayload('Falta só uma confirmação para concluir.'));
        }
        const resultado = trocarDonos(estado.meu, estado.dele, user, alvo);
        if (!resultado.ok) {
          return encerrar(
            'A troca não pôde ser concluída',
            THEME.corErro,
            'invalida'
          );
        }
        return encerrar('Troca concluída!', THEME.corSucesso, 'concluida');
      }
    } catch (erro) {
      console.error('[Troca] Falha ao processar a troca:', erro?.message || erro);
      try {
        if (!interacao.deferred && !interacao.replied) {
          await interacao.reply({ content: 'Não consegui processar essa ação. Tente novamente.', ephemeral: true });
        }
      } catch { /* ignora */ }
    }
  });

  coletor.on('end', async (_, motivo) => {
    if (encerrada) return;
    encerrada = true;
    try {
      await mensagem.edit({
        embeds: [criarEmbed({
          titulo: 'Troca expirada',
          descricao: 'O tempo acabou e nenhum Pokémon foi movido. Use `$p troca` para começar de novo quando quiser.',
          cor: THEME.corSecundario,
          rodape: 'Mila Pokémon · troca segura',
        })],
        components: [],
      });
    } catch { /* ignora */ }
  });
  return mensagem;
}

module.exports = {
  data: {
    name: 'trocar',
    description: 'Troque Pokémon com outro treinador (os dois confirmam)',
    options: [
      { type: 6, name: 'usuario', description: 'Treinador com quem trocar', required: false },
      { type: 3, name: 'meu', description: 'Seu Pokémon (nome, ID ou posição)', required: false },
      { type: 3, name: 'dele', description: 'Pokémon do outro (nome, ID ou posição)', required: false },
    ],
  },

  async execute(interaction, client) {
    const ctx = {
      isSlash: true,
      interaction,
      client,
      user: interaction.user,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    };
    return iniciarTroca(ctx, {
      alvo: interaction.options?.getUser('usuario') || null,
      meuTexto: interaction.options?.getString('meu') || '',
      deleTexto: interaction.options?.getString('dele') || '',
    });
  },

  async executePrefix(message, args = [], client) {
    const ctx = {
      isSlash: false,
      message,
      client,
      user: message.author,
      guildId: message.guildId,
      channelId: message.channelId,
      channel: message.channel,
    };
    const mencao = message.mentions?.users?.first?.() || null;
    const restante = args.filter((item) => !/^<@!?\d+>$/.test(String(item)));
    return iniciarTroca(ctx, {
      alvo: mencao,
      meuTexto: restante[0] || '',
      deleTexto: restante.slice(1).join(' ') || '',
    });
  },

  iniciarTroca,
};
