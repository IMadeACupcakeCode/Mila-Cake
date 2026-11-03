const crypto = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const pokemon = require('./pokemon');
const battle = require('./pokemonBattle');
const { THEME } = require('./theme');

const sessions = new Map();
const playerSessions = new Map();
const TEAM_PAGE_SIZE = 10;
const SESSION_TTL_MS = 15 * 60 * 1000;
const INVITATION_TTL_MS = 2 * 60 * 1000;
const BADGES_PER_PAGE = 4;
const BADGE_NAV_TTL_MS = 5 * 60 * 1000;
const BUTTON_PREFIX = 'pb:';

function nomeJogador(ctx, userId) {
  return ctx.client?.users?.cache?.get(userId)?.globalName ||
    ctx.client?.users?.cache?.get(userId)?.username ||
    `<@${userId}>`;
}

function enviar(ctx, payload, ephemeral = false) {
  if (ctx.isSlash) return ctx.interaction.reply({ ...payload, ephemeral });
  return ctx.reply(payload);
}

function atualizarMensagem(sessao, payload) {
  if (!sessao.message?.edit) throw new Error('A mensagem desta batalha não está mais disponível.');
  return sessao.message.edit(payload);
}

function embedBase(titulo, descricao, cor = THEME.corPrincipal) {
  return new EmbedBuilder()
    .setColor(cor)
    .setTitle(titulo)
    .setDescription(descricao)
    .setFooter({ text: 'Mila Pokémon · batalhas e insígnias' });
}

function customId(id, acao, valor = '') {
  return `${BUTTON_PREFIX}${id}:${acao}${valor === '' ? '' : `:${valor}`}`;
}

function filaUsuario(sessao, userId) {
  if (sessao.kind === 'duel') return [sessao.challengerId, sessao.opponentId].includes(userId);
  return sessao.playerId === userId;
}

function limparSessao(sessao) {
  if (sessao.timer) clearTimeout(sessao.timer);
  sessions.delete(sessao.id);
  for (const userId of sessao.participants) {
    if (playerSessions.get(userId) === sessao.id) playerSessions.delete(userId);
  }
}

function armarTimer(sessao, ms = SESSION_TTL_MS) {
  if (sessao.timer) clearTimeout(sessao.timer);
  sessao.timer = setTimeout(() => {
    if (!sessions.has(sessao.id)) return;
    const eraConvite = sessao.status === 'invited';
    sessao.status = 'expired';
    const texto = eraConvite
      ? 'O convite expirou sem resposta.'
      : 'A batalha expirou por inatividade.';
    Promise.resolve()
      .then(() => atualizarMensagem(sessao, {
        embeds: [embedBase('Batalha encerrada', texto, THEME.corErro)],
        components: [],
      }))
      .catch((erro) => console.error('[Pokémon] Não foi possível atualizar uma batalha expirada:', erro.message));
    limparSessao(sessao);
  }, ms);
  sessao.timer.unref?.();
}

function criarBotoesConvite(id) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId(id, 'accept')).setLabel('Aceitar duelo').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(customId(id, 'decline')).setLabel('Recusar').setStyle(ButtonStyle.Secondary)
  )];
}

function estadoDaEquipe(sessao, userId) {
  const pronta = sessao.teams.has(userId);
  return pronta ? `✅ <@${userId}> escolheu a equipe.` : `⏳ <@${userId}> ainda está montando a equipe.`;
}

function embedSelecaoEquipe(sessao) {
  const jogadores = sessao.kind === 'duel'
    ? [sessao.challengerId, sessao.opponentId]
    : [sessao.playerId];
  const elegivel = sessao.kind === 'gym'
    ? `\n\nPara ganhar a insígnia, inclua ao menos um Pokémon desta lista: ${sessao.gym.pokemonPermitidosNomes}.`
    : '';
  const formato = sessao.kind === 'gym'
    ? `${sessao.teamSize} Pokémon × ${sessao.gym.equipe.length} do ginásio`
    : `${sessao.teamSize}×${sessao.teamSize}`;
  return embedBase(
    sessao.kind === 'gym' ? `Ginásio · ${sessao.gym.nome}` : 'Duelo Pokémon · seleção de equipe',
    `Escolha **${sessao.teamSize} Pokémon** da sua coleção. Formato: **${formato}**; nível fixo **${battle.LEVEL_BATALHA}**.${elegivel}\n\n${jogadores.map((id) => estadoDaEquipe(sessao, id)).join('\n')}`
  );
}

function criarBotoesEquipe(sessao, userId, page = 0) {
  const draft = sessao.drafts.get(userId);
  const equipe = pokemon.listarColecao(userId, 250).pokemon;
  const inicio = page * TEAM_PAGE_SIZE;
  const itens = equipe.slice(inicio, inicio + TEAM_PAGE_SIZE);
  const rows = [];

  for (let linha = 0; linha < 2; linha += 1) {
    const buttons = itens.slice(linha * 5, linha * 5 + 5).map((item) => {
      const selecionado = draft.selected.has(Number(item.id));
      const rotulo = `${selecionado ? '✓ ' : ''}${Number(item.shiny) ? '✨ ' : ''}${item.name_pt || `#${item.pokemon_id}`}`.slice(0, 80);
      return new ButtonBuilder()
        .setCustomId(customId(sessao.id, 'pick', item.id))
        .setLabel(rotulo)
        .setStyle(selecionado ? ButtonStyle.Success : ButtonStyle.Secondary);
    });
    if (buttons.length) rows.push(new ActionRowBuilder().addComponents(...buttons));
  }

  const totalPaginas = Math.max(1, Math.ceil(equipe.length / TEAM_PAGE_SIZE));
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(sessao.id, 'page-prev', Math.max(0, page - 1)))
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(customId(sessao.id, 'page-next', Math.min(totalPaginas - 1, page + 1)))
      .setLabel(`Página ${page + 1}/${totalPaginas}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPaginas - 1),
    new ButtonBuilder()
      .setCustomId(customId(sessao.id, 'picker-cancel'))
      .setLabel('Fechar')
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(nav);
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(sessao.id, 'team-done'))
      .setLabel(`Confirmar equipe · ${draft.selected.size}/${sessao.teamSize}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(draft.selected.size !== sessao.teamSize)
  ));
  return { equipe, rows };
}

