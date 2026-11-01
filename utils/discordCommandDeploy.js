const { Routes } = require('discord.js');

async function publicarComando(rest, { applicationId, guildId = null, data }) {
  if (!rest || !applicationId || !data?.name) {
    throw new TypeError('REST, applicationId e o comando são obrigatórios para publicar um comando slash.');
  }

  const collectionRoute = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);
  const existingCommands = await rest.get(collectionRoute);
  if (!Array.isArray(existingCommands)) {
    throw new TypeError(`O Discord retornou uma lista inválida de comandos para ${guildId ? 'o servidor' : 'a aplicação'}.`);
  }

  const existing = existingCommands.find((command) => command.name === data.name);
  if (existing) {
    const route = guildId
      ? Routes.applicationGuildCommand(applicationId, guildId, existing.id)
      : Routes.applicationCommand(applicationId, existing.id);
    await rest.patch(route, { body: data });
    return { action: 'updated', name: data.name, guildId };
  }

  await rest.post(collectionRoute, { body: data });
  return { action: 'created', name: data.name, guildId };
}

module.exports = { publicarComando };
