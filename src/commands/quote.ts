import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const QUOTES = [
  'The best time to plant a tree was 20 years ago. The second best time is now.',
  'Do or do not. There is no try. — Yoda',
  'Stay hungry, stay foolish. — Steve Jobs',
  'Life is what happens when you’re busy making other plans. — John Lennon',
  'I am not superstitious, but I am a little stitious. — Michael Scott',
];

const command: BotCommand = {
  data: new SlashCommandBuilder().setName('quote').setDescription('Get a random quote'),
  async execute(interaction) {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    await interaction.reply(`💬 ${q}`);
  },
};

export default command;


