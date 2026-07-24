/**
 * InkOS Cloudflare — SQLite Schema
 * Replaces InkOS's filesystem-based storage with Durable Objects SQLite.
 */

export const SCHEMA_SQL = `
-- Books
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other',
  genre TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  target_chapters INTEGER NOT NULL DEFAULT 200,
  chapter_word_count INTEGER NOT NULL DEFAULT 3000,
  language TEXT NOT NULL DEFAULT 'zh',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  parent_book_id TEXT,
  fanfic_mode TEXT,
  review_mode TEXT DEFAULT 'auto',
  revision_gate TEXT DEFAULT 'strict'
);

-- Chapters
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafting',
  content TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  audit_issues TEXT NOT NULL DEFAULT '[]',
  length_warnings TEXT NOT NULL DEFAULT '[]',
  review_note TEXT,
  detection_score REAL,
  detection_provider TEXT,
  detected_at TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  UNIQUE(book_id, number),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Story documents (Markdown content for bible, rules, etc.)
CREATE TABLE IF NOT EXISTS story_docs (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (id, book_id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Character profiles
CREATE TABLE IF NOT EXISTS characters (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  char_type TEXT NOT NULL DEFAULT 'major',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (id, book_id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  kind TEXT NOT NULL DEFAULT 'chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- State snapshots
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  state_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Project config
CREATE TABLE IF NOT EXISTS project_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- LLM configs
CREATE TABLE IF NOT EXISTS llm_configs (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  base_url TEXT,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  is_default INTEGER DEFAULT 0
);

-- Volume outlines
CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(book_id, number),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chapters_book_number ON chapters(book_id, number);
CREATE INDEX IF NOT EXISTS idx_story_docs_book ON story_docs(book_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_characters_book ON characters(book_id, char_type);
CREATE INDEX IF NOT EXISTS idx_sessions_book ON sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_book_chapter ON snapshots(book_id, chapter_number);
`;

export const BOOK_STATUS = ['incubating', 'outlining', 'active', 'paused', 'completed', 'dropped'] as const;
export type BookStatus = typeof BOOK_STATUS[number];

export const CHAPTER_STATUS = [
  'card-generated', 'drafting', 'drafted', 'auditing', 'audit-passed',
  'audit-failed', 'state-degraded', 'revising', 'ready-for-review',
  'approved', 'rejected', 'published', 'imported',
] as const;
export type ChapterStatus = typeof CHAPTER_STATUS[number];

export interface BookRow {
  id: string;
  title: string;
  platform: string;
  genre: string;
  status: string;
  target_chapters: number;
  chapter_word_count: number;
  language: string;
  created_at: string;
  updated_at: string;
  parent_book_id: string | null;
  fanfic_mode: string | null;
  review_mode: string | null;
  revision_gate: string | null;
}

export interface ChapterRow {
  id: number;
  book_id: string;
  number: number;
  title: string;
  status: string;
  content: string;
  word_count: number;
  created_at: string;
  updated_at: string;
  audit_issues: string;
  length_warnings: string;
  review_note: string | null;
  detection_score: number | null;
  detection_provider: string | null;
  detected_at: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface StoryDocRow {
  id: string;
  book_id: string;
  doc_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterRow {
  id: string;
  book_id: string;
  name: string;
  char_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  book_id: string | null;
  kind: string;
  created_at: string;
  updated_at: string;
}

export interface SnapshotRow {
  id: number;
  book_id: string;
  chapter_number: number;
  state_data: string;
  created_at: string;
}

export interface LLMConfigRow {
  id: string;
  service: string;
  base_url: string | null;
  api_key: string;
  model: string;
  temperature: number;
  is_default: number;
}