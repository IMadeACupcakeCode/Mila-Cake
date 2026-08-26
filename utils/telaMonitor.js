// ⋆｡°✩ Mila Tela Monitor — avisa quando o endereço público da Sala de Tela muda
//
// Lê o PUBLIC_ORIGIN do .env do app de tela periodicamente. Quando o endereço
// muda (túnel descartável reiniciado), avisa o dono do servidor com o link
// novo e os passos para trocar no portal do Discord.
//
// Sem isso, o usuário só descobre que o endereço mudou quando a atividade abre
// em branco — o sintoma mais confuso de todos.

const fs = require('fs');
const path = require('path');

const INTERVALO_MS = 60 * 1000; // 60 segundos

// Pasta do app de tela.
const PASTA_TELA = path.join(__dirname, '..', 'discord-screen');
const ARQ_ENV = path.join(PASTA_TELA, '.env');

// Último endereço lido (em memória, não persistido).
let ultimoEndereco = null;
let timer = null;

/** Lê PUBLIC_ORIGIN do .env do app de tela. */
function lerEndereco() {
  try {
    const texto = fs.readFileSync(ARQ_ENV, 'utf8');
    for (const linha of texto.split(/\r?\n/)) {
      const limpa = linha.replace(/^\s*#.*$/, '').trim();
      if (!limpa || !limpa.startsWith('PUBLIC_ORIGIN=')) continue;
      const val = limpa.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      return val.replace(/[/]+$/, '');
    }
  } catch {
    // .env não existe ou inacessível.
  }
  return '';
}

function normalizar(u) {
  return String(u || '').replace(/[/]+$/, '');
}

/**
 * Inicia o monitor. Chame uma vez no `ready` do bot.
 *
 * Detecta mudança de endereço e entrega via callback `aoMudar`.
 *
 * @param {(info: { antigo: string, novo: string }) => void} aoMudar
 */
function iniciarMonitor({ aoMudar } = {}) {
  // Leitura inicial (sem aviso — só para comparar depois).
  ultimoEndereco = normalizar(lerEndereco());

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    const atual = normalizar(lerEndereco());
    if (!atual || atual === ultimoEndereco) return;

    const antigo = ultimoEndereco;
    ultimoEndereco = atual;

    aoMudar?.({ antigo, novo: atual });
  }, INTERVALO_MS);

  // Não bloquear o encerramento do processo.
  timer.unref?.();
}

function pararMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Monta o embed de aviso de endereço mudado.
 *
 * Mostra de forma clara o que precisa ser colado no portal do Discord,
 * com o endereço novo já formatado para Target e Redirect.
 */
function criarEmbedMudanca({ antigo, novo }) {
  // Reutiliza o theme existente (lazy import para evitar circular).
  const { criarEmbed, THEME } = require('./theme');

  const dominio = novo.replace(/^https?:\/\//, '');

  return criarEmbed({
    titulo: '📺 Endereço da Sala de Tela mudou!',
    descricao: [
      `O endereço público mudou **${antigo ? 'de ' + antigo.replace(/^https?:\/\//, '') : 'de (desconhecido)'}**`,
      `**para:** \`${dominio}\``,
      '',
      '**Para a atividade continuar funcionando, troque no portal do Discord:**',
      '',
      '**1. Activities → URL Mappings:**',
      '   Prefix:  `/`',
      `   Target:  \`${dominio}\``,
      '',
      '**2. OAuth2 → Redirects:**',
      `   \`${novo}/auth/callback\``,
      '',
      '> Se não trocar, a atividade vai abrir em branco ou mostrar',
      '> "Credenciais Falhas" / "Servidor não está no ar".',
      '',
      `> 💡 Para o endereço **nunca** mudar: rode \`npm run tunel:criar\` na pasta`,
      '> `discord-screen/` (precisa de um domínio na Cloudflare).',
    ].join('\n'),
    cor: THEME.corSecundario,
    rodape: `${THEME.nome} — Detectado automaticamente`,
  });
}

module.exports = { iniciarMonitor, pararMonitor, criarEmbedMudanca, lerEndereco };
