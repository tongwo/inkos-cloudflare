/**
 * InkOS Cloudflare — Pipeline Index
 */

import { planChapter } from './planner.js';
import type { ChapterPlan } from './planner.js';
import { writeChapter } from './writer.js';
import type { WriteResult } from './writer.js';
import { auditChapter, type AuditResult, type AuditIssue } from './auditor.js';
import { reviseChapter } from './reviser.js';
import type { ReviseResult } from './reviser.js';
import type { LLMConfig } from '../llm/client.js';

export type { ChapterPlan, WriteResult, AuditResult, AuditIssue, ReviseResult, LLMConfig };

/**
 * Run a full chapter writing cycle: plan → write → audit → revise
 */
export interface ChapterCycleResult {
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  auditPassed: boolean;
  revised: boolean;
  auditScore: number;
  auditIssues: string[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChapterCycleContext {
  bookTitle: string;
  bookId: string;
  genre: string;
  language: string;
  chapterNumber: number;
  storyBible: string;
  authorIntent: string;
  currentFocus: string;
  styleGuide: string;
  characterContext: string;
  recentChapters: string[];
}

export async function runChapterCycle(
  llm: LLMConfig,
  context: ChapterCycleContext,
): Promise<ChapterCycleResult> {
  const plan = await planChapter(llm, {
    bookTitle: context.bookTitle,
    genre: context.genre,
    language: context.language,
    chapterNumber: context.chapterNumber,
    recentChapters: context.recentChapters,
    storyBible: context.storyBible,
    authorIntent: context.authorIntent,
    currentFocus: context.currentFocus,
  });

  const writeResult = await writeChapter(llm, {
    bookTitle: context.bookTitle,
    genre: context.genre,
    language: context.language,
    chapterNumber: context.chapterNumber,
    plan,
    storyBible: context.storyBible,
    styleGuide: context.styleGuide,
    recentChapters: context.recentChapters,
    characterContext: context.characterContext,
  });

  const auditResult = await auditChapter(llm, {
    bookTitle: context.bookTitle,
    genre: context.genre,
    language: context.language,
    chapterNumber: context.chapterNumber,
    chapterContent: writeResult.content,
    chapterTitle: writeResult.title,
    storyBible: context.storyBible,
    previousChapters: context.recentChapters,
  });

  let finalContent = writeResult.content;
  let revised = false;
  let totalPromptTokens = writeResult.promptTokens;
  let totalCompletionTokens = writeResult.completionTokens;

  if (!auditResult.passed) {
    const reviseResult = await reviseChapter(llm, {
      bookTitle: context.bookTitle,
      genre: context.genre,
      language: context.language,
      chapterNumber: context.chapterNumber,
      chapterTitle: writeResult.title,
      chapterContent: writeResult.content,
      auditResult,
    });

    if (reviseResult.revised) {
      finalContent = reviseResult.content;
      revised = true;
      totalPromptTokens += reviseResult.promptTokens;
      totalCompletionTokens += reviseResult.completionTokens;
    }
  }

  return {
    chapterNumber: context.chapterNumber,
    title: writeResult.title,
    content: finalContent,
    wordCount: writeResult.wordCount,
    auditPassed: auditResult.passed,
    revised,
    auditScore: auditResult.score,
    auditIssues: auditResult.issues.map((i: AuditIssue) => `[${i.severity}] ${i.category}: ${i.description}`),
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    totalTokens: totalPromptTokens + totalCompletionTokens,
  };
}