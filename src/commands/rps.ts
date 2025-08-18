import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock–Paper–Scissors with the bot')
    .addStringOption((option) =>
      option
        .setName('move')
        .setDescription('Choose your move')
        .addChoices({ name: 'rock', value: 'rock' }, { name: 'paper', value: 'paper' }, { name: 'scissors', value: 'scissors' })
        .setRequired(true)
    ),
  async execute(interaction) {
    const move = interaction.options.getString('move', true) as 'rock' | 'paper' | 'scissors';
    const moves = ['rock', 'paper', 'scissors'] as const;
    const botMove = moves[Math.floor(Math.random() * moves.length)];
    const outcome =
      move === botMove ? "It's a tie!" :
      (move === 'rock' && botMove === 'scissors') ||
      (move === 'paper' && botMove === 'rock') ||
      (move === 'scissors' && botMove === 'paper')
        ? 'You win!' : 'You lose!';
    await interaction.reply(`You chose ${move}, I chose ${botMove}. ${outcome}`);
  },
};

export default command;


