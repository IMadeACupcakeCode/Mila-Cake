// 🎁 Doação de Pokémon entre treinadores.
// Fluxo: doador escolhe um Pokémon → receptor aceita → transferência concluída.
// Funciona por slash (`/doar-pokemon`) e por prefixo (`$doar-pokemon` ou `$p doar`).
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

const TEMPO_DOACAO_MS = 3 * 60 * 1000;

function descreverCaptura(captura) {
  if (!captura) return 'Nenhum Pokémon escolhido';
  const species = pokemon.obterPokemonCacheSync(captura.pokemon_id);
  const vida = pokemon.estadoVidaPokemon(captura, species);
  const status = vida.statusNome ? ` · ${vida.statusEmoji} ${vida.statusNome}` : '';
  return `**${captura.name_pt}** \`#${captura.id}\` · Nv.${captura.level} · \`${vida.hp}/${vida.hpMax} HP\`${status}`;
}

function colecaoDoUsuario(userId, guildId) {
  const doServidor = pokemon.listarColecao(userId, 250, 0, guildId).pokemon;
  return doServidor.length ? doServidor : pokemon.listarColecao(userId, 250).pokemon;
}

function normalizar(texto) {
  return pokemon.normalizarNome(String(texto || ''));
}

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
        '`$p doar @pessoa <meu pokémon>`',
        '`/doar-pokemon usuario:@pessoa pokemon:<nome ou ID>`',
        '',
        'Também aceita a **posição** na sua lista: `$p doar @pessoa 1`.',
      ].join('\n'),
      inline: false,
    },
    {
      name: 'Como funciona',
      value: [
        '1️⃣ Você escolhe um Pokémon da sua coleção.',
        '2️⃣ A outra pessoa **aceita** o presente nos botões.',
        '3️⃣ Só então o Pokémon é transferido.',
        '',
        '❌ Se alguém recusar ou o tempo acabar, ninguém perde nada. A vida e o status viajam com o Pokémon.',
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
    titulo: alvo ? '🎁 Doação de Pokémon' : '🎁 Como doar Pokémon',
    descricao: alvo
      ? `Você quer doar um Pokémon para **${alvo.globalName || alvo.username || 'outro treinador'}**. Escolha abaixo qual Pokémon oferecer.`
      : 'A doação é feita em etapas e só acontece quando **o receptor aceita**.',
    cor: THEME.corPrincipal,
    thumbnail: user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Pokémon · doação segura',
    campos,
  });
}

function montarEmbed({ user, alvo, captura, doadorConfirmou, receptorAceitou, status }) {
  const linhas = [
    status || 'Escolha um Pokémon seu e confirme a doação. A outra pessoa precisa aceitar.',
    '',
    `🎁 **${user.globalName || user.username}** oferece:`,
    captura ? descreverCaptura(captura) : '⚠️ escolha um Pokémon seu',
    '',
    `👤 **${alvo.globalName || alvo.username}** ${receptorAceitou ? 'aceitou o presente ✅' : 'ainda não respondeu'}`,
    '',
    `${doadorConfirmou ? '✅' : '⬜'} ${user.globalName || user.username} confirmou a doação`,
    `${receptorAceitou ? '✅' : '⬜'} ${alvo.globalName || alvo.username} aceitou o presente`,
  ];
  return criarEmbed({
    titulo: '🎁 Doação de Pokémon',
    descricao: linhas.join('\n'),
    cor: doadorConfirmou && receptorAceitou ? THEME.corSucesso : THEME.corPrincipal,
    thumbnail: alvo.displayAvatarURL?.({ size: 128 }) || user.displayAvatarURL?.({ size: 128 }),
    rodape: 'Só os dois treinadores podem usar os botões · 3 minutos',
  });
}

function montarComponentes({ estado, user, alvo, encerrada = false }) {
  if (encerrada) return [];
  const rows = [];
  const menu = new StringSelectMenuBuilder()
    .setCustomId('doar_escolher')
    .setPlaceholder('Seu Pokémon para doar')
    .addOptions(estado.colecaoDoador.slice(0, 25).map((item) => {
      const species = pokemon.obterPokemonCacheSync(item.pokemon_id);
      const vida = pokemon.estadoVidaPokemon(item, species);
      return {
        label: `${item.name_pt} · Nv.${item.level}`,
        description: `#${item.id} · ${vida.hp}/${vida.hpMax} HP${vida.statusNome ? ` · ${vida.statusNome}` : ''}`.slice(0, 100),
        value: String(item.id),
        emoji: '🎁',
        default: estado.captura?.id === item.id,
      };
    }));
  rows.push(new ActionRowBuilder().addComponents(menu));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('doar_confirmar').setLabel('Confirmar doação').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(!estado.captura),
    new ButtonBuilder().setCustomId('doar_aceitar').setLabel('Aceitar presente').setEmoji('🤝').setStyle(ButtonStyle.Primary).setDisabled(!estado.captura),
    new ButtonBuilder().setCustomId('doar_recusar').setLabel('Recusar/Cancelar').setEmoji('❌').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}

