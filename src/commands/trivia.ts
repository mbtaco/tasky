import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { BotCommand } from '../types/command';

const QUESTIONS: Array<{ q: string; options: string[]; answer: number }> = [
  { q: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], answer: 2 },
  { q: '2 + 2 * 2 = ?', options: ['6', '8', '4', '10'], answer: 0 },
  { q: 'Which planet is known as the Red Planet?', options: ['Earth', 'Mars', 'Jupiter', 'Venus'], answer: 1 },
];

const command: BotCommand = {
  data: new SlashCommandBuilder().setName('trivia').setDescription('Start a multiple-choice trivia question'),
  async execute(interaction) {
    const trivia = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const letters = ['A', 'B', 'C', 'D'] as const;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(ButtonStyle.Primary),
    );

    const questionText = `🧠 ${trivia.q}\n${trivia.options.map((o, i) => `${letters[i]}. ${o}`).join('\n')}\n\nChoose the correct answer:`;

    await interaction.reply({ content: questionText, components: [row] });
    const sent = await interaction.fetchReply();

    try {
      const btn = await sent.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 15_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      const pickedLetter = btn.customId as typeof letters[number];
      const pickedIndex = letters.indexOf(pickedLetter);
      const isCorrect = pickedIndex === trivia.answer;

      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(pickedLetter === 'A' ? (isCorrect ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(pickedLetter === 'B' ? (isCorrect ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(pickedLetter === 'C' ? (isCorrect ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(pickedLetter === 'D' ? (isCorrect ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary).setDisabled(true),
      );

      const resultText = isCorrect
        ? `✅ Correct! The answer is ${letters[trivia.answer]}. ${trivia.options[trivia.answer]}`
        : `❌ Incorrect. You chose ${pickedLetter}. Correct answer: ${letters[trivia.answer]}. ${trivia.options[trivia.answer]}`;

      await btn.update({ content: `${questionText}\n\n${resultText}`, components: [disabledRow] });
    } catch {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await interaction.editReply({ content: `${questionText}\n\n⌛ Time's up!`, components: [disabledRow] });
    }
  },
};

export default command;


