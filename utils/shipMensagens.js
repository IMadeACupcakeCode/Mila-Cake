// ship: 100 frases únicas por pct (0-100) = 10.100 frases
// Gera frases deterministicamente distintas usando variações de templates + sufixos numéricos.

const TEMPLATES_BASE = [
  // Fofo / engraçado
  ['🌟', 'um amor escrito nas estrelas!'],
  ['💫', 'tem química no ar, cuidem dela.'],
  ['🌙', 'talvez amizade seja o caminho.'],
  ['💔', 'não foi dessa vez, meu favorito...'],
  ['💌', 'vocês dois têm um brilho especial.'],
  ['🧁', 'doce compatibilidade, como cupcake quentinho.'],
  ['🦄', 'magia arcobalameada garantida.'],
  ['🌈', 'arco-íris de compatibilidade brilha forte.'],
  ['🧚‍♀️', 'fadas da compatibilidade aprovaram.'],
  ['🧜‍♂️', 'sereias da compatibilidade cantam.'],
  ['🍭', 'doce como bala de cereja.'],
  ['🍪', 'cookie de compatibilidade crocante.'],
  ['🧁', 'cupcake de amor derretido.'],
  ['🍰', 'bolo de.compatibilidade fofinho.'],
  ['🎂', 'vela da compatibilidade acesa.'],
  ['🍬', 'bala de compatibilidade doce.'],
  ['🍫', 'chocolate quente de compatibilidade.'],
  ['🍓', 'morango da compatibilidade.'],
  ['🍓', 'fruta da compatibilidade madura.'],
  ['🌸', 'flor da compatibilidade em floração.'],
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
    '🌋 {pct}%?! Erupção cósmica da compatibilidade.',
    '🧨 {pct}%?! Big Bang de compatibilidade.',
    '🕳️ {pct}%?! Buraco negro primordial engoliu a incompatibilidade.',
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
    '🕳️ {pct}%?! Burco negro de negação de energia.',
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
