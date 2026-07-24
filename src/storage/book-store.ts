/**
 * InkOS Cloudflare — Book Store
 * SQLite-based CRUD for books, replacing filesystem book.json
 */

import type { BookRow } from './schema.js';
import type { SqlExecutor } from './sql-executor.js';

export class BookStore {
  constructor(private sql: SqlExecutor) {}

  /** Create a new book */
  create(book: Omit<BookRow, 'created_at' | 'updated_at'>): BookRow {
    const now = new Date().toISOString();
    this.sql`
      INSERT INTO books (id, title, platform, genre, status, target_chapters, chapter_word_count, language, created_at, updated_at, parent_book_id, fanfic_mode, review_mode, revision_gate)
      VALUES (${book.id}, ${book.title}, ${book.platform}, ${book.genre}, ${book.status}, ${book.target_chapters}, ${book.chapter_word_count}, ${book.language}, ${now}, ${now}, ${book.parent_book_id}, ${book.fanfic_mode}, ${book.review_mode}, ${book.revision_gate})
    `;
    const rows = this.sql<BookRow>`SELECT * FROM books WHERE id = ${book.id}`;
    return rows[0]!;
  }

  /** Get a book by ID */
  getById(id: string): BookRow | undefined {
    const rows = this.sql<BookRow>`SELECT * FROM books WHERE id = ${id}`;
    return rows.length > 0 ? rows[0] : undefined;
  }

  /** List all books */
  list(): BookRow[] {
    return this.sql<BookRow>`SELECT * FROM books ORDER BY created_at DESC`;
  }

  /** List active books */
  listActive(): BookRow[] {
    return this.sql<BookRow>`SELECT * FROM books WHERE status IN ('active', 'outlining') ORDER BY created_at DESC`;
  }

  /** Update a book */
  update(id: string, updates: Partial<Record<string, unknown>>): void {
    const now = new Date().toISOString();
    this.sql`UPDATE books SET updated_at = ${now} WHERE id = ${id}`;
  }

  /** Delete a book and all related data */
  delete(id: string): void {
    this.sql`DELETE FROM chapters WHERE book_id = ${id}`;
    this.sql`DELETE FROM story_docs WHERE book_id = ${id}`;
    this.sql`DELETE FROM characters WHERE book_id = ${id}`;
    this.sql`DELETE FROM snapshots WHERE book_id = ${id}`;
    this.sql`DELETE FROM volumes WHERE book_id = ${id}`;
    this.sql`DELETE FROM sessions WHERE book_id = ${id}`;
    this.sql`DELETE FROM books WHERE id = ${id}`;
  }
}