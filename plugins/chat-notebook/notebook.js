import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

const root = document.querySelector('#app');
root.innerHTML = `
  <style>
    :root { color-scheme: light dark; --ink: #202020; --muted: #777; --line: #e8e8e8; --surface: #f7f7f7; --focus: #438e76; }
    @media (prefers-color-scheme: dark) { :root { --ink: #e9e9e9; --muted: #929292; --line: #333; --surface: #242424; } }
    :root[data-theme="dark"] { --ink: #e9e9e9; --muted: #929292; --line: #333; --surface: #242424; }
    :root[data-theme="light"] { --ink: #202020; --muted: #777; --line: #e8e8e8; --surface: #f7f7f7; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--color-text-primary, var(--ink)); font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif); font-size: 14px; }
    button, textarea { font: inherit; color: inherit; }
    button { cursor: pointer; }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
    .notebook { padding: 28px 24px; max-width: 700px; margin: 0 auto; }
    .heading { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .heading svg { width: 20px; height: 20px; flex: none; color: var(--muted); }
    h1 { margin: 0; font-size: 19px; letter-spacing: -.025em; font-weight: 600; }
    .tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--line); margin-bottom: 22px; }
    .tab { background: none; border: 0; padding: 2px 0 12px; color: var(--muted); font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s ease; }
    .tab:hover:not(:disabled) { color: var(--ink); }
    .tab[aria-selected="true"] { border-bottom-color: currentColor; color: var(--ink); font-weight: 600; }
    .composer { border: 1px solid var(--line); border-radius: 13px; padding: 15px; background: var(--color-background-secondary, var(--surface)); transition: border-color .15s ease; }
    textarea { width: 100%; border: 0; background: none; resize: vertical; min-height: 100px; max-height: 340px; padding: 0; line-height: 1.6; display: block; }
    textarea::placeholder { color: var(--muted); }
    textarea:focus-visible { outline: none; }
    .composer:focus-within { border-color: var(--focus); }
    .composer-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; }
    .hint { color: var(--muted); font-size: 11px; line-height: 1.4; }
    .save { border: 0; border-radius: 8px; background: var(--ink); color: var(--surface); padding: 8px 12px; font-size: 12px; font-weight: 600; white-space: nowrap; transition: opacity .15s ease; }
    .save:hover:not(:disabled) { opacity: .82; }
    .status { min-height: 36px; padding: 10px 1px; font-size: 11px; color: var(--muted); }
    .status.error { color: #c86555; }
    .retry { display: none; background: none; border: 0; padding: 0 0 0 7px; font-size: 11px; text-decoration: underline; }
    .empty { padding: 38px 6px; text-align: center; color: var(--muted); line-height: 1.6; }
    .empty strong { display: block; margin-bottom: 5px; color: var(--ink); font-size: 13px; font-weight: 500; }
    .empty span { font-size: 12px; }
    .group { margin: 24px 0 0; padding: 0; color: var(--muted); font-size: 11px; font-weight: 500; letter-spacing: .025em; }
    .note { padding: 19px 1px 21px; border-bottom: 1px solid var(--line); }
    .note p { margin: 0 0 11px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.65; }
    .note-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .note time { color: var(--muted); font-size: 11px; }
    .copy { padding: 4px 0 4px 10px; border: 0; background: none; color: var(--muted); font-size: 11px; transition: color .15s ease; }
    .copy:hover { color: var(--ink); }
    @media (max-width: 360px) { .notebook { padding: 22px 16px; } .composer-footer { align-items: flex-end; } }
    @media (prefers-reduced-motion: reduce) { .tab, .composer, .save, .copy { transition: none; } }
  </style>
  <main class="notebook">
    <div class="heading">
      <svg viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" rx="29" fill="#1c4037"/><rect x="34" y="24" width="66" height="80" rx="8" fill="#e8f2ea"/><path d="M49 24v80" stroke="#85a79a" stroke-width="3"/><path d="M28 42h12M28 64h12M28 86h12" stroke="#a8c8b9" stroke-width="5" stroke-linecap="round"/><path d="M60 46h26M60 60h26M60 74h16" stroke="#317a64" stroke-width="5" stroke-linecap="round"/><circle cx="88" cy="84" r="8" fill="#d2a95c"/></svg>
      <h1>Notebook</h1>
    </div>
    <div class="tabs" role="tablist" aria-label="Notes to show">
      <button class="tab" role="tab" aria-selected="true" data-scope="chat">This chat</button>
      <button class="tab" role="tab" aria-selected="false" data-scope="all">All chats</button>
    </div>
    <div class="composer">
      <textarea aria-label="New note" placeholder="A thought for later…" disabled></textarea>
      <div class="composer-footer"><span class="hint">Paste to save automatically</span><button class="save" disabled>Save note</button></div>
    </div>
    <div class="status" role="status" aria-live="polite"><span id="status-text">Connecting…</span><button class="retry">Try again</button></div>
    <section class="notes" aria-label="Saved notes" aria-busy="true"></section>
  </main>`;

