import fs from 'node:fs';
const source = fs.readFileSync(new URL('../lib/pricing.js', import.meta.url), 'utf8').replace(/^export /gm, '');
const file = new URL('../lib/client.js', import.meta.url);
const before = fs.readFileSync(file, 'utf8');
const body = source.trim().split('\n').map(line => '    ' + line).join('\n');
const after = before.replace(/    \/\/ BEGIN SHARED PRICING[\s\S]*?    \/\/ END SHARED PRICING/, '    // BEGIN SHARED PRICING\n' + body + '\n    // END SHARED PRICING');
if (process.argv.includes('--check')) { if (before !== after) { console.error('Client pricing is stale; run npm run build'); process.exitCode = 1; } }
else fs.writeFileSync(file, after);
