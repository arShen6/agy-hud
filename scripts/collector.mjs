import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
export const dataDir = () => process.env.AGY_HUD_HOME || join(homedir(), '.config', 'agy-hud');
export const settingsFile = () => process.env.AGY_HUD_SETTINGS || join(homedir(), '.gemini', 'antigravity-cli', 'settings.json');
export function readJSON(path, fallback) {
  try { if (statSync(path).size > 1024 * 1024) throw new Error('file too large'); return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; }
}
export function readConfig() {
  const c = readJSON(join(dataDir(), 'config.json'), {});
  return { language: c.language === 'zh' ? 'zh' : 'en', color: c.color !== false && !('NO_COLOR' in process.env),
    showAgents: c.showAgents !== false, showDisabled: c.showDisabled !== false, git: c.git !== false };
}
export function collectGit(payload, config) {
  if (!config.git || payload?.vcs?.branch || payload?.vcs?.type !== 'git') return {};
  const cwd = payload?.workspace?.current_dir || payload?.cwd;
  if (typeof cwd !== 'string' || !cwd) return {};
  try {
    const result = execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'status', '--porcelain=v1', '--branch', '--untracked-files=no'], {
      cwd, timeout: 250, maxBuffer: 65536, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }, windowsHide: true,
    });
    const [head, ...changes] = result.trimEnd().split('\n');
    return { branch: head.replace(/^## (?:No commits yet on |Initial commit on )?/, '').split('...')[0], dirty: changes.length > 0 };
  } catch { return {}; }
}
export async function readInput(stream = process.stdin) {
  let length = 0, chunks = [];
  for await (const chunk of stream) {
    length += Buffer.byteLength(chunk);
    if (length > 1024 * 1024) throw new Error('status input exceeds 1 MiB');
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}
