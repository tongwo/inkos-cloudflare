import React, { useState, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────

interface Book {
  id: string;
  title: string;
  genre: string;
  status: string;
  language: string;
  target_chapters: number;
  chapter_word_count: number;
  created_at: string;
  updated_at: string;
}

interface Chapter {
  id: number;
  number: number;
  title: string;
  status: string;
  word_count: number;
  content: string;
  created_at: string;
  updated_at: string;
}

interface StatusData {
  chaptersWrittenToday: number;
  totalChaptersWritten: number;
  lastWriteCycle: string | null;
  books: Array<{ id: string; title: string; genre: string; status: string; chapterCount: number }>;
}

// ─── Components ────────────────────────────────────────────────

function App() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', title: '', genre: '玄幻', language: 'zh' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBook) loadChapters(selectedBook);
  }, [selectedBook]);

  async function loadData() {
    try {
      const [statusRes, booksRes] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/books').then(r => r.json()),
      ]);
      setStatus(statusRes);
      setBooks(booksRes);
      if (booksRes.length > 0 && !selectedBook) setSelectedBook(booksRes[0].id);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadChapters(bookId: string) {
    try {
      const res = await fetch(`/api/chapters?bookId=${bookId}`);
      const data = await res.json();
      setChapters(data);
    } catch (e) {
      console.error('Failed to load chapters:', e);
    }
  }

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/create-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`书籍 "${formData.title}" 创建成功！`);
        setShowCreateForm(false);
        loadData();
        setFormData({ id: '', title: '', genre: '玄幻', language: 'zh' });
      }
    } catch (e: any) {
      setMessage(`创建失败: ${e.message}`);
    }
  }

  async function handleTriggerWrite() {
    try {
      const res = await fetch('/api/trigger-write', { method: 'POST' });
      const data = await res.json();
      setMessage(data.success ? '写作已触发！' : '触发失败');
      setTimeout(() => loadData(), 2000);
    } catch (e: any) {
      setMessage(`触发失败: ${e.message}`);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#888' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
          InkOS Studio
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          Cloudflare 原生 AI 小说创作系统 · 24小时自动写作
        </p>
      </header>

      {/* Status Bar */}
      <div style={{
        display: 'flex', gap: '1rem', marginBottom: '2rem',
        background: '#1a1a1a', borderRadius: 12, padding: '1.5rem',
      }}>
        <StatBox label="今日已写" value={`${status?.chaptersWrittenToday ?? 0} 章`} />
        <StatBox label="总计" value={`${status?.totalChaptersWritten ?? 0} 章`} />
        <StatBox label="活跃书籍" value={`${status?.books.length ?? 0} 本`} />
        <StatBox label="上次写作" value={status?.lastWriteCycle ? new Date(status.lastWriteCycle).toLocaleTimeString('zh-CN') : '暂无'} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => setShowCreateForm(!showCreateForm)} style={btnStyle}>
          {showCreateForm ? '取消' : '+ 创建新书'}
        </button>
        <button onClick={handleTriggerWrite} style={{ ...btnStyle, background: '#2563eb' }}>
          ▶ 立即写作
        </button>
        <button onClick={loadData} style={{ ...btnStyle, background: '#4b5563' }}>
          ↻ 刷新
        </button>
      </div>

      {/* Create Book Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateBook} style={{
          background: '#1a1a1a', borderRadius: 12, padding: '1.5rem', marginBottom: '2rem',
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#fff' }}>创建新书</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input placeholder="书籍ID (英文)" value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value })}
              style={inputStyle} required />
            <input placeholder="书名" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
              style={inputStyle} required />
            <select value={formData.genre} onChange={e => setFormData({ ...formData, genre: e.target.value })} style={inputStyle}>
              <option>玄幻</option><option>仙侠</option><option>都市</option><option>言情</option>
              <option>科幻</option><option>悬疑</option><option>历史</option><option>奇幻</option>
            </select>
            <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} style={inputStyle}>
              <option value="zh">中文</option><option value="en">English</option>
            </select>
          </div>
          <button type="submit" style={{ ...btnStyle, background: '#16a34a' }}>确认创建</button>
        </form>
      )}

      {/* Message */}
      {message && (
        <div style={{ background: '#1e3a5f', borderRadius: 8, padding: '1rem', marginBottom: '1rem', color: '#93c5fd' }}>
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
        {/* Book List */}
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1.5rem', maxHeight: '70vh', overflow: 'auto' }}>
          <h3 style={{ marginBottom: '1rem', color: '#fff' }}>我的书籍</h3>
          {books.length === 0 ? (
            <p style={{ color: '#666' }}>还没有书籍，点击上方创建</p>
          ) : (
            books.map(book => (
              <div key={book.id} onClick={() => setSelectedBook(book.id)}
                style={{
                  padding: '1rem', borderRadius: 8, marginBottom: '0.5rem', cursor: 'pointer',
                  background: selectedBook === book.id ? '#2d2d2d' : 'transparent',
                  border: '1px solid ' + (selectedBook === book.id ? '#444' : '#2a2a2a'),
                }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>{book.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: '0.5rem' }}>
                  <span>{book.genre}</span>
                  <span>|</span>
                  <span>{book.status}</span>
                  <span>|</span>
                  <span>{book.language === 'zh' ? '中文' : 'English'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chapter List */}
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1.5rem', maxHeight: '70vh', overflow: 'auto' }}>
          <h3 style={{ marginBottom: '1rem', color: '#fff' }}>
            {selectedBook ? `章节 (${chapters.length})` : '选择一本书查看章节'}
          </h3>
          {chapters.length === 0 ? (
            <p style={{ color: '#666' }}>
              {selectedBook ? '还没有章节，系统会自动开始写作' : '请从左侧选择一本书'}
            </p>
          ) : (
            chapters.map(ch => (
              <div key={ch.id} style={{
                padding: '0.75rem', borderRadius: 8, marginBottom: '0.5rem',
                border: '1px solid #2a2a2a',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, color: '#fff' }}>
                    第{ch.number}章: {ch.title}
                  </span>
                  <span style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: ch.status === 'ready-for-review' ? '#1e3a5f' : '#3a1e1e',
                    color: ch.status === 'ready-for-review' ? '#93c5fd' : '#fca5a5',
                  }}>
                    {ch.status === 'ready-for-review' ? '待审' : ch.status === 'audit-failed' ? '审计失败' : ch.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {ch.word_count} 字 · {new Date(ch.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
  background: '#333', color: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem',
};

const inputStyle: React.CSSProperties = {
  padding: '0.75rem', borderRadius: 8, border: '1px solid #333',
  background: '#111', color: '#fff', fontSize: '0.9rem', width: '100%',
};

export default App;