function transferir(captura, user, alvo) {
  const transacao = db.db.transaction(() => {
    const atual = db.db.prepare('SELECT user_id FROM pokemon_collection WHERE id = ?').get(Number(captura.id));
    if (!atual || String(atual.user_id) !== String(user.id)) {
      return { ok: false, motivo: 'mudou_de_dono' };
    }
    const prefs = pokemon.obterPreferencias(user.id);
    const team = Array.isArray(prefs.team) ? prefs.team.filter((id) => Number(id) !== Number(captura.id)) : [];
    pokemon.salvarPreferencias(user.id, { team });
    db.db.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?').run(String(alvo.id), Number(captura.id));
    return { ok: true };
  });
  return transacao();
}

async function iniciarDoacao(ctx, { alvo, pokemonTexto }) {
  const { user, guildId } = ctx;
  const responder = async (payload, ephemeral = false) => {
    if (ctx.isSlash) {
      if (ctx.interaction.deferred || ctx.interaction.replied) return ctx.interaction.editReply(payload);
      return ctx.interaction.reply({ ...payload, ephemeral, fetchReply: true });
    }
    const canal = ctx.channel || ctx.message?.channel;
    return canal && typeof canal.send === 'function' ? canal.send(payload) : ctx.message.reply(payload);
  };

  if (!alvo) {
    return responder({ embeds: [embedGuia(user)] }, true);
  }
  if (alvo.bot) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'Não doo para bots',
        descricao: 'Escolha um treinador de verdade. Exemplo:\n\n`$p doar @pessoa Pikachu`\n`/doar-pokemon usuario:@pessoa pokemon:Pikachu`',
        cor: THEME.corErro,
        thumbnail: user.displayAvatarURL?.({ size: 128 }),
        rodape: 'Mila Pokémon · doação',
      })],
    }, true);
  }
  if (alvo.id === user.id) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'Doar para si mesmo?',
        descricao: 'Você não pode doar um Pokémon para você mesmo. Marque outra pessoa:\n\n`$p doar @pessoa <seu pokémon>`',
        cor: THEME.corErro,
        rodape: 'Mila Pokémon · doação',
      })],
    }, true);
  }

  const colecaoDoador = colecaoDoUsuario(user.id, guildId);
  if (!colecaoDoador.length) {
    return responder({
      embeds: [criarEmbed({
        titulo: 'Sua coleção está vazia',
        descricao: 'Você precisa capturar Pokémon antes de doar. Use `/pokemon capturar` durante um encontro.',
        cor: THEME.corLembrete,
        rodape: 'Mila Pokémon · doação',
      })],
    }, true);
  }

  const { captura: inicial } = acharCaptura(user.id, guildId, pokemonTexto);
  const estado = {
    colecaoDoador,
    captura: inicial || null,
    doadorConfirmou: false,
    receptorAceitou: false,
    encerrada: false,
  };

  const montarPayload = (status) => ({
    embeds: [montarEmbed({
      user,
      alvo,
      captura: estado.captura,
      doadorConfirmou: estado.doadorConfirmou,
      receptorAceitou: estado.receptorAceitou,
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
    time: TEMPO_DOACAO_MS,
    filter: (interacao) => [user.id, alvo.id].includes(interacao.user.id),
  });

  const encerrar = async (titulo, cor, motivo, sucesso = false) => {
    if (estado.encerrada) return;
    estado.encerrada = true;
    coletor.stop(motivo);
    const descricao = sucesso
      ? `🎁 **${user.globalName || user.username}** doou ${descreverCaptura(estado.captura)} para **${alvo.globalName || alvo.username}**.\n\nO Pokémon agora faz parte da coleção do receptor. A vida e o status viajaram com ele.`
      : 'Nenhum Pokémon foi movido. Vocês podem tentar de novo quando quiserem.';
    const embed = criarEmbed({
      titulo,
      descricao,
      cor,
      thumbnail: alvo.displayAvatarURL?.({ size: 128 }) || user.displayAvatarURL?.({ size: 128 }),
      rodape: 'Mila Pokémon · doação segura',
    });
    try {
      await mensagem.edit({ embeds: [embed], components: [] });
    } catch { /* a mensagem pode ter sido apagada */ }
  };

  const tentarTransferir = async () => {
    if (!estado.captura || !estado.doadorConfirmou || !estado.receptorAceitou || estado.encerrada) return;
    estado.encerrada = true;
    const resultado = transferir(estado.captura, user, alvo);
    if (!resultado.ok) {
      estado.encerrada = false;
      return encerrar('A doação não pôde ser concluída', THEME.corErro, 'invalida');
    }
    return encerrar('Doação concluída!', THEME.corSucesso, 'concluida', true);
  };

  coletor.on('collect', async (interacao) => {
    try {
      if (estado.encerrada) return;
      if (interacao.isStringSelectMenu?.() && interacao.customId === 'doar_escolher') {
        if (interacao.user.id !== user.id) {
          return interacao.reply({ content: 'Só quem está doando escolhe o Pokémon.', ephemeral: true });
        }
        const escolhido = estado.colecaoDoador.find((item) => String(item.id) === interacao.values[0]);
        if (escolhido) {
          estado.captura = escolhido;
          estado.doadorConfirmou = false;
          estado.receptorAceitou = false;
        }
        return interacao.update(montarPayload());
      }
      if (interacao.customId === 'doar_recusar') {
        return encerrar('Doação cancelada', THEME.corSecundario, 'recusada');
      }
      if (interacao.customId === 'doar_confirmar') {
        if (interacao.user.id !== user.id) {
          return interacao.reply({ content: 'Só quem está doando pode confirmar.', ephemeral: true });
        }
        if (!estado.captura) {
          return interacao.reply({ content: 'Escolha primeiro qual Pokémon você vai doar.', ephemeral: true });
        }
        if (!estado.doadorConfirmou) estado.doadorConfirmou = true;
        if (estado.doadorConfirmou && estado.receptorAceitou) {
          return tentarTransferir();
        }
        return interacao.update(montarPayload('Falta só a outra pessoa aceitar o presente.'));
      }
      if (interacao.customId === 'doar_aceitar') {
        if (interacao.user.id !== alvo.id) {
          return interacao.reply({ content: 'Só quem vai receber pode aceitar o presente.', ephemeral: true });
        }
        if (!estado.captura) {
          return interacao.reply({ content: 'O doador ainda não escolheu o Pokémon.', ephemeral: true });
        }
        if (!estado.receptorAceitou) estado.receptorAceitou = true;
        if (estado.doadorConfirmou && estado.receptorAceitou) {
          return tentarTransferir();
        }
        return interacao.update(montarPayload('Falta só o doador confirmar a doação.'));
      }
    } catch (erro) {
      console.error('[Doação Pokémon] Falha ao processar:', erro?.message || erro);
      try {
        if (!interacao.deferred && !interacao.replied) {
          await interacao.reply({ content: 'Não consegui processar essa ação. Tente novamente.', ephemeral: true });
        }
      } catch { /* ignora */ }
    }
  });

  coletor.on('end', async (_, motivo) => {
    if (estado.encerrada) return;
    estado.encerrada = true;
    try {
      await mensagem.edit({
        embeds: [criarEmbed({
          titulo: 'Doação expirada',
          descricao: 'O tempo acabou e nenhum Pokémon foi movido. Use `$p doar` para começar de novo quando quiser.',
          cor: THEME.corSecundario,
          rodape: 'Mila Pokémon · doação segura',
        })],
        components: [],
      });
    } catch { /* ignora */ }
  });

  return mensagem;
}

module.exports = {
  data: {
    name: 'doar-pokemon',
    description: 'Doe um Pokémon para outro treinador (o receptor precisa aceitar)',
    options: [
      { type: 6, name: 'usuario', description: 'Treinador que vai receber', required: false },
      { type: 3, name: 'pokemon', description: 'Seu Pokémon (nome, ID ou posição)', required: false },
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
    return iniciarDoacao(ctx, {
      alvo: interaction.options?.getUser('usuario') || null,
      pokemonTexto: interaction.options?.getString('pokemon') || '',
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
    const restante = (args || []).filter((item) => !/^<@!?\d+>$/.test(String(item)));
    return iniciarDoacao(ctx, {
      alvo: mencao,
      pokemonTexto: restante.join(' ').trim(),
    });
  },
  iniciarDoacao,
};