async function iniciarBatalha(sessao) {
  if (sessao.kind === 'gym') {
    sessao.teams.set(sessao.npcId, await battle.prepararEquipeDoGinasio(sessao.gym.id));
  }
  sessao.status = 'battle';
  sessao.activeIndices = new Map(Array.from(sessao.teams.keys(), (id) => [id, 0]));
  sessao.actions = new Map();
  sessao.turns = 0;
  armarTimer(sessao);
  await atualizarMensagem(sessao, {
    embeds: [montarEmbedBatalha(sessao, ['A batalha começou! Escolham uma ação.'])],
    components: botoesBatalha(sessao),
    allowedMentions: { parse: [] },
  });
}

function ladoDoJogador(sessao, userId) {
  if (sessao.kind === 'gym') {
    return userId === sessao.playerId ? sessao.playerId : sessao.npcId;
  }
  return userId === sessao.challengerId ? sessao.challengerId : sessao.opponentId;
}

function equipeAtiva(sessao, userId) {
  const id = ladoDoJogador(sessao, userId);
  const equipe = sessao.teams.get(id);
  const ativoIndice = sessao.activeIndices.get(id) || 0;
  return { id, equipe, ativoIndice, ativo: equipe?.[ativoIndice] };
}

function barraHp(pokemonAtual) {
  const proporcao = pokemonAtual.hp / pokemonAtual.hpMax;
  const preenchidos = Math.max(0, Math.min(12, Math.ceil(proporcao * 12)));
  const emoji = proporcao > 0.5 ? '🟩' : proporcao > 0.2 ? '🟨' : '🟥';
  return `${emoji.repeat(preenchidos)}${'⬛'.repeat(12 - preenchidos)} **${pokemonAtual.hp}/${pokemonAtual.hpMax} HP**`;
}

function resumoEquipe(equipe, indiceAtivo) {
  return equipe.map((item, index) => {
    const estado = item.hp <= 0 ? '✖' : index === indiceAtivo ? '▶' : '•';
    return `${estado} ${item.nome}${item.shiny ? ' ✨' : ''}`;
  }).join('\n');
}

function montarEmbedBatalha(sessao, linhas = []) {
  const ids = sessao.kind === 'gym'
    ? [sessao.playerId, sessao.npcId]
    : [sessao.challengerId, sessao.opponentId];
  const descricao = [
    `**Turno ${sessao.turns + 1}** · ${sessao.kind === 'gym' ? `${sessao.teamSize} contra ${sessao.gym.equipe.length}` : `formato ${sessao.teamSize}×${sessao.teamSize}`}`,
    ...linhas,
    ...ids.map((userId) => {
      const equipe = sessao.teams.get(userId);
      if (!equipe) return '';
      const ativoIndice = sessao.activeIndices?.get(userId) || 0;
      const ativo = equipe[ativoIndice];
      const status = ativo.status ? ` · ${battle.STATUS_NOMES[ativo.status]}` : '';
      return `\n**${userId === sessao.npcId ? sessao.gym.lider : nomeJogador({ client: sessao.client }, userId)}** · ${ativo.nome}${ativo.shiny ? ' ✨' : ''} · ${ativo.tipos.join('/')}${status}\n${barraHp(ativo)}`;
    }).filter(Boolean),
  ].filter(Boolean).join('\n');
  const embed = embedBase(sessao.kind === 'gym' ? `Ginásio · ${sessao.gym.nome}` : 'Duelo Pokémon', descricao);
  for (const userId of ids) {
    const equipe = sessao.teams.get(userId);
    if (!equipe) continue;
    embed.addFields({
      name: userId === sessao.npcId ? `Equipe de ${sessao.gym.lider}` : `Equipe de ${nomeJogador({ client: sessao.client }, userId)}`,
      value: resumoEquipe(equipe, sessao.activeIndices?.get(userId) || 0),
      inline: true,
    });
  }
  const ativo = sessao.teams.get(ids[0])?.[sessao.activeIndices?.get(ids[0]) || 0];
  if (ativo?.animatedUrl || ativo?.imageUrl) embed.setImage(ativo.animatedUrl || ativo.imageUrl);
  return embed;
}

