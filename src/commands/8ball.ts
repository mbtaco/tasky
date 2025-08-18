import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const RESPONSES = [
  'It is certain.', 'Without a doubt.', 'You may rely on it.', 'Yes, definitely.', 'As I see it, yes.',
  'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy, try again.',
  'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  "Don't count on it.", 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the Magic 8-Ball a question')
    .addStringOption((option) => option.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    const question = interaction.options.getString('question', true);
    await interaction.reply(`🎱 Q: ${question}\nA: ${answer}`);
  },
};

export default command;


