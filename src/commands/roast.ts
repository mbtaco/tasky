import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const ROASTS = [
  "I'd agree with you, but then we'd both be wrong.",
  'You have the right to remain silent because whatever you say will probably be stupid anyway.',
  "I'm not saying I hate you, but I would unplug your life support to charge my phone.",
  'If laughter is the best medicine, your face must be curing the world.',
];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Send a playful roast to a user')
    .addUserOption((option) => option.setName('user').setDescription('Target user').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const line = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    await interaction.reply(`${target}: ${line}`);
  },
};

export default command;


