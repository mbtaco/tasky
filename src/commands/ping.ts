import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  async execute(interaction) {
    await interaction.reply({ content: 'Pinging...' });
    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Pong! Latency: ${latency}ms`);
  },
};

export default command;


