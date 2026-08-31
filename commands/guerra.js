const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { criarEmbed, THEME } = require('../utils/theme');
const { registerChallenge } = require('../utils/guerraManager');
const { registrarVitoria, atualizarNome, top } = require('../utils/guerraStore');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TRANSITION_DELAY = 1600;
const ACTION_DELAY = 1800;

// Risco original: sem rate limiting, um usuário podia spammar batalhas,
// consumindo memória e canais do Discord.
const guerraCooldowns = new Map(); // userId → timestamp da última batalha
const GUERRA_COOLDOWN_MS = 30000; // 30 segundos entre batalhas

// Guerra: comando de batalha um-contra-outro por reação (turnos).
// Implementação com pool de ataques temáticos de memes, pickups,
// aceitação de desafio e animações por edição de embed.

const EMOJI_NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
const REACT_PICKUP = '🎁';
const REACT_SPECIAL = '⚡';
const REACT_DEFEND = '🛡️';

const TIPOS_MEME = ['ragememe', 'dankmeme', 'brmeme', 'normiememe'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTypeLabel(type) {
  const map = {
    ragememe: 'Rage Meme',
    dankmeme: 'Dank Meme',
    brmeme: 'BR Meme',
    normiememe: 'Normie Meme',
  };
  return map[type] || type;
}

function getEffectLabel(effect) {
  const map = {
    burn: '🔥 Burn (dano ao longo do tempo)',
    armor: '🛡️ Escudo (reduz dano)',
    drain: '💧 Drain (cura parte do dano)',
    stun: '⚡ Stun (pula o próximo turno)',
  };
  return map[effect] || '';
}

function formatStatusLine(player) {
  if (!player.statuses || !player.statuses.length) return 'Nenhum status ativo';
  return player.statuses.map((status) => {
    if (status.type === 'burn') return `🔥 Burn (${status.turns} turns)`;
    if (status.type === 'armor') return `🛡️ Escudo (${status.turns} turns)`;
    if (status.type === 'stun') return `⚡ Stun (${status.turns} turns)`;
    return status.type;
  }).join(' • ');
}

function applyStartOfTurnEffects(player) {
  if (!player.statuses) return { text: '', skip: false };
  let text = '';
  let skip = false;
  const nextStatuses = [];

  for (const status of player.statuses) {
    if (status.type === 'burn') {
      player.hp = Math.max(0, player.hp - status.damage);
      text += `🔥 ${player.user.username} sofreu ${status.damage} de burn.\n`;
    }
    if (status.type === 'stun') {
      text += `⚡ ${player.user.username} está atordoado e pula o turno.\n`;
      skip = true;
    }
    if (status.type === 'armor') {
      text += `🛡️ ${player.user.username} está protegido por um escudo.\n`;
    }

    status.turns -= 1;
    if (status.turns > 0) {
      nextStatuses.push(status);
    }
  }

  player.statuses = nextStatuses;
  return { text: text.trim(), skip };
}

// Carrega as imagens reais da pasta static/guerra e amarra cada uma a um
// "personagem" temático, para que cada ataque/especial apareça com a figura certa.
const IMAGENS_DIR = path.resolve(__dirname, '..', 'static', 'guerra');
const IMAGENS_DISPONIVEIS = fs.existsSync(IMAGENS_DIR)
  ? fs.readdirSync(IMAGENS_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f))
  : [];
const IMG_MANUAL = IMAGENS_DISPONIVEIS.length ? path.join(IMAGENS_DIR, IMAGENS_DISPONIVEIS[0]) : null;

function acharImagem(token) {
  const found = IMAGENS_DISPONIVEIS.find((f) => f.toLowerCase().includes(token.toLowerCase()));
  return found ? path.join(IMAGENS_DIR, found) : null;
}

