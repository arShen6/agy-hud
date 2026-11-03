import { execFile } from 'node:child_process';
import { parseUsage } from '../src/quota.mjs';

export function queryUsage({ executable = process.env.AGY_HUD_AGY || 'agy', prefix = [], cwd, timeout = 20000 } = {}) {
  const settings = JSON.stringify({ disableSlashCommands: false, statusLine: { enabled: false }, useG1Credits: false });
  return new Promise(resolve => {
    execFile(executable, [...prefix, '--settings', settings, '--output-format', 'json', '-p', '/usage'], {
      cwd, encoding: 'utf8', timeout: Math.min(20000, Math.max(200, timeout)), killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024, windowsHide: true,
      env: { ...process.env, AGY_HUD_REFRESH_CHILD: '1' },
    }, (error, stdout) => {
      if (error) return resolve({ status: error.killed && error.code !== 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'timeout' : 'failed' });
      try {
        const quota = parseUsage(JSON.parse(stdout));
        resolve(quota ? { status: 'ok', quota } : { status: 'failed' });
      } catch { resolve({ status: 'failed' }); }
    });
  });
}
