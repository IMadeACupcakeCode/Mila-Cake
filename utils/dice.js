const LIMITES = {
  expressao: 100,
  termos: 12,
  quantidade: 50,
  lados: 1000,
  magnitude: 1000000,
};

function tokenizar(expressao) {
  const tokens = [];
  let indice = 0;
  while (indice < expressao.length) {
    const resto = expressao.slice(indice);
    const espacos = resto.match(/^\s+/);
    if (espacos) { indice += espacos[0].length; continue; }
    const dado = resto.match(/^(\d{1,2})d(\d{1,4})/i);
    if (dado) {
      tokens.push({ tipo: 'dado', quantidade: Number(dado[1]), lados: Number(dado[2]) });
      indice += dado[0].length;
      continue;
    }
    const numero = resto.match(/^\d{1,7}/);
    if (numero) {
      tokens.push({ tipo: 'numero', valor: Number(numero[0]) });
      indice += numero[0].length;
      continue;
    }
    const operador = resto.match(/^[+\-x*()]/i);
    if (!operador) throw new Error('Caractere inválido na expressão');
    const valor = operador[0].toLowerCase();
    tokens.push({ tipo: valor === '(' || valor === ')' ? valor : 'operador', valor });
    indice += 1;
  }
  return tokens;
}

function validarDado(dado) {
  if (dado.quantidade < 1 || dado.quantidade > LIMITES.quantidade) throw new Error('Quantidade de dados fora do limite');
  if (dado.lados < 2 || dado.lados > LIMITES.lados) throw new Error('Quantidade de lados fora do limite');
}

function avaliar(expressao, rng = Math.random) {
  if (typeof expressao !== 'string' || !expressao.trim() || expressao.length > LIMITES.expressao) return null;
  let tokens;
  try { tokens = tokenizar(expressao); } catch { return null; }
  let posicao = 0;
  let termos = 0;
  let temDado = false;

  function primario() {
    const token = tokens[posicao++];
    if (!token) throw new Error('Expressão incompleta');
    if (token.tipo === 'numero') return { valor: token.valor, texto: String(token.valor), rolagens: [], folhas: [] };
    if (token.tipo === 'dado') {
      validarDado(token);
      termos += 1;
      temDado = true;
      if (termos > LIMITES.termos) throw new Error('Muitos termos de dados');
      const rolagens = Array.from({ length: token.quantidade }, () => Math.floor(rng() * token.lados) + 1);
      const valor = rolagens.reduce((soma, item) => soma + item, 0);
      const folha = { ...token, rolagens, valor, texto: `${token.quantidade}d${token.lados}` };
      return { valor, texto: folha.texto, rolagens, folhas: [folha] };
    }
    if (token.tipo === '(') {
      const node = soma();
      if (tokens[posicao]?.tipo !== ')') throw new Error('Parêntese não fechado');
      posicao += 1;
      return { ...node, texto: `(${node.texto})` };
    }
    throw new Error('Termo inválido');
  }

  function unario() {
    return primario();
  }

  function multiplicacao() {
    let esquerda = unario();
    while (tokens[posicao]?.tipo === 'operador' && ['x', '*'].includes(tokens[posicao].valor)) {
      const operador = tokens[posicao++].valor;
      const direita = unario();
      esquerda = {
        valor: esquerda.valor * direita.valor,
        texto: `${esquerda.texto} ${operador} ${direita.texto}`,
        rolagens: [...esquerda.rolagens, ...direita.rolagens],
        folhas: [...esquerda.folhas, ...direita.folhas],
      };
    }
    return esquerda;
  }

  function soma() {
    let esquerda = multiplicacao();
    while (tokens[posicao]?.tipo === 'operador' && ['+', '-'].includes(tokens[posicao].valor)) {
      const operador = tokens[posicao++].valor;
      const direita = multiplicacao();
      esquerda = {
        valor: operador === '+' ? esquerda.valor + direita.valor : esquerda.valor - direita.valor,
        texto: `${esquerda.texto} ${operador} ${direita.texto}`,
        rolagens: [...esquerda.rolagens, ...direita.rolagens],
        folhas: [...esquerda.folhas, ...direita.folhas],
      };
    }
    return esquerda;
  }

  try {
    const arvore = soma();
    if (posicao !== tokens.length || !temDado || Math.abs(arvore.valor) > LIMITES.magnitude) return null;
    return {
      expressao: expressao.trim(),
      normalizada: arvore.texto,
      total: arvore.valor,
      rolagens: arvore.rolagens,
      folhas: arvore.folhas,
      termos,
    };
  } catch {
    return null;
  }
}

function formatar(resultado, detalhar = false) {
  const dados = resultado.folhas
    .map((folha) => `\`${folha.texto}\`: ${folha.rolagens.map((valor) => `\`${valor}\``).join(' · ')} → **${folha.valor}**`)
    .join('\n');
  const resumo = `**Expressão:** \`${resultado.normalizada}\`\n**Dados:**\n${dados}\n**Total:** \`${resultado.total}\``;
  if (!detalhar) return resumo;
  return `${resumo}\n\n**Detalhamento:**\n\`${resultado.normalizada}\` = \`${resultado.total}\`\n*Multiplicações por x ou * são resolvidas antes de + e -.*`;
}

module.exports = { avaliar, formatar, tokenizar, LIMITES };
