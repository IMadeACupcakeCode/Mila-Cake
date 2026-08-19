const challenges = new Map();

async function registerChallenge(message, opponentId, timeout = 60000) {
  if (!message || !message.id) throw new Error('Mensagem de desafio inválida.');
  const key = message.id;
  if (challenges.has(key)) throw new Error('Desafio já registrado');

  await message.fetch();
  const resolveImmediate = checkExistingReactions(message, opponentId);
  if (resolveImmediate) return resolveImmediate;

  let timeoutId;
  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      challenges.delete(key);
      reject(new Error('time'));
    }, timeout);
    challenges.set(key, { opponentId, resolve, reject, timeoutId });
  });

  return promise.finally(() => {
    const active = challenges.get(key);
    if (active) {
      clearTimeout(active.timeoutId);
      challenges.delete(key);
    }
  });
}

function checkExistingReactions(message, opponentId) {
  const accept = message.reactions.cache.get('✅');
  if (accept) {
    const users = accept.users.cache;
    if (users.has(opponentId)) return '✅';
  }

  const decline = message.reactions.cache.get('❌');
  if (decline) {
    const users = decline.users.cache;
    if (users.has(opponentId)) return '❌';
  }

  return null;
}

async function handleReaction(reaction, user) {
  if (!reaction || !user || user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }
  const message = reaction.message;
  if (!message || !challenges.has(message.id)) return;

  const challenge = challenges.get(message.id);
  if (!challenge || user.id !== challenge.opponentId) return;

  const emoji = reaction.emoji.name;
  if (emoji !== '✅' && emoji !== '❌') return;

  challenge.resolve(emoji);
  clearTimeout(challenge.timeoutId);
  challenges.delete(message.id);
}

module.exports = { registerChallenge, handleReaction };