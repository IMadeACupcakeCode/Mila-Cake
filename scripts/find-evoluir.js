const fs = require('fs');
const f = 'commands/pokemon.js';
let l = fs.readFileSync(f, 'utf8').split(/\r?\n/);
for (let i = 0; i < l.length; i++) {
  if (l[i].includes("case 'evoluir':")) {
    console.log(i + 1);
    break;
  }
}
