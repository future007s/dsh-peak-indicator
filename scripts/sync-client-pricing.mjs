import fs from 'node:fs';
const file = new URL('../lib/client.js', import.meta.url);
// Fork: normalize line endings so a Windows checkout (CRLF) and the shared
// modules (LF) compare equal, and so running apply-fork-changes.mjs after this
// script never makes the --check run stale.
const read = url => fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
const before = read(file);
let after = before;
for (const name of ['pricing', 'balance']) {
  const source = read(new URL(`../lib/${name}.js`, import.meta.url)).replace(/^export /gm, '');
  const body = source.trim().split('\n').map(line => line ? '    ' + line : '').join('\n');
  const marker = name.toUpperCase();
  const pattern = new RegExp(`    // BEGIN SHARED ${marker}[\\s\\S]*?    // END SHARED ${marker}`);
  if (!pattern.test(after)) throw new Error(`Missing shared ${name} markers`);
  after = after.replace(pattern, () => `    // BEGIN SHARED ${marker}\n${body}\n    // END SHARED ${marker}`);
}
if (process.argv.includes('--check')) { if (before !== after) { console.error('Client shared modules are stale; run npm run build'); process.exitCode = 1; } }
else fs.writeFileSync(file, after);
