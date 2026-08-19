const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Carrega .env da raiz do projeto
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Mapa de comandos slash registráveis (apenas os que possuem SlashCommandBuilder)
const comandos = new Map();

function carregar() {
  const pasta = path.join(__dirname, '..', 'commands');
  for (const arquivo of fs.readdirSync(pasta)) {
    if (!arquivo.endsWith('.js')) continue;
    const mod = require(path.join(pasta, arquivo));
    // Só considera comandos que realmente são slash (têm .toJSON de builder)
    if (mod && mod.data && typeof mod.data.toJSON === 'function' && typeof mod.execute === 'function') {
      comandos.set(mod.data.name, mod);
    }
  }
}

// Registra os slash commands no Discord (guild-scoped se GUILD_ID existir)
async function registrar() {
  const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;
  if (!CLIENT_ID || !DISCORD_TOKEN) return;

  carregar();
  const body = Array.from(comandos.values()).map((c) => c.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  try {
    await rest.put(route, { body });
    console.log(`${'✧ ⎯ ੭'} Slash commands registrados (${comandos.size}).`);
  } catch (err) {
    console.error('Erro ao registrar slash commands:', err);
  }
}

// Roteia interações: autocomplete e comandos chat-input
async function tratar(interaction) {
  try {
    if (interaction.isAutocomplete()) {
      const cmd = comandos.get(interaction.commandName);
      if (cmd && typeof cmd.autocomplete === 'function') {
        await cmd.autocomplete(interaction);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const cmd = comandos.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction);
    }
  } catch (err) {
    console.error('Erro na interação slash:', err);
  }
}

module.exports = { carregar, registrar, tratar, comandos };