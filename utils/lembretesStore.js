const fs = require('fs');
const path = require('path');

const CAMINHO_ARQUIVO = path.join(__dirname, '..', 'data', 'lembretes.json');

function garantirArquivo() {
  const pasta = path.dirname(CAMINHO_ARQUIVO);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  if (!fs.existsSync(CAMINHO_ARQUIVO)) fs.writeFileSync(CAMINHO_ARQUIVO, '[]', 'utf-8');
}

function carregarLembretes() {
  garantirArquivo();
  const conteudo = fs.readFileSync(CAMINHO_ARQUIVO, 'utf-8');
  try {
    return JSON.parse(conteudo);
  } catch {
    return [];
  }
}

function salvarLembretes(lista) {
  garantirArquivo();
  fs.writeFileSync(CAMINHO_ARQUIVO, JSON.stringify(lista, null, 2), 'utf-8');
}

function adicionarLembrete(lembrete) {
  const lista = carregarLembretes();
  lista.push(lembrete);
  salvarLembretes(lista);
}

function removerLembrete(id) {
  const lista = carregarLembretes().filter((l) => l.id !== id);
  salvarLembretes(lista);
}

// Filtros: { userId?, pessoa?, ordenar?, status?, criadoDe?, criadoAte?, disparaDe?, disparaAte? }
function filtrarLembretes(opcoes = {}) {
  let lista = carregarLembretes();
  const agora = Date.now();

  // Filtro por usuário específico
  if (opcoes.userId) {
    lista = lista.filter((l) => l.userId === opcoes.userId);
  }

  // Filtro por pessoa (nome ou ID)
  if (opcoes.pessoa) {
    const termo = opcoes.pessoa.toLowerCase();
    lista = lista.filter((l) => {
      const nome = (l.usuarioNome || '').toLowerCase();
      return nome.includes(termo) || l.userId === termo;
    });
  }

  // Filtro por data de criação
  if (opcoes.criadoDe) {
    const de = new Date(opcoes.criadoDe).getTime();
    if (!isNaN(de)) lista = lista.filter((l) => l.criadoEm >= de);
  }
  if (opcoes.criadoAte) {
    const ate = new Date(opcoes.criadoAte).getTime();
    if (!isNaN(ate)) lista = lista.filter((l) => l.criadoEm <= ate);
  }

  // Filtro por data de disparo
  if (opcoes.disparaDe) {
    const de = new Date(opcoes.disparaDe).getTime();
    if (!isNaN(de)) lista = lista.filter((l) => l.disparaEm >= de);
  }
  if (opcoes.disparaAte) {
    const ate = new Date(opcoes.disparaAte).getTime();
    if (!isNaN(ate)) lista = lista.filter((l) => l.disparaEm <= ate);
  }

  // Filtro por status
  if (opcoes.status === 'pendentes') {
    lista = lista.filter((l) => l.disparaEm > agora);
  } else if (opcoes.status === 'vencidos') {
    lista = lista.filter((l) => l.disparaEm <= agora);
  }

  // Ordenação
  if (opcoes.ordenar === 'mais_antigo') {
    lista.sort((a, b) => a.disparaEm - b.disparaEm);
  } else if (opcoes.ordenar === 'mais_recente') {
    lista.sort((a, b) => b.disparaEm - a.disparaEm);
  } else if (opcoes.ordenar === 'criado_antigo') {
    lista.sort((a, b) => a.criadoEm - b.criadoEm);
  } else if (opcoes.ordenar === 'criado_recente') {
    lista.sort((a, b) => b.criadoEm - a.criadoEm);
  } else {
    // padrão: mais próximo de vencer primeiro
    lista.sort((a, b) => a.disparaEm - b.disparaEm);
  }

  return lista;
}

module.exports = { carregarLembretes, salvarLembretes, adicionarLembrete, removerLembrete, filtrarLembretes };