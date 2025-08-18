import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Overview of server stats (members, roles, channels)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const guild = interaction.guild!;
    const channels = await guild.channels.fetch();
    const textCount = channels.filter(c => c?.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter(c => c?.type === ChannelType.GuildVoice).size;
    const roleCount = (await guild.roles.fetch()).size;
    const memberCount = guild.memberCount;
    const embed = new EmbedBuilder()
      .setTitle(`${guild.name}`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Members', value: `${memberCount}`, inline: true },
        { name: 'Roles', value: `${roleCount}`, inline: true },
        { name: 'Text Channels', value: `${textCount}`, inline: true },
        { name: 'Voice Channels', value: `${voiceCount}`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;