// Cada tema liga um nome de ataque coerente à imagem correspondente da pasta.
const TEMAS = [
  { token: 'spongebob', nome: '🧽 SpongeBob: Breath In Boi', tipo: 'ragememe', effect: 'burn', cost: 2, dmgMin: 10, dmgMax: 22, fraco: 'brmeme' },
  { token: 'chernobyl', nome: '☢️ Chernobyl: Reator Solto', tipo: 'ragememe', effect: 'burn', cost: 3, dmgMin: 14, dmgMax: 28, fraco: 'brmeme' },
  { token: 'dio', nome: '👑 Dio Brando: WRYYYYY', tipo: 'brmeme', effect: 'drain', cost: 3, dmgMin: 16, dmgMax: 30, fraco: 'normiememe' },
  { token: 'frodo', nome: '💍 Frodo: Caminho de Mordor', tipo: 'normiememe', effect: 'stun', cost: 2, dmgMin: 8, dmgMax: 20, fraco: 'dankmeme' },
  { token: 'squash', nome: '👟 Squash: Pisada Esmagadora', tipo: 'brmeme', effect: 'drain', cost: 1, dmgMin: 6, dmgMax: 16, fraco: 'normiememe' },
  { token: 'mickey', nome: '🐭 Mickey: Clubhouse Caótico', tipo: 'normiememe', effect: 'stun', cost: 2, dmgMin: 9, dmgMax: 19, fraco: 'dankmeme' },
  { token: 'perry', nome: '🦫 Perry: Platypus Surpresa', tipo: 'dankmeme', effect: 'armor', cost: 2, dmgMin: 7, dmgMax: 17, fraco: 'ragememe' },
  { token: 'shrek', nome: '🟢 Shrek: Swamp Smash', tipo: 'brmeme', effect: 'drain', cost: 2, dmgMin: 10, dmgMax: 21, fraco: 'normiememe' },
  { token: 'anakin', nome: '⚔️ Anakin: Alto Ground', tipo: 'ragememe', effect: 'burn', cost: 3, dmgMin: 15, dmgMax: 29, fraco: 'brmeme' },
  { token: 'tai lung', nome: '🐼 Tai Lung: Golpe do Dragão', tipo: 'brmeme', effect: 'drain', cost: 3, dmgMin: 14, dmgMax: 27, fraco: 'normiememe' },
  { token: 'titanic', nome: '🚢 Rose: Não Solta a Mão', tipo: 'normiememe', effect: 'stun', cost: 1, dmgMin: 6, dmgMax: 15, fraco: 'dankmeme' },
  { token: 'grievous', nome: '🤖 Grievous: O Negociador', tipo: 'dankmeme', effect: 'armor', cost: 3, dmgMin: 13, dmgMax: 26, fraco: 'ragememe' },
  { token: 'brain', nome: '🧠 Brain: Vou Dormir?', tipo: 'normiememe', effect: 'stun', cost: 1, dmgMin: 5, dmgMax: 14, fraco: 'dankmeme' },
  { token: 'streetlight', nome: '💡 Poste: Leitura Noturna', tipo: 'dankmeme', effect: 'armor', cost: 2, dmgMin: 8, dmgMax: 18, fraco: 'ragememe' },
  { token: 'spider', nome: '🕷️ Spider-Man: Peter Parker', tipo: 'dankmeme', effect: 'armor', cost: 2, dmgMin: 9, dmgMax: 19, fraco: 'ragememe' },
  { token: 'taken', nome: '🔍 Taken: Eu Vou Te Achar', tipo: 'ragememe', effect: 'burn', cost: 3, dmgMin: 15, dmgMax: 28, fraco: 'brmeme' },
];

function buildAttackPool() {
  return TEMAS.map((t, i) => {
    const imgPath = acharImagem(t.token);
    return {
      id: `atk${i + 1}`,
      name: t.nome,
      type: t.tipo,
      typeLabel: getTypeLabel(t.tipo),
      cost: t.cost,
      dmgMin: t.dmgMin,
      dmgMax: t.dmgMax,
      image: imgPath ? `static/guerra/${path.basename(imgPath)}` : null,
      imgPath: imgPath || null,
      weakAgainst: t.fraco,
      weakLabel: getTypeLabel(t.fraco),
      effect: t.effect,
      effectLabel: getEffectLabel(t.effect),
    };
  });
}

function buildSpecials() {
  const efeitos = ['heavy', 'multi', 'heal'];
  return TEMAS.map((t, i) => {
    const imgPath = acharImagem(t.token);
    return {
      id: `sp${i + 1}`,
      name: `💥 Especial: ${t.nome.replace(/^[^a-zA-ZÀ-ÿ]+/, '')}`,
      cost: 3,
      dmgMin: 18,
      dmgMax: 40,
      image: imgPath ? `static/guerra/${path.basename(imgPath)}` : null,
      imgPath: imgPath || null,
      special: true,
      effect: efeitos[i % efeitos.length],
    };
  });
}

const POOL = buildAttackPool();
const SPECIALS = buildSpecials();

