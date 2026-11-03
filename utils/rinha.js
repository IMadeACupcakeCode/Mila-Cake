// 🥊 Sistema de Rinha Pokémon — batalhas com apostas.
// Regras: usuário vs bot (nunca transfere Pokémon para o bot),
// usuário vs usuário (Pokémon derrotados podem ser transferidos),
// times de 1 ou 7 Pokémon com risco de perder o time inteiro.
const pokemon = require('./pokemon');
const battle = require('./pokemonBattle');
const db = require('./db');

const TAMANHOS_VALIDOS = new Set([1, 7]);
const MAX_TURNOS_RINHA = 60;
const CHANCE_PERDER = 0.3;          // chance por Pokémon derrotado
const CHANCE_TIME_INTEIRO = 0.2;    // chance extra quando o time de 7 cai inteiro

function normalizarIds(equipe) {
  if (!Array.isArray(equipe)) return [];
  return [...new Set(equipe.map((valor) => String(valor).trim()).filter(Boolean))];
}

function selecionarCapturas(userId, identificadores = [], tamanho = 1) {
  const colecao = pokemon.listarColecao(userId, 250).pokemon;
  if (!colecao.length) return { ok: false, motivo: 'colecao_vazia' };
  const porId = new Map(colecao.map((item) => [String(item.id), item]));
  const porNome = new Map(colecao.map((item) => [pokemon.normalizarNome(item.name_pt || ''), item]));
  let escolhidos = [];
  for (const identificador of normalizarIds(identificadores)) {
    const captura = porId.get(identificador) || porNome.get(pokemon.normalizarNome(identificador));
    if (captura && !escolhidos.some((item) => item.id === captura.id)) escolhidos.push(captura);
  }
  if (!escolhidos.length) escolhidos = colecao.slice(0, tamanho);
  escolhidos = escolhidos.slice(0, tamanho);
  if (escolhidos.length < tamanho) {
    for (const captura of colecao) {
      if (escolhidos.length >= tamanho) break;
      if (!escolhidos.some((item) => item.id === captura.id)) escolhidos.push(captura);
    }
  }
  return { ok: true, capturas: escolhidos };
}

async function prepararTimeDoUsuario(userId, identificadores = [], tamanho = 1) {
  const selecao = selecionarCapturas(userId, identificadores, tamanho);
  if (!selecao.ok) return selecao;
  const combatentes = [];
  for (const captura of selecao.capturas) {
    try {
      combatentes.push(await battle.prepararPokemon(captura));
    } catch (erro) {
      console.error('[Rinha] Não consegui preparar um Pokémon:', erro?.message || erro);
    }
  }
  if (!combatentes.length) return { ok: false, motivo: 'preparo_falhou' };
  return { ok: true, capturas: selecao.capturas, combatentes };
}

async function prepararTimeDoBot(tamanho = 1, nivelReferencia = 25) {
  const combatentes = [];
  const tentativas = tamanho * 4;
  for (let i = 0; i < tentativas && combatentes.length < tamanho; i += 1) {
    try {
      const especie = await pokemon.sortearPokemon();
      const nivel = Math.max(5, Math.min(100, Math.round(nivelReferencia + (Math.random() * 10 - 5))));
      const treinador = await battle.prepararPokemon({
        pokemon_id: especie.id,
        name_pt: especie.namePt,
        shiny: 0,
        level: nivel,
        nature: pokemon.natureAleatoria(),
        id: null,
      });
      combatentes.push(treinador);
    } catch (erro) {
      console.error('[Rinha] Não consegui preparar um Pokémon do bot:', erro?.message || erro);
    }
  }
  if (!combatentes.length) return { ok: false, motivo: 'preparo_falhou' };
  return { ok: true, combatentes };
}

function primeiroVivo(equipe) {
  const indice = equipe.findIndex((combatente) => combatente.hp > 0);
  return indice >= 0 ? indice : -1;
}

function melhorGolpe(atacante, defensor) {
  let melhor = 0;
  let melhorPontuacao = -Infinity;
  atacante.moves.forEach((golpe, indice) => {
    if (!golpe || (golpe.ppAtual ?? 1) < 1) return;
    let pontuacao = Number(golpe.poder) || 0;
    if (golpe.categoria === 'status') pontuacao = 12;
    const efetividade = battle.multiplicadorTipo(golpe.tipo, defensor.tipos);
    pontuacao *= Math.max(0.05, efetividade);
    if (atacante.tipos.includes(golpe.tipo)) pontuacao *= 1.2;
    if (pontuacao > melhorPontuacao) { melhorPontuacao = pontuacao; melhor = indice; }
  });
  return melhor;
}

function golpeDeReserva(atacante) {
  if (!atacante.moves.some((golpe) => (golpe.ppAtual ?? 1) > 0)) {
    atacante.moves.push({
      nome: 'Investida desesperada', tipo: 'normal', categoria: 'physical',
      poder: 50, precisao: 100, ppAtual: 1, prioridade: 0, alvo: 'selected-pokemon',
      ailment: null, ailmentChance: 0, statChanges: [], isStruggle: true,
    });
  }
}

