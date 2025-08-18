import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import type { BotCommand } from './types/command';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // For faster dev: register in a single guild

if (!token || !clientId || !guildId) {
  console.error('Missing env vars. Require DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID');
  process.exit(1);
}

// Load command definitions from files
const commandsDir = path.join(__dirname, 'commands');
const commandJson = (() => {
  if (!fs.existsSync(commandsDir)) return [] as unknown[];
  const files = fs.readdirSync(commandsDir).filter(f => (f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'));
  const list: unknown[] = [];
  for (const file of files) {
    const mod = require(path.join(commandsDir, file));
    const cmd: BotCommand | undefined = mod.default ?? mod.command ?? mod;
    if (cmd?.data) list.push(cmd.data.toJSON());
  }
  return list;
})();

const rest = new REST({ version: '10' }).setToken(token);

async function main() {
  try {
    await rest.put(Routes.applicationGuildCommands(clientId!, guildId!), {
      body: commandJson,
    });
    console.log('Registered slash commands.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();


