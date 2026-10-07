const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const axios = require('axios');

let win;
let db;
let settingsPath;
let settings = { providers: [] };
let translateWin;

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadSettings() {
  settingsPath = path.join(dataDir(), 'settings.json');
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!Array.isArray(settings.providers)) settings.providers = [];
  } catch {
    settings = { providers: [] };
    saveSettings();
  }
}

function saveSettings() {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

function initDb() {
  db = new Database(path.join(dataDir(), 'news.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      source_name TEXT DEFAULT '',
      source_url TEXT NOT NULL UNIQUE,
      published_at TEXT DEFAULT '',
      content TEXT DEFAULT '',
      category TEXT DEFAULT '미분류',
      keywords TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);
    CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
    CREATE VIRTUAL TABLE IF NOT EXISTS news_fts USING fts5(
      title, description, content, keywords,
      content='news', content_rowid='id'
    );
    CREATE TRIGGER IF NOT EXISTS news_ai AFTER INSERT ON news BEGIN
      INSERT INTO news_fts(rowid,title,description,content,keywords)
      VALUES(new.id,new.title,new.description,new.content,new.keywords);
    END;
    CREATE TRIGGER IF NOT EXISTS news_au AFTER UPDATE ON news BEGIN
      INSERT INTO news_fts(news_fts,rowid,title,description,content,keywords)
      VALUES('delete',old.id,old.title,old.description,old.content,old.keywords);
      INSERT INTO news_fts(rowid,title,description,content,keywords)
      VALUES(new.id,new.title,new.description,new.content,new.keywords);
    END;
    CREATE TRIGGER IF NOT EXISTS news_ad AFTER DELETE ON news BEGIN
      INSERT INTO news_fts(news_fts,rowid,title,description,content,keywords)
      VALUES('delete',old.id,old.title,old.description,old.content,old.keywords);
    END;
  `);
}

function publicProviders() {
  return settings.providers.map(p => ({
    id: p.id,
    name: p.name,
    provider: p.provider,
    enabled: p.enabled !== false,
    apiKey: p.apiKey ? '••••••••' + p.apiKey.slice(-4) : ''
  }));
}

async function searchGNews(p, query) {
  if (!p.apiKey) throw new Error('GNews API Key가 없습니다.');
  const r = await axios.get('https://gnews.io/api/v4/search', {
    params: { q: query, lang: 'en', max: 20, apikey: p.apiKey },
    timeout: 15000
  });
  return (r.data.articles || []).map(a => ({
    title: a.title || '',
    description: a.description || '',
    sourceName: a.source?.name || '',
    sourceUrl: a.url || '',
    publishedAt: a.publishedAt || '',
    content: a.content || '',
    provider: 'gnews'
  }));
}

async function searchNewsApi(p, query) {
  if (!p.apiKey) throw new Error('NewsAPI Key가 없습니다.');
  const r = await axios.get('https://newsapi.org/v2/everything', {
    params: { q: query, language: 'en', pageSize: 20, sortBy: 'publishedAt', apiKey: p.apiKey },
    timeout: 15000
  });
  if (r.data.status !== 'ok') throw new Error(r.data.message || 'NewsAPI 검색 실패');
  return (r.data.articles || []).map(a => ({
    title: a.title || '',
    description: a.description || '',
    sourceName: a.source?.name || '',
    sourceUrl: a.url || '',
    publishedAt: a.publishedAt || '',
    content: a.content || '',
    provider: 'newsapi'
  }));
}

async function translateWithGoogle(apiKey, text, target='ko', source='auto') {
  if (!apiKey) throw new Error('Google Cloud Translation API Key가 없습니다.');
  if (!String(text || '').trim()) throw new Error('번역할 원문이 없습니다.');
  const value = String(text).trim();
  const chunks = [];
  const max = 4500;
  for (let i = 0; i < value.length; i += max) chunks.push(value.slice(i, i + max));
  const out = [];
  for (const chunk of chunks) {
    const r = await axios.post('https://translation.googleapis.com/language/translate/v2', null, {
      params: { key: apiKey, q: chunk, target, ...(source && source !== 'auto' ? { source } : {}), format: 'text' },
      timeout: 20000
    });
    const translations = r.data?.data?.translations || [];
    if (!translations.length) throw new Error('Google Translation API가 번역 결과를 반환하지 않았습니다.');
    out.push(translations.map(x => x.translatedText || '').join(''));
  }
  return out.join('\n');
}

function openGoogleTranslatePopup() {
  if (translateWin && !translateWin.isDestroyed()) {
    translateWin.focus();
    return true;
  }
  translateWin = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Google Translate',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  translateWin.loadURL('https://translate.google.com/?sl=auto&tl=ko&op=translate');
  translateWin.on('closed', () => { translateWin = null; });
  return true;
}

async function runSearch(query, providerIds = []) {
  const selected = settings.providers.filter(p =>
    (p.provider === 'gnews' || p.provider === 'newsapi') &&
    p.enabled !== false && (!providerIds.length || providerIds.includes(p.id))
  );
  if (!selected.length) {
    throw new Error('활성화된 뉴스 API가 없습니다. 먼저 API 관리에서 GNews 또는 NewsAPI를 등록해 주세요.');
  }

  const all = [];
  const errors = [];
  for (const p of selected) {
    try {
      const rows = p.provider === 'gnews'
        ? await searchGNews(p, query)
        : p.provider === 'newsapi'
          ? await searchNewsApi(p, query)
          : [];
      all.push(...rows);
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }

  const seen = new Set();
  const rows = all.filter(a => {
    const key = a.sourceUrl || a.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { rows, errors };
}

function saveNews(n) {
  if (!n.sourceUrl) throw new Error('원문 URL이 없는 뉴스는 저장할 수 없습니다.');
  const existing = db.prepare('SELECT id FROM news WHERE source_url=?').get(n.sourceUrl);
  if (existing) return { saved: false, already: true, id: existing.id };
  const info = db.prepare(`
    INSERT INTO news(title,description,source_name,source_url,published_at,content,category,keywords)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    n.title || '', n.description || '', n.sourceName || '', n.sourceUrl,
    n.publishedAt || '', n.content || '', n.category || '미분류', n.keywords || ''
  );
  return { saved: true, already: false, id: Number(info.lastInsertRowid) };
}

function listNews({ q = '', category = '전체', page = 1, limit = 30 } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const hasQ = q.trim().length > 0;
  const cat = category && category !== '전체' ? category : null;
  let rows;
  let total;

  if (hasQ) {
    const term = q.replace(/["*]/g, ' ').trim() + '*';
    if (cat) {
      rows = db.prepare(`
        SELECT n.* FROM news_fts f JOIN news n ON n.id=f.rowid
        WHERE news_fts MATCH ? AND n.category=?
        ORDER BY COALESCE(n.published_at,'') DESC,n.id DESC LIMIT ? OFFSET ?
      `).all(term, cat, limit, offset);
      total = db.prepare(`SELECT COUNT(*) c FROM news_fts f JOIN news n ON n.id=f.rowid WHERE news_fts MATCH ? AND n.category=?`).get(term, cat).c;
    } else {
      rows = db.prepare(`
        SELECT n.* FROM news_fts f JOIN news n ON n.id=f.rowid
        WHERE news_fts MATCH ? ORDER BY COALESCE(n.published_at,'') DESC,n.id DESC LIMIT ? OFFSET ?
      `).all(term, limit, offset);
      total = db.prepare(`SELECT COUNT(*) c FROM news_fts f JOIN news n ON n.id=f.rowid WHERE news_fts MATCH ?`).get(term).c;
    }
  } else if (cat) {
    rows = db.prepare(`SELECT * FROM news WHERE category=? ORDER BY COALESCE(published_at,'') DESC,id DESC LIMIT ? OFFSET ?`).all(cat, limit, offset);
    total = db.prepare(`SELECT COUNT(*) c FROM news WHERE category=?`).get(cat).c;
  } else {
    rows = db.prepare(`SELECT * FROM news ORDER BY COALESCE(published_at,'') DESC,id DESC LIMIT ? OFFSET ?`).all(limit, offset);
    total = db.prepare(`SELECT COUNT(*) c FROM news`).get().c;
  }
  return { rows, total };
}

function registerIpc() {
  ipcMain.handle('providers:list', () => publicProviders());

  ipcMain.handle('providers:save', (_, p) => {
    const id = p.id || String(Date.now());
    const old = settings.providers.find(x => x.id === id);
    const row = {
      id,
      name: String(p.name || '').trim(),
      provider: p.provider,
      apiKey: p.apiKey || old?.apiKey || '',
      enabled: p.enabled !== false
    };
    if (!row.name || !row.provider) throw new Error('API 이름과 제공자를 입력해 주세요.');
    const idx = settings.providers.findIndex(x => x.id === id);
    if (idx >= 0) settings.providers[idx] = row;
    else settings.providers.push(row);
    saveSettings();
    return true;
  });

  ipcMain.handle('providers:delete', (_, id) => {
    settings.providers = settings.providers.filter(p => p.id !== id);
    saveSettings();
    return true;
  });

  ipcMain.handle('providers:toggle', (_, id) => {
    const p = settings.providers.find(x => x.id === id);
    if (p) p.enabled = p.enabled === false;
    saveSettings();
    return true;
  });

  ipcMain.handle('providers:test', async (_, id) => {
    const p = settings.providers.find(x => x.id === id);
    if (!p) return { ok: false, message: 'API 설정을 찾을 수 없습니다.' };
    try {
      if (p.provider === 'google_translate') {
        const translated = await translateWithGoogle(p.apiKey, 'Hello. This is a Google Cloud Translation API test.', 'ko');
        return { ok: true, message: `연결 성공 — 번역 테스트 완료: ${translated}` };
      }
      const r = await runSearch('artificial intelligence', [id]);
      if (r.rows.length) return { ok: true, message: `연결 성공 — ${r.rows.length}건을 확인했습니다.` };
      if (r.errors.length) return { ok: false, message: r.errors.join('\n') };
      return { ok: true, message: '연결 성공 — 검색 결과가 없습니다.' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  });

  ipcMain.handle('translate:google', async (_, { text, target }) => {
    const p = settings.providers.find(x => x.provider === 'google_translate' && x.enabled !== false && x.apiKey);
    if (!p) throw new Error('Google Cloud Translation API Key가 등록되어 있지 않습니다. API 관리에서 등록해 주세요.');
    return { text: await translateWithGoogle(p.apiKey, text, target || 'ko') };
  });

  ipcMain.handle('translate:popup', () => openGoogleTranslatePopup());

  ipcMain.handle('news:search', async (_, { query, providerIds }) => {
    const result = await runSearch(query, providerIds || []);
    const urls = result.rows.map(x => x.sourceUrl).filter(Boolean);
    const saved = urls.length
      ? new Set(db.prepare(`SELECT source_url FROM news WHERE source_url IN (${urls.map(() => '?').join(',')})`).all(...urls).map(x => x.source_url))
      : new Set();
    return {
      rows: result.rows.map(x => ({ ...x, saved: saved.has(x.sourceUrl) })),
      errors: result.errors
    };
  });

  ipcMain.handle('news:save', (_, n) => saveNews(n));
  ipcMain.handle('news:list', (_, x) => listNews(x || {}));
  ipcMain.handle('news:get', (_, id) => db.prepare('SELECT * FROM news WHERE id=?').get(id));
  ipcMain.handle('news:delete', (_, id) => { db.prepare('DELETE FROM news WHERE id=?').run(id); return true; });
  ipcMain.handle('news:count', () => db.prepare('SELECT COUNT(*) c FROM news').get().c);
  ipcMain.handle('news:update', (_, n) => {
    db.prepare(`UPDATE news SET title=?,description=?,content=?,category=?,keywords=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(n.title || '', n.description || '', n.content || '', n.category || '미분류', n.keywords || '', n.id);
    return db.prepare('SELECT * FROM news WHERE id=?').get(n.id);
  });
  ipcMain.handle('news:categories', () => db.prepare(`SELECT category,COUNT(*) count FROM news GROUP BY category ORDER BY category`).all());

  ipcMain.handle('open:url', (_, url) => shell.openExternal(url));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1450,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '../frontend/index.html'));
}

app.whenReady().then(() => {
  loadSettings();
  initDb();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
