import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Partials, ActivityType, MessageFlags } from 'discord.js';
import { registerDmAiHandler } from './handlers/dm';
import fs from 'fs';
import path from 'path';
import type { BotCommand } from './types/command';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in environment. Create a .env with DISCORD_TOKEN=your_token');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  c.user.setPresence({
    activities: [
      { type: ActivityType.Custom, name: 'DM me for AI!' }
    ],
    status: 'online'
  });
});

// Load commands from src/commands (or dist/commands when built)
const commands = new Map<string, BotCommand>();
const commandsDir = path.join(__dirname, 'commands');
if (fs.existsSync(commandsDir)) {
  const files = fs.readdirSync(commandsDir).filter(f => (f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'));
  for (const file of files) {
    const mod = require(path.join(commandsDir, file));
    const cmd: BotCommand | undefined = mod.default ?? mod.command ?? mod;
    if (cmd && cmd.data && typeof cmd.execute === 'function') {
      commands.set(cmd.data.name, cmd);
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `Error: ${message}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `Error: ${message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

// DM AI handler
registerDmAiHandler(client);

client.login(token);


