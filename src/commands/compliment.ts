import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const COMPLIMENTS = [
  'You light up the room!',
  'You have impeccable manners.',
  'You are an awesome friend.',
  'Your positivity is infectious.',
];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Send a nice compliment to a user')
    .addUserOption((option) => option.setName('user').setDescription('Target user').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const line = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    await interaction.reply(`${target}: ${line}`);
  },
};

export default command;


