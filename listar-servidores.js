const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client, GatewayIntentBits } = require('discord.js');

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN não encontrado no .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log('\n✅ Bot conectado!\n');
  console.log('📋 SERVIDORES ONDE A MILA CAKE ESTÁ:\n');
  console.log('='.repeat(70));

  const guilds = client.guilds.cache.sort((a, b) => a.name.localeCompare(b.name));

  guilds.forEach((guild, index) => {
    console.log(`${index + 1}. ${guild.name}`);
    console.log(`   ID: ${guild.id}`);
    console.log(`   Membros: ${guild.memberCount}`);
    console.log('');
  });

  console.log('='.repeat(70));
  console.log(`\n📊 Total: ${guilds.size} servidores\n`);

  // Desconecta e encerra
  await client.destroy();
  process.exit(0);
});

client.on('error', (error) => {
  console.error('❌ Erro:', error);
  process.exit(1);
});

console.log('🔄 Conectando ao Discord...');
client.login(DISCORD_TOKEN);
