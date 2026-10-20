import fs from 'node:fs';
const file = new URL('../lib/client.js', import.meta.url);
const before = fs.readFileSync(file, 'utf8');
let after = before;
for (const name of ['pricing', 'balance']) {
  const source = fs.readFileSync(new URL(`../lib/${name}.js`, import.meta.url), 'utf8').replace(/^export /gm, '');
  const body = source.trim().split('\n').map(line => line ? '    ' + line : '').join('\n');
  const marker = name.toUpperCase();
  const pattern = new RegExp(`    // BEGIN SHARED ${marker}[\\s\\S]*?    // END SHARED ${marker}`);
  if (!pattern.test(after)) throw new Error(`Missing shared ${name} markers`);
  after = after.replace(pattern, () => `    // BEGIN SHARED ${marker}\n${body}\n    // END SHARED ${marker}`);
}
if (process.argv.includes('--check')) { if (before !== after) { console.error('Client shared modules are stale; run npm run build'); process.exitCode = 1; } }
else fs.writeFileSync(file, after);
