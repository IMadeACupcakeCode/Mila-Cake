const fs = require('fs');
const path = require('path');
const { REST, Routes, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('./perms');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const comandos = new Map();
const interacoesEmProcessamento = new Set();

function nomeValido(nome) {
  return typeof nome === 'string' && /^[\w-]{1,32}$/.test(nome) && nome === nome.toLowerCase();
}

function validarOpcoes(options, contexto = 'options') {
  if (options === undefined) return [];
  if (!Array.isArray(options) || options.length > 25) return [`${contexto}: deve ser uma lista com no máximo 25 itens`];
  const erros = [];
  const nomes = new Set();
  let opcaoOpcional = false;
  for (const [indice, option] of options.entries()) {
    const local = `${contexto}[${indice}]`;
    if (!option || !nomeValido(option.name) || typeof option.description !== 'string' || !option.description.trim() || typeof option.type !== 'number') {
      erros.push(`${local}: nome, descrição e tipo são obrigatórios`);
      continue;
    }
    if (nomes.has(option.name)) erros.push(`${local}: nome duplicado ${option.name}`);
    nomes.add(option.name);
    if (option.required === false) opcaoOpcional = true;
    if (opcaoOpcional && option.required === true) erros.push(`${local}: opção obrigatória não pode vir depois de opcional`);
    if (option.choices && (!Array.isArray(option.choices) || option.choices.length > 25)) erros.push(`${local}: choices inválidas`);
    erros.push(...validarOpcoes(option.options, `${local}.options`));
  }
  return erros;
}

function validarData(data) {
  if (!data || !nomeValido(data.name) || typeof data.description !== 'string' || !data.description.trim()) return ['metadata básica inválida'];
  return validarOpcoes(data.options);
}

function serializarData(data) {
  if (data && typeof data.toJSON === 'function') return data.toJSON();
  if (!data || !Array.isArray(data.options)) return data;
  return {
    ...data,
    options: data.options.map((option) => ({
      ...option,
      choices: option.choices?.slice(0, 25),
      options: Array.isArray(option.options) ? option.options.map((child) => ({
        ...child,
        choices: child.choices?.slice(0, 25),
      })) : option.options,
    })),
  };
}

function carregar() {
  comandos.clear();
  const pasta = path.join(__dirname, '..', 'commands');
  const invalidos = [];

  for (const arquivo of fs.readdirSync(pasta).sort()) {
    if (!arquivo.endsWith('.js')) continue;
    const caminho = path.join(pasta, arquivo);
    try {
      delete require.cache[require.resolve(caminho)];
      const mod = require(caminho);
      const data = serializarData(mod?.data);
      const errosData = validarData(data);
      if (errosData.length || typeof mod.execute !== 'function') {
        invalidos.push(`${arquivo}: ${errosData.concat(typeof mod.execute !== 'function' ? ['execute ausente'] : []).join('; ') || 'exportação inválida'}`);
        continue;
      }
      if (comandos.has(data.name)) {
        invalidos.push(`${arquivo}: nome duplicado ${data.name}`);
        continue;
      }
      comandos.set(data.name, { ...mod, data: mod.data, json: data });
    } catch (erro) {
      invalidos.push(`${arquivo}: ${erro?.message || erro}`);
    }
  }

  if (invalidos.length) {
    console.warn(`⚠️ ${invalidos.length} comando(s) ignorado(s):\n- ${invalidos.join('\n- ')}`);
  }
  return { comandos, invalidos };
}

function listarJson() {
  return Array.from(comandos.values()).map((comando) => comando.json || serializarData(comando.data));
}

async function registrar() {
  const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;
  const resultado = carregar();
  if (!CLIENT_ID || !DISCORD_TOKEN) {
    console.warn(`⚠️ Registro slash desativado: faltam ${!CLIENT_ID ? 'CLIENT_ID' : ''}${!CLIENT_ID && !DISCORD_TOKEN ? ' e ' : ''}${!DISCORD_TOKEN ? 'DISCORD_TOKEN' : ''}. Comandos carregados: ${comandos.size}.`);
    return { ok: false, skipped: true, ...resultado };
  }

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  try {
    await rest.put(route, { body: listarJson() });
    console.log(`✧ ⎯ ੭ Slash commands registrados (${comandos.size}${GUILD_ID ? ` na guild ${GUILD_ID}` : ''}).`);
    return { ok: true, ...resultado };
  } catch (erro) {
    console.error('Erro ao registrar slash commands:', erro?.message || erro);
    return { ok: false, ...resultado, error: erro };
  }
}

function temPermissao(membro, permissao) {
  if (!permissao) return true;
  if (!membro?.permissions?.has) return false;
  return membro.permissions.has(PermissionFlagsBits[permissao] || permissao);
}

async function preflight(interaction, cmd) {
  const meta = cmd.meta || {};
  if (meta.guildOnly && !interaction.guildId) return '❌ Este comando só pode ser usado dentro de um servidor.';
  if (meta.staff && !isStaff(interaction.member)) return '❌ Você não tem permissão para usar este comando.';
  if (meta.permissions && !meta.permissions.some((permissao) => temPermissao(interaction.member, permissao))) {
    return '❌ Você não tem permissão para usar este comando.';
  }
  return null;
}

async function responderErro(interaction, mensagem) {
  try {
    if (interaction.deferred) return await interaction.editReply({ content: mensagem, embeds: [], components: [] });
    if (interaction.replied) return await interaction.followUp({ content: mensagem, ephemeral: true });
    return await interaction.reply({ content: mensagem, ephemeral: true });
  } catch {
    return null;
  }
}

async function tratar(interaction, client) {
  if (!interaction?.isAutocomplete?.() && !interaction?.isChatInputCommand?.()) return false;
  if (interaction.isChatInputCommand() && interaction.id) {
    if (interacoesEmProcessamento.has(interaction.id)) return true;
    interacoesEmProcessamento.add(interaction.id);
    setTimeout(() => interacoesEmProcessamento.delete(interaction.id), 120_000);
  }
  if (interaction.isChatInputCommand() && (interaction.replied || interaction.deferred)) return true;

  try {
    const cmd = comandos.get(interaction.commandName);
    if (!cmd) {
      if (interaction.isAutocomplete()) await interaction.respond([]).catch(() => {});
      else await responderErro(interaction, '❌ Este comando não está disponível no momento.');
      return true;
    }

    if (interaction.isAutocomplete()) {
      if (typeof cmd.autocomplete === 'function') await cmd.autocomplete(interaction, client);
      else await interaction.respond([]).catch(() => {});
      return true;
    }

    const erroPreflight = await preflight(interaction, cmd);
    if (erroPreflight) {
      await responderErro(interaction, erroPreflight);
      return true;
    }
    await cmd.execute(interaction, client);
  } catch (erro) {
    console.error(`Erro no comando slash ${interaction.commandName}:`, erro);
    if (interaction.isAutocomplete()) await interaction.respond([]).catch(() => {});
    else if (erro?.code !== 10062) await responderErro(interaction, '❌ Não consegui concluir esse comando agora. Tente novamente em instantes.');
  }
  return true;
}

if (require.main === module) {
  registrar().then((resultado) => {
    if (!resultado.ok && !resultado.skipped) process.exitCode = 1;
  });
}

module.exports = { carregar, listarJson, registrar, tratar, comandos, nomeValido, validarData, preflight };
