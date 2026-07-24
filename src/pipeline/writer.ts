/**
 * InkOS Cloudflare — Chapter Writer
 * Writes the actual chapter content based on the plan
 */

import { callLLM, type LLMConfig, type LLMMessage } from '../llm/client.js';
import type { ChapterPlan } from './planner.js';

export interface WriteResult {
  content: string;
  title: string;
  wordCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function writeChapter(
  llm: LLMConfig,
  context: {
    bookTitle: string;
    genre: string;
    language: string;
    chapterNumber: number;
    plan: ChapterPlan;
    storyBible: string;
    styleGuide: string;
    recentChapters: string[];
    characterContext: string;
  },
): Promise<WriteResult> {
  const language = context.language === 'zh' ? '中文' : 'English';
  const languageNote = context.language === 'zh'
    ? '请用中文写作。使用流畅自然的现代中文，避免AI常见的套话和陈词滥调。'
    : 'Write in English. Use natural, flowing prose. Avoid AI clichés and formulaic writing.';

  const recentText = context.recentChapters.length > 0
    ? context.recentChapters.slice(-2).map((c, i) => `--- Previous Chapter ---\n${c.slice(0, 1000)}`).join('\n\n')
    : '';

  const systemPrompt = `You are an award-winning ${context.genre} novelist. You are writing Chapter ${context.chapterNumber} of "${context.bookTitle}".

${languageNote}

Guidelines:
- Write compelling, character-driven prose
- Maintain consistent voice and tone
- Show, don't tell
- Use varied sentence structure
- Avoid overused adverbs and adjectives
- Keep dialogue natural and purposeful
- Advance the plot meaningfully
- End with a hook or natural pause

Output only the chapter content. Do not include meta-commentary.`;

  const userPrompt = `## Chapter Plan
Title: ${context.plan.title}
Outline: ${context.plan.outline}
Focus Points: ${context.plan.focusPoints.map((p) => `- ${p}`).join('\n')}

## Story Bible (excerpt)
${context.storyBible.slice(0, 1500)}

## Style Guide
${context.styleGuide.slice(0, 1000)}

## Character Context
${context.characterContext.slice(0, 1000)}

${recentText ? `\n## Recent Chapters\n${recentText}` : ''}

Write Chapter ${context.chapterNumber}: ${context.plan.title}

Target length: approximately ${context.plan.expectedLength} words.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await callLLM(llm, messages);

  const content = response.content.trim();
  const wordCount = context.language === 'zh'
    ? content.replace(/\s+/g, '').length
    : content.split(/\s+/).length;

  return {
    content,
    title: context.plan.title,
    wordCount,
    promptTokens: response.promptTokens,
    completionTokens: response.completionTokens,
    totalTokens: response.totalTokens,
  };
}