// Anexa a imagem de um ataque/especial ao embed e devolve os arquivos para o Discord.
function anexarImagem(embed, atk) {
  if (!atk || !atk.imgPath) return [];
  const ext = path.extname(atk.imgPath);
  const nome = `guerra_${Date.now()}_${rand(1000, 9999)}${ext}`;
  embed.setImage(`attachment://${nome}`);
  return [new AttachmentBuilder(atk.imgPath).setName(nome)];
}

function sampleOptions(pool, count = 4) {
  const out = [];
  const used = new Set();
  while (out.length < count && out.length < pool.length) {
    const idx = rand(0, pool.length - 1);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

function shortAvatarField(user) {
  return `${user.username} (${user.discriminator || ''})`;
}

function manualEmbed() {
  return criarEmbed({
    titulo: '⚔️ Manual da Guerra de Memes',
    descricao:
      'Uma batalha 1x1 por reações. Cada jogador começa com **100 HP** e **3 pontos de ação**.\n\n' +
      '**🎯 Como jogar**\n' +
      '• Use `$guerra @alguém` para desafiar. O marcado reage ✅ para aceitar ou ❌ para recusar.\n' +
      '• Marque a própria bot para uma **guerra solo** contra a máquina!\n' +
      '• Sem marcar ninguém? Aparece este manual. Use `$guerra placar` para o ranking.\n\n' +
      '**⚡ As reações por turno**\n' +
      '• `1️⃣ 2️⃣ 3️⃣ 4️⃣` — Atacar com o meme escolhido (cada um tem um **custo em pontos**).\n' +
      '• `🛡️` — **Defender**: ganha +1 ponto de ação (máx 5), não ataca.\n' +
      '• `⚡` — **Especial**: usa a arma coletada (custa 3 pontos; sorteia heal/multi/heavy).\n' +
      '• `🎁` — Aparece sozinho de vez em quando: reaja para pegar uma arma (bônus de dano).\n\n' +
      '**🧩 Tipos e efeitos**\n' +
      '• Rage Meme → 🔥 **Burn** (dano ao longo do tempo).\n' +
      '• Dank Meme → 🛡️ **Escudo** (reduz o dano que você recebe).\n' +
      '• BR Meme → 💧 **Drain** (cura parte do dano causado).\n' +
      '• Normie Meme → ⚡ **Stun** (o inimigo pula o próximo turno).\n\n' +
      '**🏆 Regras**\n' +
      '• Fraqueza de tipo dá **+25% de dano** (cada tipo é fraco contra outro).\n' +
      '• Sem pontos suficientes para um ataque? Você perde a vez.\n' +
      '• Vence quem deixar o HP do oponente em 0. Cada vitória entra no **placar**!',
    cor: THEME.corPrincipal,
    rodape: 'Use $guerra @oponente e bom combate ✧',
  });
}

function placarEmbed() {
  const lista = top(10);
  const corpo = lista.length
    ? lista.map((e, i) => `**${i + 1}.** ${e.nome} — \`${e.vitorias}\` vitória(s)`).join('\n')
    : 'Ainda não houve batalhas. Seja o primeiro campeão!';
  return criarEmbed({
    titulo: '🏆 Placar de Guerra',
    descricao: corpo,
    cor: THEME.corPrincipal,
    rodape: 'Maiores guerreiros de meme da lua ✧',
  });
}

// Responde o manual/placar já anexando uma imagem da pasta para dar cara ao comando.
function manualPayload() {
  const embed = manualEmbed();
  if (IMG_MANUAL) {
    const ext = path.extname(IMG_MANUAL);
    const nome = `manual${ext}`;
    embed.setImage(`attachment://${nome}`);
    return { embeds: [embed], files: [new AttachmentBuilder(IMG_MANUAL).setName(nome)] };
  }
  return { embeds: [embed] };
}

function placarPayload() {
  const embed = placarEmbed();
  if (IMG_MANUAL) {
    const ext = path.extname(IMG_MANUAL);
    const nome = `placar${ext}`;
    embed.setImage(`attachment://${nome}`);
    return { embeds: [embed], files: [new AttachmentBuilder(IMG_MANUAL).setName(nome)] };
  }
  return { embeds: [embed] };
}

module.exports = {
  data: { name: 'guerra', description: '⚔️ Inicia uma batalha contra outro usuário (desafie usando @)' },
  async execute(interaction) {
    const args = interaction.options && typeof interaction.options.getString === 'function'
      ? (interaction.options.getString('sub') || '').toLowerCase()
      : (interaction._guerraArgs || []).join(' ').toLowerCase();

    // Placar
    if (args === 'placar' || args === 'ranking') {
      return interaction.reply(placarPayload());
    }
    // Manual explícito
    if (args === 'manual' || args === 'ajuda' || args === 'help') {
      return interaction.reply(manualPayload());
    }

    // Resolução do oponente: prefere a menção da própria mensagem
    let opponent = interaction.options && interaction.options.getUser ? interaction.options.getUser('usuario') : null;
    if (!opponent && interaction._guerraMention) opponent = interaction._guerraMention;
    if (!opponent && interaction.channel) {
      const mencaoDireta = interaction.message && interaction.message.mentions && interaction.message.mentions.users
        ? interaction.message.mentions.users.first()
        : null;
      if (mencaoDireta) opponent = mencaoDireta;
    }

    // Sem oponente válido (ou bot que não seja a própria) -> mostra o manual
    if (!opponent || (opponent.bot && opponent.id !== interaction.client.user.id)) {
      return interaction.reply(manualPayload());
    }

    // Verifica cooldown de guerra
    const agora = Date.now();
    const ultimaGuerra = guerraCooldowns.get(interaction.user.id) || 0;
    if (agora - ultimaGuerra < GUERRA_COOLDOWN_MS) {
      const restante = Math.ceil((GUERRA_COOLDOWN_MS - (agora - ultimaGuerra)) / 1000);
      return interaction.reply({
        embeds: [
          criarEmbed({
            titulo: '⏱️ Calma, guerreiro!',
            descricao: `Espere mais **${restante}s** antes de iniciar outra batalha.`,
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }
    guerraCooldowns.set(interaction.user.id, agora);

    const isBotOponente = opponent.id === interaction.client.user.id;

    // Guerra solo: a própria bot aceita automaticamente
    if (!isBotOponente) {
      const chal = criarEmbed({
        titulo: '⚔️ Desafio de Guerra',
        descricao: `${interaction.user} desafiou ${opponent} para uma batalha!\n${opponent}, reaja com ✅ para aceitar ou ❌ para recusar.`,
        cor: THEME.corPrincipal,
      });
      const msg = await interaction.reply({ embeds: [chal], fetchReply: true });
      await msg.react('✅');
      await msg.react('❌');
      await msg.fetch();

      let accepted = false;
      try {
        const result = await registerChallenge(msg, opponent.id, 60000);
        if (result === '❌') {
          await msg.edit({ embeds: [criarEmbed({ titulo: 'Desafio recusado', descricao: `${opponent} recusou o desafio.`, cor: THEME.corErro })], components: [] });
          return;
        }
        accepted = result === '✅';
      } catch (e) {
        await msg.edit({ embeds: [criarEmbed({ titulo: 'Desafio expirado', descricao: 'Ninguém respondeu ao desafio.', cor: THEME.corErro })] });
        return;
      }
      if (!accepted) {
        await msg.edit({ embeds: [criarEmbed({ titulo: 'Desafio recusado', descricao: `${opponent} recusou o desafio.`, cor: THEME.corErro })], components: [] });
        return;
      }
    } else {
      const chal = criarEmbed({
        titulo: '🤖 Guerra Solo!',
        descricao: `${interaction.user} desafiou a própria máquina! Prepare-se para lutar contra ${opponent}...`,
        cor: THEME.corPrincipal,
      });
      await interaction.reply({ embeds: [chal], fetchReply: true });
    }

    // Inicializa combatentes
    const p1 = { id: interaction.user.id, user: interaction.user, hp: 100, points: 3, type: TIPOS_MEME[rand(0, 3)], weapons: [], statuses: [], avatar: interaction.user.displayAvatarURL({ size: 256 }), isBot: false };
    const botUser = isBotOponente ? opponent : interaction.client.user;
    const p2 = { id: opponent.id, user: opponent, hp: 100, points: 3, type: TIPOS_MEME[rand(0, 3)], weapons: [], statuses: [], avatar: opponent.displayAvatarURL({ size: 256 }), isBot: isBotOponente };
    const players = [p1, p2];

    let turn = 0;
    let round = 1;

    const renderStatusEmbed = (stateText = '') => {
      const embed = criarEmbed({
        titulo: '⚔️ Status da Guerra',
        descricao: `**${shortAvatarField(p1.user)}** — HP: \`${p1.hp}\` • Pontos: \`${p1.points}\` • Armas: \`${p1.weapons.length}\`\n${formatStatusLine(p1)}\n**${shortAvatarField(p2.user)}** — HP: \`${p2.hp}\` • Pontos: \`${p2.points}\` • Armas: \`${p2.weapons.length}\`\n${formatStatusLine(p2)}\n\n${stateText}`,
        cor: THEME.corPrincipal,
      });
      return embed;
    };

    const renderActionEmbed = (actor, text = '') => {
      const embed = criarEmbed({
        titulo: `Turno de ${actor.user.username}`,
        descricao: text || 'Escolha sua ação reagindo com um ícone abaixo.',
        cor: THEME.corPrincipal,
      });
      embed.setThumbnail(actor.avatar);
      return embed;
    };

    let battleMsg = await interaction.editReply({ embeds: [renderStatusEmbed('Preparando batalha...'), renderActionEmbed(p1, 'Aguardando início da batalha...')] });

    const attackPool = POOL.slice();

    // Decide a ação do bot (escolha simples: ataca o mais forte que pode pagar, senão defende)
    async function botAct() {
      const bot = players[1];
      const opts = sampleOptions(attackPool, 4);
      const affordable = opts.filter((o) => bot.points >= o.cost);
      if (affordable.length && bot.points >= 1) {
        const atk = affordable[rand(0, affordable.length - 1)];
        return { kind: 'attack', atk };
      }
      return { kind: 'defend' };
    }

    async function spawnPickup(actorId) {
      if (Math.random() > 0.18) return null;
      const item = { id: `wp_${Date.now()}`, name: `Arma Aleatória ${rand(1, 999)}`, bonus: rand(3, 12) };
      const pickEmbed = criarEmbed({ titulo: '🎁 Uma arma apareceu!', descricao: `Reaja com ${REACT_PICKUP} para pegar **${item.name}** (bônus ${item.bonus}).`, cor: 0xFFD166 });
      try {
        battleMsg = await interaction.editReply({ embeds: [renderStatusEmbed('Arma disponível!'), pickEmbed] });
        await battleMsg.react(REACT_PICKUP);
        const filter = (r, u) => r.emoji.name === REACT_PICKUP && [p1.id, p2.id].includes(u.id);
        const collected = await battleMsg.awaitReactions({ filter, max: 1, time: 8000 });
        const reaction = collected.first();
        if (reaction) {
          const user = reaction.users.cache.find((u) => [p1.id, p2.id].includes(u.id));
          if (user) {
            const owner = user.id === p1.id ? p1 : p2;
            owner.weapons.push(item);
            await battleMsg.edit({ embeds: [renderStatusEmbed(`Arma capturada por ${owner.user.username}!`), criarEmbed({ titulo: '🎉 Arma pega!', descricao: `${owner.user} pegou **${item.name}**!`, cor: 0x88E0EF })] });
            await sleep(TRANSITION_DELAY);
          }
        }
      } catch {}
      battleMsg = await interaction.editReply({ embeds: [renderStatusEmbed(), renderActionEmbed(players[turn], 'A batalha continua...')] });
    }

    while (p1.hp > 0 && p2.hp > 0) {
      const actor = players[turn];
      const target = players[1 - turn];

      const options = sampleOptions(attackPool, 4);
      const hasSpecial = actor.weapons && actor.weapons.length;

      const optsText = options.map((opt, i) => {
        const cant = actor.points < opt.cost;
        return `${EMOJI_NUM[i]} **${opt.name}** — tipo ${opt.typeLabel} / custo ${opt.cost}${cant ? ' (sem pontos!)' : ''} / dano ${opt.dmgMin}-${opt.dmgMax}${opt.effect ? ` / efeito ${opt.effectLabel}` : ''}`;
      }).join('\n');
      const actionText = `${optsText}\n\nSeus pontos: \`${actor.points}\`. Reaja com o número para atacar (gasta pontos). ${REACT_DEFEND} para defender (+1 ponto). ${REACT_SPECIAL} para usar Especial ${hasSpecial ? '(custa 3 pontos)' : '(sem armas)'}.`;

      const startEffects = applyStartOfTurnEffects(actor);
      const statusHeader = startEffects.text ? `Efeitos ativos:\n${startEffects.text}` : '';

      if (startEffects.skip) {
        battleMsg = await interaction.editReply({ embeds: [renderStatusEmbed(`⚡ ${actor.user.username} está atordoado e perdeu a vez!`), renderActionEmbed(actor, `⚡ Stun! ${actor.user.username} não pode agir neste turno.`)] });
        await sleep(TRANSITION_DELAY);
        try { await battleMsg.reactions.removeAll(); } catch {}
        turn = 1 - turn;
        round++;
        continue;
      }

      battleMsg = await interaction.editReply({ embeds: [renderStatusEmbed(`Round ${round} — vez de ${actor.user.username}`), renderActionEmbed(actor, `${statusHeader}\n${actionText}`)] });

      for (let i = 0; i < options.length; i++) await battleMsg.react(EMOJI_NUM[i]);
      await battleMsg.react(REACT_DEFEND);
      await battleMsg.react(REACT_SPECIAL);

      let choice = null;
      try {
        if (actor.isBot) {
          await sleep(ACTION_DELAY);
          const acao = await botAct();
          if (acao.kind === 'attack') {
            const idx = options.indexOf(acao.atk);
            choice = EMOJI_NUM[idx >= 0 ? idx : 0];
          } else {
            choice = REACT_DEFEND;
          }
        } else {
          const filter = (reaction, user) => {
            const emoji = reaction.emoji.name;
            return [REACT_DEFEND, REACT_SPECIAL, ...EMOJI_NUM].includes(emoji) && user.id === actor.id;
          };
          const collected = await battleMsg.awaitReactions({ filter, max: 1, time: 25000 });
          const reaction = collected.first();
          choice = reaction ? reaction.emoji.name : null;
        }
      } catch (e) {
        await battleMsg.edit({ embeds: [renderStatusEmbed('Ação perdida!'), criarEmbed({ titulo: 'Tempo esgotado', descricao: `${actor.user} não reagiu a tempo.`, cor: THEME.corErro })] });
        await sleep(TRANSITION_DELAY);
      }

      // resolve ação
      try {
        if (choice === REACT_DEFEND) {
          actor.points = Math.min(5, actor.points + 1);
          await battleMsg.edit({ embeds: [renderStatusEmbed(`${actor.user.username} defendeu!`), criarEmbed({ titulo: `${actor.user.username} defendeu!`, descricao: `Ganhou 1 ponto de ação.`, cor: 0x9AE66E })] });
          await sleep(ACTION_DELAY);
        } else if (choice === REACT_SPECIAL && actor.weapons.length) {
          if (actor.points < 3) {
            await battleMsg.edit({ embeds: [renderStatusEmbed(`${actor.user.username} não tem pontos!`), criarEmbed({ titulo: 'Pontos insuficientes', descricao: `${actor.user.username} precisa de 3 pontos para o Especial (tem ${actor.points}). Perdeu a vez.`, cor: THEME.corErro })] });
            await sleep(TRANSITION_DELAY);
          } else {
            actor.points -= 3;
            const w = actor.weapons.shift();
            const sp = SPECIALS[rand(0, SPECIALS.length - 1)];
            let dmg = w.bonus + rand(6, 18);
            let extra = '';
            if (sp.effect === 'heal') {
              const c = Math.min(15, Math.floor(dmg * 0.5));
              actor.hp = Math.min(100, actor.hp + c);
              extra = `\n💚 Curou ${c} de HP!`;
            } else if (sp.effect === 'multi') {
              dmg = Math.floor(dmg * 1.6);
              extra = '\n💥 Acerto múltiplo!';
            } else if (sp.effect === 'heavy') {
              dmg = Math.floor(dmg * 1.3);
              extra = '\n🏋️ Golpe pesado!';
            }
            target.hp = Math.max(0, target.hp - dmg);
            const spEmbed = criarEmbed({ titulo: `${actor.user.username} usou ${sp.name}!`, descricao: `Causou ${dmg} de dano.${extra}`, cor: 0xFF7BAC });
            const spFiles = anexarImagem(spEmbed, sp);
            await battleMsg.edit({ embeds: [renderStatusEmbed(`${actor.user.username} usou Especial! (-3 pt)`), spEmbed], files: spFiles });
            await sleep(ACTION_DELAY);
          }
        } else if (choice && EMOJI_NUM.includes(choice)) {
          const idx = EMOJI_NUM.indexOf(choice);
          const atk = options[idx];
          if (actor.points < atk.cost) {
            await battleMsg.edit({ embeds: [renderStatusEmbed(`${actor.user.username} não tem pontos!`), criarEmbed({ titulo: 'Pontos insuficientes', descricao: `${actor.user.username} precisava de ${atk.cost} ponto(s) (tem ${actor.points}). Perdeu a vez.`, cor: THEME.corErro })] });
            await sleep(TRANSITION_DELAY);
          } else {
            actor.points -= atk.cost;
            let dmg = rand(atk.dmgMin, atk.dmgMax);
            const statusText = [];
            if (atk.weakAgainst && atk.weakAgainst === target.type) {
              dmg = Math.floor(dmg * 1.25);
              statusText.push(`✨ Bônus de fraqueza contra ${atk.weakLabel}!`);
            }
            const armor = target.statuses && target.statuses.find((s) => s.type === 'armor');
            if (armor) {
              const reduction = Math.min(6, Math.max(2, Math.floor(dmg * 0.22)));
              dmg = Math.max(0, dmg - reduction);
              statusText.push(`🛡️ Escudo reduziu ${reduction} de dano!`);
            }
            target.hp = Math.max(0, target.hp - dmg);
            if (atk.effect === 'burn') {
              target.statuses.push({ type: 'burn', turns: 2, damage: 4 });
              statusText.push('🔥 Burn aplicado!');
            } else if (atk.effect === 'drain') {
              const heal = Math.min(6, Math.floor(dmg * 0.35));
              actor.hp = Math.min(100, actor.hp + heal);
              statusText.push(`💧 Drain curou ${heal} de HP!`);
            } else if (atk.effect === 'stun') {
              target.statuses.push({ type: 'stun', turns: 1 });
              statusText.push('⚡ Stun aplicado!');
            } else if (atk.effect === 'armor') {
              target.statuses.push({ type: 'armor', turns: 2 });
              statusText.push('🛡️ Escudo aplicado!');
            }
            const statusLine = statusText.length ? `\n${statusText.join('\n')}` : '';
            const atkEmbed = criarEmbed({ titulo: `${actor.user.username} usou ${atk.name}!`, descricao: `${actor.user} → ${target.user}\nDano: \`${dmg}\`${statusLine}`, cor: 0xF5A962 });
            const atkFiles = anexarImagem(atkEmbed, atk);
            await battleMsg.edit({ embeds: [renderStatusEmbed(`${actor.user.username} atacou! (-${atk.cost} pt)`), atkEmbed], files: atkFiles });
            await sleep(ACTION_DELAY);
          }
        } else {
          await battleMsg.edit({ embeds: [renderStatusEmbed('Ação perdida!'), criarEmbed({ titulo: 'Tempo esgotado', descricao: `${actor.user} não executou ação, perdeu a vez.`, cor: THEME.corErro })] });
          await sleep(TRANSITION_DELAY);
        }
      } catch (e) {
        await battleMsg.edit({ embeds: [renderStatusEmbed('Ação perdida!'), criarEmbed({ titulo: 'Tempo esgotado', descricao: `${actor.user} não reagiu a tempo.`, cor: THEME.corErro })] });
        await sleep(TRANSITION_DELAY);
      }

      await spawnPickup(actor.id);

      try { await battleMsg.reactions.removeAll(); } catch {}
      turn = 1 - turn;
      round++;
    }

    battleMsg = await interaction.editReply({ embeds: [renderStatusEmbed('Final da batalha!'), renderActionEmbed(players[turn], 'Resultado chegando...')] });

    const winner = p1.hp > 0 ? p1 : p2;
    const loser = p1.hp > 0 ? p2 : p1;

    // Registra vitória no placar (ignora vitória da própria bot)
    try {
      if (!winner.isBot) {
        registrarVitoria(winner.id, winner.user.username);
      } else {
        atualizarNome(loser.id, loser.user.username);
      }
    } catch {}

    const frames = [
      criarEmbed({ titulo: `🏆 ${winner.user.username} venceu!`, descricao: `${shortAvatarField(winner.user)} triunfou sobre ${shortAvatarField(loser.user)}.`, cor: 0xFFD166 }),
      criarEmbed({ titulo: `✨ Fraude Concluída`, descricao: `${winner.user} é o vencedor!`, cor: 0x88E0EF }),
    ];
    for (const f of frames) {
      try {
        await interaction.editReply({ embeds: [f] });
        await new Promise((r) => setTimeout(r, 900));
      } catch {}
    }

    return;
  },
};