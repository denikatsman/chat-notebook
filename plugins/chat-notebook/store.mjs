import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const defaultDatabasePath = () => join(
  process.env.CHAT_NOTEBOOK_DATA_DIR || join(homedir(), 'Library', 'Application Support', 'Plugin UI Lab', 'Chat Notebook'),
  'notes.sqlite',
);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = isoPattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return false;
  return true;
}

function requireThread(threadId) {
  if (typeof threadId !== 'string' || !threadId.trim()) throw new Error('Missing chat thread metadata.');
}

export function createNotebookStore(path = defaultDatabasePath()) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notes_thread_created ON notes(thread_id, created_at_ms DESC);`);
  const get = db.prepare('SELECT id, thread_id AS threadId, text, created_at AS createdAt FROM notes WHERE id = ?');
  const insert = db.prepare('INSERT INTO notes (id, thread_id, text, created_at, created_at_ms) VALUES (?, ?, ?, ?, ?)');
  const chat = db.prepare('SELECT id, thread_id AS threadId, text, created_at AS createdAt FROM notes WHERE thread_id = ? ORDER BY created_at_ms DESC, id ASC');
  const all = db.prepare('SELECT id, thread_id AS threadId, text, created_at AS createdAt FROM notes ORDER BY (thread_id = ?) DESC, created_at_ms DESC, id ASC');
  return {
    list(threadId, scope = 'chat') {
      requireThread(threadId);
      if (scope !== 'chat' && scope !== 'all') throw new Error('Invalid notebook scope.');
      return { threadId, notes: scope === 'chat' ? chat.all(threadId) : all.all(threadId), scope };
    },
    add(threadId, { id, text, createdAt }) {
      requireThread(threadId);
      if (typeof id !== 'string' || !uuidPattern.test(id)) throw new Error('Note ID must be a UUID.');
      if (typeof text !== 'string' || !text.trim()) throw new Error('Note text must not be empty.');
      if (!isIsoTimestamp(createdAt)) throw new Error('Note creation time must be a valid ISO timestamp with a timezone.');
      // A single insert also handles competing requests safely; a retry must match every field.
      try {
        insert.run(id, threadId, text, createdAt, Date.parse(createdAt));
      } catch (error) {
        const existing = get.get(id);
        if (!existing || existing.threadId !== threadId || existing.text !== text || existing.createdAt !== createdAt) {
          if (existing) throw new Error('Note ID is already in use with different content.');
          throw error;
        }
      }
      return this.list(threadId, 'chat');
    },
    close() { db.close(); },
  };
}