const textarea = root.querySelector('textarea');
const saveButton = root.querySelector('.save');
const notesElement = root.querySelector('.notes');
const retryButton = root.querySelector('.retry');
const tabs = [...root.querySelectorAll('.tab')];
let threadId = null;
let scope = 'chat';
let notes = [];
let ready = false;
let saving = false;
let draftCaptureTime = null;
let pending = null;
let sequence = 0;
let pasteSequence = 0;
let inputSequence = 0;
let retry = null;

function status(message, error = false, retryAction = null) {
  root.querySelector('#status-text').textContent = message;
  root.querySelector('.status').classList.toggle('error', error);
  retry = retryAction;
  retryButton.style.display = retryAction ? 'inline' : 'none';
}

function updateControls() {
  textarea.disabled = !ready || saving;
  saveButton.disabled = !ready || saving || !textarea.value.trim();
  saveButton.textContent = saving ? 'Saving…' : 'Save note';
  tabs.forEach(tab => { tab.disabled = !ready || saving; });
}

function drawNotes() {
  notesElement.replaceChildren();
  notesElement.setAttribute('aria-busy', 'false');
  if (!notes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const title = document.createElement('strong');
    title.textContent = scope === 'chat' ? 'No notes in this chat yet' : 'No notes yet';
    const text = document.createElement('span');
    text.textContent = 'Keep a thought here while the conversation continues.';
    empty.append(title, text);
    notesElement.append(empty);
    return;
  }
  const groups = new Map();
  for (const note of notes) {
    if (!groups.has(note.threadId)) groups.set(note.threadId, []);
    groups.get(note.threadId).push(note);
  }
  const orderedNotes = scope === 'all' ? [...groups.values()].flat() : notes;
  let previousThread;
  for (const note of orderedNotes) {
    if (scope === 'all' && note.threadId !== previousThread) {
      const group = document.createElement('h2');
      group.className = 'group';
      group.textContent = note.threadId === threadId ? 'This chat' : `Chat · ${note.threadId.slice(-8)}`;
      group.title = note.threadId;
      notesElement.append(group);
      previousThread = note.threadId;
    }
    const article = document.createElement('article');
    article.className = 'note';
    const text = document.createElement('p');
    text.textContent = note.text;
    const time = document.createElement('time');
    const date = new Date(note.createdAt);
    time.dateTime = note.createdAt;
    time.title = date.toLocaleString();
    time.textContent = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
    const footer = document.createElement('div');
    footer.className = 'note-footer';
    const copy = document.createElement('button');
    copy.className = 'copy';
    copy.textContent = 'Copy';
    copy.setAttribute('aria-label', 'Copy note');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(note.text);
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(text);
        selection?.removeAllRanges();
        selection?.addRange(range);
        status('Note selected. Use your keyboard shortcut to copy.');
      }
    });
    footer.append(time, copy);
    article.append(text, footer);
    notesElement.append(article);
  }
}

function readSnapshot(result) {
  if (result.isError) throw new Error(result.content?.find(item => item.type === 'text')?.text || 'The notebook could not be loaded.');
  const snapshot = result.structuredContent;
  if (!snapshot || typeof snapshot.threadId !== 'string' || !Array.isArray(snapshot.notes)) throw new Error('The notebook returned an invalid response.');
  return snapshot;
}

