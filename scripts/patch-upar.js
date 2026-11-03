const fs = require('fs');
const f = 'commands/pokemon.js';
let l = fs.readFileSync(f, 'utf8').split(/\r?\n/);
// find "  case 'upar':" followed by "  case 'evoluir': {"
for (let i = 0; i < l.length; i++) {
  if (l[i].trim() === "case 'upar':" && l[i+1] && l[i+1].trim() === "case 'evoluir': {") {
    // replace the two lines with the new upar case + evoluir case
    const newBlock = `  case 'upar': {
    const identificador = options.getString('captura');
    const owned = resolverCaptura(user.id, identificador);
    if (!owned) return responderTexto(ctx, 'Captura não encontrada', 'Confira o ID, o nome ou a posição na sua coleção global com \`/pokemon colecao\` e tente novamente. Você também pode usar o nome ou a posição na lista.', THEME.corErro);
    const quantidadeOuItem = String(options.getString('destino') || '').trim();
    let xpGanho = 0;
    let itemUsado = null;
    if (/^\\d+$/.test(quantidadeOuItem)) {
      const qtd = Math.max(1, Number(quantidadeOuItem));
      const saldo = criador.ehCriador(user) ? Infinity : (db.getUsuario(user.id)?.acucares || 0);
      if (saldo < qtd) return responderTexto(ctx, 'Açúcares insuficientes', \`Você tem **\${saldo}** açúcares e precisa de **\${qtd}**. Ganhe mais com missões, trabalhos ou vendendo itens.\`, THEME.corErro);
      if (!criador.ehCriador(user)) db.addAcucares(user.id, -qtd);
      xpGanho = qtd;
    } else if (quantidadeOuItem) {
      const item = pokemon.buscarItem(quantidadeOuItem);
      if (!item || item.tipo !== 'xp') return responderTexto(ctx, 'Item inválido', 'Use um número de açúcares (ex.: \`$p upar 1 500\`) ou um item de XP como **Doce Raro** (ex.: \`$p upar 1 doce_raro\`).', THEME.corErro);
      const inv = pokemon.obterInventario(user.id).itens.find((candidato) => candidato.id === item.id);
      if (!inv || inv.quantidade < 1) return responderTexto(ctx, 'Item não encontrado', \`Você não tem **\${item.nome}** no inventário. Compre na loja Pokémon.\`, THEME.corLembrete);
      if (!pokemon.consumirItem(user.id, item.id)) return responderTexto(ctx, 'Não foi possível usar o item', 'Tente novamente.', THEME.corErro);
      xpGanho = Number(item.xp) || 1000;
      itemUsado = item;
    } else {
      const proximo = pokemon.xpNecessarioParaNivel(owned.level);
      return responder(ctx, {
        embeds: [embed(
          'Como upar este Pokémon?',
          \`**\${owned.name_pt}** · Captura \\\`\${owned.id}\\\` · Nível \${owned.level} · XP: \${owned.xp || 0}/\${proximo}\\n\\n\` +
          \`Use açúcares: \\\`$p upar \${owned.id} 500\\\` (1 açúcar = 1 XP)\\n\` +
          \`Ou um Doce Raro: \\\`$p upar \${owned.id} doce_raro\\\` (1000 XP)\\n\\n\` +
          \`Ganhe XP também conversando no chat: cada mensagem dá 5 XP a um Pokémon aleatório da sua coleção.\`,
          THEME.corPrincipal,
          pokemon.spriteUrl(owned.pokemon_id, Boolean(owned.shiny), owned.species_name),
          'Mila Pokémon · upar Pokémon',
          user.displayAvatarURL?.({ size: 128 })
        )],
      }, true);
    }
    const resultado = pokemon.ganharXpPokemon(user.id, owned.id, xpGanho);
    if (!resultado.ok) return responderTexto(ctx, 'Não foi possível upar', 'Tente novamente.', THEME.corErro);
    return responder(ctx, {
      embeds: [embed(
        resultado.subiu ? 'Nível aumentado!' : 'XP adicionado!',
        \`**\${owned.name_pt}** ganhou **\${xpGanho} XP**\${itemUsado ? \` com \${itemUsado.emoji} **\${itemUsado.nome}**\` : ''}.\\n\\nNível: **\${resultado.nivel}** · XP: **\${resultado.xp}/\${resultado.proximo}**\${resultado.subiu ? \`\\n\\n⬆️ Subiu de nível!\` : ''}\`,
        resultado.subiu ? THEME.corSucesso : THEME.corPrincipal,
        pokemon.spriteUrl(owned.pokemon_id, Boolean(owned.shiny), owned.species_name),
        'Mila Pokémon · upar Pokémon',
        user.displayAvatarURL?.({ size: 128 })
      )],
    }, true);
  }

  case 'evoluir': {`;
    l.splice(i, 2, newBlock);
    break;
  }
}
fs.writeFileSync(f, l.join('\n'));
console.log('done');
