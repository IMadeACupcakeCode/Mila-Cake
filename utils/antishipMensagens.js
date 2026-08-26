// anti-ship: 100 frases únicas por pct (0-100) = 10.100 frases
// Gera frases deterministicamente distintas usando variações de templates + sufixos numéricos.

const TEMPLATES_BASE = [
  // Ácidos / sádicos
  ['🩸', 'isso não é compatibilidade, é um aviso de contaminação. Corra enquanto ainda consegue.'],
  ['💀', 'compatibilidade zero absoluta. Sequestro emocional garantido.'],
  ['🖤', 'vocês dois são o oposto do que deveriam ser.'],
  ['🧟‍♂️', 'nível zumbi: incompatibilidade ressuscitou.'],
  ['🕳️', 'buraco negro engoliu qualquer vestígio de compatibilidade.'],
  ['🌑', 'escuridão cósmica aprovou esta incompatibilidade.'],
  ['🔮', 'a bola de cristal pediu demissão ao ver isso.'],
  ['🧪', 'reação química: ódio + incompatibilidade = explosão garantida.'],
  ['🧊', 'gelo seco da incompatibilidade congelou até o calor humano.'],
  ['🔥', 'incêndio de incompatibilidade em nível crítico.'],
  ['🧨', 'bomba-relógio de incompatibilidade tick-tock.'],
  ['🦂', 'escorpião da incompatibilidade picou.'],
  ['🐍', 'cobra envenenada da incompatibilidade soltou.'],
  ['🐜', 'formiga da incompatibilidade carrega drama.'],
  ['🐛', 'minhoca da incompatibilidade roe tudo.'],
  ['🧟', 'zumbi bebê da incompatibilidade.'],
  ['🧊', 'bloco de gelo da incompatibilidade.'],
  ['🧪', 'frasco de reação tóxica.'],
  ['🌑', 'lua negra da incompatibilidade.'],
  ['🕳️', 'voragem da incompatibilidade.'],
];

const SUFIXOS = [
  ' {pct}% — {n}º variação.',
  ' (edição #{n}).',
  ' — instância {n}.',
  ' — cópia {n}.',
  ' [amostra {n}].',
  ' — réplica {n}.',
  ' (clique {n}).',
  ' — {n}ª tentativa.',
  ' [versão {n}].',
  ' — build {n}.',
];

function gerarPara(pct, idx) {
  // idx: 0..99 → 100 frases por pct
  const [emoji, base] = TEMPLATES_BASE[idx % TEMPLATES_BASE.length];
  const suf = SUFIXOS[idx % SUFIXOS.length];
  const n = idx + 1;
  return `${emoji} ${pct}% ${base} ${suf.replace(/{pct}/g, pct).replace(/{n}/g, n)}`;
}

const msg = {};
for (let p = 0; p <= 100; p++) {
  msg[p] = [];
  for (let i = 0; i < 100; i++) {
    msg[p].push(gerarPara(p, i));
  }
}

// Frases raras para >100 / <0 (impossíveis no cálculo base)
const raras = {
  '>100': [
    '🌌 {pct}%?! Você quebrou a escala. A realidade chorou.',
    '🌋 {pct}%?! Erupção cósmica da incompatibilidade.',
    '🧨 {pct}%?! Big Bang de incompatibilidade.',
    '🕳️ {pct}%?! Buraco negro primordial engoliu a compatibilidade.',
    '🧟 {pct}%?! Até os mortos pediram ajuda.',
    '👾 {pct}%?! Alienígena não entende.',
    '🤖 {pct}%?! Robô chorou óleo.',
    '🔥 {pct}%?! Fogo da fúria divina.',
    '🌑 {pct}%?! Escuridão total do além.',
    '💀 {pct}%?! A morte pediu demissão.',
  ],
  '<0': [
    '🧊 {pct}%?! Escuridão antes do nascimento do universo.',
    '🌌 {pct}%?! Vazio cósmico se recusa.',
    '🕳️ {pct}%?! Buraco negro de negação de energia.',
    '🧟 {pct}%?! Zumbi negativo?',
    '👾 {pct}%?! Alienígena não assinou.',
    '🤖 {pct}%?! Máquina explodiu.',
    '🔮 {pct}%?! Bola de cristal não vê isso.',
    '🧪 {pct}%?! Reação química reversa.',
    '🧊 {pct}%?! Gelo do nada.',
    '🌑 {pct}%?! Escuridão primordial.',
  ],
};

module.exports = { msg, raras };
