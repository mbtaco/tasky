import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice (d6 or d20)')
    .addStringOption((option) =>
      option
        .setName('dice')
        .setDescription('Choose a die to roll')
        .addChoices({ name: 'd6', value: 'd6' }, { name: 'd20', value: 'd20' })
        .setRequired(true)
    ),
  async execute(interaction) {
    const dice = interaction.options.getString('dice', true);
    const sides = dice === 'd20' ? 20 : 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    await interaction.reply(`🎲 You rolled a ${dice}: ${roll}`);
  },
};

export default command;


