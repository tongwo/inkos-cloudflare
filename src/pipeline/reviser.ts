/**
 * InkOS Cloudflare — Chapter Reviser
 * Revises chapter content based on audit results
 */

import { callLLM, type LLMConfig, type LLMMessage } from '../llm/client.js';
import type { AuditResult } from './auditor.js';

export interface ReviseResult {
  content: string;
  revised: boolean;
  changes: string[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function reviseChapter(
  llm: LLMConfig,
  context: {
    bookTitle: string;
    genre: string;
    language: string;
    chapterNumber: number;
    chapterTitle: string;
    chapterContent: string;
    auditResult: AuditResult;
  },
): Promise<ReviseResult> {
  // Only revise if there are issues
  const blockingIssues = context.auditResult.issues.filter((i) => i.severity === 'blocking');
  const warnings = context.auditResult.issues.filter((i) => i.severity === 'warning');

  if (blockingIssues.length === 0 && warnings.length === 0) {
    return {
      content: context.chapterContent,
      revised: false,
      changes: [],
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  const language = context.language === 'zh' ? '中文' : 'English';
  const languageNote = context.language === 'zh'
    ? '请用中文修订。保持流畅自然的现代中文风格。'
    : 'Revise in English. Maintain natural, flowing prose.';

  const issuesText = context.auditResult.issues.map((i) =>
    `[${i.severity.toUpperCase()}] ${i.category}: ${i.description}${i.location ? ` (${i.location})` : ''}`
  ).join('\n');

  const systemPrompt = `You are a professional editor for ${language} ${context.genre} novels. You revise chapters to fix issues while preserving the author's voice.

${languageNote}

Revise Chapter ${context.chapterNumber} ("${context.chapterTitle}") of "${context.bookTitle}" to address the following issues:

${issuesText}

Guidelines:
- Fix the specific issues identified
- Preserve the original style and voice
- Don't change what isn't broken
- Keep the same length and structure

Output the revised chapter content.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `## Original Chapter\n${context.chapterContent}` },
  ];

  const response = await callLLM(llm, messages);

  return {
    content: response.content.trim(),
    revised: true,
    changes: context.auditResult.issues.map((i) => `Fixed ${i.category}: ${i.description}`),
    promptTokens: response.promptTokens,
    completionTokens: response.completionTokens,
    totalTokens: response.totalTokens,
  };
}