// Testes da Guerra de Cartas — motor puro + assets locais.
// Rode com: npm run test:guerra

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const motor = require('../utils/guerraCartas');

const DIR_ARTE = path.join(__dirname, '..', 'static', 'guerra', 'cards');
let testes = 0;

function ok(nome, fn) {
  fn();
  testes += 1;
  console.log(`✓ ${nome}`);
}

function simularPartida() {
  const p1 = motor.criarJogador({ id: '1', nome: 'A', isBot: true });
  const p2 = motor.criarJogador({ id: '2', nome: 'B', isBot: true });
  motor.comprar(p1, motor.MAO_INICIAL);
  motor.comprar(p2, motor.MAO_INICIAL);
  let turno = Math.random() < 0.5 ? 0 : 1;

  for (let rodada = 1; rodada <= motor.TURNOS_MAX; rodada++) {
    const ator = turno === 0 ? p1 : p2;
    const alvo = turno === 0 ? p2 : p1;
    const inicio = motor.processarInicioTurno(ator);

    if (ator.hp <= 0) return { vencedor: alvo, rodada, ko: true };
    if (inicio.atordoado) {
      turno = 1 - turno;
      continue;
    }

    ator.pontos = Math.min(motor.PONTOS_MAX, ator.pontos + 1);
    motor.comprar(ator, Math.max(0, motor.MAO_INICIAL - ator.mao.length));

    const acao = motor.escolherAcaoBot({ bot: ator, alvo });
    if (acao.tipo === 'atacar') {
      motor.resolverAtaque({ atacante: ator, defensor: alvo, carta: acao.carta });
      if (alvo.hp <= 0) return { vencedor: ator, rodada, ko: true };
    } else if (acao.tipo === 'especial') {
      const resultado = motor.resolverEspecial({
        atacante: ator,
        defensor: alvo,
        especial: acao.especial,
      });
      assert.ok(resultado, 'especial deveria resolver com carga e pontos');
      if (alvo.hp <= 0) return { vencedor: ator, rodada, ko: true };
    } else if (acao.tipo === 'caixa') {
      if (!ator.caixaAberta) motor.abrirCaixa(ator);
    } else {
      motor.defender(ator);
    }

    if (ator.hp <= 0) return { vencedor: alvo, rodada, ko: true };
    turno = 1 - turno;
  }

  if (p1.hp === p2.hp) return { vencedor: null, rodada: motor.TURNOS_MAX, ko: false };
  return {
    vencedor: p1.hp > p2.hp ? p1 : p2,
    rodada: motor.TURNOS_MAX,
    ko: false,
  };
}

ok('catálogo tem 20 cartas base e 4 especiais', () => {
  assert.strictEqual(motor.CARTAS.length, 20);
  assert.strictEqual(motor.ESPECIAIS.length, 4);
});