function executarRodada(timeA, timeB, log) {
  const indiceA = primeiroVivo(timeA);
  const indiceB = primeiroVivo(timeB);
  if (indiceA < 0 || indiceB < 0) return { encerrou: true };
  const ativoA = timeA[indiceA];
  const ativoB = timeB[indiceB];
  golpeDeReserva(ativoA);
  golpeDeReserva(ativoB);

  const inicioA = battle.iniciarTurno(ativoA);
  const inicioB = battle.iniciarTurno(ativoB);
  log.push(...inicioA.linhas, ...inicioB.linhas);

  const golpeA = melhorGolpe(ativoA, ativoB);
  const golpeB = melhorGolpe(ativoB, ativoA);
  const acoes = [];
  if (inicioA.podeAgir) acoes.push({ lado: 'A', combatente: ativoA, alvo: ativoB, golpe: golpeA });
  if (inicioB.podeAgir) acoes.push({ lado: 'B', combatente: ativoB, alvo: ativoA, golpe: golpeB });
  acoes.sort((x, y) => battle.velocidadeAtual(y.combatente) - battle.velocidadeAtual(x.combatente));

  for (const acao of acoes) {
    if (acao.combatente.hp <= 0 || acao.alvo.hp <= 0) continue;
    const resultado = battle.resolverGolpe(acao.combatente, acao.alvo, acao.golpe);
    log.push(...resultado.linhas);
  }

  log.push(...battle.fimDeTurno(ativoA), ...battle.fimDeTurno(ativoB));
  return { encerrou: false };
}

function simularRinha(timeA, timeB, opcoes = {}) {
  const log = [];
  const maxTurnos = Math.max(1, Math.min(200, Number(opcoes.maxTurnos) || MAX_TURNOS_RINHA));
  let turnos = 0;
  while (turnos < maxTurnos) {
    turnos += 1;
    const resultado = executarRodada(timeA, timeB, log);
    if (resultado.encerrou) break;
    if (!battle.temPokemonVivo(timeA) || !battle.temPokemonVivo(timeB)) break;
  }
  const vivoA = battle.temPokemonVivo(timeA);
  const vivoB = battle.temPokemonVivo(timeB);
  const vencedor = vivoA && !vivoB ? 'A' : vivoB && !vivoA ? 'B' : 'empate';
  return { log, turnos, vencedor, vivoA, vivoB };
}

function transferirCaptura(collectionId, novoDono, guildId = null) {
  const resultado = db.db.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?')
    .run(String(novoDono), Number(collectionId));
  return resultado.changes === 1;
}

function perderCaptura(collectionId) {
  const resultado = db.db.prepare('DELETE FROM pokemon_collection WHERE id = ?').run(Number(collectionId));
  return resultado.changes === 1;
}

// Resolve as apostas após a rinha.
// - Vencedor humano: pode receber Pokémon derrotados do perdedor (nunca o bot).
// - Vencedor bot: nenhum Pokémon é transferido; apenas ficam desmaiados.
function resolverApostas({ timePerdedor = [], vencedorId = null, contraBot = false, tamanho = 1, random = Math.random }) {
  const relatorio = [];
  let transferidos = 0;
  let perdidos = 0;
  const derrotados = timePerdedor.filter((combatente) => combatente.hp <= 0 && combatente.collectionId);
  const chanceTimeInteiro = tamanho >= 7 && derrotados.length >= tamanho ? CHANCE_TIME_INTEIRO : 0;
  const timeInteiroPerdido = chanceTimeInteiro > 0 && random() < chanceTimeInteiro;

  if (timeInteiroPerdido && vencedorId && !contraBot) {
    for (const combatente of derrotados) {
      if (transferirCaptura(combatente.collectionId, vencedorId)) {
        transferidos += 1;
        relatorio.push(`🔄 **${combatente.nome}** passou para <@${vencedorId}> no time inteiro.`);
      }
    }
    return { relatorio, transferidos, perdidos, timeInteiroPerdido };
  }

  for (const combatente of derrotados) {
    if (random() >= CHANCE_PERDER) {
      relatorio.push(`💤 **${combatente.nome}** desmaiou, mas continua com você (precisa de cura).`);
      continue;
    }
    if (contraBot) {
      relatorio.push(`🛡️ **${combatente.nome}** desmaiou. A Mila não fica com Pokémon de treinadores.`);
      continue;
    }
    if (vencedorId && transferirCaptura(combatente.collectionId, vencedorId)) {
      transferidos += 1;
      relatorio.push(`🔄 **${combatente.nome}** foi para <@${vencedorId}>.`);
    } else {
      perdidos += 1;
      relatorio.push(`💔 **${combatente.nome}** foi perdido na rinha.`);
    }
  }
  return { relatorio, transferidos, perdidos, timeInteiroPerdido };
}

function persistirTime(userId, combatentes) {
  for (const combatente of combatentes || []) {
    if (!combatente?.collectionId) continue;
    try {
      pokemon.salvarVidaPokemon(userId, combatente.collectionId, {
        hp: combatente.hp,
        status: combatente.status,
        statusTurns: combatente.sleepTurns,
      });
    } catch (erro) {
      console.error('[Rinha] Não consegui salvar a vida do Pokémon:', erro?.message || erro);
    }
  }
}

module.exports = {
  TAMANHOS_VALIDOS,
  MAX_TURNOS_RINHA,
  CHANCE_PERDER,
  CHANCE_TIME_INTEIRO,
  selecionarCapturas,
  prepararTimeDoUsuario,
  prepararTimeDoBot,
  simularRinha,
  resolverApostas,
  persistirTime,
  transferirCaptura,
  perderCaptura,
};
