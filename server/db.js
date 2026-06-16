import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'fynix-chat.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedDefaults();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Assistant',
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 2048,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL DEFAULT '',
      attachments TEXT NOT NULL DEFAULT '[]',
      token_estimate INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id TEXT PRIMARY KEY DEFAULT 'user-preferences',
      theme TEXT NOT NULL DEFAULT 'system',
      font_size TEXT NOT NULL DEFAULT 'medium',
      streaming INTEGER NOT NULL DEFAULT 1,
      sound_enabled INTEGER NOT NULL DEFAULT 1,
      stream_debounce_ms INTEGER NOT NULL DEFAULT 50
    );

    CREATE TABLE IF NOT EXISTS active_state (
      id TEXT PRIMARY KEY DEFAULT 'active',
      conversation_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, timestamp);
  `);

  migrateUserProfile();
}

function migrateUserProfile() {
  const tableInfo = db.prepare("PRAGMA table_info('user_profiles')").all();
  const hasOldColumns = tableInfo.some((c: any) => c.name === 'name' || c.name === 'background');
  if (hasOldColumns) {
    db.exec(`
      DROP TABLE IF EXISTS user_profiles;
      CREATE TABLE user_profiles (
        id TEXT PRIMARY KEY DEFAULT 'main',
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      );
    `);
  } else {
    db.exec(`CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY DEFAULT 'main',
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );`);
  }
}

function seedDefaults() {
  const prefs = db.prepare('SELECT id FROM preferences WHERE id = ?').get('user-preferences');
  if (!prefs) {
    db.prepare(`INSERT INTO preferences (id, theme, font_size, streaming, sound_enabled, stream_debounce_ms)
      VALUES ('user-preferences', 'system', 'medium', 1, 1, 50)`).run();
  }

  const defaultPersona = db.prepare('SELECT id FROM personas WHERE id = ?').get('default');
  if (!defaultPersona) {
    const now = Date.now();
    db.prepare(`INSERT INTO personas (id, name, description, system_prompt, temperature, max_tokens, created_at, updated_at)
      VALUES ('default', 'Chat Assistant', 'A helpful AI assistant', 'You are a helpful, friendly, and knowledgeable AI assistant. Provide accurate and concise responses.', 0.7, 2048, ?, ?)`).run(now, now);
  }

  const active = db.prepare('SELECT id FROM active_state WHERE id = ?').get('active');
  if (!active) {
    db.prepare(`INSERT INTO active_state (id, conversation_id) VALUES ('active', NULL)`).run();
  }

  const profile = db.prepare('SELECT id FROM user_profiles WHERE id = ?').get('main');
  if (!profile) {
    const now = Date.now();
    db.prepare(`INSERT INTO user_profiles (id, content, created_at, updated_at)
      VALUES ('main', '', ?, ?)`).run(now, now);
  }
}

export function query(sql, params = {}) {
  const d = getDb();
  const stmt = d.prepare(sql);
  const bind = Array.isArray(params) ? params : params;
  const rows = stmt.all(bind);
  return rows.map(r => mapRow(r));
}

export function get(sql, params = {}) {
  const d = getDb();
  const stmt = d.prepare(sql);
  const bind = Array.isArray(params) ? params : params;
  const row = stmt.get(bind);
  return row ? mapRow(row) : null;
}

export function run(sql, params = {}) {
  const d = getDb();
  const stmt = d.prepare(sql);
  const bind = Array.isArray(params) ? params : params;
  const info = stmt.run(bind);
  return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

function mapRow(row) {
  if (!row) return row;
  const mapped = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    mapped[camelKey] = value;
  }
  return mapped;
}
