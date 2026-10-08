const say = require('./say');

module.exports = {
  ...say,
  meta: { guildOnly: true, permissions: ['Administrator'] },
  data: {
    ...say.data,
    name: 'falar',
    description: '💬 Alias slash de /say para fazer a Mila falar',
  },
};
