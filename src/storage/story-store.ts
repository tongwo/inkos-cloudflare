/**
 * InkOS Cloudflare — Story Document Store
 * SQLite-based CRUD for story documents (bible, rules, author_intent, etc.)
 * and character profiles.
 */

import type { StoryDocRow, CharacterRow } from './schema.js';
import type { SqlExecutor } from './sql-executor.js';

// ─── Story Documents ───────────────────────────────────────────

export class StoryDocStore {
  constructor(private sql: SqlExecutor) {}

  /** Get a document by type */
  getByType(bookId: string, docType: string): StoryDocRow | undefined {
    const rows = this.sql<StoryDocRow>`
      SELECT * FROM story_docs WHERE book_id = ${bookId} AND doc_type = ${docType}
    `;
    return rows.length > 0 ? rows[0] : undefined;
  }

  /** Get or create a document */
  getOrCreate(bookId: string, docType: string, defaultContent = ''): StoryDocRow {
    const existing = this.getByType(bookId, docType);
    if (existing) return existing;

    const now = new Date().toISOString();
    const id = `${bookId}_${docType}`;
    this.sql`
      INSERT INTO story_docs (id, book_id, doc_type, content, created_at, updated_at)
      VALUES (${id}, ${bookId}, ${docType}, ${defaultContent}, ${now}, ${now})
    `;
    return { id, book_id: bookId, doc_type: docType, content: defaultContent, created_at: now, updated_at: now };
  }

  /** Upsert document content */
  upsertContent(bookId: string, docType: string, content: string): void {
    const now = new Date().toISOString();
    const id = `${bookId}_${docType}`;
    this.sql`INSERT INTO story_docs (id, book_id, doc_type, content, created_at, updated_at) VALUES (${id}, ${bookId}, ${docType}, ${content}, ${now}, ${now})
    ON CONFLICT(id, book_id) DO UPDATE SET content = ${content}, updated_at = ${now}`;
  }

  /** List all documents for a book */
  listByBook(bookId: string): StoryDocRow[] {
    return this.sql<StoryDocRow>`SELECT * FROM story_docs WHERE book_id = ${bookId}`;
  }

  /** Delete a document */
  delete(bookId: string, docType: string): void {
    this.sql`DELETE FROM story_docs WHERE book_id = ${bookId} AND doc_type = ${docType}`;
  }
}

// ─── Characters ────────────────────────────────────────────────

export class CharacterStore {
  constructor(private sql: SqlExecutor) {}

  /** Create or update a character */
  upsert(bookId: string, id: string, name: string, charType: string, content: string): void {
    const now = new Date().toISOString();
    this.sql`INSERT INTO characters (id, book_id, name, char_type, content, created_at, updated_at) VALUES (${id}, ${bookId}, ${name}, ${charType}, ${content}, ${now}, ${now})
    ON CONFLICT(id, book_id) DO UPDATE SET name = ${name}, char_type = ${charType}, content = ${content}, updated_at = ${now}`;
  }

  /** Get a character by ID */
  getById(bookId: string, id: string): CharacterRow | undefined {
    const rows = this.sql<CharacterRow>`SELECT * FROM characters WHERE book_id = ${bookId} AND id = ${id}`;
    return rows.length > 0 ? rows[0] : undefined;
  }

  /** List characters by type */
  listByType(bookId: string, charType: string): CharacterRow[] {
    return this.sql<CharacterRow>`SELECT * FROM characters WHERE book_id = ${bookId} AND char_type = ${charType}`;
  }

  /** List all characters for a book */
  listByBook(bookId: string): CharacterRow[] {
    return this.sql<CharacterRow>`SELECT * FROM characters WHERE book_id = ${bookId}`;
  }

  /** Delete a character */
  delete(bookId: string, id: string): void {
    this.sql`DELETE FROM characters WHERE book_id = ${bookId} AND id = ${id}`;
  }
}

// ─── Snapshots ─────────────────────────────────────────────────

export class SnapshotStore {
  constructor(private sql: SqlExecutor) {}

  /** Save a snapshot */
  save(bookId: string, chapterNumber: number, stateData: Record<string, string>): void {
    const now = new Date().toISOString();
    this.sql`INSERT INTO snapshots (book_id, chapter_number, state_data, created_at) VALUES (${bookId}, ${chapterNumber}, ${JSON.stringify(stateData)}, ${now})`;
  }

  /** Get the latest snapshot for a chapter */
  getByChapter(bookId: string, chapterNumber: number): SnapshotRowDef | undefined {
    const rows = this.sql<SnapshotRowRaw>`
      SELECT * FROM snapshots WHERE book_id = ${bookId} AND chapter_number = ${chapterNumber} ORDER BY created_at DESC LIMIT 1
    `;
    if (rows.length === 0) return undefined;
    return { ...rows[0]!, stateData: JSON.parse(rows[0]!.state_data) };
  }

  /** Delete snapshots after a given chapter */
  deleteAfter(bookId: string, chapterNumber: number): void {
    this.sql`DELETE FROM snapshots WHERE book_id = ${bookId} AND chapter_number > ${chapterNumber}`;
  }
}

interface SnapshotRowRaw {
  id: number;
  book_id: string;
  chapter_number: number;
  state_data: string;
  created_at: string;
}

export interface SnapshotRowDef {
  id: number;
  book_id: string;
  chapter_number: number;
  stateData: Record<string, string>;
  created_at: string;
}

// ─── Sessions ──────────────────────────────────────────────────

export class SessionStore {
  constructor(private sql: SqlExecutor) {}

  /** Create a session */
  create(id: string, bookId: string | null, kind: string): void {
    const now = new Date().toISOString();
    this.sql`INSERT INTO sessions (id, book_id, kind, created_at, updated_at) VALUES (${id}, ${bookId}, ${kind}, ${now}, ${now})`;
  }

  /** Get a session */
  getById(id: string): SessionRowDef | undefined {
    const rows = this.sql<SessionRowDef>`SELECT * FROM sessions WHERE id = ${id}`;
    return rows.length > 0 ? rows[0] : undefined;
  }

  /** List sessions for a book */
  listByBook(bookId: string): SessionRowDef[] {
    return this.sql<SessionRowDef>`SELECT * FROM sessions WHERE book_id = ${bookId} ORDER BY updated_at DESC`;
  }

  /** Update session */
  touch(id: string): void {
    const now = new Date().toISOString();
    this.sql`UPDATE sessions SET updated_at = ${now} WHERE id = ${id}`;
  }
}

interface SessionRowDef {
  id: string;
  book_id: string | null;
  kind: string;
  created_at: string;
  updated_at: string;
}