const join = require('./join');

module.exports = {
  ...join,
  data: {
    ...join.data,
    name: 'entrar',
    description: '🔊 Entra no seu canal de voz (alias de /join)',
  },
};
