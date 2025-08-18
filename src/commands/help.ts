import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import type { BotCommand } from '../types/command';

const command: BotCommand = {
  data: new SlashCommandBuilder().setName('help').setDescription('List available commands'),
  async execute(interaction) {
    const embed = new EmbedBuilder().setTitle('Help').setColor(Colors.Blurple).addFields(
      { name: 'Server Utilities',
        value:
`\`/serverinfo\` • server stats (Admin)
\`/purge [amount]\` • bulk delete (Admin)
\`/avatar [user]\` • show avatar
\`/userinfo [user]\` • user details`,
        inline: true,
      },
      { name: 'Bot Utilities',
        value:
`\`/help\` • show this help
\`/ping\` • check bot latency
\`/uptime\` • show how long the bot has been online`,
        inline: true,
      },
      
      { name: 'Fun',
        value:
`\`/8ball [question]\` • magic 8-ball answers
\`/quote\` • random quote
\`/rps [rock|paper|scissors]\` • play Rock-Paper-Scissors
\`/coinflip\` • flips a coin
\`/roll [d6|d20]\` • roll dice
\`/roast [user]\` • roast a user
\`/trivia\` • trivia game
\`/compliment [user]\` • compliment a user`,
        inline: true,
      },
    );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;