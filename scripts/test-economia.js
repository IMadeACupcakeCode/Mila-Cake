// scripts/test-economia.js
// Teste de integração da Economia: usa IDs sintéticos, exercita as regras e
// limpa tudo no final. Não depende do Discord.

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const arquivoCriador = path.join(__dirname, '..', 'data', 'criador.json');
const backupCriador = fs.existsSync(arquivoCriador) ? fs.readFileSync(arquivoCriador) : null;

const IDs = ['999999999999999901', '999999999999999902', '999999999999999903'];
const { EventEmitter } = require('node:events');

function limpar(db) {
  for (const id of IDs) {
    // inventario tem FOREIGN KEY para usuarios: apagar antes da linha principal.
    db.db.prepare('DELETE FROM inventario WHERE user_id = ?').run(id);
    db.db.prepare('DELETE FROM transacoes WHERE user_id = ?').run(id);
    db.db.prepare('DELETE FROM conquistas WHERE user_id = ?').run(id);
    db.db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  }
}

async function main() {
  const db = require('../utils/db');
  const service = require('../utils/economyService');
  const loja = require('../utils/economyLoja');
  const UI = require('../utils/economyUI');
  const theme = require('../utils/economyTheme');
  const criador = require('../utils/criador');
  const comandoLoja = require('../commands/loja');
  const comandoCarrinho = require('../commands/carrinho');

  limpar(db);

  const [a, b, c] = IDs;
  db.addAcucares(a, 100000);

  // ── Diário ──
  const diario = service.resgatarDiario(a);
  assert.equal(diario.ok, true, 'diário deve resgatar');
  assert.ok(diario.quantidade >= 200, 'quantidade mínima do diário');
  assert.equal(service.statusDiario(a).pronto, false, 'diário entra em cooldown');
  assert.equal(service.resgatarDiario(a).ok, false, 'segundo diário bloqueado');

  // ── Trabalho ──
  const trabalho = service.concluirTrabalho(a, { acertou: true });
  assert.equal(trabalho.ok, true, 'trabalho deve concluir');
  assert.equal(service.statusTrabalho(a).pronto, false, 'trabalho entra em cooldown');

  // ── Loja ──
  const pacote = loja.comprar(a, 'pacote_cartas');
  assert.equal(pacote.ok, true, 'pacote deve comprar');
  assert.equal(pacote.cartas.length, 1, 'pacote entrega uma carta');
  const titulo = loja.comprar(a, 'titulo_vip');
  assert.equal(titulo.ok, true, 'título deve comprar');
  assert.equal(db.getUsuario(a).titulo_personalizado, 'Confeiteiro VIP');

  // ── Catálogo interativo da loja ──
  const temaLoja = theme.obterTema('ddtank');
  const clientLoja = { user: { displayAvatarURL: () => 'https://example.com/bot.png' } };
  const catalogo = comandoLoja.internals.montarEmbed({
    tema: temaLoja,
    membro: { id: a, username: 'Teste', displayAvatarURL: () => 'https://example.com/a.png' },
    categoria: 'titulos',
    saldo: 7500,
    selecionado: 'titulo_vip',
  }).toJSON();
  assert.ok(catalogo.title.includes('Loja da Mila'));
  assert.ok(catalogo.description.includes('Saldo disponível'));
  assert.equal(catalogo.fields.length, Math.min(5, loja.listarPorCategoria().find((item) => item.id === 'titulos').itens.length) + 2, 'catálogo paginado exibe título, itens da página e resumo do carrinho');
  assert.ok(catalogo.fields[1].value.includes('5.000'), 'catálogo mostra o preço formatado');
  assert.ok(catalogo.fields[1].name.includes('🏅'), 'catálogo usa emojis descritivos dos itens');

  const componentes = comandoLoja.internals.montarComponentes({ categoria: 'todas', selecionado: null })
    .map((linha) => linha.toJSON());
  assert.equal(componentes.length, 5, 'loja organiza categoria, item, paginação, carrinho e finalização em linhas separadas');
  assert.equal(componentes[0].components[0].options.length, 5, 'seletor oferece todas as categorias e visão completa');
  assert.equal(componentes[1].components[0].options.length, 5, 'seletor exibe os itens da página atual');
  assert.equal(componentes[2].components[1].label, 'Próximo', 'catálogo oferece paginação explícita');
  assert.equal(componentes[3].components[0].disabled, true, 'adicionar fica bloqueado até selecionar um item');
  assert.equal(componentes[4].components[0].disabled, true, 'finalizar fica bloqueado até adicionar um item');
  assert.equal(comandoCarrinho.execute, comandoLoja.execute, '/carrinho reutiliza a loja sem um segundo fluxo confuso');

  const collector = new EventEmitter();
  collector.stop = (reason) => collector.emit('end', [], reason);
  let respostaDaLoja;
  const mensagemLoja = {
    createMessageComponentCollector: () => collector,
    edit: async (payload) => { respostaDaLoja = payload; },
  };
  const interacaoLoja = {
    user: { id: a, username: 'Teste', displayAvatarURL: () => 'https://example.com/a.png' },
    guildId: '999999999999999904',
    options: { getString: () => null },
    reply: async (payload) => {
      respostaDaLoja = payload;
      return mensagemLoja;
    },
  };
  await comandoLoja.execute(interacaoLoja, clientLoja);
  assert.equal(respostaDaLoja.ephemeral, true, 'catálogo fica privado para evitar poluir o canal');
  const selecionar = async (customId, values) => {
    let updated;
    await collector.listeners('collect')[0]({
      customId,
      values,
      user: interacaoLoja.user,
      replied: false,
      deferred: false,
      update: async (payload) => { updated = payload; },
    });
    respostaDaLoja = updated;
    return updated;
  };
  const paginaSeguinte = await selecionar('loja_pagina_proxima', []);
  assert.ok(paginaSeguinte.embeds[0].toJSON().fields[0].name.includes('2/'), 'botão Próximo avança o catálogo completo');
  await selecionar('loja_pagina_anterior', []);
  const filtroItens = await selecionar('loja_categoria', ['itens']);
  assert.equal(filtroItens.embeds[0].toJSON().fields.length, Math.min(5, loja.listarPorCategoria().find((item) => item.id === 'itens').itens.length) + 2, 'trocar categoria atualiza o catálogo e mantém o carrinho');
  const itemEscolhido = await selecionar('loja_item', ['ingresso_evento']);
  assert.notEqual(itemEscolhido.components[2].components[0].disabled, true, 'seleção habilita adicionar o item ao carrinho');
  const itemAdicionado = await selecionar('loja_adicionar', []);
  assert.ok(itemAdicionado.embeds[0].toJSON().fields.at(-1).value.includes('Ingresso'), 'item adicionado aparece no resumo do carrinho');
  assert.notEqual(itemAdicionado.components[3].components[0].disabled, true, 'carrinho com itens habilita finalização');
  const carrinhoLimpo = await selecionar('loja_limpar', []);
  assert.ok(carrinhoLimpo.embeds[0].toJSON().fields.at(-1).value.includes('carrinho está vazio'), 'limpar remove os itens sem finalizar compra');
  await selecionar('loja_adicionar', []);
  const doisItens = await selecionar('loja_adicionar', []);
  assert.ok(doisItens.embeds[0].toJSON().fields.at(-1).value.includes('× 2'), 'adicionar repetidamente aumenta a quantidade no carrinho');
  const compraConfirmada = await selecionar('loja_finalizar', []);
  assert.ok(compraConfirmada.embeds[0].toJSON().title.includes('Pedido confirmado'));
  assert.equal(compraConfirmada.components.length, 0, 'após comprar, os controles são removidos');
  assert.ok(compraConfirmada.embeds[0].toJSON().fields.some((campo) => campo.name.includes('Total') && campo.value.includes('3.000')), 'recibo mostra o total correto do pedido');

  // ── Doação ──
  const doacao = service.doar(a, b, 1000);
  assert.equal(doacao.ok, true, 'doação deve funcionar');
  assert.ok(db.getUsuario(b).acucares >= 1000, 'destinatário recebe a doação');

  // ── Carteira, extrato, ranking, conquistas ──
  const carteira = service.carteira(a);
  assert.ok(carteira.itens >= 1, 'inventário conta itens');
  assert.ok(service.extrato(a, 10).length >= 3, 'extrato registra movimentos');
  const ranking = service.ranking('money', 50);
  assert.ok(ranking.every((e) => e.posicao >= 1));
  assert.ok(service.ranking('xp', 10).length >= 1);
  assert.ok(service.listarConquistas(a).some((x) => x.desbloqueada), 'alguma conquista desbloqueada');

  // ── Criador ──
  criador.ehCriador({ id: c, username: 'acupcakecatsocial' });
  assert.equal(service.carteira(c).acucares, 999999, 'criador tem saldo infinito');
  const compraCriador = loja.comprar(c, 'titulo_vip');
  assert.equal(compraCriador.ok, true, 'criador compra sem saldo real');
  assert.equal(compraCriador.saldo, 999999, 'saldo do criador não muda');
  const rankingCriador = service.ranking('money', 50);
  const primeiroCriador = rankingCriador.find((entrada) => entrada.ehCriador);
  assert.equal(primeiroCriador.posicao, 1, 'criador fica acima de saldos anormais');
  assert.equal(primeiroCriador.classificacao, '??');
  assert.match(primeiroCriador.valorFormatado, /^\+9{30}$/);
  assert.equal(
    service.carteira(c).posicaoDinheiro,
    rankingCriador.find((entrada) => entrada.id === c).posicao,
    'posição no perfil coincide com a ordem do ranking corrigido'
  );
  const diarioCriador = service.resgatarDiario(c);
  assert.equal(diarioCriador.ok, true);
  assert.equal(diarioCriador.ehCriador, true);

  // Quantias inseguras não podem ser convertidas em saldos REAL pelo SQLite.
  const saldoAntesDoTeste = db.getUsuario(b).acucares;
  assert.deepEqual(service.doar(a, b, Number.MAX_SAFE_INTEGER + 1), { ok: false, motivo: 'valor' });
  assert.equal(db.transferirAcucares(a, b, Number.MAX_SAFE_INTEGER + 1), false);
  assert.equal(db.getUsuario(b).acucares, saldoAntesDoTeste);
  assert.throws(() => db.addAcucares(a, Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => db.addAcucares(a, Number.MAX_SAFE_INTEGER), RangeError, 'saldo resultante fora do limite é rejeitado');

  // ── Renderização de todos os cartões ──
  const client = { user: { displayAvatarURL: () => 'https://example.com/bot.png' } };
  const membro = { id: a, username: 'Teste', displayAvatarURL: () => 'https://example.com/a.png' };
  const tema = theme.obterTema('ddtank');
  const conquistas = service.listarConquistas(a);
  const embeds = [
    UI.embedHub({ tema, client, membro, dados: carteira }),
    UI.embedCarteira({ tema, client, membro, dados: carteira }),
    UI.embedDiario({ tema, client, membro, resultado: diario, status: service.statusDiario(a) }),
    UI.embedDiario({ tema, client, membro, resultado: { ok: false }, status: service.statusDiario(a) }),
    UI.embedTrabalhoDesafio({ tema, client, membro, palavra: 'chocolate', segundos: 20 }),
    UI.embedTrabalhoResultado({ tema, client, membro, resultado: trabalho }),
    UI.embedLoja({ tema, client, membro, categorias: loja.listarPorCategoria(), saldo: carteira.acucares, ehCriador: false }),
    UI.embedCompra({ tema, client, membro, resultado: pacote, saldo: carteira.acucares }),
    UI.embedColecao({ tema, client, membro, itens: db.getInventario(a), total: carteira.itens, distintos: carteira.itensDistintos }),
    UI.embedRanking({ tema, client, categoria: 'money', entradas: ranking.slice(0, 10), membro }),
    UI.embedRanking({ tema, client, categoria: 'xp', entradas: service.ranking('xp', 10), membro }),
    UI.embedExtrato({ tema, client, membro, transacoes: service.extrato(a, 10) }),
    UI.embedConquistas({ tema, client, membro, conquistas }),
    UI.embedTemas({ tema, client, atual: tema, temas: theme.listarTemas() }),
  ];
  for (const embed of embeds) {
    const json = embed.toJSON();
    assert.ok(json.description || json.fields, 'embed precisa de conteúdo');
    assert.ok(JSON.stringify(json).length > 40, 'embed não pode estar vazio');
  }

  // ── Componentes ──
  assert.equal(UI.botoesEconomia('eco').components.length, 4);
  assert.equal(UI.botoesTema(theme.listarTemas(), tema).components.length, 5);

  // ── Temas ──
  for (const t of theme.listarTemas()) {
    assert.ok(theme.normalizarTema(t.id) === t.id);
    assert.ok(t.cor >= 0);
  }
  assert.equal(theme.normalizarTema('inexistente'), theme.TEMA_PADRAO);

  console.log('Economia OK: diário, trabalho, loja, doação, ranking, extrato, conquistas, criador e 14 renders.');
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      limpar(require('../utils/db'));
    } catch {}
    if (backupCriador) fs.writeFileSync(arquivoCriador, backupCriador);
    else {
      try {
        fs.rmSync(arquivoCriador, { force: true });
      } catch {}
    }
  });
