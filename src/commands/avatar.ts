import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Fetch a user's avatar in full size")
    .addUserOption((option) => option.setName('user').setDescription('Target user (defaults to you)').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const url = user.displayAvatarURL({ size: 1024 });
    await interaction.reply(url);
  },
};

export default command;


