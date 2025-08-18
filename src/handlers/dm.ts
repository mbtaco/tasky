import { Client, Events, Message, EmbedBuilder, Colors, Collection, Snowflake } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      // Clear in-memory history for this DM channel
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
          'You are a helpful Discord bot. Be concise and friendly. If the user asks about server-specific actions, remind them you can only chat in DMs.'
      });

      // Build history from DM channel until the most recent barrier (!stop/!clear/!reset/!forget), excluding current message
      const collected: Message[] = [];
      let lastId: string | undefined = undefined;
      while (collected.length < MAX_MESSAGES) {
        const remaining = Math.min(100, MAX_MESSAGES - collected.length);
        const batch: Collection<Snowflake, Message> = await message.channel.messages.fetch({ limit: remaining, before: lastId });
        if (batch.size === 0) break;
        const batchArr: Message[] = Array.from(batch.values());
        collected.push(...batchArr);
        lastId = batchArr[batchArr.length - 1]?.id;
        // Stop if we've reached the oldest available or we found a barrier in this batch
        const hasBarrier = batchArr.some((m: Message) => {
          if (m.id === message.id) return false; // exclude current message
          const txt = m.content?.trim().toLowerCase();
          const fromUser = m.author.id === message.author.id;
          return fromUser && BARRIERS.has(txt ?? '');
        });
        if (hasBarrier) break;
      }

      // collected is newest->oldest; find barrier index and slice messages after it
      const barrierIdx = collected.findIndex((m: Message) => {
        if (m.id === message.id) return false;
        const txt = m.content?.trim().toLowerCase();
        const fromUser = m.author.id === message.author.id;
        return fromUser && BARRIERS.has(txt ?? '');
      });
      const afterBarrier = barrierIdx === -1 ? collected : collected.slice(0, barrierIdx);
      const messagesAsc = afterBarrier
        .filter(m => m.id !== message.id)
        .filter(m => m.content && m.content.trim().length > 0)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      let history: GeminiHistoryItem[] = [];
      const botId = message.client.user?.id;
      for (const m of messagesAsc) {
        const text = m.content.trim();
        const role: 'user' | 'model' = m.author.id === botId ? 'model' : 'user';
        history.push({ role, parts: [{ text }] });
      }

      // Fallback to in-memory history if channel fetch yielded nothing
      if (history.length === 0) {
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

      const MAX_LEN = 1995;
      const chunks: string[] = [];
      let remaining = response;
      while (remaining.length > MAX_LEN) {
        chunks.push(remaining.slice(0, MAX_LEN));
        remaining = remaining.slice(MAX_LEN);
      }
      chunks.push(remaining);

      for (const chunk of chunks) {
        await message.author.send(chunk);
      }

      // Update in-memory history with this exchange
      const mem = perChannelMemory.get(message.channel.id) ?? [];
      mem.push({ role: 'user', parts: [{ text: message.content }] });
      mem.push({ role: 'model', parts: [{ text: response }] });
      perChannelMemory.set(
        message.channel.id,
        mem.length > 2 * MAX_MEMORY_TURNS ? mem.slice(-2 * MAX_MEMORY_TURNS) : mem
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await message.author.send(`Error generating AI response: ${errMsg}`);
    }
  });
}


