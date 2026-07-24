/**
 * InkOS Cloudflare — Main InkOS Agent
 * 
 * The central agent that manages books, chapters, scheduling, and the writing pipeline.
 * Uses Agents SDK for state persistence, scheduling, and WebSocket communication.
 */

import { Agent, routeAgentRequest, callable } from 'agents';
import { BookStore, ChapterStore, StoryDocStore, CharacterStore } from '../storage/index.js';
import type { BookRow } from '../storage/schema.js';
import { runChapterCycle, type ChapterCycleResult } from '../pipeline/index.js';
import type { LLMConfig } from '../pipeline/index.js';

// ─── Types ─────────────────────────────────────────────────────

interface InkosState {
  initialized: boolean;
  lastWriteCycle: string | null;
  chaptersWrittenToday: number;
  lastWriteDate: string | null;
  totalChaptersWritten: number;
}

interface Env {
  InkosAgent: DurableObjectNamespace;
  AI: unknown;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
}

// ─── Agent ─────────────────────────────────────────────────────

export class InkosAgent extends Agent<Env, InkosState> {
  // ── Storage Stores (lazy init) ──
  private _bookStore: BookStore | null = null;
  private _chapterStore: ChapterStore | null = null;
  private _storyDocStore: StoryDocStore | null = null;
  private _characterStore: CharacterStore | null = null;

  private get st() {
    return this.sql.bind(this) as unknown as {
      <T>(strings: TemplateStringsArray, ...values: unknown[]): T[];
    };
  }

  private get bookStore(): BookStore {
    if (!this._bookStore) this._bookStore = new BookStore(this.st);
    return this._bookStore;
  }

  private get chapterStore(): ChapterStore {
    if (!this._chapterStore) this._chapterStore = new ChapterStore(this.st);
    return this._chapterStore;
  }

  private get storyDocStore(): StoryDocStore {
    if (!this._storyDocStore) this._storyDocStore = new StoryDocStore(this.st);
    return this._storyDocStore;
  }

  private get characterStore(): CharacterStore {
    if (!this._characterStore) this._characterStore = new CharacterStore(this.st);
    return this._characterStore;
  }

  // ── State ──

  initialState: InkosState = {
    initialized: false,
    lastWriteCycle: null,
    chaptersWrittenToday: 0,
    lastWriteDate: null,
    totalChaptersWritten: 0,
  };

  // ── Lifecycle ──

