/**
 * InkOS Cloudflare — Chapter Store
 * SQLite-based CRUD for chapters, replacing filesystem chapter files
 */

import type { ChapterRow } from './schema.js';
import type { SqlExecutor } from './sql-executor.js';

export class ChapterStore {
  constructor(private sql: SqlExecutor) {}

  /** Create a new chapter */
  create(bookId: string, number: number, title: string): ChapterRow {
    const now = new Date().toISOString();
    this.sql`
      INSERT INTO chapters (book_id, number, title, status, content, word_count, created_at, updated_at)
      VALUES (${bookId}, ${number}, ${title}, 'drafting', '', 0, ${now}, ${now})
    `;
    const rows = this.sql<ChapterRow>`
      SELECT * FROM chapters WHERE book_id = ${bookId} AND number = ${number}
    `;
    return rows[0]!;
  }

  /** Get a chapter by book and number */
  getByNumber(bookId: string, number: number): ChapterRow | undefined {
    const rows = this.sql<ChapterRow>`
      SELECT * FROM chapters WHERE book_id = ${bookId} AND number = ${number}
    `;
    return rows.length > 0 ? rows[0] : undefined;
  }

  /** List all chapters for a book, ordered by number */
  listByBook(bookId: string): ChapterRow[] {
    return this.sql<ChapterRow>`
      SELECT * FROM chapters WHERE book_id = ${bookId} ORDER BY number ASC
    `;
  }

  /** Get the latest chapter number */
  getLatestNumber(bookId: string): number {
    const rows = this.sql<{ max: number | null }>`
      SELECT MAX(number) as max FROM chapters WHERE book_id = ${bookId}
    `;
    return rows[0]?.max ?? 0;
  }

  /** Get the next chapter number */
  getNextNumber(bookId: string): number {
    return this.getLatestNumber(bookId) + 1;
  }

  /** Get chapter count */
  getCount(bookId: string): number {
    const rows = this.sql<{ count: number }>`
      SELECT COUNT(*) as count FROM chapters WHERE book_id = ${bookId}
    `;
    return rows[0]?.count ?? 0;
  }

  /** Update chapter content */
  updateContent(bookId: string, number: number, content: string): void {
    const now = new Date().toISOString();
    const wordCount = content.replace(/\s+/g, '').length;
    this.sql`
      UPDATE chapters SET content = ${content}, word_count = ${wordCount}, updated_at = ${now}
      WHERE book_id = ${bookId} AND number = ${number}
    `;
  }

  /** Update chapter status */
  updateStatus(bookId: string, number: number, status: string, extras?: {
    auditIssues?: string[];
    reviewNote?: string;
    detectionScore?: number;
    detectionProvider?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }): void {
    const now = new Date().toISOString();
    this.sql`
      UPDATE chapters SET
        status = ${status},
        audit_issues = ${JSON.stringify(extras?.auditIssues ?? [])},
        review_note = ${extras?.reviewNote ?? null},
        detection_score = ${extras?.detectionScore ?? null},
        detection_provider = ${extras?.detectionProvider ?? null},
        prompt_tokens = ${extras?.promptTokens ?? 0},
        completion_tokens = ${extras?.completionTokens ?? 0},
        total_tokens = ${extras?.totalTokens ?? 0},
        updated_at = ${now}
      WHERE book_id = ${bookId} AND number = ${number}
    `;
  }

  /** Update chapter title */
  updateTitle(bookId: string, number: number, title: string): void {
    const now = new Date().toISOString();
    this.sql`
      UPDATE chapters SET title = ${title}, updated_at = ${now}
      WHERE book_id = ${bookId} AND number = ${number}
    `;
  }

  /** Delete chapters after a given number (for rollback) */
  deleteAfter(bookId: string, number: number): void {
    this.sql`DELETE FROM chapters WHERE book_id = ${bookId} AND number > ${number}`;
  }

  /** Delete a specific chapter */
  delete(bookId: string, number: number): void {
    this.sql`DELETE FROM chapters WHERE book_id = ${bookId} AND number = ${number}`;
  }
}