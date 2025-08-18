# Tasky Discord Bot

A Discord bot that provides AI-powered conversations through direct messages using Google's Gemini 2.5 Flash model.

## Features

- **AI Direct Messages**: Send DMs to the bot for AI-powered conversations
- **Conversation Memory**: The bot remembers your conversation history within each DM
- **Conversation Control**: Use commands like `!clear`, `!reset`, `!stop`, or `!forget` to reset the conversation
- **Slash Commands**: Includes basic commands like `/ping` for bot interaction

## Setup

### Prerequisites

- Node.js 18.17 or higher
- A Discord application and bot token
- A Google Gemini API key

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd tasky
npm install
```

2. Create a `.env` file in the project root with the following:

```bash
# Required to run the bot
DISCORD_TOKEN=your-bot-token

# Required to deploy slash commands (guild-scoped)
DISCORD_CLIENT_ID=your-application-client-id
DISCORD_GUILD_ID=your-test-guild-id

# Required to enable AI DMs
GEMINI_API_KEY=your-gemini-api-key
```

3. In the Discord Developer Portal for your application:
- Enable the Message Content Intent: Bot → Privileged Gateway Intents → toggle "Message Content Intent".
- Invite the bot to your server using an OAuth URL with scopes `bot` and `applications.commands`. For DM-only usage, no special permissions are required. Example template:
  - `https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=0`

4. Register slash commands (guild-scoped for faster propagation):

```bash
npm run deploy:commands
```

5. Run the bot in development (auto-reloads on changes):

```bash
npm run dev
```

6. Build and run in production:

```bash
npm run build
npm start
```

Or do everything (build, deploy commands, start) with:

```bash
npm run release
```

## Usage

- **DM the bot**: Chat directly with the bot. It remembers the recent conversation within the DM.
- **Reset memory**: Send one of `!clear`, `!reset`, `!stop`, or `!forget` in the DM to clear context.
- **Slash commands**: Try `/ping`. Additional commands are in `src/commands`.

## Environment variables

- **DISCORD_TOKEN**: Your bot token (required).
- **DISCORD_CLIENT_ID**: App client ID (required for command deployment).
- **DISCORD_GUILD_ID**: Guild ID where commands are registered (required for command deployment).
- **GEMINI_API_KEY**: Google Gemini API key (required for AI DMs).

## Troubleshooting

- Missing tokens: If the app exits on start, ensure `.env` has `DISCORD_TOKEN` (and others for command deployment).
- Slash commands not appearing: Re-run `npm run deploy:commands`, confirm `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` are correct, and that the bot is in that guild.
- "AI is not configured": Set `GEMINI_API_KEY` in `.env`.
- Intents errors: Ensure "Message Content Intent" is enabled in the Developer Portal.