ok('IDs de cartas são únicos', () => {
  const ids = [...motor.CARTAS, ...motor.ESPECIAIS].map((c) => c.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

ok('cada facção tem 5 cartas base', () => {
  for (const faccao of motor.ORDEM_FACCOES) {
    const cartas = motor.CARTAS.filter((c) => c.faccao === faccao);
    assert.strictEqual(cartas.length, 5, `${faccao} deveria ter 5 cartas`);
  }
});

ok('todo efeito de carta tem metadados de exibição', () => {
  for (const carta of [...motor.CARTAS, ...motor.ESPECIAIS]) {
    assert.ok(motor.EFEITOS[carta.efeito], `efeito sem metadados: ${carta.efeito} (${carta.id})`);
  }
});

ok('ciclo de facções fecha em quatro lados', () => {
  let atual = motor.ORDEM_FACCOES[0];
  const vistos = new Set();
  for (let i = 0; i < 4; i++) {
    vistos.add(atual);
    atual = motor.FACCOES[atual].forteContra;
  }
  assert.strictEqual(atual, motor.ORDEM_FACCOES[0]);
  assert.strictEqual(vistos.size, 4);
});

ok('todas as artes existem no disco', () => {
  const artes = new Set([...motor.CARTAS, ...motor.ESPECIAIS].map((c) => c.arte));
  for (const arte of artes) {
    const caminho = path.join(DIR_ARTE, arte);
    assert.ok(fs.existsSync(caminho), `arte ausente: ${caminho}`);
    assert.ok(fs.statSync(caminho).size > 512, `arte pequena demais: ${caminho}`);
  }
});

ok('baralho começa com 20 cartas únicas', () => {
  const baralho = motor.criarBaralho();
  assert.strictEqual(baralho.length, 20);
  assert.strictEqual(new Set(baralho.map((c) => c.id)).size, 20);
});

ok('mão respeita o limite e o baralho recicla o descarte', () => {
  const jogador = motor.criarJogador({ id: 'x', nome: 'X' });
  for (let i = 0; i < 100; i++) {
    motor.comprar(jogador, 1);
    motor.descartar(jogador, jogador.mao[0]);
  }
  assert.ok(jogador.mao.length <= motor.MAO_MAX);
  assert.ok(jogador.baralho.length + jogador.descarte.length + jogador.mao.length === 20);
});

ok('dano é finito, não negativo e nunca deixa HP abaixo de zero', () => {
  for (let i = 0; i < 300; i++) {
    const atacante = motor.criarJogador({ id: 'a', nome: 'A' });
    const defensor = motor.criarJogador({ id: 'b', nome: 'B' });
    const carta = motor.CARTAS[Math.floor(Math.random() * motor.CARTAS.length)];
    atacante.mao = [carta];
    atacante.pontos = motor.PONTOS_MAX;
    const resultado = motor.resolverAtaque({ atacante, defensor, carta });
    assert.ok(Number.isFinite(resultado.dano));
    assert.ok(resultado.dano >= 0);
    assert.ok(defensor.hp >= 0);
  }
});

ok('defesa concede +2 pontos e compra uma carta', () => {
  const jogador = motor.criarJogador({ id: 'd', nome: 'D' });
  jogador.pontos = 0;
  jogador.mao = [];
  const antesBaralho = jogador.baralho.length;
  const resultado = motor.defender(jogador);
  assert.strictEqual(resultado.pontosGanhos, 2);
  assert.strictEqual(jogador.pontos, 2);
  assert.strictEqual(jogador.baralho.length, antesBaralho - 1);
  assert.strictEqual(jogador.mao.length, 1);
});

ok('caixa dá carga, +1 ponto e só abre uma vez', () => {
  const jogador = motor.criarJogador({ id: 'c', nome: 'C' });
  jogador.pontos = 0;
  const especial = motor.abrirCaixa(jogador, motor.ESPECIAIS[0], () => 0);
  assert.strictEqual(especial.id, motor.ESPECIAIS[0].id);
  assert.strictEqual(jogador.cargas, 1);
  assert.strictEqual(jogador.pontos, 1);
  assert.strictEqual(motor.abrirCaixa(jogador), null);
});

ok('300 partidas simuladas terminam sem erro e com KOs saudáveis', () => {
  let totalRodadas = 0;
  let kos = 0;
  const resultados = { A: 0, B: 0, empate: 0 };
  for (let i = 0; i < 300; i++) {
    const partida = simularPartida();
    totalRodadas += partida.rodada;
    if (partida.ko) kos += 1;
    if (!partida.vencedor) resultados.empate += 1;
    else resultados[partida.vencedor.nome] += 1;
    assert.ok(partida.rodada <= motor.TURNOS_MAX);
  }
  const media = totalRodadas / 300;
  assert.ok(media >= 8, `média de rodadas baixa demais: ${media}`);
  assert.ok(media <= 22, `média de rodadas alta demais: ${media}`);
  assert.ok(kos / 300 >= 0.9, `taxa de KO baixa: ${kos}/300`);
  console.log(
    `   ↳ ${resultados.A}x${resultados.B}, empates ${resultados.empate}, ` +
      `média ${media.toFixed(1)} rodadas, ${kos} KOs`,
  );
});

console.log(`\n${testes} testes da Guerra de Cartas passaram.`);
