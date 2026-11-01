const path = require('path');
const { REST } = require('discord.js');
const { publicarComando } = require('../utils/discordCommandDeploy');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const { CLIENT_ID, DISCORD_TOKEN, GUILD_ID } = process.env;
  if (!CLIENT_ID || !DISCORD_TOKEN) {
    throw new Error(`Não foi possível publicar loja/carrinho: faltam ${!CLIENT_ID ? 'CLIENT_ID' : ''}${!CLIENT_ID && !DISCORD_TOKEN ? ' e ' : ''}${!DISCORD_TOKEN ? 'DISCORD_TOKEN' : ''} no .env.`);
  }

  const comandos = [
    require('../commands/loja'),
    require('../commands/carrinho'),
  ];
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const destinos = [
    { guildId: null, nome: 'global' },
    ...(GUILD_ID ? [{ guildId: GUILD_ID, nome: `servidor ${GUILD_ID}` }] : []),
  ];

  for (const destino of destinos) {
    for (const comando of comandos) {
      const resultado = await publicarComando(rest, {
        applicationId: CLIENT_ID,
        guildId: destino.guildId,
        data: comando.data,
      });
      const verbo = resultado.action === 'created' ? 'publicado' : 'atualizado';
      console.log(`✅ /${resultado.name} ${verbo} no escopo ${destino.nome}.`);
    }
  }
}

main().catch((erro) => {
  console.error('Falha ao publicar a loja:', erro?.message || erro);
  process.exitCode = 1;
});
