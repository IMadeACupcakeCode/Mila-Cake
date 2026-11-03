const fs = require('fs');
const f = 'commands/pokemon.js';
let l = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const start = l.findIndex((line) => line.includes("const resultado = await pokemon.evoluirPokemon(user.id, captura.id, estado.destino);"));
console.log('start', start+1);
for (let i = start; i < start + 40; i++) console.log(i+1, l[i]);
