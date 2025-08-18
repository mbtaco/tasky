import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  type VoiceChannel,
  type StageChannel,
} from 'discord.js';
import type { BotCommand } from '../types/command';

function isVoiceLike(
  channel: any
): channel is VoiceChannel | StageChannel {
  return (
    channel?.type === ChannelType.GuildVoice ||
    channel?.type === ChannelType.GuildStageVoice
  );
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('moveall')
    .setDescription('Move all members from one voice channel to another')
    .addChannelOption((opt) =>
      opt
        .setName('to')
        .setDescription('Destination voice channel')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('from')
        .setDescription('Source voice channel (defaults to your current)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Use this in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const guild = interaction.guild!;
    const me = guild.members.me;
    if (!me) {
      await interaction.reply({ content: 'Bot member not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!me.permissions.has(PermissionFlagsBits.MoveMembers)) {
      await interaction.reply({ content: 'I need the Move Members permission.', flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.options.getChannel('to', true);
    const providedSource = interaction.options.getChannel('from');

    if (!isVoiceLike(target)) {
      await interaction.reply({ content: 'Destination must be a voice channel.', flags: MessageFlags.Ephemeral });
      return;
    }

    let source = providedSource;
    if (!source) {
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      source = member?.voice?.channel ?? null;
    }

    if (!isVoiceLike(source)) {
      await interaction.reply({ content: 'Specify a source voice channel or join one.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (source.id === target.id) {
      await interaction.reply({ content: 'Source and destination cannot be the same.', flags: MessageFlags.Ephemeral });
      return;
    }

    const members = source.members;
    if (!members.size) {
      await interaction.reply({ content: 'No members to move in the source channel.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Optional: check channel-level permission overrides
    const botCanMoveFrom = source.permissionsFor(me).has(PermissionFlagsBits.MoveMembers);
    const botCanMoveTo = target.permissionsFor(me).has(PermissionFlagsBits.MoveMembers);
    if (!botCanMoveFrom || !botCanMoveTo) {
      await interaction.reply({ content: 'I need Move Members permission in both channels.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const results = await Promise.allSettled(
      members.map((m) => m.voice.setChannel(target).then(() => m.user.tag))
    );

    const moved = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - moved;

    await interaction.editReply(
      `Attempted to move ${results.length} member(s) from <#${source.id}> to <#${target.id}>. ` +
        `Moved: ${moved}${failed ? `, Failed: ${failed}` : ''}`
    );
  },
};

export default command;


