/**
 * InkOS Cloudflare — Chapter Planner
 * Plans the next chapter based on story state and recent chapters
 */

import { callLLM, type LLMConfig, type LLMMessage } from '../llm/client.js';

export interface ChapterPlan {
  title: string;
  outline: string;
  focusPoints: string[];
  expectedLength: number;
}

export async function planChapter(
  llm: LLMConfig,
  context: {
    bookTitle: string;
    genre: string;
    language: string;
    chapterNumber: number;
    recentChapters: string[];
    storyBible: string;
    authorIntent: string;
    currentFocus: string;
  },
): Promise<ChapterPlan> {
  const language = context.language === 'zh' ? '中文' : 'English';

  const recentText = context.recentChapters.length > 0
    ? context.recentChapters.slice(-3).map((c, i) => `--- Chapter ${context.chapterNumber - context.recentChapters.length + i + 1} ---\n${c.slice(0, 500)}`).join('\n\n')
    : 'No previous chapters yet.';

  const systemPrompt = `You are a professional novel chapter planner. You plan chapters for ${language} ${context.genre} novels.

Your task is to plan the next chapter (Chapter ${context.chapterNumber}) of "${context.bookTitle}".

Guidelines:
- Create a compelling chapter title
- Write a detailed outline (3-5 paragraphs)
- List 2-4 focus points for this chapter
- Suggest an appropriate word count based on the genre and pacing

Output format (JSON):
{
  "title": "Chapter title",
  "outline": "Detailed outline of the chapter",
  "focusPoints": ["Point 1", "Point 2", "Point 3"],
  "expectedLength": 3000
}`;

  const userPrompt = `## Story Bible
${context.storyBible.slice(0, 2000)}

## Author Intent
${context.authorIntent.slice(0, 1000)}

## Current Focus
${context.currentFocus.slice(0, 1000)}

## Recent Chapters
${recentText}

## Next Chapter
Chapter ${context.chapterNumber}

Please plan this chapter.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await callLLM(llm, messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ChapterPlan;
    }
  } catch {
    // fall through
  }

  // Fallback: extract from text
  return {
    title: `第${context.chapterNumber}章`,
    outline: response.content.slice(0, 500),
    focusPoints: [],
    expectedLength: 3000,
  };
}