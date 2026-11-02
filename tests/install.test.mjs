import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const entry = resolve('scripts/agy-hud.mjs');
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "agy hud ' test-"));
  const settings = join(dir, 'settings.json');
  const env = { ...process.env, AGY_HUD_HOME: join(dir, 'state'), AGY_HUD_SETTINGS: settings, NO_COLOR: '1' };
  const run = (...args) => spawnSync(process.execPath, [entry, ...args], { env, encoding: 'utf8', timeout: 5000 });
  try { fn({ dir, settings, run, read: () => JSON.parse(readFileSync(settings, 'utf8')) }); } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('setup, repeat setup, restart wiring, uninstall preserve unrelated preferences', () => fixture(({ settings, run, read, dir }) => {
  const before = { statusLine: { command: 'old', padding: 1 }, model: 'unchanged', permissions: { allow: ['user rule'] }, useG1Credits: false };
  writeFileSync(settings, JSON.stringify(before));
  assert.equal(run('setup').status, 0);
  assert.equal(run('setup').status, 0);
  assert.equal(JSON.parse(run('doctor').stdout).installed, true);
  const current = read(); assert.deepEqual(current.permissions, before.permissions); assert.equal(current.useG1Credits, false);
  assert.equal(current.statusLine.stack_with_default, true);
  const render = spawnSync(current.statusLine.command, { shell: true, input: '{}', encoding: 'utf8', timeout: 5000, env: { ...process.env, NO_COLOR: '1' } });
  assert.equal(render.status, 0); assert.match(render.stdout, /AGY/);
  current.model = 'changed later'; writeFileSync(settings, JSON.stringify(current));
  assert.equal(run('uninstall').status, 0);
  assert.deepEqual(read(), { ...before, model: 'changed later' });
  assert.ok(readdirSync(dir).some(f => f.endsWith('.bak')));
}));
test('corrupt settings remain byte-identical and another HUD is not overwritten on removal', () => fixture(({ settings, run, read }) => {
  writeFileSync(settings, '{invalid'); assert.equal(run('setup').status, 1); assert.equal(readFileSync(settings, 'utf8'), '{invalid');
  writeFileSync(settings, '{}'); assert.equal(run('setup').status, 0);
  const changed = read(); changed.statusLine.command = 'other-tool'; writeFileSync(settings, JSON.stringify(changed));
  assert.equal(run('uninstall').status, 1); assert.equal(read().statusLine.command, 'other-tool');
}));
test('new settings get no phantom previous status line', () => fixture(({ settings, run, read }) => {
  assert.equal(existsSync(settings), false); assert.equal(run('setup').status, 0);
  assert.equal(run('uninstall').status, 0); assert.equal(Object.hasOwn(read(), 'statusLine'), false);
}));
test('bad render data exits successfully with a visible fallback', () => {
  const r = spawnSync(process.execPath, [entry, 'render'], { input: '{bad', encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0); assert.match(r.stdout, /data unavailable/);
});
