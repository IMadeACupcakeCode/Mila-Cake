const loja = require('./loja');

module.exports = {
  data: {
    ...loja.data,
    name: 'carrinho',
    description: 'Abra o catálogo interativo da Loja da Mila',
  },
  execute: loja.execute,
};
