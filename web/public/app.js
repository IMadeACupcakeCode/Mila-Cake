// web/public/app.js
// ── Mila · front-end ──────────────────────────────────────────────────
// Sem frameworks: navegação por páginas, visual aleatório a cada visita,
// troca secreta de plataforma + popup acessível,
// e dados vindos da API do bot (/api/...).

(() => {
  const TEMAS = {
    facebook: { nome: 'Facebook', emoji: '📘', cores: ['#3b5998', '#4e69a2', '#e9ebee', '#ffffff'], desc: 'Feed, páginas e comunidade.', marca: 'facebook', subtitulo: 'Mila · Amigos', titulo: 'Mila | Facebook', corNavegador: '#3b5998', abas: ['Manual', 'Destaques', 'Loja', 'Perfil', 'Pokémon', 'Criadora', 'Sobre'], rodape: 'Mila · Facebook', tituloRanking: 'Pessoas em destaque', tituloLoja: 'Loja da Mila', tituloPerfil: 'Perfil' },
    gplus: { nome: 'Google+', emoji: '➕', cores: ['#db4437', '#f4b400', '#f1f1f1', '#ffffff'], desc: 'Círculos, novidades e comunidades.', marca: 'Google+', subtitulo: 'Mila · Comandos', titulo: 'Mila - Google+', corNavegador: '#db4437', abas: ['Comandos', 'Círculos', 'Loja', 'Perfil', 'Pokémon', 'Criadora', 'Sobre'], rodape: 'Mila · Google+', tituloRanking: 'Pessoas em destaque', tituloLoja: 'Loja', tituloPerfil: 'Perfil' },
    fourshared: { nome: '4shared', emoji: '📁', cores: ['#1b75bb', '#36a9e1', '#edf5fb', '#ffffff'], desc: 'Arquivos, pastas e conteúdo compartilhado.', marca: '4shared', subtitulo: 'Arquivos da Mila', titulo: 'Mila - 4shared', corNavegador: '#1b75bb', abas: ['Arquivos', 'Destaques', 'Loja', 'Minha conta', 'Pokémon', 'Criadora', 'Sobre'], rodape: '4shared · Mila', tituloRanking: 'Mais acessados', tituloLoja: 'Loja', tituloPerfil: 'Minha conta' },
    mediafire: { nome: 'MediaFire', emoji: '🔥', cores: ['#168de2', '#55b6f5', '#edf7ff', '#ffffff'], desc: 'Armazenamento na nuvem e compartilhamento.', marca: 'MediaFire', subtitulo: 'Nuvem da Mila', titulo: 'Mila - MediaFire', corNavegador: '#168de2', abas: ['Explorar', 'Destaques', 'Loja', 'Minha conta', 'Pokémon', 'Criadora', 'Sobre'], rodape: 'MediaFire · Mila', tituloRanking: 'Mais acessados', tituloLoja: 'Loja', tituloPerfil: 'Minha conta' },
    friv: { nome: 'Friv', emoji: '🎮', cores: ['#642d88', '#ffcc00', '#ff6600', '#ffffff'], desc: 'Grade de jogos colorida em um portal roxo.', marca: 'friv.com', subtitulo: 'Jogos e atividades', titulo: 'Friv.com - Mila', corNavegador: '#ffcc00', abas: ['Ajuda', 'Mais populares', 'Loja', 'Jogador', 'Pokémon', 'Criadora', 'Sobre'], rodape: 'Friv.com · Mila', tituloRanking: 'Mais populares', tituloLoja: 'Loja', tituloPerfil: 'Jogador' },
  };

  const ORDEM_TEMAS = Object.keys(TEMAS);
  const PAGINAS = {
    comandos: '/',
    ranking: '/ranking',
    loja: '/loja',
    carteira: '/perfil',
    pokemon: '/pokemon',
    criadora: '/criadora',
    referencias: '/referencias',
  };
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const estado = {
    tema: 'facebook',
    ranking: 'money',
    perfilAtual: null,
    popupAberto: false,
    trocando: false,
    focoAnterior: null,
    pokemonPainel: 'manual',
    pokemonRanking: 'global',
    pokemonUsername: '',
    pokemonServidores: null,
  };

  // ── Utilidades ─────────────────────────────────────────────────────
  const numero = (n) => Number(n || 0).toLocaleString('pt-BR');

  async function buscarJson(url) {
    const resposta = await fetch(url, { headers: { Accept: 'application/json' } });
    const dados = await resposta.json();
    if (!resposta.ok) {
      const erro = new Error(dados.erro || `HTTP ${resposta.status}`);
      erro.payload = dados;
      throw erro;
    }
    return dados;
  }

  function escapar(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function temaValido(id) {
    return Object.prototype.hasOwnProperty.call(TEMAS, id);
  }

  function paginaDaRota() {
    const rota = window.location.pathname.replace(/\/+$/, '') || '/';
    if (rota === '/comandos') return 'comandos';
    return Object.entries(PAGINAS).find(([, caminho]) => caminho === rota)?.[0] || 'comandos';
  }

  function atualizarTituloPagina() {
    const pagina = paginaDaRota();
    const tituloPagina = $(`#pagina-${pagina} h1`)?.textContent?.trim();
    document.title = tituloPagina
      ? `${tituloPagina} | ${TEMAS[estado.tema].marca}`
      : TEMAS[estado.tema].titulo;
  }

  // ── Visuais (temas) ────────────────────────────────────────────────
  function aplicarTemaCore(id) {
    const tema = temaValido(id) ? id : 'facebook';
    estado.tema = tema;
    document.documentElement.setAttribute('data-theme', tema);
    const identidade = TEMAS[tema];
    $('#marca-nome')?.replaceChildren(document.createTextNode(identidade.marca));
    $('#marca-sub')?.replaceChildren(document.createTextNode(identidade.subtitulo));
    $('#titulo-ranking')?.replaceChildren(document.createTextNode(identidade.tituloRanking));
    $('#titulo-loja')?.replaceChildren(document.createTextNode(identidade.tituloLoja));
    $('#titulo-perfil')?.replaceChildren(document.createTextNode(identidade.tituloPerfil));
    $('#theme-color')?.setAttribute('content', identidade.corNavegador);
    atualizarTituloPagina();
    $$('.aba').forEach((aba, indice) => {
      aba.replaceChildren(document.createTextNode(identidade.abas[indice]));
    });
    const rodape = $('#rodape-contexto');
    if (rodape) rodape.textContent = identidade.rodape;
  }

  function trocarTema(novoId, comTransicao = true) {
    if (!temaValido(novoId)) return;
    if (novoId === estado.tema) { fecharPopup(true); return; }
    if (estado.trocando) return;
    const de = estado.tema;
    const para = novoId;
    const movimentoReduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!comTransicao || movimentoReduzido) { aplicarTemaCore(para); fecharPopup(true); return; }

    estado.trocando = true;
    document.body.classList.add(`saindo-${de}`);
    setTimeout(() => {
      document.body.classList.remove(`saindo-${de}`);
      aplicarTemaCore(para);
      document.body.classList.add(`entrando-${para}`);
      setTimeout(() => {
        document.body.classList.remove(`entrando-${para}`);
        estado.trocando = false;
      }, 540);
    }, 260);
    fecharPopup(true);
  }

  function temaAleatorio() {
    const candidatos = ORDEM_TEMAS.filter((t) => t !== estado.tema);
    const escolha = candidatos[Math.floor(Math.random() * candidatos.length)];
    trocarTema(escolha, true);
  }

  // ── Popup de troca de visual ───────────────────────────────────────
  function montarPopup() {
    const grade = $('#popup-grade');
    if (!grade) return;
    grade.innerHTML = ORDEM_TEMAS.map((id) => {
      const t = TEMAS[id];
      const amostras = t.cores.map((cor) => `<i style="background:${cor}"></i>`).join('');
      return `
        <button class="visual-opcao" data-visual="${id}" aria-pressed="false">
          <span class="visual-emoji">${t.emoji}</span>
          <strong>${escapar(t.nome)}</strong>
          <small>${escapar(t.desc)}</small>
          <span class="visual-amostra">${amostras}</span>
        </button>`;
    }).join('');

    grade.addEventListener('click', (e) => {
      const btn = e.target.closest('.visual-opcao');
      if (!btn) return;
      trocarTema(btn.dataset.visual, true);
    });
  }

  function abrirPopup() {
    const popup = $('#popup-visual');
    if (!popup) return;
    estado.focoAnterior = document.activeElement;
    estado.popupAberto = true;
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('popup-visuais-aberto');
    popup.classList.remove('oculto');
    requestAnimationFrame(() => popup.classList.add('aberto'));
    const grade = $('#popup-grade');
    grade?.querySelectorAll('.visual-opcao').forEach((el) => {
      const ativo = el.dataset.visual === estado.tema;
      el.classList.toggle('ativo', ativo);
      el.setAttribute('aria-pressed', String(ativo));
    });
    (grade?.querySelector('.visual-opcao.ativo') || grade?.querySelector('.visual-opcao'))?.focus();
    document.addEventListener('keydown', controlarFocoPopup);
  }

  function fecharPopup(restaurarFoco = false) {
    const popup = $('#popup-visual');
    if (!popup || popup.classList.contains('oculto')) return;
    popup.classList.remove('aberto');
    popup.setAttribute('aria-hidden', 'true');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      popup.classList.add('oculto');
    } else {
      setTimeout(() => {
        if (!popup.classList.contains('aberto')) popup.classList.add('oculto');
      }, 260);
    }
    estado.popupAberto = false;
    document.body.classList.remove('popup-visuais-aberto');
    document.removeEventListener('keydown', controlarFocoPopup);
    if (restaurarFoco && estado.focoAnterior?.isConnected) estado.focoAnterior.focus();
  }

  function controlarFocoPopup(evento) {
    if (evento.key === 'Escape') {
      fecharPopup(true);
      return;
    }
    if (evento.key !== 'Tab') return;
    const popup = $('#popup-visual');
    const alvos = Array.from(popup.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'))
      .filter((alvo) => !alvo.closest('.popup-fundo'));
    if (!alvos.length) return;
    const primeiro = alvos[0];
    const ultimo = alvos[alvos.length - 1];
    if (!popup.contains(document.activeElement)) {
      evento.preventDefault();
      (evento.shiftKey ? ultimo : primeiro).focus();
    } else if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  function ligarPopup() {
    montarPopup();
    $('#popup-fundo')?.addEventListener('click', () => fecharPopup(true));
    $('#popup-fechar')?.addEventListener('click', () => fecharPopup(true));
    $('#popup-aleatorio')?.addEventListener('click', temaAleatorio);
    $('#botao-secreto')?.addEventListener('click', abrirPopup);
  }

  // ── Navegação ──────────────────────────────────────────────────────
  function abrirPagina(nome, registrarHistorico = true) {
    if (!Object.hasOwn(PAGINAS, nome)) return;
    $$('.aba').forEach((aba) => {
      const ativa = aba.dataset.pagina === nome;
      aba.classList.toggle('ativa', ativa);
      if (ativa) aba.setAttribute('aria-current', 'page');
      else aba.removeAttribute('aria-current');
    });
    $$('.pagina').forEach((pagina) => pagina.classList.toggle('ativa', pagina.id === `pagina-${nome}`));
    if (registrarHistorico && window.location.pathname !== PAGINAS[nome]) {
      window.history.pushState({ pagina: nome }, '', PAGINAS[nome]);
    }
    atualizarTituloPagina();
    if (nome === 'ranking') carregarRanking();
    if (nome === 'loja') carregarLoja();
    if (nome === 'comandos') carregarComandos();
    if (nome === 'pokemon') abrirPainelPokemon(estado.pokemonPainel);
  }

  function ligarNavegacao() {
    $$('.aba').forEach((aba) => {
      aba.addEventListener('click', (evento) => {
        evento.preventDefault();
        abrirPagina(aba.dataset.pagina);
      });
    });
    $$('[data-ir]').forEach((botao) => {
      botao.addEventListener('click', (evento) => {
        evento.preventDefault();
        abrirPagina(botao.dataset.ir);
      });
    });
    window.addEventListener('popstate', () => abrirPagina(paginaDaRota(), false));
    const abas = $$('.aba');
    $('.abas')?.addEventListener('keydown', (evento) => {
      const atual = abas.indexOf(document.activeElement);
      if (atual < 0) return;
      let proximo = atual;
      if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') proximo = (atual + 1) % abas.length;
      else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') proximo = (atual - 1 + abas.length) % abas.length;
      else if (evento.key === 'Home') proximo = 0;
      else if (evento.key === 'End') proximo = abas.length - 1;
      else return;
      evento.preventDefault();
      abas[proximo].focus();
      abrirPagina(abas[proximo].dataset.pagina);
    });
  }

  // ── Manual pesquisável ─────────────────────────────────────────────
  let catalogoComandos = [];
  let categoriasComandos = {};

  function renderizarComandos() {
    const grade = $('#lista-comandos');
    if (!grade) return;
    const termo = ($('#busca-comandos')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const categoriaEscolhida = $('#filtro-categoria')?.value || '';
    const filtrados = catalogoComandos.filter((comando) => {
      const categoria = categoriasComandos[comando.categoria];
      const texto = [comando.nome, comando.descricao, comando.uso, comando.exemplo, categoria?.nome]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return (!categoriaEscolhida || comando.categoria === categoriaEscolhida) && (!termo || texto.includes(termo));
    });

    grade.innerHTML = filtrados.length
      ? filtrados.map((comando) => {
        const categoria = categoriasComandos[comando.categoria];
        return `
          <article class="comando-card">
            <header><span>${escapar(comando.emoji || '✦')}</span><div><h2>$${escapar(comando.nome)}</h2><small>${escapar(categoria?.nome || 'Mila')}</small></div></header>
            <p>${escapar(comando.descricao)}</p>
            <div class="comando-detalhes"><strong>Como usar</strong><code>${escapar(comando.uso)}</code></div>
            <div class="comando-detalhes"><strong>Exemplo</strong><span>${escapar(comando.exemplo)}</span></div>
          </article>`;
      }).join('')
      : '<p class="ajuda vazio-comandos">Nenhum comando corresponde à busca. Tente outro termo ou categoria.</p>';
    $('#contagem-comandos').textContent = `${filtrados.length} de ${catalogoComandos.length} comandos`;
  }

  async function carregarComandos() {
    try {
      if (!catalogoComandos.length) {
        const dados = await buscarJson('/api/comandos');
        catalogoComandos = dados.comandos;
        categoriasComandos = dados.categorias;
        const aviso = $('#aviso-comandos');
        if (aviso && dados.avisos?.length) {
          aviso.textContent = `Alguns comandos não puderam ser listados (${dados.avisos.length}). Consulte /codex no Discord; a lista desta página pode estar incompleta.`;
          aviso.hidden = false;
        }
        const filtro = $('#filtro-categoria');
        filtro.innerHTML = '<option value="">Todas as categorias</option>' +
          Object.entries(categoriasComandos).map(([id, categoria]) =>
            `<option value="${escapar(id)}">${escapar(categoria.nome)}</option>`
          ).join('');
      }
      renderizarComandos();
    } catch {
      $('#lista-comandos').innerHTML = '<p class="erro">Não consegui abrir o manual. Verifique se a Mila está conectada e tente novamente.</p>';
      $('#contagem-comandos').textContent = '';
    }
  }

  function ligarManual() {
    $('#busca-comandos')?.addEventListener('input', renderizarComandos);
    $('#filtro-categoria')?.addEventListener('change', renderizarComandos);
  }

  // ── Status ─────────────────────────────────────────────────────────
  async function carregarStatus() {
    const led = $('#status-led');
    const texto = $('#status-texto');
    try {
      const dados = await buscarJson('/api/status');
      const online = Boolean(dados.online);
      led.classList.toggle('online', online);
      led.classList.toggle('offline', !online);
      texto.textContent = online ? `online · ${dados.guilds} servidor(es)` : 'offline';
      document.body.classList.toggle('bot-indisponivel', !online);
      $('#tela-indisponivel').hidden = online;
    } catch {
      led.classList.add('offline');
      texto.textContent = 'Mila offline';
      document.body.classList.add('bot-indisponivel');
      $('#tela-indisponivel').hidden = false;
    }
  }

  function ligarReconexao() {
    $('#tentar-reconectar')?.addEventListener('click', carregarStatus);
  }

  // ── Ranking ────────────────────────────────────────────────────────
  async function carregarRanking() {
    const lista = $('#lista-ranking');
    lista.innerHTML = '<li class="carregando">Carregando ranking...</li>';
    try {
      const dados = await buscarJson(`/api/ranking?categoria=${estado.ranking}&limite=10`);
      if (!dados.entradas?.length) {
        lista.innerHTML = '<li>Ninguém pontuou ainda. Seja o primeiro!</li>';
        return;
      }
      const maior = Math.max(1, ...dados.entradas.map((e) => e.valor));
      lista.innerHTML = dados.entradas
        .map((e) => {
          const nome = e.usuario?.globalName || e.usuario?.username || `Usuário ${String(e.id).slice(-4)}`;
          const avatar = e.usuario?.avatar || './assets/mila-icone.png';
          const medalha = ['🥇', '🥈', '🥉'][e.posicao - 1] || `#${e.posicao}`;
          const valor = dados.categoria === 'xp'
            ? `Nv ${e.level} · ${numero(e.xp)} XP`
            : `${numero(e.acucares)} 🍬`;
          const largura = Math.max(3, Math.round((e.valor / maior) * 100));
          return `
            <li>
              <span class="pos">${medalha}</span>
              <img class="avatar" src="${escapar(avatar)}" alt="" loading="lazy">
              <span class="nome">${escapar(nome)}${e.ehCriador ? ' <span class="coroa">👑</span>' : ''}</span>
              <span class="barra"><i style="width:${largura}%"></i></span>
              <span class="valor">${valor}</span>
            </li>`;
        })
        .join('');
      $('#ranking-info').textContent = `top ${dados.entradas.length} · ${dados.categoria === 'xp' ? 'nível' : 'açúcares'}`;
    } catch {
      lista.innerHTML = '<li class="erro">Não consegui carregar o ranking agora.</li>';
    }
  }

  function ligarRanking() {
    $$('[data-ranking]').forEach((botao) => {
      botao.addEventListener('click', () => {
        estado.ranking = botao.dataset.ranking;
        $$('[data-ranking]').forEach((b) => b.classList.toggle('ativo', b === botao));
        carregarRanking();
      });
    });
  }

  // ── Loja ───────────────────────────────────────────────────────────
  async function carregarLoja() {
    const alvo = $('#lista-loja');
    alvo.innerHTML = '<p class="carregando">Abrindo as prateleiras...</p>';
    try {
      const dados = await buscarJson('/api/loja');
      alvo.innerHTML = dados.categorias
        .map((cat) => {
          const itens = cat.itens
            .map(
              (i) => `
                <div class="item">
                  <span class="item-emoji">${escapar(i.emoji || '🍬')}</span>
                  <span class="item-info">
                    <strong>${escapar(i.nome)}</strong>
                    <small>${escapar(i.descricao)}</small>
                  </span>
                  <span class="item-preco">${numero(i.preco)} 🍬</span>
                </div>`
            )
            .join('');
          return `
            <section class="categoria">
              <h3>${escapar(cat.emoji)} ${escapar(cat.nome)}</h3>
              ${itens}
            </section>`;
        })
        .join('');
    } catch {
      alvo.innerHTML = '<p class="erro">A loja está fechada por enquanto.</p>';
    }
  }

  // ── Carteira ───────────────────────────────────────────────────────
  function mostrarErro(mensagem) {
    const erro = $('#perfil-erro');
    erro.textContent = mensagem;
    erro.classList.remove('oculto');
    $('#perfil-resultado').classList.add('oculto');
  }

  function renderizarPerfil(payload) {
    const { usuario, dados, conquistas, extrato } = payload;
    $('#perfil-erro').classList.add('oculto');
    $('#perfil-resultado').classList.remove('oculto');

    $('#perfil-avatar').src = usuario.avatar || './assets/mila-icone.png';
    $('#perfil-avatar').alt = usuario.globalName || usuario.username || 'Avatar do usuário';
    $('#perfil-nome').textContent = usuario.globalName || usuario.username || 'Usuário';
    $('#perfil-titulo').textContent = dados.ehCriador ? '👑 Criador da Mila' : dados.titulo;
    $('#perfil-saldo').textContent = dados.ehCriador ? '+999999 🍬' : `${numero(dados.acucares)} 🍬`;

    $('#perfil-nivel').textContent = dados.level;
    $('#perfil-xp').textContent = numero(dados.xp);
    $('#perfil-streak').textContent = `${dados.streak} dia(s)`;
    $('#perfil-posicao').textContent = `#${dados.posicaoDinheiro}`;
    $('#perfil-diarios').textContent = dados.diarios;
    $('#perfil-trabalhos').textContent = dados.trabalhos;

    $('#perfil-conquistas').innerHTML = conquistas
      .map(
        (c) => `
          <span class="conquista ${c.desbloqueada ? '' : 'bloqueada'}" title="${escapar(c.descricao)}">
            ${escapar(c.emoji)} ${escapar(c.nome)}
          </span>`
      )
      .join('');

    $('#perfil-extrato').innerHTML = extrato.length
      ? extrato
          .map((t) => {
            const positivo = Number(t.valor) >= 0;
            const sinal = positivo ? '+' : '';
            return `
              <li>
                <span>${escapar(t.detalhe || t.tipo)}</span>
                <span class="${positivo ? 'entrada' : 'saida'}">${sinal}${numero(t.valor)} 🍬</span>
              </li>`;
          })
          .join('')
      : '<li><span>Nenhuma movimentação ainda.</span></li>';
  }

  async function consultarPerfil(evento) {
    evento.preventDefault();
    const username = ($('#campo-username').value || '').trim().replace(/^@/, '');
    if (!/^[a-z0-9._]{2,32}$/i.test(username)) {
      mostrarErro('Digite um username global válido do Discord, sem espaços.');
      return;
    }
    const botao = $('#form-perfil button[type="submit"]');
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Consultando…';
    $('#perfil-erro').classList.add('oculto');
    $('#perfil-resultado').classList.add('oculto');
    try {
      const dados = await buscarJson(`/api/perfil?username=${encodeURIComponent(username)}`);
      estado.perfilAtual = username;
      renderizarPerfil(dados);
    } catch (erro) {
      mostrarErro(erro.message || 'Não consegui consultar esse perfil agora.');
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }

  function ligarCarteira() {
    $('#form-perfil').addEventListener('submit', consultarPerfil);
  }

  // ── Mila Pokémon ──────────────────────────────────────────────────
  const numeroPokemon = (valor) => Number(valor || 0).toLocaleString('pt-BR');
  const spritePokemon = (id, shiny = false) => {
    const numeroId = Number(id);
    if (!Number.isInteger(numeroId) || numeroId < 1 || numeroId > 1025) return './assets/mila-icone.png';
    const caminho = shiny
      ? `shiny/${numeroId}.png`
      : `other/official-artwork/${numeroId}.png`;
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${caminho}`;
  };

  async function carregarServidoresPokemon() {
    if (estado.pokemonServidores) return estado.pokemonServidores;
    const dados = await buscarJson('/api/pokemon/servidores');
    estado.pokemonServidores = dados.servidores || [];
    const opcoes = estado.pokemonServidores
      .map((servidor) => `<option value="${escapar(servidor.id)}">${escapar(servidor.nome)}</option>`)
      .join('');
    const ranking = $('#pokemon-servidor-ranking');
    ranking.innerHTML = opcoes || '<option value="">Nenhum servidor disponível</option>';
    ranking.disabled = !estado.pokemonServidores.length;
    const perfil = $('#pokemon-servidor-perfil');
    perfil.innerHTML = '<option value="">Todos os servidores · global</option>' +
      (opcoes || '');
    perfil.disabled = !estado.pokemonServidores.length;
    return estado.pokemonServidores;
  }

  function abrirPainelPokemon(nome) {
    if (!$$('[data-pokemon-panel]').some((painel) => painel.dataset.pokemonPanel === nome)) return;
    estado.pokemonPainel = nome;
    $$('[data-pokemon-view]').forEach((botao) => {
      const ativo = botao.dataset.pokemonView === nome;
      botao.classList.toggle('ativo', ativo);
      botao.setAttribute('aria-selected', String(ativo));
      botao.tabIndex = ativo ? 0 : -1;
    });
    $$('[data-pokemon-panel]').forEach((painel) => {
      const ativo = painel.dataset.pokemonPanel === nome;
      painel.classList.toggle('ativo', ativo);
      painel.hidden = !ativo;
    });
    carregarServidoresPokemon().catch((erro) => {
      if (nome === 'ranking') $('#pokemon-ranking-info').textContent = erro.message;
    });
    if (nome === 'ranking') carregarRankingPokemon();
    if (nome === 'loja') carregarLojaPokemon();
  }

  function ligarAbasPokemon() {
    $$('[data-pokemon-view]').forEach((botao, indice, botoes) => {
      botao.addEventListener('click', () => abrirPainelPokemon(botao.dataset.pokemonView));
      botao.addEventListener('keydown', (evento) => {
        let proximo = indice;
        if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') proximo = (indice + 1) % botoes.length;
        else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') proximo = (indice - 1 + botoes.length) % botoes.length;
        else if (evento.key === 'Home') proximo = 0;
        else if (evento.key === 'End') proximo = botoes.length - 1;
        else return;
        evento.preventDefault();
        botoes[proximo].focus();
        abrirPainelPokemon(botoes[proximo].dataset.pokemonView);
      });
    });
  }

  async function carregarRankingPokemon() {
    const lista = $('#pokemon-ranking-lista');
    if (!lista) return;
    lista.innerHTML = '<li class="carregando">Carregando ranking Pokémon...</li>';
    const parametros = new URLSearchParams({ escopo: estado.pokemonRanking });
    const servidor = $('#pokemon-servidor-ranking').value;
    if (estado.pokemonRanking === 'servidor') {
      if (!servidor) {
        lista.innerHTML = '<li>Escolha um servidor para ver o ranking local.</li>';
        return;
      }
      parametros.set('servidor', servidor);
    }
    try {
      const dados = await buscarJson(`/api/pokemon/ranking?${parametros}`);
      const entradas = dados.entradas || [];
      $('#pokemon-ranking-info').textContent = dados.escopo === 'global'
        ? 'Coleção completa de treinadores em todos os servidores da Mila.'
        : `Capturas registradas em ${dados.servidor?.nome || 'este servidor'}.`;
      if (!entradas.length) {
        lista.innerHTML = '<li>Ainda não há capturas neste ranking. Seja o primeiro treinador!</li>';
        return;
      }
      const maior = Math.max(1, ...entradas.map((entrada) => entrada.total));
      lista.innerHTML = entradas.map((entrada) => {
        const nome = entrada.usuario?.globalName || entrada.usuario?.username || `Treinador ${String(entrada.user_id).slice(-4)}`;
        const avatar = entrada.usuario?.avatar || './assets/mila-icone.png';
        const medalha = ['🥇', '🥈', '🥉'][entrada.posicao - 1] || `#${entrada.posicao}`;
        const largura = Math.max(3, Math.round((entrada.total / maior) * 100));
        return `
          <li>
            <span class="pos">${medalha}</span>
            <img class="avatar" src="${escapar(avatar)}" alt="" loading="lazy">
            <span class="nome">${escapar(nome)}</span>
            <span class="barra"><i style="width:${largura}%"></i></span>
            <span class="valor">${numeroPokemon(entrada.total)} · ${numeroPokemon(entrada.species)} espécies</span>
          </li>`;
      }).join('');
    } catch (erro) {
      lista.innerHTML = `<li class="erro">${escapar(erro.message || 'Não consegui carregar o ranking Pokémon.')}</li>`;
    }
  }

  async function carregarLojaPokemon() {
    const grade = $('#pokemon-loja-lista');
    grade.innerHTML = '<p class="carregando">Abrindo a loja Pokémon...</p>';
    try {
      const dados = await buscarJson('/api/pokemon/loja');
      grade.innerHTML = dados.categorias.map((categoria) => `
        <section class="categoria">
          <h3>${escapar(categoria.emoji)} ${escapar(categoria.nome)}</h3>
          <p class="pokemon-categoria-descricao">${escapar(categoria.descricao)}</p>
          ${categoria.itens.map((item) => `
            <article class="item">
              <span class="item-emoji">${escapar(item.emoji || '🎒')}</span>
              <span class="item-info">
                <strong>${escapar(item.nome)}</strong>
                <small>${escapar(item.descricao)}</small>
              </span>
              <span class="item-preco">${numeroPokemon(item.preco)} 🍬</span>
            </article>`).join('')}
        </section>`).join('');
    } catch (erro) {
      grade.innerHTML = `<p class="erro">${escapar(erro.message || 'A loja Pokémon está indisponível.')}</p>`;
    }
  }

  async function consultarPokedex(evento) {
    evento.preventDefault();
    const campo = $('#campo-pokedex');
    const consulta = campo.value.trim();
    const resultado = $('#pokedex-resultado');
    const erro = $('#pokedex-erro');
    erro.classList.add('oculto');
    resultado.innerHTML = '<p class="carregando">Consultando a Pokédex...</p>';
    try {
      const dados = await buscarJson(`/api/pokemon/info?pokemon=${encodeURIComponent(consulta)}`);
      const especie = dados.pokemon;
      const imagem = especie.animatedUrl || especie.imageUrl || spritePokemon(especie.id);
      resultado.innerHTML = `
        <article class="pokemon-dex-card">
          <div class="pokemon-dex-imagem"><img src="${escapar(imagem)}" alt="${escapar(especie.namePt)}" loading="lazy"></div>
          <div class="pokemon-dex-dados">
            <p class="selo">POKÉDEX #${String(especie.id).padStart(4, '0')}</p>
            <h2>${escapar(especie.namePt)} <small>${escapar(especie.name)}</small></h2>
            <p>Taxa base de captura: <strong>${numeroPokemon(especie.captureRate)}</strong></p>
            <div class="pokemon-tipos">${(especie.types || []).map((tipo) => `<span>${escapar(tipo)}</span>`).join('') || '<span>Tipo indisponível</span>'}</div>
          </div>
        </article>`;
    } catch (falha) {
      resultado.replaceChildren();
      erro.textContent = falha.message || 'Não consegui consultar a Pokédex.';
      erro.classList.remove('oculto');
    }
  }

  function formatarDataPokemon(valor) {
    const data = Number(valor);
    return Number.isFinite(data) && data > 0
      ? new Date(data).toLocaleDateString('pt-BR')
      : '—';
  }

  function renderizarPerfilPokemon(dados) {
    const { usuario, perfil, colecao, colecaoTotal, inventario, preferencias, missoes } = dados;
    const resultado = $('#pokemon-perfil-resultado');
    const ultima = perfil.latestGlobal;
    const favoritos = perfil.favorites.length
      ? perfil.favorites.map((item) => `<li>#${String(item.pokemon_id).padStart(4, '0')} · ${escapar(item.name_pt)}</li>`).join('')
      : '<li>Nenhum favorito neste servidor.</li>';
    const itens = inventario.length
      ? inventario.map((item) => `<li><span>${escapar(item.emoji)} ${escapar(item.nome)}</span><strong>×${numeroPokemon(item.quantidade)}</strong></li>`).join('')
      : '<li>A mochila está vazia.</li>';
    const capturas = colecao.length
      ? colecao.map((item) => `
        <article class="pokemon-colecao-item">
          <img src="${spritePokemon(item.pokemon_id, Boolean(item.shiny))}" alt="" loading="lazy">
          <div><strong>${item.shiny ? '✨ ' : ''}${escapar(item.name_pt)}</strong><small>#${String(item.pokemon_id).padStart(4, '0')} · Nv. ${numeroPokemon(item.level)} · ${formatarDataPokemon(item.caught_at)}</small></div>
        </article>`).join('')
      : '<p class="ajuda">Ainda não há capturas na coleção.</p>';
    const missoesHtml = missoes.map((missao) => {
      const percentual = Math.min(100, Math.round((missao.progresso / missao.meta) * 100));
      const estadoMissao = missao.resgatada ? 'Recompensa resgatada' : missao.concluida ? 'Concluída · resgate no Discord' : `${numeroPokemon(missao.progresso)} / ${numeroPokemon(missao.meta)}`;
      return `
        <article class="pokemon-missao">
          <div class="pokemon-missao-topo"><strong>${escapar(missao.nome)}</strong><span>${escapar(estadoMissao)}</span></div>
          <p>${escapar(missao.descricao)}</p>
          <div class="pokemon-progresso"><i style="width:${percentual}%"></i></div>
          <small>Recompensa: ${escapar(missao.recompensaItem?.emoji || '🎁')} ${escapar(missao.recompensaItem?.nome || missao.recompensa)}</small>
        </article>`;
    }).join('');
    const preferenciasAviso = preferencias.pingEnabled && preferencias.favoriteAlerts
      ? 'Menções de favoritos permitidas'
      : preferencias.favoriteAlerts
        ? 'Alertas de favoritos ativos; menções desativadas'
        : 'Alertas de favoritos desativados';
    resultado.innerHTML = `
      <article class="pokemon-perfil-card">
        <header class="pokemon-perfil-cabecalho">
          <img src="${escapar(usuario.avatar || './assets/mila-icone.png')}" alt="" width="68" height="68">
          <div><h2>${escapar(usuario.globalName || usuario.username)}</h2><p>@${escapar(usuario.username)}</p></div>
          ${perfil.arceusExclusivo ? '<span class="pokemon-arceus">🌟 Arceus</span>' : ''}
        </header>
        <div class="pokemon-estatisticas">
          <div><small>Capturas globais</small><strong>${numeroPokemon(perfil.global.total)}</strong></div>
          <div><small>Espécies</small><strong>${numeroPokemon(perfil.global.species)}</strong></div>
          <div><small>Brilhantes</small><strong>${numeroPokemon(perfil.global.shinies)}</strong></div>
          <div><small>Ranking global</small><strong>${perfil.globalPosition ? `#${numeroPokemon(perfil.globalPosition)}` : '—'}</strong></div>
          <div><small>Ranking ${dados.servidor ? 'do servidor' : 'local'}</small><strong>${perfil.guildPosition ? `#${numeroPokemon(perfil.guildPosition)}` : '—'}</strong></div>
        </div>
        <p class="ajuda">${dados.servidor ? `Dados locais de ${escapar(dados.servidor.nome)}.` : 'Selecione um servidor acima para consultar estatísticas e favoritos locais.'}</p>
        ${perfil.arceusExclusivo ? '<p class="pokemon-nota">Arceus é um presente exclusivo global do perfil da criadora, capturado com uma Master Ball.</p>' : ''}
        <div class="pokemon-perfil-colunas">
          <section><h3>🕰️ Captura mais recente</h3><p>${ultima ? `${ultima.shiny ? '✨ ' : ''}${escapar(ultima.name_pt)} · #${String(ultima.pokemon_id).padStart(4, '0')} · ${formatarDataPokemon(ultima.caught_at)}` : 'Nenhuma captura registrada.'}</p></section>
          <section><h3>🎒 Mochila</h3><ul class="pokemon-lista">${itens}</ul><p class="ajuda">Pokébola: ${escapar(perfil.equippedBall?.nome || 'Pokébola comum')} · Cosmético: ${escapar(perfil.equippedCosmetic?.nome || 'nenhum')}</p></section>
          <section><h3>⭐ Favoritos ${dados.servidor ? 'deste servidor' : ''}</h3><ul class="pokemon-lista">${favoritos}</ul><p class="ajuda">${escapar(preferenciasAviso)}</p></section>
          <section><h3>🧭 Missões</h3><div class="pokemon-missoes">${missoesHtml || '<p class="ajuda">Nenhuma missão disponível.</p>'}</div></section>
        </div>
        <section class="pokemon-colecao">
          <div class="pokemon-colecao-titulo"><h3>📚 Coleção recente</h3><span>${numeroPokemon(colecaoTotal)} capturas · ${numeroPokemon(dados.especies)} espécies</span></div>
          <div class="pokemon-colecao-grade">${capturas}</div>
        </section>
      </article>`;
  }

  async function consultarPerfilPokemon({ username = null } = {}) {
    const erro = $('#pokemon-perfil-erro');
    const resultado = $('#pokemon-perfil-resultado');
    erro.classList.add('oculto');
    resultado.innerHTML = '<p class="carregando">Consultando o treinador...</p>';
    if (username !== null) {
      estado.pokemonUsername = username;
    }
    const parametros = new URLSearchParams();
    parametros.set('username', estado.pokemonUsername);
    const servidor = $('#pokemon-servidor-perfil').value;
    if (servidor) parametros.set('servidor', servidor);
    try {
      const dados = await buscarJson(`/api/pokemon/perfil?${parametros}`);
      renderizarPerfilPokemon(dados);
    } catch (falha) {
      resultado.replaceChildren();
      erro.textContent = falha.message || 'Não consegui consultar esse treinador.';
      erro.classList.remove('oculto');
    }
  }

  function ligarPokemon() {
    ligarAbasPokemon();
    $('#form-pokedex').addEventListener('submit', consultarPokedex);
    $('#form-pokemon-perfil').addEventListener('submit', (evento) => {
      evento.preventDefault();
      const username = $('#campo-pokemon-username').value.trim().replace(/^@/, '');
      if (!/^[a-z0-9._]{2,32}$/i.test(username)) {
        $('#pokemon-perfil-erro').textContent = 'Digite um username global válido do Discord, sem espaços.';
        $('#pokemon-perfil-erro').classList.remove('oculto');
        return;
      }
      consultarPerfilPokemon({ username });
    });
    $('#pokemon-servidor-perfil').addEventListener('change', () => {
      if (estado.pokemonUsername) consultarPerfilPokemon();
    });
    $('#pokemon-servidor-ranking').addEventListener('change', carregarRankingPokemon);
    $$('[data-pokemon-ranking]').forEach((botao) => {
      botao.addEventListener('click', () => {
        estado.pokemonRanking = botao.dataset.pokemonRanking;
        $$('[data-pokemon-ranking]').forEach((item) => item.classList.toggle('ativo', item === botao));
        $('#pokemon-servidor-ranking').disabled = estado.pokemonRanking !== 'servidor' || !estado.pokemonServidores?.length;
        carregarRankingPokemon();
      });
    });
  }

  // ── Revelação ao rolar ─────────────────────────────────────────────
  function ligarRevelacao() {
    if (!('IntersectionObserver' in window)) return;
    const alvos = document.querySelectorAll('.cartao, .janela, .categoria, .visual-opcao, .ranking li');
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.style.animation = 'itemEntrada .5s var(--ease-out) both';
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    alvos.forEach((el) => obs.observe(el));
  }

  // ── Inicialização ──────────────────────────────────────────────────
  function iniciar() {
    const inicial = ORDEM_TEMAS[Math.floor(Math.random() * ORDEM_TEMAS.length)];
    aplicarTemaCore(inicial);

    ligarNavegacao();
    ligarManual();
    ligarRanking();
    ligarCarteira();
    ligarPokemon();
    ligarPopup();
    ligarReconexao();
    ligarRevelacao();
    const paginaInicial = paginaDaRota();
    if (window.location.pathname !== PAGINAS[paginaInicial]) {
      window.history.replaceState({ pagina: paginaInicial }, '', PAGINAS[paginaInicial]);
    }
    abrirPagina(paginaInicial, false);
    carregarStatus();
    carregarRanking();
    setInterval(carregarStatus, 30000);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
