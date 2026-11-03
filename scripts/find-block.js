const fs = require('fs');
const f = 'commands/pokemon.js';
let l = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const start = l.findIndex((line) => line.includes("if (interacao.customId === 'pokemon_evoluir_confirmar') {"));
// find the next "return;" after the final interacao.update in this block (before fechar)
let end = -1;
for (let i = start + 1; i < l.length; i++) {
  if (l[i].includes("interacao.update({") && l[i+1] && l[i+1].includes("Uma evolução aconteceu")) {
    // find closing of this update call
    for (let j = i; j < l.length; j++) {
      if (l[j].trim() === "components: []," && l[j+1] && l[j+1].trim() === "});") {
        end = j + 2;
        break;
      }
    }
    break;
  }
}
console.log('start', start+1, 'end', end+1);
// We'll just print, not replace, to verify
