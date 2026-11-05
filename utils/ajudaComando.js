// ⋆｡°✩ Ajuda universal da Mila.
// Monta páginas de ajuda a partir dos próprios comandos carregados
// (nome, descrição, subcomandos e opções) e complementa com o catálogo
// editorial de `codexData`. Assim, TODO comando ganha uma explicação
// consistente, com listas, busca e navegação.

const fs = require('fs');
const path = require('path');
const { criarEmbed, THEME } = require('./theme');
const { CATEGORIAS, COMANDOS } = require('./codexData');
const { aproximar, linhaNavegacao } = require('./ui');

const TIPO_NOME = {
  1: 'subcomando',
  2: 'grupo',
  3: 'texto',
  4: 'número',
  5: 'sim/não',
  6: 'usuário',
  7: 'canal',
  8: 'cargo',
  9: 'menção',
  10: 'decimal',
  11: 'anexo',
};

const CATEGORIA_PADRAO = {
  eightball: 'diversao',
  'reset-economia': 'admin',
  'reset-pokemon': 'admin',
  trocar: 'pokemon',
  'doar-pokemon': 'pokemon',
};

let catalogoCache = null;

function limparTexto(texto) {
  return String(texto || '')
    .replace(/\s+/g, ' ')
    .replace(/^[^\wÀ-ÿ$/(]+/u, '')
    .trim();
}

function serializarData(data) {
  if (data && typeof data.toJSON === 'function') return data.toJSON();
  return data || null;
}

function carregarModulos() {
  const mapa = new Map();
  const pasta = path.join(__dirname, '..', 'commands');
  for (const arquivo of fs.readdirSync(pasta)) {
    if (!arquivo.endsWith('.js')) continue;
    try {
      const mod = require(path.join(pasta, arquivo));
      const data = serializarData(mod?.data);
      if (!data?.name) continue;
      mapa.set(String(data.name).toLowerCase(), { mod, data });
    } catch {
      // Comando quebrado não impede a ajuda dos demais.
    }
  }
  return mapa;
}

function gerarUso(nome, data) {
  const opcoes = data?.options || [];
  const subs = opcoes.filter((o) => o.type === 1 || o.type === 2);
  if (subs.length) return `$${nome} <subcomando>`;
  if (opcoes.length) return `$${nome} [opções]`;
  return `$${nome}`;
}

function linhasOpcoes(opcoes, nivel = 0, limite = 18) {
  const linhas = [];
  for (const opcao of (opcoes || []).slice(0, limite)) {
    const tipo = TIPO_NOME[opcao.type] || 'opção';
    const obrigatorio = opcao.required ? 'obrigatório' : 'opcional';
    const marca = nivel > 0 ? '↳' : '˖';
    const escolhas = Array.isArray(opcao.choices) && opcao.choices.length
      ? ` · ${opcao.choices.slice(0, 4).map((c) => c.name || c.value).join(', ')}`
      : '';
    linhas.push(`${marca} \`${opcao.name}\` — ${limparTexto(opcao.description) || tipo} _(${tipo}, ${obrigatorio}${escolhas})_`);
    if (opcao.options?.length && nivel < 1) linhas.push(...linhasOpcoes(opcao.options, nivel + 1, 10));
  }
  return linhas;
}

function cortarLinhas(linhas, limite = 1024) {
  const aviso = '˖ …e mais opções. Use `/ajuda comando:<nome>`.';
  const resultado = [];
  let total = 0;
  for (const original of linhas) {
    // Linha gigante (subcomando com muitas opções) é truncada sozinha para
    // nunca estourar o limite de 1024 caracteres de um campo de embed.
    const linha = original.length > 220 ? `${original.slice(0, 217)}…` : original;
    if (total + linha.length + 1 + aviso.length + 1 > limite) {
      resultado.push(aviso);
      return resultado.join('\n');
    }
    resultado.push(linha);
    total += linha.length + 1;
  }
  return resultado.join('\n') || '`sem opções — use como mostra o exemplo`';
}

function cortarValor(texto, limite = 1024) {
  const valor = String(texto || '');
  if (valor.length <= limite) return valor || '`nada por aqui`';
  return `${valor.slice(0, limite - 1)}…`;
}

function montarCatalogo() {
  if (catalogoCache) return catalogoCache;
  const modulos = carregarModulos();
  const editoriais = new Map();
  for (const item of COMANDOS) {
    const nome = String(item.nome || '').toLowerCase();
    // Entradas com espaço são subcomandos ("pokemon evoluir"); o catálogo
    // principal trabalha com o comando base.
    if (!nome || nome.includes(' ')) continue;
    if (!editoriais.has(nome)) editoriais.set(nome, item);
  }

  const entradas = [];
  const subcomandosPorBase = new Map();
  for (const item of COMANDOS) {
    const nome = String(item.nome || '').toLowerCase();
    if (!nome.includes(' ')) continue;
    const [base, ...resto] = nome.split(/\s+/);
    const lista = subcomandosPorBase.get(base) || [];
    lista.push({ nome: nome, descricao: limparTexto(item.descricao), uso: limparTexto(item.uso) });
    subcomandosPorBase.set(base, lista);
  }

  for (const [nome, { data }] of modulos) {
    const editorial = editoriais.get(nome);
    const categoria = editorial?.categoria || CATEGORIA_PADRAO[nome] || 'util';
    const meta = CATEGORIAS[categoria] || {};
    entradas.push({
      nome,
      categoria,
      emoji: editorial?.emoji || meta.emoji || '✦',
      descricao: limparTexto(editorial?.descricao) || limparTexto(data.description) || 'Sem descrição.',
      uso: limparTexto(editorial?.uso) || gerarUso(nome, data),
      exemplo: limparTexto(editorial?.exemplo),
      aliases: [...(editorial?.alias || []), ...(editorial?.aliases || [])].map((a) => String(a).toLowerCase()),
      subcomandos: subcomandosPorBase.get(nome) || [],
      data,
    });
  }

  // Comandos que existem no catálogo editorial mas não têm arquivo próprio
  // (aliases de música, por exemplo) continuam pesquisáveis.
  for (const [nome, editorial] of editoriais) {
    if (entradas.some((e) => e.nome === nome)) continue;
    const categoria = editorial.categoria || CATEGORIA_PADRAO[nome] || 'util';
    const meta = CATEGORIAS[categoria] || {};
    entradas.push({
      nome,
      categoria,
      emoji: editorial.emoji || meta.emoji || '✦',
      descricao: limparTexto(editorial.descricao) || 'Sem descrição.',
      uso: limparTexto(editorial.uso) || `$${nome}`,
      exemplo: limparTexto(editorial.exemplo),
      aliases: [...(editorial.alias || []), ...(editorial.aliases || [])].map((a) => String(a).toLowerCase()),
      subcomandos: subcomandosPorBase.get(nome) || [],
      data: null,
    });
  }

  entradas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  catalogoCache = entradas;
  return entradas;
}

function todas() {
  return montarCatalogo();
}

function buscar(termo) {
  const alvo = limparTexto(termo).toLowerCase();
  if (!alvo) return null;
  const lista = todas();
  const exato = lista.find((e) => e.nome === alvo || e.aliases.includes(alvo));
  if (exato) return exato;
  // Busca por substring antes do fuzzy, para "config" achar "configurar".
  const contem = lista.filter((e) => e.nome.includes(alvo) || e.aliases.some((a) => a.includes(alvo)));
  if (contem.length === 1) return contem[0];
  if (contem.length > 1) {
    return contem.sort((a, b) => a.nome.length - b.nome.length)[0];
  }
  // Busca em subcomandos ("evoluir" → "pokemon").
  const porSubcomando = lista.find((e) => e.subcomandos.some((s) => s.nome.includes(alvo)));
  if (porSubcomando) return porSubcomando;
  return aproximar(alvo, lista.map((e) => ({ ...e, nome: e.nome, alias: e.aliases, categoria: e.categoria })));
}

function paginaComando(entrada) {
  const meta = CATEGORIAS[entrada.categoria] || {};
  const opcoes = entrada.data?.options || [];
  const linhas = linhasOpcoes(opcoes);
  const relacionados = todas()
    .filter((e) => e.categoria === entrada.categoria && e.nome !== entrada.nome)
    .slice(0, 6)
    .map((e) => `\`${e.nome}\``)
    .join(' · ') || '`nenhum`';

  const embed = criarEmbed({
    titulo: `${entrada.emoji} ${entrada.nome}`,
    descricao: `${THEME.div.bolinhas}\n\n${entrada.descricao}\n\n${THEME.div.coracao}`,
    cor: meta.cor || THEME.corPrincipal,
    rodape: `${THEME.nome} · ajuda de ${entrada.nome}`,
  }).addFields(
    { name: '📚 Categoria', value: `${meta.emoji || '✦'} ${meta.nome || entrada.categoria}`, inline: true },
    { name: '⌨️ Uso por prefixo', value: `\`${entrada.uso}\``, inline: true },
    { name: '🔎 Buscar', value: `\`$ajuda ${entrada.nome}\` · \`$codex ${entrada.nome}\``, inline: true }
  );

  if (opcoes.length) {
    embed.addFields({ name: '📋 Subcomandos e opções', value: cortarLinhas(linhas), inline: false });
  }
  if (entrada.subcomandos?.length) {
    const listaSubs = entrada.subcomandos
      .slice(0, 12)
      .map((s) => {
        const atalho = s.nome.startsWith(`${entrada.nome} `) ? s.nome.slice(entrada.nome.length + 1) : s.nome;
        return `\`${atalho}\` — ${s.descricao || 'atalho do comando'}`;
      })
      .join('\n');
    embed.addFields({ name: '🧭 Atalhos', value: cortarValor(listaSubs), inline: false });
  }
  if (entrada.exemplo) {
    embed.addFields({ name: '✨ Exemplo', value: `\`${entrada.exemplo}\``, inline: false });
  }
  embed.addFields({ name: '🧩 Comandos relacionados', value: relacionados, inline: false });
  embed.addFields({ name: '💡 Dica', value: 'Use `$comando ?` para abrir esta ajuda a qualquer momento.', inline: false });
  return embed;
}

function comandosDaCategoria(categoria) {
  return todas().filter((e) => e.categoria === categoria);
}

function paginaVisaoGeral() {
  const categorias = Object.entries(CATEGORIAS);
  const campos = categorias.map(([id, cat]) => {
    const lista = comandosDaCategoria(id);
    if (!lista.length) return null;
    const amostra = lista.slice(0, 8).map((e) => `\`${e.nome}\``).join(' · ');
    return { name: `${cat.emoji} ${cat.nome} — ${lista.length}`, value: amostra, inline: false };
  }).filter(Boolean);

  return criarEmbed({
    titulo: '📚 Central de Ajuda',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      'Eu explico qualquer comando meu com lista de opções, exemplos e busca.\n\n' +
      '**Como usar**\n' +
      '˖ `$ajuda <comando>` — explica um comando\n' +
      '˖ `$comando ?` — atalho direto para a ajuda daquele comando\n' +
      '˖ `$ajuda <termo>` — pesquisa pelo nome mais parecido\n' +
      '˖ `$codex` — abre o livro completo, página por página\n\n' +
      '⬅️ ➡️ trocam de página. Use o menu de categorias para pular.\n\n' +
      `${THEME.div.coracao}`,
    cor: THEME.corPrincipal,
    rodape: `${THEME.nome} · use ⬅️ ➡️ para navegar`,
  }).addFields(campos.slice(0, 12));
}

function paginasAjuda() {
  const paginas = [paginaVisaoGeral()];
  for (const [id, cat] of Object.entries(CATEGORIAS)) {
    const lista = comandosDaCategoria(id);
    if (!lista.length) continue;
    for (let i = 0; i < lista.length; i += 10) {
      const bloco = lista.slice(i, i + 10);
      const embed = criarEmbed({
        titulo: `${cat.emoji} ${cat.nome}`,
        descricao: `${THEME.div.bolinhas}\n\n**${lista.length} comando(s)** nesta categoria.\n\nUse \`$ajuda <comando>\` para ver a explicação completa.\n\n${THEME.div.bolinhas}`,
        cor: cat.cor,
        rodape: `${THEME.nome} · ajuda`,
      }).addFields(
        bloco.map((e) => ({
          name: `${e.emoji} ${e.nome}`,
          value: `${e.descricao}${e.uso ? `\n\`${e.uso}\`` : ''}`,
          inline: false,
        }))
      );
      paginas.push(embed);
    }
  }
  return paginas.map((embed, indice) => {
    const dados = embed.toJSON();
    embed.setFooter({ text: `${THEME.nome} · página ${indice + 1}/${paginas.length}` });
    return { embed, indice, total: paginas.length, categoria: dados.title };
  });
}

function montarBotoesNav(indice, total, prefixo = 'ajuda') {
  return linhaNavegacao(prefixo, {
    first: indice === 0,
    prev: indice === 0,
    next: indice >= total - 1,
    last: indice >= total - 1,
  });
}

module.exports = {
  todas,
  buscar,
  paginaComando,
  paginasAjuda,
  paginaVisaoGeral,
  montarBotoesNav,
  comandosDaCategoria,
  limparTexto,
};
