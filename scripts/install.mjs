import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDir, settingsFile, readJSON } from './collector.mjs';
function atomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); renameSync(tmp, path); }
  finally { if (existsSync(tmp)) unlinkSync(tmp); }
}
function quote(s) {
  if (process.platform === 'win32') {
    if (/["%\r\n]/.test(s)) throw new Error('Unsupported Windows path; choose a path without quotes or percent signs');
    return `"${s}"`;
  }
  return "'" + s.replaceAll("'", "'\\''") + "'";
}
export function commandFor(entry) {
  const command = `${quote(process.execPath)} ${quote(entry)} render`;
  return process.platform === 'win32' ? `"${command}"` : command;
}
function settings() {
  const s = readJSON(settingsFile(), {});
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('settings.json must be an object');
  return s;
}
export function install(entry, language) {
  const file = settingsFile(), current = settings(), command = commandFor(entry);
  const stateFile = join(dataDir(), 'installation.json');
  const old = readJSON(stateFile, null);
  // Idempotent: preserve the original status line across repeated setup and upgrades.
  const owned = old?.settingsFile === file && current.statusLine?.command === old.command;
  const state = owned ? { ...old, command } : { settingsFile: file, command,
    hadPrevious: Object.hasOwn(current, 'statusLine'), previous: current.statusLine ?? null };
  mkdirSync(dataDir(), { recursive: true });
  if (existsSync(file)) {
    const backup = `${file}.agy-hud-${Date.now()}-${randomUUID().slice(0, 8)}.bak`;
    writeFileSync(backup, readFileSync(file), { mode: 0o600, flag: 'wx' });
  }
  atomic(stateFile, state);
  current.statusLine = { type: 'command', command, enabled: true, padding: 0, stack_with_default: true };
  atomic(file, current);
  if (language) configure({ language });
  return file;
}
export function configure(update) {
  const file = join(dataDir(), 'config.json');
  atomic(file, { ...readJSON(file, {}), ...update });
}
export function uninstall() {
  const state = readJSON(join(dataDir(), 'installation.json'), null);
  if (!state || state.settingsFile !== settingsFile()) throw new Error('No installation record for these settings');
  const current = settings();
  if (current.statusLine?.command !== state.command) throw new Error('Status line was changed by another tool; left untouched');
  if (state.hadPrevious) current.statusLine = state.previous; else delete current.statusLine;
  atomic(settingsFile(), current);
  unlinkSync(join(dataDir(), 'installation.json'));
}
export function doctor(entry) {
  const current = settings(), desired = commandFor(entry);
  const wired = current.statusLine?.command === desired && current.statusLine?.enabled !== false;
  return { node: process.version, installed: wired, entryExists: existsSync(entry), settings: settingsFile(),
    hint: wired ? 'Restart agy once. Quota is supplied by agy; use /usage if it is missing.' : 'Run: node scripts/agy-hud.mjs setup' };
}
