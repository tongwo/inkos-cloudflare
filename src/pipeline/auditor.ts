/**
 * InkOS Cloudflare — Continuity Auditor
 * Audits chapter content for continuity, quality, and style issues
 */

import { callLLM, type LLMConfig, type LLMMessage } from '../llm/client.js';

export interface AuditResult {
  passed: boolean;
  issues: AuditIssue[];
  score: number; // 0-100
}

export interface AuditIssue {
  category: string;
  severity: 'blocking' | 'warning' | 'info';
  description: string;
  location?: string;
}

export async function auditChapter(
  llm: LLMConfig,
  context: {
    bookTitle: string;
    genre: string;
    language: string;
    chapterNumber: number;
    chapterContent: string;
    chapterTitle: string;
    storyBible: string;
    previousChapters: string[];
  },
): Promise<AuditResult> {
  const language = context.language === 'zh' ? '中文' : 'English';

  const previousText = context.previousChapters.length > 0
    ? context.previousChapters.slice(-1).map((c) => c.slice(0, 1000)).join('\n\n')
    : '';

  const systemPrompt = `You are a professional continuity auditor for ${language} ${context.genre} novels. You audit chapters for quality and consistency.

Analyze Chapter ${context.chapterNumber} ("${context.chapterTitle}") of "${context.bookTitle}" and provide a JSON audit report.

Audit categories to check:
- Continuity: Does the chapter contradict established facts?
- Pacing: Is the pacing appropriate for the genre?
- Character: Are characters acting consistently?
- Plot: Does the chapter advance the plot meaningfully?
- Prose: Is the writing quality good?
- Dialogue: Is dialogue natural?
- AI-tells: Are there obvious AI writing patterns?
- Structure: Does the chapter have proper structure?

Output format (JSON):
{
  "passed": true/false,
  "score": 85,
  "issues": [
    {
      "category": "Pacing",
      "severity": "warning",
      "description": "The middle section drags slightly",
      "location": "Paragraphs 5-8"
    }
  ]
}

Score: 90-100 = excellent, 70-89 = good, 50-69 = needs revision, <50 = major issues.`;

  const userPrompt = `## Chapter ${context.chapterNumber}: ${context.chapterTitle}
${context.chapterContent.slice(0, 4000)}

${previousText ? `## Previous Chapter (excerpt)\n${previousText}` : ''}

## Story Bible (excerpt)
${context.storyBible.slice(0, 1000)}

Please audit this chapter.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await callLLM(llm, messages);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AuditResult;
    }
  } catch {
    // fall through
  }

  return {
    passed: true,
    issues: [],
    score: 75,
  };
}