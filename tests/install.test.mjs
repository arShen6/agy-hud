import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, cpSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const entry = resolve('scripts/agy-hud.mjs');
const details = (command, result) => JSON.stringify({ command, status: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2);
function assertSuccess(command, result) {
  assert.equal(result.status, 0, details(command, result));
  return result;
}
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "agy hud ' test-"));
  const settings = join(dir, 'settings.json');
  const env = { ...process.env, AGY_HUD_HOME: join(dir, 'state'), AGY_HUD_SETTINGS: settings, NO_COLOR: '1' };
  const run = (...args) => spawnSync(process.execPath, [entry, ...args], { env, encoding: 'utf8', timeout: 5000 });
  try { fn({ dir, settings, run, env, read: () => JSON.parse(readFileSync(settings, 'utf8')) }); } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('setup, repeat setup, restart wiring, uninstall preserve unrelated preferences', () => fixture(({ settings, run, read, dir }) => {
  const before = { statusLine: { command: 'old', padding: 1 }, model: 'unchanged', permissions: { allow: ['user rule'] }, useG1Credits: false };
  writeFileSync(settings, JSON.stringify(before));
  assertSuccess('setup', run('setup'));
  assertSuccess('repeat setup', run('setup'));
  assert.equal(JSON.parse(assertSuccess('doctor', run('doctor')).stdout).installed, true);
  const current = read(); assert.deepEqual(current.permissions, before.permissions); assert.equal(current.useG1Credits, false);
  assert.equal(current.statusLine.stack_with_default, true);
  const render = spawnSync(current.statusLine.command, { shell: true, input: '{}', encoding: 'utf8', timeout: 5000, env: { ...process.env, NO_COLOR: '1' } });
  assertSuccess(current.statusLine.command, render); assert.match(render.stdout, /AGY/);
  current.model = 'changed later'; writeFileSync(settings, JSON.stringify(current));
  assertSuccess('uninstall', run('uninstall'));
  assert.deepEqual(read(), { ...before, model: 'changed later' });
  assert.ok(readdirSync(dir).some(f => f.endsWith('.bak')));
}));
test('installed command launches real Node and HUD from paths with spaces and shell punctuation', () => fixture(({ dir, env, read }) => {
  // Both executable and plugin paths must contain spaces. Previously only the
  // settings path did, so the launch test missed this common Windows case.
  const pluginRoot = join(dir, "plugin & tools (HUD) ' 中文");
  for (const folder of ['src', 'scripts']) cpSync(resolve(folder), join(pluginRoot, folder), { recursive: true });
  const runtimeDir = join(dir, 'runtime & tools (Node)');
  mkdirSync(runtimeDir);
  const node = join(runtimeDir, process.platform === 'win32' ? 'node.exe' : 'node');
  copyFileSync(process.execPath, node);
  const installedEntry = join(pluginRoot, 'scripts', 'agy-hud.mjs');
  assertSuccess('setup in spaced paths', spawnSync(node, [installedEntry, 'setup'], { env, encoding: 'utf8', timeout: 5000 }));
  const command = read().statusLine.command;
  const options = { input: '{"model":{"display_name":"Launch Regression"},"quota":{"gemini-5h":{"remaining_fraction":0.7}}}', env, encoding: 'utf8', timeout: 5000 };
  const render = assertSuccess(command, spawnSync(command, { ...options, shell: true }));
  assert.match(render.stdout, /Launch Regression/);
  assert.match(render.stdout, /Gemini 5h left .*70%/);
  if (process.platform === 'win32') {
    // Also execute the persisted command as a native cmd statement, without
    // Node's shell:true quoting around that statement.
    const batch = join(dir, 'native-launch.cmd');
    writeFileSync(batch, `@echo off\r\nchcp 65001 >nul\r\n${command}\r\n`);
    const native = assertSuccess(command, spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', batch], options));
    assert.match(native.stdout, /Launch Regression/);
    assert.match(native.stdout, /Gemini 5h left .*70%/);
  }
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
