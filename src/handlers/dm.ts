import { Client, Events, Message, EmbedBuilder, Colors, Collection, Snowflake } from 'discord.js';
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

    try {
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
        await message.author.send({ embeds: [embed] });
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
}


