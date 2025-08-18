import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete a number of recent messages')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: 'You need Manage Messages permission to use this command.', flags: MessageFlags.Ephemeral });
      return;
    }
    const amount = interaction.options.getInteger('amount', true);
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'This command can only be used in text channels.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const deleted = await channel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) {
      await interaction.editReply('Failed to delete messages. I can only delete messages newer than 14 days and need proper permissions.');
      return;
    }
    await interaction.editReply(`Deleted ${deleted.size} messages.`);
  },
};

export default command;


