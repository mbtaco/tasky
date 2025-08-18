import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Detailed profile for a user (server join date, roles, etc)')
    .addUserOption((option) => option.setName('user').setDescription('Target user (defaults to you)').setRequired(false))
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
    const roles = member ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || 'None' : 'None';
    const embed = new EmbedBuilder()
      .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined', value: member ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : 'Unknown', inline: true },
        { name: 'Roles', value: roles, inline: false },
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;


