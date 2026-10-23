const path = require('path');
const { lerJson, salvarJson } = require('./jsonStore');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'guerra.json');

function carregar() {
  const dados = lerJson(CAMINHO_ARQUIVO, {});
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
}

function salvar(registro) {
  salvarJson(CAMINHO_ARQUIVO, registro);
}

function normalizar(registro, userId, username) {
  if (!registro[userId]) {
    registro[userId] = {
      vitorias: 0,
      derrotas: 0,
      sequencia: 0,
      melhorSequencia: 0,
      cartasJogadas: 0,
      danoTotal: 0,
      nome: username || 'desconhecido',
    };
  }
  const jogador = registro[userId];
  jogador.vitorias = Number(jogador.vitorias) || 0;
  jogador.derrotas = Number(jogador.derrotas) || 0;
  jogador.sequencia = Number(jogador.sequencia) || 0;
  jogador.melhorSequencia = Number(jogador.melhorSequencia) || 0;
  jogador.cartasJogadas = Number(jogador.cartasJogadas) || 0;
  jogador.danoTotal = Number(jogador.danoTotal) || 0;
  if (username) jogador.nome = username;
  return jogador;
}

// Mantido para compatibilidade com chamadas antigas.
function registrarVitoria(userId, username) {
  const registro = carregar();
  const jogador = normalizar(registro, userId, username);
  jogador.vitorias += 1;
  jogador.sequencia += 1;
  jogador.melhorSequencia = Math.max(jogador.melhorSequencia, jogador.sequencia);
  salvar(registro);
  return jogador;
}

function registrarDerrota(userId, username) {
  const registro = carregar();
  const jogador = normalizar(registro, userId, username);
  jogador.derrotas += 1;
  jogador.sequencia = 0;
  salvar(registro);
  return jogador;
}

/**
 * Registra um resultado completo. Bots nunca entram no placar.
 * `estatisticas` é opcional: { cartasJogadas, danoTotal }.
 */
function registrarResultado({
  vencedorId,
  vencedorNome,
  perdedorId,
  perdedorNome,
  estatisticasVencedor,
  estatisticasPerdedor,
  empate = false,
}) {
  const registro = carregar();

  if (empate) {
    if (vencedorId) normalizar(registro, vencedorId, vencedorNome);
    if (perdedorId) normalizar(registro, perdedorId, perdedorNome);
    salvar(registro);
    return;
  }

  if (vencedorId) {
    const vencedor = normalizar(registro, vencedorId, vencedorNome);
    vencedor.vitorias += 1;
    vencedor.sequencia += 1;
    vencedor.melhorSequencia = Math.max(vencedor.melhorSequencia, vencedor.sequencia);
    if (estatisticasVencedor) {
      vencedor.cartasJogadas += Number(estatisticasVencedor.cartasJogadas) || 0;
      vencedor.danoTotal += Number(estatisticasVencedor.danoTotal) || 0;
    }
  }

  if (perdedorId) {
    const perdedor = normalizar(registro, perdedorId, perdedorNome);
    perdedor.derrotas += 1;
    perdedor.sequencia = 0;
    if (estatisticasPerdedor) {
      perdedor.cartasJogadas += Number(estatisticasPerdedor.cartasJogadas) || 0;
      perdedor.danoTotal += Number(estatisticasPerdedor.danoTotal) || 0;
    }
  }

  salvar(registro);
}

function atualizarNome(userId, username) {
  const registro = carregar();
  normalizar(registro, userId, username);
  salvar(registro);
}

function estatisticas(userId) {
  const registro = carregar();
  if (!registro[userId]) return null;
  const dados = normalizar(registro, userId);
  const total = dados.vitorias + dados.derrotas;
  return {
    id: userId,
    ...dados,
    total,
    winrate: total ? Math.round((dados.vitorias / total) * 100) : 0,
  };
}

function top(limite = 10) {
  const registro = carregar();
  return Object.entries(registro)
    .map(([id, v]) => {
      const dados = normalizar(registro, id);
      const total = dados.vitorias + dados.derrotas;
      return {
        id,
        nome: dados.nome || 'desconhecido',
        vitorias: dados.vitorias,
        derrotas: dados.derrotas,
        sequencia: dados.sequencia,
        melhorSequencia: dados.melhorSequencia,
        cartasJogadas: dados.cartasJogadas,
        danoTotal: dados.danoTotal,
        total,
        winrate: total ? Math.round((dados.vitorias / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.vitorias - a.vitorias || b.winrate - a.winrate)
    .slice(0, limite);
}

module.exports = {
  registrarVitoria,
  registrarDerrota,
  registrarResultado,
  atualizarNome,
  estatisticas,
  top,
};
