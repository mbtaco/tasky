import { Client, Events, Message, EmbedBuilder, Colors, Collection, Snowflake, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { clearChannelMessages, fetchChannelMessages, insertMessage, isDbEnabled } from '../db';

/**
 * Registers a DM handler that replies with Gemini 2.5 Flash.
 */
type GeminiHistoryItem = { role: 'user' | 'model'; parts: Array<{ text: string }> };

export function registerDmAiHandler(client: Client) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  let genai: GoogleGenerativeAI | null = null;
  if (geminiApiKey) {
    genai = new GoogleGenerativeAI(geminiApiKey);
  }

  const MAX_MESSAGES = 100; // pull up to last 100 messages from the DM
  const MAX_MEMORY_TURNS = 25; // in-memory fallback cap
  const perChannelMemory = new Map<string, GeminiHistoryItem[]>();
  const BARRIERS = new Set(['!stop', '!clear', '!reset', '!forget']);

  // Controls row shown under every AI message
  const CONTROLS_ROW = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ai_help').setLabel('Help').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ai_clear').setLabel('Clear chat').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ai_regen').setLabel('Regenerate').setStyle(ButtonStyle.Primary)
  );

  // Global cooldown and request queue to respect Gemini free tier 10 RPM (~6s)
  const COOLDOWN_MS = 6000;
  type QueueTask = () => Promise<void>;
  const requestQueue: QueueTask[] = [];
  let isProcessingQueue = false;
  let lastRequestTimestamp = 0;

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForCooldown(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, lastRequestTimestamp + COOLDOWN_MS - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastRequestTimestamp = Date.now();
  }

  function enqueueRequest(task: QueueTask): void {
    requestQueue.push(task);
    if (!isProcessingQueue) {
      void processQueue();
    }
  }

  async function processQueue(): Promise<void> {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    try {
      while (requestQueue.length > 0) {
        const task = requestQueue.shift()!;
        try {
          await task();
        } catch {
          // Individual task handles its own errors for user feedback
        }
      }
    } finally {
      isProcessingQueue = false;
    }
  }

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.guild) return; // only DMs

    // Barrier commands: clear/reset conversation
    const raw = message.content?.trim().toLowerCase();
    const isBarrier = BARRIERS.has(raw ?? '');
    if (isBarrier) {
      // Clear DB-backed history and in-memory fallback
      try {
        if (isDbEnabled) {
          await clearChannelMessages(message.channel.id);
        }
      } catch {
        // ignore DB clear errors to avoid blocking user
      }
      perChannelMemory.delete(message.channel.id);
      const embed = new EmbedBuilder()
        .setTitle('Conversation cleared')
        .setDescription('I will forget previous messages in this DM. Start fresh anytime!')
        .setColor(Colors.Blurple)
        .setTimestamp();
      await message.author.send({ embeds: [embed] });
      return;
    }

    if (!genai) {
      await message.author.send('AI is not configured. Missing GEMINI_API_KEY.');
      return;
    }

    enqueueRequest(async () => {
      try {
        // Enforce cooldown just before making the API call
        await waitForCooldown();

        const model = genai.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction:
            `You are a helpful Discord bot called Tasky. Be concise and friendly. Use Discord compatible markdown. The current user's username is "${message.author.username}" If the user asks about server-specific actions, remind them you can only chat in DMs.`
        });

        // Build history from Postgres if configured; fallback to in-memory
        let history: GeminiHistoryItem[] = [];
        if (isDbEnabled) {
          const stored = await fetchChannelMessages(message.channel.id, MAX_MESSAGES);
          const storedAsc = stored
            .filter(r => typeof r.content === 'string' && r.content.trim().length > 0)
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          history = storedAsc.map(r => ({ role: r.role, parts: [{ text: r.content.trim() }] }));
        }
        if (!isDbEnabled || history.length === 0) {
          const mem = perChannelMemory.get(message.channel.id);
          if (mem && mem.length > 0) {
            history = mem.slice(-2 * MAX_MEMORY_TURNS);
          }
        }

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(message.content);
        const response = result.response?.text?.() ?? null;

        if (!response || response.trim().length === 0) {
          await message.author.send('Sorry, I could not generate a response.');
          return;
        }

        // Discord embed description limit is 4096 characters.
        // We'll slice the response into 4096-char chunks and send as multiple embeds if necessary.
        const EMBED_DESC_MAX = 4096;
        const chunks: string[] = [];
        let remaining = response;
        while (remaining.length > EMBED_DESC_MAX) {
          chunks.push(remaining.slice(0, EMBED_DESC_MAX));
          remaining = remaining.slice(EMBED_DESC_MAX);
        }
        chunks.push(remaining);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embed = new EmbedBuilder()
            .setDescription(chunk)
            .setColor(0x5865F2)
            .setAuthor({
              name: 'Gemini 2.5 Flash',
              url: 'https://deepmind.google/models/gemini/',
              iconURL: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png',
            });
          if (chunks.length > 1) {
            embed.setFooter({ text: `Part ${i + 1} / ${chunks.length}` });
          }
          await message.author.send({ embeds: [embed], components: [CONTROLS_ROW()] });
        }

        // Persist to DB when available; otherwise update in-memory fallback
        if (isDbEnabled) {
          try {
            await insertMessage({
              userId: message.author.id,
              channelId: message.channel.id,
              role: 'user',
              content: message.content,
              timestamp: new Date(message.createdTimestamp)
            });
            await insertMessage({
              userId: message.client.user?.id ?? 'bot',
              channelId: message.channel.id,
              role: 'model',
              content: response,
              timestamp: new Date()
            });
          } catch {
            // If DB insert fails, still maintain in-memory fallback
            const mem = perChannelMemory.get(message.channel.id) ?? [];
            mem.push({ role: 'user', parts: [{ text: message.content }] });
            mem.push({ role: 'model', parts: [{ text: response }] });
            perChannelMemory.set(
              message.channel.id,
              mem.length > 2 * MAX_MEMORY_TURNS ? mem.slice(-2 * MAX_MEMORY_TURNS) : mem
            );
          }
        } else {
          const mem = perChannelMemory.get(message.channel.id) ?? [];
          mem.push({ role: 'user', parts: [{ text: message.content }] });
          mem.push({ role: 'model', parts: [{ text: response }] });
          perChannelMemory.set(
            message.channel.id,
            mem.length > 2 * MAX_MEMORY_TURNS ? mem.slice(-2 * MAX_MEMORY_TURNS) : mem
          );
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await message.author.send(`Error generating AI response: ${errMsg}`);
      }
    });
  });

  // Button interactions in DMs
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (!interaction.isButton()) return;
      if (interaction.guild) return; // only DMs

      const channelId = interaction.channelId;

      if (interaction.customId === 'ai_help') {
        const embed = new EmbedBuilder()
          .setTitle('Help')
          .setColor(Colors.Blurple)
          .setDescription([
            'Use this DM to chat with the AI. Buttons under each reply:',
            '- Help: shows these tips',
            '- Clear chat: wipes conversation memory',
            '- Regenerate: asks the AI to answer your last message again',
            '',
            'Text commands:',
            '`!clear`, `!reset`, `!forget`, `!stop` — clear conversation',
          ].join('\n'))
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (interaction.customId === 'ai_clear') {
        try {
          if (isDbEnabled) {
            await clearChannelMessages(channelId);
          }
        } catch {
          // ignore DB errors, still clear memory
        }
        perChannelMemory.delete(channelId);
        const embed = new EmbedBuilder()
          .setTitle('Conversation cleared')
          .setDescription('I will forget previous messages in this DM. Start fresh anytime!')
          .setColor(Colors.Blurple)
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (interaction.customId === 'ai_regen') {
        await interaction.deferReply();
        enqueueRequest(async () => {
          try {
            await waitForCooldown();

            if (!genai) {
              await interaction.editReply('AI is not configured. Missing GEMINI_API_KEY.');
              return;
            }

            // Rebuild history
            let history: GeminiHistoryItem[] = [];
            if (isDbEnabled) {
              try {
                const stored = await fetchChannelMessages(channelId, MAX_MESSAGES);
                const storedAsc = stored
                  .filter(r => typeof r.content === 'string' && r.content.trim().length > 0)
                  .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                history = storedAsc.map(r => ({ role: r.role, parts: [{ text: r.content.trim() }] }));
              } catch {
                // ignore DB fetch errors, fallback to memory
              }
            }
            if (!isDbEnabled || history.length === 0) {
              const mem = perChannelMemory.get(channelId);
              if (mem && mem.length > 0) {
                history = mem.slice(-2 * MAX_MEMORY_TURNS);
              }
            }

            // Find the last user turn to regenerate
            let lastUserIndex = -1;
            for (let i = history.length - 1; i >= 0; i--) {
              if (history[i].role === 'user') {
                lastUserIndex = i;
                break;
              }
            }
            if (lastUserIndex === -1) {
              await interaction.editReply('No previous user message found to regenerate.');
              return;
            }

            const lastUserText = history[lastUserIndex].parts.map(p => p.text).join('\n');
            const baseHistory = history.slice(0, lastUserIndex); // exclude the last user (will be sent anew)

            const model = genai.getGenerativeModel({
              model: 'gemini-2.5-flash',
              systemInstruction:
                `You are a helpful Discord bot called Tasky. Be concise and friendly. Use Discord compatible markdown.`
            });
            const chat = model.startChat({ history: baseHistory });
            const result = await chat.sendMessage(lastUserText);
            const response = result.response?.text?.() ?? null;
            if (!response || response.trim().length === 0) {
              await interaction.editReply('Sorry, I could not generate a response.');
              return;
            }

            // Chunk embeds and send in a single interaction reply update
            const EMBED_DESC_MAX = 4096;
            const chunks: string[] = [];
            let remaining = response;
            while (remaining.length > EMBED_DESC_MAX) {
              chunks.push(remaining.slice(0, EMBED_DESC_MAX));
              remaining = remaining.slice(EMBED_DESC_MAX);
            }
            chunks.push(remaining);

            // First embed replaces deferred reply; additional embeds are followups
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const embed = new EmbedBuilder()
                .setDescription(chunk)
                .setColor(0x5865F2)
                .setAuthor({
                  name: 'Gemini 2.5 Flash',
                  url: 'https://deepmind.google/models/gemini/',
                  iconURL: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png',
                });
              if (chunks.length > 1) {
                embed.setFooter({ text: `Part ${i + 1} / ${chunks.length}` });
              }
              if (i === 0) {
                await interaction.editReply({ embeds: [embed], components: [CONTROLS_ROW()] });
              } else {
                await interaction.followUp({ embeds: [embed], components: [CONTROLS_ROW()] });
              }
            }

            // Persist regenerated response
            if (isDbEnabled) {
              try {
                await insertMessage({
                  userId: interaction.client.user?.id ?? 'bot',
                  channelId,
                  role: 'model',
                  content: response,
                  timestamp: new Date()
                });
              } catch {
                const mem = perChannelMemory.get(channelId) ?? [];
                mem.push({ role: 'model', parts: [{ text: response }] });
                perChannelMemory.set(
                  channelId,
                  mem.length > 2 * MAX_MEMORY_TURNS ? mem.slice(-2 * MAX_MEMORY_TURNS) : mem
                );
              }
            } else {
              const mem = perChannelMemory.get(channelId) ?? [];
              mem.push({ role: 'model', parts: [{ text: response }] });
              perChannelMemory.set(
                channelId,
                mem.length > 2 * MAX_MEMORY_TURNS ? mem.slice(-2 * MAX_MEMORY_TURNS) : mem
              );
            }
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await interaction.editReply(`Error generating AI response: ${errMsg}`);
          }
        });
        return;
      }
    } catch {
      // swallow interaction errors to avoid crashing the bot
    }
  });
}


