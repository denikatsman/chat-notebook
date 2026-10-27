import { copyFileSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs';

if (process.platform !== 'darwin' || Number(process.versions.node.split('.')[0]) < 24) {
  throw new Error('Prepare the local package with Node 24 or newer on macOS.');
}
const directory = new URL('./runtime/', import.meta.url);
mkdirSync(directory, { recursive: true });
const target = new URL('node', directory);
copyFileSync(process.execPath, target);
chmodSync(target, 0o755);
writeFileSync(new URL('version.json', directory), `${JSON.stringify({ node: process.version, platform: process.platform, architecture: process.arch }, null, 2)}\n`);
console.log(`Bundled Node ${process.version} (${process.arch}) for this Mac. Codex can now launch the plugin without a terminal server.`);