function applySnapshot(snapshot) {
  threadId = snapshot.threadId;
  notes = snapshot.notes.filter(note => typeof note.id === 'string' && typeof note.threadId === 'string' && typeof note.text === 'string' && Number.isFinite(Date.parse(note.createdAt)));
  ready = true;
  updateControls();
  drawNotes();
}

const app = new App({ name: 'Chat Notebook', version: '0.2.1' }, {});
app.ontoolresult = result => {
  try {
    // The host's initial result may arrive after a newer list or save response.
    if (ready) return;
    applySnapshot(readSnapshot(result));
    status('Saved on this Mac');
  } catch (error) { status(error.message, true, () => loadNotes()); }
};

function applyContext(context) {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
}
app.onhostcontextchanged = applyContext;

async function loadNotes() {
  const request = ++sequence;
  notesElement.setAttribute('aria-busy', 'true');
  try {
    const snapshot = readSnapshot(await app.callServerTool({ name: 'notebook_list', arguments: { scope } }));
    if (request !== sequence) return;
    applySnapshot(snapshot);
    status('Saved on this Mac');
  } catch (error) {
    if (request === sequence) {
      notesElement.setAttribute('aria-busy', 'false');
      status(error.message, true, () => loadNotes());
    }
  }
}

async function saveNote() {
  if (!ready || saving || !textarea.value.trim()) return;
  const text = textarea.value;
  pending = pending?.text === text ? pending : { id: crypto.randomUUID(), text, createdAt: draftCaptureTime || new Date().toISOString() };
  saving = true;
  ++sequence;
  updateControls();
  status('Saving…');
  try {
    const snapshot = readSnapshot(await app.callServerTool({ name: 'notebook_add', arguments: pending }));
    // Only clear the draft once the response confirms this exact note was saved.
    if (!snapshot.notes.some(note => note.id === pending.id && note.threadId === snapshot.threadId && note.text === pending.text && note.createdAt === pending.createdAt)) {
      throw new Error('The saved note was not confirmed.');
    }
    textarea.value = '';
    pending = null;
    draftCaptureTime = null;
    if (scope === 'chat') {
      applySnapshot(snapshot);
      status('Saved on this Mac');
    } else {
      await loadNotes();
    }
  } catch (error) {
    status('Couldn’t save. Your text is still above.', true, () => saveNote());
  } finally {
    saving = false;
    updateControls();
  }
}

textarea.addEventListener('paste', () => {
  if (!ready || saving) return;
  const before = textarea.value;
  const inputBefore = inputSequence;
  const pastedAt = new Date().toISOString();
  const paste = ++pasteSequence;
  // Let the browser perform the paste, then save the value actually inserted.
  // Multiple paste events in one turn are combined into one save.
  setTimeout(() => {
    if (paste !== pasteSequence || saving) return;
    if ((textarea.value === before && inputSequence === inputBefore) || !textarea.value.trim()) {
      if (!textarea.value) draftCaptureTime = null;
      return;
    }
    draftCaptureTime ||= pastedAt;
    void saveNote();
  }, 0);
  if (!before) draftCaptureTime = pastedAt;
});
textarea.addEventListener('input', () => {
  ++inputSequence;
  draftCaptureTime = textarea.value ? draftCaptureTime || new Date().toISOString() : null;
  updateControls();
});
textarea.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    void saveNote();
  }
});
saveButton.addEventListener('click', () => { void saveNote(); });
retryButton.addEventListener('click', () => { void retry?.(); });
tabs.forEach(tab => tab.addEventListener('click', () => {
  scope = tab.dataset.scope;
  tabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  void loadNotes();
}));

if (window.parent === window) {
  applySnapshot({ threadId: 'preview', notes: [] });
  ready = false;
  updateControls();
  status('Preview · Open Chat Notebook beside a Codex chat to save notes');
} else {
  app.connect().then(() => {
    applyContext(app.getHostContext());
    if (!ready) void loadNotes();
  }).catch(error => status(`Couldn’t connect: ${error.message}`, true));
}
