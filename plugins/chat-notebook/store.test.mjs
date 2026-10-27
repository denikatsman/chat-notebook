import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNotebookStore, isIsoTimestamp } from './store.mjs';

const a = { id: '29b8553a-9b99-4f27-94d4-099ec088177a', text: '  first\nline  ', createdAt: '2026-10-27T08:00:00.000Z' };
const b = { id: 'f4a40d8e-d1fb-4809-9f66-b8bb548b3100', text: 'other chat', createdAt: '2026-10-27T09:00:00.000Z' };
const c = { id: '58635f21-22e0-42c4-b106-47ced651226f', text: 'newer current', createdAt: '2026-10-27T10:00:00.000Z' };

test('notes persist across reopen, preserve text, isolate chats, and order all with current first', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chat-notebook-'));
  const path = join(dir, 'notes.sqlite');
  try {
    let store = createNotebookStore(path);
    store.add('chat-a', a);
    store.add('chat-b', b);
    store.add('chat-a', c);
    store.close();
    store = createNotebookStore(path);
    assert.deepEqual(store.list('chat-a').notes.map(n => [n.id, n.text]), [[c.id, c.text], [a.id, a.text]]);
    assert.deepEqual(store.list('chat-b').notes.map(n => n.id), [b.id]);
    assert.deepEqual(store.list('chat-b', 'all').notes.map(n => n.id), [b.id, c.id, a.id]);
    assert.equal(store.list('chat-a').scope, 'chat');
    store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('retries are idempotent but reused IDs with changed data or thread are rejected', () => {
  const store = createNotebookStore(':memory:');
  try {
    store.add('chat-a', a);
    store.add('chat-a', a);
    assert.equal(store.list('chat-a').notes.length, 1);
    assert.throws(() => store.add('chat-a', { ...a, text: 'different' }), /already in use/);
    assert.throws(() => store.add('chat-a', { ...a, createdAt: b.createdAt }), /already in use/);
    assert.throws(() => store.add('chat-b', a), /already in use/);
  } finally { store.close(); }
});

test('missing thread and invalid note inputs fail closed', () => {
  const store = createNotebookStore(':memory:');
  try {
    assert.throws(() => store.list(''), /thread metadata/);
    assert.throws(() => store.add(undefined, a), /thread metadata/);
    assert.throws(() => store.list('chat-a', 'unknown'), /scope/);
    assert.throws(() => store.add('chat-a', { ...a, id: 'not-a-uuid' }), /UUID/);
    assert.throws(() => store.add('chat-a', { ...a, text: '  ' }), /empty/);
    assert.throws(() => store.add('chat-a', { ...a, createdAt: '2026-02-30T08:00:00Z' }), /ISO timestamp/);
    assert.equal(isIsoTimestamp('2026-10-27T10:00:00+02:00'), true);
    assert.equal(isIsoTimestamp('2026-10-27'), false);
    assert.equal(store.list('chat-a').notes.length, 0);
  } finally { store.close(); }
});