function botoesBatalha(sessao) {
  const jogadores = sessao.kind === 'gym'
    ? [sessao.playerId]
    : [sessao.challengerId, sessao.opponentId];
  const rows = [new ActionRowBuilder().addComponents(
    ...jogadores.map((userId) => new ButtonBuilder()
      .setCustomId(customId(sessao.id, 'action', userId))
      .setLabel(sessao.actions.has(userId) ? 'Ação escolhida ✓' : `Ação de ${nomeJogador({ client: sessao.client }, userId)}`)
      .setStyle(sessao.actions.has(userId) ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(sessao.actions.has(userId))),
    new ButtonBuilder()
      .setCustomId(customId(sessao.id, 'forfeit'))
      .setLabel('Desistir')
      .setStyle(ButtonStyle.Danger)
  )];
  return rows;
}

function criarMenuAcoes(sessao, userId) {
  const { equipe, ativoIndice, ativo } = equipeAtiva(sessao, userId);
  if (!ativo || ativo.hp <= 0) throw new Error('Seu Pokémon ativo não pode continuar lutando.');
  const opcoes = ativo.moves
    .map((golpe, index) => ({ golpe, index }))
    .filter(({ golpe }) => golpe.ppAtual > 0)
    .map(({ golpe, index }) => ({
      label: `${golpe.nome} · ${golpe.ppAtual}/${golpe.pp} PP`.slice(0, 100),
      description: `${golpe.tipo} · ${golpe.categoria}${golpe.poder ? ` · poder ${golpe.poder}` : ''}`.slice(0, 100),
      value: `move:${index}`,
    }));
  if (!opcoes.length) {
    opcoes.push({
      label: 'Luta (sem PP)',
      description: 'Um último golpe físico quando todos os PP acabarem.',
      value: 'struggle',
    });
  }
  equipe.forEach((pokemonAtual, index) => {
    if (index === ativoIndice || pokemonAtual.hp <= 0) return;
    opcoes.push({
      label: `Trocar para ${pokemonAtual.nome}${pokemonAtual.shiny ? ' ✨' : ''}`.slice(0, 100),
      description: `HP ${pokemonAtual.hp}/${pokemonAtual.hpMax}`,
      value: `switch:${pokemonAtual.collectionId}`,
    });
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId(sessao.id, 'choose'))
      .setPlaceholder(`Ação de ${ativo.nome}`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(opcoes.slice(0, 25))
  );
}

function selecionarAcao(sessao, userId, value) {
  if (value === 'struggle') return {
    tipo: 'move',
    struggle: true,
    activeIndex: equipeAtiva(sessao, userId).ativoIndice,
  };
  const [tipo, indice] = value.split(':');
  if (tipo === 'move') {
    const indiceGolpe = Number(indice);
    const ativo = equipeAtiva(sessao, userId).ativo;
    if (!Number.isInteger(indiceGolpe) || !ativo?.moves[indiceGolpe] || ativo.moves[indiceGolpe].ppAtual < 1) {
      throw new Error('Esse golpe não está disponível. Abra o menu e escolha outro.');
    }
    return { tipo, indiceGolpe, activeIndex: equipeAtiva(sessao, userId).ativoIndice };
  }
  if (tipo === 'switch') {
    const { equipe, ativoIndice } = equipeAtiva(sessao, userId);
    const indiceAlvo = equipe.findIndex((item) => item.collectionId === Number(indice));
    if (indiceAlvo < 0 || indiceAlvo === ativoIndice || equipe[indiceAlvo].hp <= 0) {
      throw new Error('Esse Pokémon não pode entrar em campo.');
    }
    return { tipo, indiceAlvo };
  }
  throw new Error('Ação de batalha inválida.');
}

function mensagemGolpe(sessao, quem, acao, linhas) {
  const equipe = sessao.teams.get(quem);
  const ativo = equipe[sessao.activeIndices.get(quem) || 0];
  if (!acao || acao.tipo !== 'move' || !ativo || ativo.hp <= 0) return;
  if (acao.struggle) {
    ativo.moves.push({
      nome: 'Luta',
      nomeOriginal: 'struggle',
      tipo: 'normal',
      categoria: 'physical',
      poder: 50,
      precisao: 100,
      pp: 1,
      ppAtual: 1,
      prioridade: 0,
      ailment: 'none',
      ailmentChance: 0,
      statChanges: [],
      alvo: 'selected-pokemon',
    });
    acao.indiceGolpe = ativo.moves.length - 1;
    acao.struggle = false;
  }
  const status = battle.iniciarTurno(ativo);
  linhas.push(...status.linhas);
  if (!status.podeAgir) return;
  const oponenteId = sessao.kind === 'gym'
    ? quem === sessao.playerId ? sessao.npcId : sessao.playerId
    : quem === sessao.challengerId ? sessao.opponentId : sessao.challengerId;
  const oponenteEquipe = sessao.teams.get(oponenteId);
  const defensor = oponenteEquipe[ sessao.activeIndices.get(oponenteId) || 0 ];
  const resultado = battle.resolverGolpe(ativo, defensor, acao.indiceGolpe);
  linhas.push(...resultado.linhas);
  if (defensor.hp <= 0) {
    linhas.push(`💫 **${defensor.nome}** não pode mais lutar!`);
    const proximo = battle.escolherProximoVivo(oponenteEquipe, sessao.activeIndices.get(oponenteId) || 0);
    if (proximo >= 0) {
      sessao.activeIndices.set(oponenteId, proximo);
      linhas.push(`➡️ ${oponenteEquipe[proximo].nome} entrou em campo.`);
    }
  }
}

function escolherGolpeDoLider(sessao) {
  const equipe = sessao.teams.get(sessao.npcId);
  const ativo = equipe[sessao.activeIndices.get(sessao.npcId) || 0];
  const defensor = sessao.teams.get(sessao.playerId)[sessao.activeIndices.get(sessao.playerId) || 0];
  const disponiveis = ativo.moves
    .map((golpe, index) => ({ golpe, index }))
    .filter(({ golpe }) => golpe.ppAtual > 0);
  if (!disponiveis.length) {
    return { tipo: 'move', struggle: true, activeIndex: sessao.activeIndices.get(sessao.npcId) || 0 };
  }
  disponiveis.sort((a, b) => {
    const pontuar = ({ golpe }) => {
      const efetividade = battle.multiplicadorTipo(golpe.tipo, defensor.tipos);
      const stab = ativo.tipos.includes(golpe.tipo) ? 1.5 : 1;
      const poder = golpe.poder > 0 ? golpe.poder : 12;
      const precisao = golpe.precisao / 100;
      const efeito = (golpe.ailmentChance / 100) * 8 + golpe.statChanges.length * 2;
      return (poder * efetividade * stab * precisao) + golpe.prioridade * 5 + efeito;
    };
    return pontuar(b) - pontuar(a);
  });
  return {
    tipo: 'move',
    indiceGolpe: disponiveis[0].index,
    activeIndex: sessao.activeIndices.get(sessao.npcId) || 0,
  };
}

function resolverAcaoTroca(sessao, userId, acao, linhas) {
  if (acao.tipo !== 'switch') return;
  const equipe = sessao.teams.get(userId);
  const indice = equipe.findIndex((item) => item.collectionId === acao.indiceAlvo);
  if (!battle.trocarAtivo(equipe, indice)) {
    linhas.push('A troca não pôde ser realizada.');
    return;
  }
  sessao.activeIndices.set(userId, indice);
  linhas.push(`🔁 **${equipe[indice].nome}** entrou em campo!`);
}

async function resolverTurno(sessao) {
  if (sessao.resolving || sessao.actions.size < (sessao.kind === 'gym' ? 1 : 2)) return;
  sessao.resolving = true;
  try {
    const jogadores = sessao.kind === 'gym'
      ? [sessao.playerId, sessao.npcId]
      : [sessao.challengerId, sessao.opponentId];
    if (sessao.kind === 'gym') {
      sessao.actions.set(sessao.npcId, escolherGolpeDoLider(sessao));
    }
    const [id1, id2] = jogadores;
    const ordem = battle.ordenarEscolhas(
      sessao.teams.get(id1),
      { ...sessao.actions.get(id1), ativoIndice: sessao.activeIndices.get(id1) || 0 },
      sessao.teams.get(id2),
      { ...sessao.actions.get(id2), ativoIndice: sessao.activeIndices.get(id2) || 0 }
    );
    const ordemIds = ordem === 0 ? [id1, id2] : [id2, id1];
    const linhas = [];
    for (const userId of ordemIds) {
      const acao = sessao.actions.get(userId);
      const equipe = sessao.teams.get(userId);
      const indiceAtivo = sessao.activeIndices.get(userId) || 0;
      if (acao.tipo === 'switch') {
        resolverAcaoTroca(sessao, userId, acao, linhas);
      } else if (equipe[indiceAtivo]?.hp > 0) {
        if (acao.activeIndex !== undefined && acao.activeIndex !== indiceAtivo) {
          linhas.push(`💫 ${equipe[acao.activeIndex]?.nome || 'O Pokémon'} foi nocauteado antes de agir.`);
        } else {
          mensagemGolpe(sessao, userId, acao, linhas);
        }
      }
      if (linhas.length) {
        await atualizarMensagem(sessao, {
          embeds: [montarEmbedBatalha(sessao, linhas)],
          components: [],
          allowedMentions: { parse: [] },
        });
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
    for (const userId of jogadores) {
      const equipe = sessao.teams.get(userId);
      const indiceAtivo = sessao.activeIndices.get(userId) || 0;
      const ativo = equipe[indiceAtivo];
      linhas.push(...battle.fimDeTurno(ativo));
      if (ativo.hp <= 0) {
        linhas.push(`💫 **${ativo.nome}** não pode mais lutar!`);
        const proximo = battle.escolherProximoVivo(equipe, indiceAtivo);
        if (proximo >= 0) {
          sessao.activeIndices.set(userId, proximo);
          linhas.push(`➡️ ${equipe[proximo].nome} entrou em campo.`);
        }
      }
    }
    sessao.turns += 1;
    sessao.actions.clear();
    const derrotados = jogadores.filter((userId) => !battle.temPokemonVivo(sessao.teams.get(userId)));
    if (derrotados.length || sessao.turns >= battle.MAX_TURNS) {
      const vencedor = derrotados.length === 1 ? jogadores.find((id) => id !== derrotados[0]) : null;
      await encerrarBatalha(sessao, vencedor, linhas);
      return;
    }
    armarTimer(sessao);
    await atualizarMensagem(sessao, {
      embeds: [montarEmbedBatalha(sessao, linhas.length ? linhas : ['O campo se acalma por um instante.'])],
      components: botoesBatalha(sessao),
      allowedMentions: { parse: [] },
    });
  } finally {
    sessao.resolving = false;
  }
}

async function encerrarBatalha(sessao, vencedorId, linhas = []) {
  try {
    const venceu = Boolean(vencedorId);
    const jogadorVenceu = sessao.kind === 'gym' ? vencedorId === sessao.playerId : venceu;

    // ── XP para Pokémon da equipe do vencedor ──
    if (venceu) {
      const equipeVencedora = sessao.kind === 'gym'
        ? sessao.teams.get(sessao.playerId)
        : sessao.teams.get(vencedorId);
      if (equipeVencedora) {
        const xpBase = sessao.kind === 'gym' ? 300 : 150;
        const xpPorPokemon = Math.floor(xpBase / Math.max(1, equipeVencedora.length));
        for (const poke of equipeVencedora) {
          if (poke.collectionId) {
            const resultadoXp = pokemon.ganharXpPokemon(
              sessao.kind === 'gym' ? sessao.playerId : vencedorId,
              poke.collectionId,
              xpPorPokemon
            );
            if (resultadoXp.ok && resultadoXp.subiu) {
              linhas.push(`⬆️ **${poke.nome}** subiu para o nível **${resultadoXp.nivelNovo}**!`);
            }
          }
        }
      }
    }

    // ── Persiste vida e status dos Pokémon que participaram ──
    for (const [donoId, equipe] of sessao.teams.entries()) {
      for (const poke of equipe || []) {
        if (!poke.collectionId) continue;
        try {
          pokemon.salvarVidaPokemon(donoId, poke.collectionId, {
            hp: poke.hp,
            status: poke.status,
            statusTurns: poke.sleepTurns,
          });
        } catch (erro) {
          console.error('[Pokémon] Não consegui salvar a vida do Pokémon após a batalha:', erro?.message || erro);
        }
      }
    }

    if (sessao.kind === 'gym' && jogadorVenceu) {
      const resultado = battle.registrarVitoriaGinasio(
        sessao.playerId,
        sessao.gym.id,
        sessao.teams.get(sessao.playerId)
      );
      if (resultado.ok && resultado.nova) linhas.push(`🏅 Você conquistou **${resultado.insignia.nome}**!`);
      else if (resultado.ok) linhas.push(`🏅 Você venceu novamente; sua **${resultado.insignia.nome}** já estava registrada.`);
    }
    battle.registrarResultado({
      guildId: sessao.guildId,
      modo: sessao.kind === 'gym' ? 'ginasio' : 'duelo',
      jogador1: sessao.kind === 'gym' ? sessao.playerId : sessao.challengerId,
      jogador2: sessao.kind === 'gym' ? null : sessao.opponentId,
      vencedorId,
      ginasioId: sessao.kind === 'gym' ? sessao.gym.id : null,
      tamanho: sessao.teamSize,
      turnos: sessao.turns,
    });
    sessao.status = 'finished';
    const titulo = sessao.kind === 'gym'
      ? jogadorVenceu ? 'Vitória no ginásio!' : vencedorId === sessao.npcId ? 'Derrota no ginásio' : 'Batalha encerrada em empate'
      : venceu ? `Vitória de ${nomeJogador({ client: sessao.client }, vencedorId)}!` : 'Batalha encerrada em empate';
    const descricao = [
      ...linhas,
      sessao.kind === 'gym'
        ? jogadorVenceu ? 'Você superou o desafio do ginásio.' : vencedorId === sessao.npcId ? 'O líder venceu desta vez. Reorganize sua equipe e tente novamente.' : 'A batalha chegou ao limite de turnos sem um vencedor.'
        : venceu ? `<@${vencedorId}> venceu o duelo!` : 'A batalha chegou ao limite de turnos sem um vencedor.',
    ].join('\n');
    await atualizarMensagem(sessao, {
      embeds: [embedBase(titulo, descricao, jogadorVenceu || (sessao.kind === 'duel' && venceu) ? THEME.corSucesso : THEME.corSecundario)],
      components: [],
      allowedMentions: { parse: [] },
    });
  } finally {
    limparSessao(sessao);
  }
}

async function criarSessao(ctx, options) {
  const sessionId = crypto.randomBytes(6).toString('hex');
  const sessao = {
    id: sessionId,
    kind: options.kind,
    status: options.status,
    guildId: String(ctx.guildId),
    channelId: String(ctx.channelId),
    client: ctx.client,
    participants: options.participants,
    challengerId: options.challengerId || null,
    opponentId: options.opponentId || null,
    playerId: options.playerId || null,
    npcId: options.npcId || null,
    gym: options.gym || null,
    teamSize: options.teamSize,
    teams: new Map(),
    drafts: new Map(),
    actions: new Map(),
    activeIndices: new Map(),
    turns: 0,
    resolving: false,
    message: null,
    timer: null,
  };
  sessions.set(sessionId, sessao);
  for (const userId of sessao.participants) playerSessions.set(userId, sessionId);
  return sessao;
}

async function iniciarDuelo(ctx, adversario, tamanho) {
  if (!ctx.guildId) return enviar(ctx, { embeds: [embedBase('Use em um servidor', 'Duelo Pokémon só pode acontecer em um servidor.', THEME.corErro)] }, true);
  if (!adversario || adversario.bot || adversario.id === ctx.user.id) {
    return enviar(ctx, { embeds: [embedBase('Adversário inválido', 'Escolha outra pessoa do servidor que não seja um bot.', THEME.corErro)] }, true);
  }
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > battle.MAX_TIME) {
    return enviar(ctx, { embeds: [embedBase('Formato inválido', 'Escolha uma batalha com **1 a 6 Pokémon** por treinador.', THEME.corErro)] }, true);
  }
  if (playerSessions.has(ctx.user.id) || playerSessions.has(adversario.id)) {
    return enviar(ctx, { embeds: [embedBase('Treinador ocupado', 'Você ou essa pessoa já está em um convite ou batalha Pokémon.', THEME.corErro)] }, true);
  }
  const propriaColecao = pokemon.listarColecao(ctx.user.id, 250);
  const colecaoAdversaria = pokemon.listarColecao(adversario.id, 250);
  if (propriaColecao.total < tamanho || colecaoAdversaria.total < tamanho) {
    return enviar(ctx, {
      embeds: [embedBase(
        'Coleção insuficiente',
        `Os dois treinadores precisam ter pelo menos **${tamanho} Pokémon** na coleção. Você tem ${propriaColecao.total}; ${adversario.username || 'a outra pessoa'} tem ${colecaoAdversaria.total}.`,
        THEME.corErro
      )],
    }, true);
  }
  const sessao = await criarSessao(ctx, {
    kind: 'duel',
    status: 'invited',
    participants: [ctx.user.id, adversario.id],
    challengerId: ctx.user.id,
    opponentId: adversario.id,
    teamSize: tamanho,
  });
  const convite = embedBase(
    'Desafio Pokémon',
    `**${ctx.user.globalName || ctx.user.username}** desafia você para um duelo de **${tamanho}×${tamanho}**.\n\nCada pessoa escolhe Pokémon da própria coleção e a batalha usa o **nível original** de cada captura.`
  );
  try {
    if (ctx.isSlash) {
      await ctx.interaction.reply({
        content: `<@${adversario.id}>`,
        embeds: [convite],
        components: criarBotoesConvite(sessao.id),
        allowedMentions: { users: [adversario.id] },
      });
      sessao.message = await ctx.interaction.fetchReply();
    } else {
      sessao.message = await ctx.reply({
        content: `<@${adversario.id}>`,
        embeds: [convite],
        components: criarBotoesConvite(sessao.id),
        allowedMentions: { users: [adversario.id] },
      });
    }
    armarTimer(sessao, INVITATION_TTL_MS);
  } catch (erro) {
    limparSessao(sessao);
    throw erro;
  }
  return sessao.message;
}

async function iniciarGinasio(ctx, gymId, teamSize) {
  if (!ctx.guildId) return enviar(ctx, { embeds: [embedBase('Use em um servidor', 'Desafios de ginásio só podem acontecer em um servidor.', THEME.corErro)] }, true);
  const gym = battle.GYMS.find((item) => item.id === gymId);
  if (!gym) return enviar(ctx, { embeds: [embedBase('Ginásio não encontrado', 'Escolha um ginásio da lista do comando.', THEME.corErro)] }, true);
  if (!Number.isInteger(teamSize) || teamSize < 2 || teamSize > battle.MAX_TIME) {
    return enviar(ctx, { embeds: [embedBase('Equipe inválida', 'Escolha uma equipe com **2 a 6 Pokémon**.', THEME.corErro)] }, true);
  }
  if (playerSessions.has(ctx.user.id)) {
    return enviar(ctx, { embeds: [embedBase('Treinador ocupado', 'Você já está em um convite ou batalha Pokémon.', THEME.corErro)] }, true);
  }
  const colecao = pokemon.listarColecao(ctx.user.id, 250);
  if (colecao.total < teamSize) {
    return enviar(ctx, { embeds: [embedBase('Coleção insuficiente', `Você precisa de pelo menos **${teamSize} Pokémon**; sua coleção tem ${colecao.total}.`, THEME.corErro)] }, true);
  }
  const elegiveis = colecao.pokemon.filter((item) => gym.pokemonPermitidos.includes(Number(item.pokemon_id)));
  if (!elegiveis.length) {
    return enviar(ctx, {
      embeds: [embedBase(
        'Falta um Pokémon elegível',
        `Para desafiar este ginásio, capture ao menos um destes Pokémon: ${gym.pokemonPermitidosNomes}.\n\nO restante da equipe pode ser formado por qualquer Pokémon da sua coleção.`,
        THEME.corErro
      )],
    }, true);
  }
  const npcId = `gym:${gym.id}:${ctx.user.id}`;
  const sessao = await criarSessao(ctx, {
    kind: 'gym',
    status: 'selecting',
    participants: [ctx.user.id],
    playerId: ctx.user.id,
    npcId,
    gym,
    teamSize,
  });
  try {
    sessao.message = await enviar(ctx, {
      embeds: [embedSelecaoEquipe(sessao)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(customId(sessao.id, 'open-picker', ctx.user.id)).setLabel('Escolher minha equipe').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(customId(sessao.id, 'cancel')).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
      )],
    });
    if (ctx.isSlash) sessao.message = await ctx.interaction.fetchReply();
  } catch (erro) {
    limparSessao(sessao);
    throw erro;
  }
  armarTimer(sessao);
  return sessao.message;
}

async function listarInsigniasCommand(ctx, alvo) {
  const user = alvo || ctx.user;
  let paginaAtual = 0;
  const mensagem = ctx.isSlash
    ? await ctx.interaction.reply({
      embeds: [montarEmbedInsignias(user, paginaAtual)],
      components: montarComponentesInsignias(paginaAtual),
      fetchReply: true,
    })
    : await ctx.reply({
      embeds: [montarEmbedInsignias(user, paginaAtual)],
      components: montarComponentesInsignias(paginaAtual),
    });
  if (!mensagem?.createMessageComponentCollector) {
    throw new Error('Não foi possível iniciar a navegação das insígnias.');
  }
  const coletor = mensagem.createMessageComponentCollector({
    time: BADGE_NAV_TTL_MS,
    filter: (componente) => componente.user.id === ctx.user.id,
  });
  coletor.on('collect', async (componente) => {
    try {
      const ultimaPagina = Math.ceil(battle.GYMS.length / BADGES_PER_PAGE) - 1;
      const deslocamento = componente.customId === 'pokemon_insignias_anterior' ? -1 : 1;
      const proximaPagina = Math.max(0, Math.min(ultimaPagina, paginaAtual + deslocamento));
      paginaAtual = proximaPagina;
      await componente.update({
        embeds: [montarEmbedInsignias(user, paginaAtual)],
        components: montarComponentesInsignias(paginaAtual),
      });
    } catch (erro) {
      console.error('[Pokémon] Falha ao navegar pelas insígnias:', erro?.message || erro);
      if (!componente.replied && !componente.deferred) {
        await componente.reply({ content: 'Não consegui abrir essa página de insígnias. Tente novamente.', ephemeral: true });
      }
    }
  });
  coletor.on('end', async () => {
    try {
      await mensagem.edit({ components: [] });
    } catch (erro) {
      console.error('[Pokémon] Não consegui encerrar os controles das insígnias:', erro?.message || erro);
    }
  });
  return mensagem;
}

async function responderPrivado(interaction, texto) {
  const payload = { content: texto, ephemeral: true, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function tratarComponente(interaction) {
  if (!interaction.customId?.startsWith(BUTTON_PREFIX)) return false;
  const [prefixo, id, acao, valor] = interaction.customId.split(':');
  if (prefixo !== 'pb') return false;
  const sessao = sessions.get(id);
  if (!sessao) {
    await responderPrivado(interaction, 'Este convite ou esta batalha já expirou.');
    return true;
  }
  const userId = interaction.user.id;
  if (!filaUsuario(sessao, userId)) {
    await responderPrivado(interaction, 'Este controle pertence aos participantes da batalha.');
    return true;
  }

  if (acao === 'accept' || acao === 'decline') {
    if (sessao.kind !== 'duel' || userId !== sessao.opponentId || sessao.status !== 'invited') {
      await responderPrivado(interaction, 'Este convite não está mais disponível para você.');
      return true;
    }
    if (acao === 'decline') {
      sessao.status = 'declined';
      await interaction.update({
        embeds: [embedBase('Convite recusado', 'O duelo foi recusado. Nenhuma equipe foi alterada.', THEME.corSecundario)],
        components: [],
        allowedMentions: { parse: [] },
      });
      limparSessao(sessao);
      return true;
    }
    sessao.status = 'selecting';
    armarTimer(sessao);
    await interaction.update({
      embeds: [embedSelecaoEquipe(sessao)],
      components: [new ActionRowBuilder().addComponents(
        ...[sessao.challengerId, sessao.opponentId].map((idJogador) => new ButtonBuilder()
          .setCustomId(customId(sessao.id, 'open-picker', idJogador))
          .setLabel(`Escolher equipe · ${nomeJogador({ client: sessao.client }, idJogador)}`)
          .setStyle(ButtonStyle.Primary)),
        new ButtonBuilder().setCustomId(customId(sessao.id, 'cancel')).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
      )],
      allowedMentions: { parse: [] },
    });
    return true;
  }

  if (acao === 'cancel') {
    if (sessao.status === 'battle' || sessao.status === 'finished') {
      await responderPrivado(interaction, 'A batalha já começou e não pode mais ser cancelada por este controle.');
      return true;
    }
    sessao.status = 'cancelled';
    await interaction.update({
      embeds: [embedBase('Batalha cancelada', 'O desafio foi cancelado.', THEME.corSecundario)],
      components: [],
      allowedMentions: { parse: [] },
    });
    limparSessao(sessao);
    return true;
  }

  if (acao === 'open-picker') {
    if (sessao.status !== 'selecting') {
      await responderPrivado(interaction, 'A seleção de equipes não está aberta.');
      return true;
    }
    if (valor !== userId) {
      await responderPrivado(interaction, 'Use o botão de seleção destinado ao seu treinador.');
      return true;
    }
    const colecao = pokemon.listarColecao(userId, 250).pokemon;
    if (!sessao.drafts.has(userId)) sessao.drafts.set(userId, { selected: new Set(), page: 0 });
    const { rows } = criarBotoesEquipe(sessao, userId);
    await interaction.reply({
      content: `Selecione **${sessao.teamSize} Pokémon** da sua coleção. Você pode navegar pelas páginas sem perder as escolhas.`,
      components: rows,
      ephemeral: true,
    });
    if (!colecao.length) await interaction.editReply({ content: 'Sua coleção está vazia.', components: [] });
    return true;
  }

  if (acao === 'pick' || acao === 'page-prev' || acao === 'page-next' || acao === 'picker-cancel' || acao === 'team-done') {
    if (sessao.status !== 'selecting') {
      await responderPrivado(interaction, 'A seleção de equipes já foi encerrada.');
      return true;
    }
    const draft = sessao.drafts.get(userId);
    if (!draft) {
      await responderPrivado(interaction, 'Abra primeiro o seletor da sua equipe.');
      return true;
    }
    if (acao === 'picker-cancel') {
      sessao.drafts.delete(userId);
      await interaction.update({ content: 'Seletor fechado. Sua equipe não foi confirmada.', components: [] });
      return true;
    }
    if (acao === 'page-prev' || acao === 'page-next') {
      const totalPaginas = Math.max(1, Math.ceil(pokemon.listarColecao(userId, 250).pokemon.length / TEAM_PAGE_SIZE));
      const page = Number(valor);
      if (!Number.isInteger(page) || page < 0 || page >= totalPaginas) {
        await responderPrivado(interaction, 'Página inválida. Use os controles do seletor.');
        return true;
      }
      draft.page = page;
      const { rows } = criarBotoesEquipe(sessao, userId, draft.page);
      await interaction.update({ components: rows });
      return true;
    }
    if (acao === 'pick') {
      const collectionId = Number(valor);
      const colecao = pokemon.listarColecao(userId, 250).pokemon;
      if (!colecao.some((item) => Number(item.id) === collectionId)) {
        await responderPrivado(interaction, 'Esse Pokémon não pertence à sua coleção.');
        return true;
      }
      if (draft.selected.has(collectionId)) draft.selected.delete(collectionId);
      else if (draft.selected.size < sessao.teamSize) draft.selected.add(collectionId);
      else {
        await responderPrivado(interaction, `A equipe já tem ${sessao.teamSize} Pokémon. Remova um antes de escolher outro.`);
        return true;
      }
      const { rows } = criarBotoesEquipe(sessao, userId, draft.page);
      await interaction.update({ components: rows });
      return true;
    }
    if (acao === 'team-done') {
      if (draft.selected.size !== sessao.teamSize || sessao.preparing?.has(userId)) {
        await responderPrivado(interaction, `Escolha exatamente ${sessao.teamSize} Pokémon.`);
        return true;
      }
      if (!sessao.preparing) sessao.preparing = new Set();
      sessao.preparing.add(userId);
      await interaction.deferUpdate();
      try {
        const equipe = await battle.prepararEquipeDoUsuario(userId, Array.from(draft.selected), sessao.teamSize);
        if (sessao.kind === 'gym' && !equipe.some((item) => sessao.gym.pokemonPermitidos.includes(item.pokemonId))) {
          throw new Error('Sua equipe precisa incluir ao menos um Pokémon da lista de espécies elegíveis deste ginásio.');
        }
        sessao.teams.set(userId, equipe);
        sessao.drafts.delete(userId);
        await interaction.editReply({
          content: 'Equipe carregada e pronta para a batalha.',
          components: [],
          allowedMentions: { parse: [] },
        });
        await atualizarMensagem(sessao, {
          embeds: [embedSelecaoEquipe(sessao)],
          components: sessao.kind === 'gym'
            ? [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(customId(sessao.id, 'open-picker', userId)).setLabel('Trocar equipe').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(customId(sessao.id, 'cancel')).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
            )]
            : [new ActionRowBuilder().addComponents(
              ...[sessao.challengerId, sessao.opponentId].map((idJogador) => new ButtonBuilder()
                .setCustomId(customId(sessao.id, 'open-picker', idJogador))
                .setLabel(sessao.teams.has(idJogador) ? `Equipe pronta · ${nomeJogador({ client: sessao.client }, idJogador)}` : `Escolher equipe · ${nomeJogador({ client: sessao.client }, idJogador)}`)
                .setStyle(sessao.teams.has(idJogador) ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(sessao.teams.has(idJogador))),
              new ButtonBuilder().setCustomId(customId(sessao.id, 'cancel')).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
            )],
          allowedMentions: { parse: [] },
        });
        const quantidadeProntas = sessao.kind === 'gym' ? 1 : 2;
        if (sessao.teams.size === quantidadeProntas) await iniciarBatalha(sessao);
      } catch (erro) {
        if (sessao.kind === 'gym' && sessao.status === 'selecting' && sessao.teams.has(userId)) {
          sessao.teams.delete(userId);
          await atualizarMensagem(sessao, {
            embeds: [embedSelecaoEquipe(sessao)],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(customId(sessao.id, 'open-picker', userId)).setLabel('Tentar novamente').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(customId(sessao.id, 'cancel')).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
            )],
            allowedMentions: { parse: [] },
          });
        }
        await interaction.editReply({
          content: `Não consegui preparar a equipe: ${erro.message}`,
          components: [],
          allowedMentions: { parse: [] },
        });
        console.error('[Pokémon] Falha ao preparar equipe de batalha:', erro);
      } finally {
        sessao.preparing.delete(userId);
      }
      return true;
    }
  }

  if (acao === 'action') {
    if (valor !== userId) {
      await responderPrivado(interaction, 'Use o botão de ação destinado ao seu treinador.');
      return true;
    }
    if (sessao.status !== 'battle' || sessao.actions.has(userId)) {
      await responderPrivado(interaction, 'Sua ação já foi escolhida ou a batalha não está aceitando ações.');
      return true;
    }
    await interaction.reply({
      content: 'Escolha um golpe ou troque o Pokémon ativo.',
      components: [criarMenuAcoes(sessao, userId)],
      ephemeral: true,
    });
    return true;
  }

  if (acao === 'choose') {
    if (sessao.status !== 'battle' || sessao.actions.has(userId)) {
      await responderPrivado(interaction, 'Sua ação já foi escolhida ou a batalha não está aceitando ações.');
      return true;
    }
    const escolha = selecionarAcao(sessao, userId, interaction.values?.[0]);
    sessao.actions.set(userId, escolha);
    await interaction.update({ content: 'Ação registrada. A batalha avança quando todos escolherem.', components: [] });
    await atualizarMensagem(sessao, {
      embeds: [montarEmbedBatalha(sessao, [
        sessao.kind === 'gym'
          ? 'Ação recebida. Preparando o próximo turno...'
          : `Ações escolhidas: **${sessao.actions.size}/2**.`,
      ])],
      components: sessao.kind === 'gym' || sessao.actions.size === 2 ? [] : botoesBatalha(sessao),
      allowedMentions: { parse: [] },
    });
    if (sessao.actions.size === (sessao.kind === 'gym' ? 1 : 2)) await resolverTurno(sessao);
    return true;
  }

  if (acao === 'forfeit') {
    if (sessao.status !== 'battle') {
      await responderPrivado(interaction, 'Não há uma batalha em andamento para desistir.');
      return true;
    }
    await interaction.deferUpdate();
    const vencedor = sessao.kind === 'gym'
      ? sessao.npcId
      : userId === sessao.challengerId ? sessao.opponentId : sessao.challengerId;
    await encerrarBatalha(sessao, vencedor, [`<@${userId}> desistiu da batalha.`]);
    return true;
  }

  await responderPrivado(interaction, 'Este controle de batalha não é reconhecido.');
  return true;
}

function montarEmbedInsignias(user, pagina = 0) {
  const insignias = battle.listarInsignias(user.id);
  const obtidas = insignias.filter((item) => item.obtida);
  const totalPaginas = Math.max(1, Math.ceil(insignias.length / BADGES_PER_PAGE));
  const paginaSegura = Math.max(0, Math.min(totalPaginas - 1, pagina));
  const insigniasPagina = insignias.slice(paginaSegura * BADGES_PER_PAGE, (paginaSegura + 1) * BADGES_PER_PAGE);
  const descricao = insigniasPagina.map((item) => {
    const data = item.obtidaEm ? ` · <t:${Math.floor(item.obtidaEm / 1000)}:d>` : '';
    const ginasio = battle.GYMS.find((entry) => entry.id === item.id);
    return `${item.obtida ? '🏅' : '🔒'} **${item.nome}** · líder ${item.lider}${data}\nDesafio: ${ginasio?.pokemonPermitidosNomes || 'equipe especial'}`;
  }).join('\n');
  const embed = embedBase(
    `Insígnias · ${user.globalName || user.username}`,
    `**${obtidas.length}/${insignias.length} conquistadas** · página ${paginaSegura + 1}/${totalPaginas}\n\n${descricao}`
  );
  const avatar = user.displayAvatarURL?.({ size: 128 });
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}

function montarComponentesInsignias(pagina) {
  const totalPaginas = Math.max(1, Math.ceil(battle.GYMS.length / BADGES_PER_PAGE));
  if (totalPaginas <= 1) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pokemon_insignias_anterior')
      .setLabel('Anterior')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagina === 0),
    new ButtonBuilder()
      .setCustomId('pokemon_insignias_proxima')
      .setLabel('Próximo')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagina >= totalPaginas - 1)
  )];
}

module.exports = {
  iniciarDuelo,
  iniciarGinasio,
  listarInsigniasCommand,
  montarEmbedInsignias,
  tratarComponente,
  internals: { sessions, playerSessions, criarBotoesEquipe, montarEmbedBatalha, selecionarAcao },
};
