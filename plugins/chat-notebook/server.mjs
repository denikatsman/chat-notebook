import express from 'express';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { createNotebookStore, isIsoTimestamp } from './store.mjs';

const resourceUri = 'ui://chat-notebook/panel-v2.html';
const noteSchema = z.object({ id: z.string(), threadId: z.string(), text: z.string(), createdAt: z.string() });
const outputSchema = { threadId: z.string(), notes: z.array(noteSchema), scope: z.enum(['chat', 'all']) };
const scopeSchema = z.enum(['chat', 'all']).default('chat');
const addSchema = {
  id: z.string().uuid(),
  text: z.string().refine(value => value.trim().length > 0, 'Note text must not be empty.'),
  createdAt: z.string().refine(isIsoTimestamp, 'Expected a valid ISO timestamp with a timezone.'),
};

async function html(preview = false) {
  const script = await readFile(new URL('./dist/notebook.js', import.meta.url), 'utf8');
  // The bundled code is inline, so prevent a literal closing script tag from ending it.
  const safeScript = script.replace(/<\/script/gi, '<\\/script');
  const banner = preview ? '<div style="padding:10px;background:#171717;color:#aaa;font:12px sans-serif">Standalone preview</div>' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0">${banner}<div id="app"></div><script type="module">${safeScript}</script></body></html>`;
}

function threadFrom(extra) {
  const threadId = extra?._meta?.threadId ?? extra?._meta?.thread_id;
  if (typeof threadId !== 'string' || !threadId.trim()) throw new Error('Missing chat thread metadata. Open this notebook from a chat.');
  return threadId;
}

function result(action) {
  try {
    return { content: [{ type: 'text', text: 'Notebook ready.' }], structuredContent: action() };
  } catch (error) {
    // Error messages describe validation or availability only, never note contents.
    const message = error.message === 'Missing chat thread metadata. Open this notebook from a chat.' || error.message === 'Note ID is already in use with different content.'
      ? error.message : 'Could not access the notebook.';
    return { isError: true, content: [{ type: 'text', text: message }] };
  }
}

export function createMcpServer(store) {
  const server = new McpServer({ name: 'chat-notebook', version: '0.2.1' });
  const meta = { ui: { resourceUri, visibility: ['app'] } };
  const annotations = readOnlyHint => ({ readOnlyHint, destructiveHint: false, openWorldHint: false });
  registerAppTool(server, 'notebook_open', {
    title: 'Open chat notebook', description: 'Open notes saved for this chat.', inputSchema: {}, outputSchema,
    annotations: annotations(true), _meta: { ...meta, 'openai/ui': { entrypoints: [{ type: 'thread' }] } },
  }, async (_args, extra) => result(() => store.list(threadFrom(extra), 'chat')));
  registerAppTool(server, 'notebook_list', {
    title: 'List notebook notes', description: 'List notes for this chat or all notebook chats.', inputSchema: { scope: scopeSchema }, outputSchema,
    annotations: annotations(true), _meta: meta,
  }, async ({ scope }, extra) => result(() => store.list(threadFrom(extra), scope)));
  registerAppTool(server, 'notebook_add', {
    title: 'Add notebook note', description: 'Save a pasted note for this chat.', inputSchema: addSchema, outputSchema,
    annotations: annotations(false), _meta: meta,
  }, async (args, extra) => result(() => store.add(threadFrom(extra), args)));
  registerAppResource(server, 'Chat notebook', resourceUri, {}, async () => ({
    contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: await html(), _meta: { ui: { prefersBorder: true, permissions: { clipboardWrite: {} } } } }],
  }));
  return server;
}

export function createWebApp(store) {
  const web = express();
  web.use(express.json());
  web.get('/health', (_req, res) => res.json({ ok: true }));
  web.get('/preview', async (_req, res, next) => {
    try { res.type('html').send(await html(true)); } catch (error) { next(error); }
  });
  web.post('/mcp', async (req, res) => {
    const server = createMcpServer(store);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      console.error('MCP request failed.');
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Server error' }, id: null });
    }
  });
  return web;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--stdio')) {
    throw new Error('Usage: node server.mjs [--stdio]');
  }
  const store = createNotebookStore();
  let closeTransport = async () => {};
  let closing;
  const close = () => closing ??= (async () => {
    try { await closeTransport(); } finally { store.close(); }
  })();
  const stop = () => { void close().catch(() => { console.error('Could not shut down Chat Notebook cleanly.'); process.exitCode = 1; }); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    if (args[0] === '--stdio') {
      const server = createMcpServer(store);
      closeTransport = () => server.close();
      // The host owns this process. Close the database when its input pipe closes.
      process.stdin.once('end', stop);
      await server.connect(new StdioServerTransport());
    } else {
      const listener = createWebApp(store).listen(3877, '127.0.0.1');
      closeTransport = () => new Promise((resolve, reject) => listener.close(error => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error); else resolve();
      }));
      await new Promise((resolve, reject) => {
        listener.once('listening', resolve);
        listener.once('error', reject);
      });
      console.error('Chat Notebook: http://127.0.0.1:3877/preview — MCP: http://127.0.0.1:3877/mcp');
    }
  } catch (error) {
    await close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
