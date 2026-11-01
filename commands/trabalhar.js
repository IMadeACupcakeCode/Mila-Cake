const trabalho = require('../utils/economyTrabalho');

module.exports = {
  data: {
    name: 'trabalhar',
    description: '👩‍🍳 Faça um turno na confeitaria e ganhe açúcares',
  },
  async execute(interaction, client) {
    await trabalho.iniciar(interaction, client);
  },
};
