import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder().setName('uptime').setDescription('Show how long the bot has been online'),
  async execute(interaction) {
    const up = process.uptime();
    const hours = Math.floor(up / 3600);
    const minutes = Math.floor((up % 3600) / 60);
    const seconds = Math.floor(up % 60);
    await interaction.reply(`Uptime: ${hours}h ${minutes}m ${seconds}s`);
  },
};

export default command;


