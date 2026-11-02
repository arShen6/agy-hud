import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]); }
// Architectural boundary: parsing/rendering cannot import host capabilities.
for (const file of files('src')) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /node:|\bprocess\b|\bfetch\s*\(|\beval\s*\(|\bFunction\s*\(|\bimport\s*\(/, file);
  for (const match of source.matchAll(/from\s+['"]([^'"]+)/g)) assert.ok(match[1].startsWith('./') || match[1].startsWith('../'), file);
}
const pkg = JSON.parse(readFileSync('package.json')), plugin = JSON.parse(readFileSync('plugin.json'));
assert.equal(pkg.version, plugin.version);
console.log('Architecture and manifest checks passed.');
