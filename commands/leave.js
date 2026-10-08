const sair = require('./sair');
module.exports = { ...sair, data: { ...sair.data, name: 'leave', description: 'Leave the voice channel and stop music' } };