  async onStart() {
    if (!this.state.initialized) {
      try {
        // Create tables using the sql template tag
        this.sql`CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, platform TEXT NOT NULL DEFAULT 'other',
          genre TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
          target_chapters INTEGER NOT NULL DEFAULT 200, chapter_word_count INTEGER NOT NULL DEFAULT 3000,
          language TEXT NOT NULL DEFAULT 'zh', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          parent_book_id TEXT, fanfic_mode TEXT, review_mode TEXT DEFAULT 'auto', revision_gate TEXT DEFAULT 'strict'
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL, number INTEGER NOT NULL,
          title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'drafting', content TEXT NOT NULL DEFAULT '',
          word_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          audit_issues TEXT NOT NULL DEFAULT '[]', length_warnings TEXT NOT NULL DEFAULT '[]',
          review_note TEXT, detection_score REAL, detection_provider TEXT, detected_at TEXT,
          prompt_tokens INTEGER DEFAULT 0, completion_tokens INTEGER DEFAULT 0, total_tokens INTEGER DEFAULT 0,
          UNIQUE(book_id, number), FOREIGN KEY (book_id) REFERENCES books(id)
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS story_docs (
          id TEXT NOT NULL, book_id TEXT NOT NULL, doc_type TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY (id, book_id), FOREIGN KEY (book_id) REFERENCES books(id)
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS characters (
          id TEXT NOT NULL, book_id TEXT NOT NULL, name TEXT NOT NULL,
          char_type TEXT NOT NULL DEFAULT 'major', content TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY (id, book_id), FOREIGN KEY (book_id) REFERENCES books(id)
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, book_id TEXT, kind TEXT NOT NULL DEFAULT 'chat',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (book_id) REFERENCES books(id)
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL,
          chapter_number INTEGER NOT NULL, state_data TEXT NOT NULL,
          created_at TEXT NOT NULL, FOREIGN KEY (book_id) REFERENCES books(id)
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS project_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
        this.sql`CREATE TABLE IF NOT EXISTS llm_configs (
          id TEXT PRIMARY KEY, service TEXT NOT NULL, base_url TEXT,
          api_key TEXT NOT NULL, model TEXT NOT NULL, temperature REAL DEFAULT 0.7, is_default INTEGER DEFAULT 0
        )`;
        this.sql`CREATE TABLE IF NOT EXISTS volumes (
          id TEXT PRIMARY KEY, book_id TEXT NOT NULL, number INTEGER NOT NULL,
          title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          UNIQUE(book_id, number), FOREIGN KEY (book_id) REFERENCES books(id)
        )`;
        this.sql`CREATE INDEX IF NOT EXISTS idx_chapters_book_number ON chapters(book_id, number)`;
        this.sql`CREATE INDEX IF NOT EXISTS idx_story_docs_book ON story_docs(book_id, doc_type)`;
        this.sql`CREATE INDEX IF NOT EXISTS idx_characters_book ON characters(book_id, char_type)`;

        this.setState({ ...this.state, initialized: true });
        console.log('[InkosAgent] Schema initialized successfully');
      } catch (e) {
        console.error('[InkosAgent] Schema init failed:', e);
      }

      // Schedule recurring chapter writing (every 15 minutes)
      try {
        await (this as any).scheduleEvery(15 * 60, 'writeCycle');
        console.log('[InkosAgent] Scheduled writeCycle every 15 minutes');
      } catch (e) {
        console.log('[InkosAgent] Scheduling not available in dev mode');
      }
    }
  }

  // ── Scheduled Tasks ──

  async writeCycle() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (this.state.lastWriteDate !== today) {
      this.setState({ ...this.state, chaptersWrittenToday: 0, lastWriteDate: today });
    }

    if (this.state.chaptersWrittenToday >= 50) {
      console.log(`[InkosAgent] Daily limit reached (${this.state.chaptersWrittenToday}/50)`);
      return;
    }

    const activeBooks = this.bookStore.listActive();
    if (activeBooks.length === 0) {
      console.log('[InkosAgent] No active books to write');
      return;
    }

    const book = activeBooks.sort((a, b) => {
      return this.chapterStore.getCount(a.id) - this.chapterStore.getCount(b.id);
    })[0]!;

    try {
      console.log(`[InkosAgent] Writing chapter for: ${book.title} (${book.id})`);
      const result = await this.writeOneChapter(book.id);

      this.setState({
        ...this.state,
        lastWriteCycle: now.toISOString(),
        chaptersWrittenToday: this.state.chaptersWrittenToday + 1,
        totalChaptersWritten: this.state.totalChaptersWritten + 1,
      });

      console.log(`[InkosAgent] Ch.${result.chapterNumber} "${result.title}" (${result.wordCount} chars, audit: ${result.auditPassed ? 'PASS' : 'FAIL'})`);
    } catch (error) {
      console.error(`[InkosAgent] Write cycle failed:`, error);
    }
  }

  private async writeOneChapter(bookId: string): Promise<ChapterCycleResult> {
    const book = this.bookStore.getById(bookId);
    if (!book) throw new Error(`Book not found: ${bookId}`);

    const llmConfig = this.getLLMConfig();
    const chapterNumber = this.chapterStore.getNextNumber(bookId);

    const storyBible = this.storyDocStore.getOrCreate(bookId, 'story_bible');
    const authorIntent = this.storyDocStore.getOrCreate(bookId, 'author_intent');
    const currentFocus = this.storyDocStore.getOrCreate(bookId, 'current_focus');
    const styleGuide = this.storyDocStore.getOrCreate(bookId, 'style_guide');
    const characters = this.characterStore.listByBook(bookId);
    const characterContext = characters.map(c => `${c.name}: ${c.content.slice(0, 300)}`).join('\n\n');
    const recentChapters = this.chapterStore.listByBook(bookId);
    const recentContents = recentChapters.slice(-3).map(c => c.content);

    const result = await runChapterCycle(llmConfig, {
      bookTitle: book.title,
      bookId: book.id,
      genre: book.genre,
      language: book.language,
      chapterNumber,
      storyBible: storyBible.content,
      authorIntent: authorIntent.content,
      currentFocus: currentFocus.content,
      styleGuide: styleGuide.content,
      characterContext,
      recentChapters: recentContents,
    });

    this.chapterStore.create(bookId, chapterNumber, result.title);
    this.chapterStore.updateContent(bookId, chapterNumber, result.content);
    this.chapterStore.updateStatus(bookId, chapterNumber, result.auditPassed ? 'ready-for-review' : 'audit-failed', {
      auditIssues: result.auditIssues,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
    });

    return result;
  }

  private getLLMConfig(): LLMConfig {
    return {
      baseUrl: (this.env as any).LLM_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: (this.env as any).LLM_API_KEY ?? '',
      model: (this.env as any).LLM_MODEL ?? 'gpt-4o',
      temperature: 0.7,
    };
  }

  // ── RPC Methods ──

  @callable()
  async createBook(params: {
    id: string; title: string; genre: string;
    platform?: string; language?: string;
    targetChapters?: number; chapterWordCount?: number;
  }) {
    this.bookStore.create({
      id: params.id, title: params.title, platform: params.platform ?? 'other',
      genre: params.genre, status: 'active', target_chapters: params.targetChapters ?? 200,
      chapter_word_count: params.chapterWordCount ?? 3000, language: params.language ?? 'zh',
      parent_book_id: null, fanfic_mode: null, review_mode: 'auto', revision_gate: 'strict',
    });
    this.storyDocStore.upsertContent(params.id, 'story_bible', `# Story Bible\n\nWorld-building for "${params.title}"\n\nGenre: ${params.genre}\n`);
    this.storyDocStore.upsertContent(params.id, 'author_intent', `# Author Intent\n\n(Describe the long-term creative direction for "${params.title}")`);
    this.storyDocStore.upsertContent(params.id, 'current_focus', '# Current Focus\n\n## Active Focus\n\n(Describe what the next 1-3 chapters should prioritize)');
    this.storyDocStore.upsertContent(params.id, 'style_guide', '# Style Guide\n\n(Writing style notes and methodology)');
    return { success: true, bookId: params.id };
  }

  @callable() listBooks() { return this.bookStore.list(); }
  @callable() getBook(bookId: string) { return this.bookStore.getById(bookId); }
  @callable() getChapters(bookId: string) { return this.chapterStore.listByBook(bookId); }
  @callable() getChapter(bookId: string, number: number) { return this.chapterStore.getByNumber(bookId, number); }
  @callable() getStoryDocs(bookId: string) { return this.storyDocStore.listByBook(bookId); }

  @callable()
  updateStoryDoc(bookId: string, docType: string, content: string) {
    this.storyDocStore.upsertContent(bookId, docType, content);
    return { success: true };
  }

  @callable() getCharacters(bookId: string) { return this.characterStore.listByBook(bookId); }

  @callable()
  addCharacter(bookId: string, name: string, charType: string, content: string) {
    const id = `${bookId}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    this.characterStore.upsert(bookId, id, name, charType, content);
    return { success: true, characterId: id };
  }

  @callable()
  getStatus() {
    const books = this.bookStore.list();
    return {
      chaptersWrittenToday: this.state.chaptersWrittenToday,
      totalChaptersWritten: this.state.totalChaptersWritten,
      lastWriteCycle: this.state.lastWriteCycle,
      books: books.map((b: BookRow) => ({
        id: b.id, title: b.title, genre: b.genre, status: b.status,
        chapterCount: this.chapterStore.getCount(b.id),
      })),
    };
  }

  @callable() async triggerWriteCycle() { await this.writeCycle(); return { success: true }; }
  @callable() async writeChapter(bookId: string) { return this.writeOneChapter(bookId); }
  @callable() updateBook(bookId: string, updates: Record<string, unknown>) { this.bookStore.update(bookId, updates); return { success: true }; }
  @callable() deleteBook(bookId: string) { this.bookStore.delete(bookId); return { success: true }; }
}

// ─── Worker Entry Point ────────────────────────────────────────

const worker = {
  async fetch(request: Request, env: any): Promise<Response> {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    const url = new URL(request.url);
    const agentId = env.InkosAgent.idFromName('default');
    const agent = env.InkosAgent.get(agentId);

    if (url.pathname === '/api/status') {
      return Response.json(await agent.getStatus());
    }
    if (url.pathname === '/api/books') {
      return Response.json(await agent.listBooks());
    }
    if (url.pathname === '/api/chapters') {
      const bookId = url.searchParams.get('bookId') || '';
      return Response.json(await agent.getChapters(bookId));
    }
    if (url.pathname === '/api/create-book' && request.method === 'POST') {
      const body = await request.json() as any;
      return Response.json(await agent.createBook(body));
    }
    if (url.pathname === '/api/trigger-write' && request.method === 'POST') {
      return Response.json(await agent.triggerWriteCycle());
    }

    return new Response('InkOS Cloudflare Agent — use /agents/inkos-agent/default for WebSocket', {
      status: 200, headers: { 'Content-Type': 'text/plain' },
    });
  },

  async scheduled(_event: any, env: any) {
    const agentId = env.InkosAgent.idFromName('default');
    const agent = env.InkosAgent.get(agentId);
    await agent.triggerWriteCycle();
  },
};

export default worker;