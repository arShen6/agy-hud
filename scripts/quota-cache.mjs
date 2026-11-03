import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { quotaFields } from '../src/quota.mjs';
import { dataDir, readJSON } from './collector.mjs';
import { queryUsage } from './query-usage.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
function paths(dir, id) {
  if (typeof id !== 'string' || !id || id.length > 300) return null;
  const root = join(dir, 'quota'), key = digest(id);
  return { root, observation: join(root, `${key}.native.json`), snapshot: join(root, `${key}.query.json`), lock: join(root, `${key}.lock`) };
}
function read(path) { try { return readJSON(path, null); } catch { return null; } }
const revisions = observation => Object.fromEntries(Object.entries(observation.buckets || {}).map(([id, bucket]) => [id, bucket.revision]));
function atomic(path, value) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(tmp, JSON.stringify(value), { mode: 0o600, flag: 'wx' }); renameSync(tmp, path); }
  finally { try { unlinkSync(tmp); } catch {} }
}

// The observation is a fingerprint, not a log. Ignore relative countdown fields:
// those change on redraw without indicating a new balance from the host.
export function collectQuota(payload, config, { dir = dataDir() } = {}) {
  if (config?.quotaRefresh !== 'turn-end' || process.env.AGY_HUD_REFRESH_CHILD === '1') return null;
  const p = paths(dir, payload?.conversation_id || payload?.session_id);
  if (!p) return null;
  try {
    mkdirSync(p.root, { recursive: true, mode: 0o700 });
    const account = digest(typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '');
    const old = read(p.observation);
    const sameAccount = old?.account === account && typeof old?.revision === 'string';
    const observation = { account, revision: sameAccount ? old.revision : randomUUID(), buckets: {} };
    for (const [id, quota] of Object.entries(quotaFields(payload.quota))) {
      const fingerprint = digest(JSON.stringify(quota));
      const previous = sameAccount ? old.buckets?.[id] : null;
      observation.buckets[id] = { fingerprint, revision: previous?.fingerprint === fingerprint ? previous.revision : randomUUID() };
    }
    if (JSON.stringify(old) !== JSON.stringify(observation)) atomic(p.observation, observation);
    return { revision: observation.revision, nativeRevisions: revisions(observation), record: read(p.snapshot) };
  } catch { return null; }
}

export async function refreshQuota(input, { dir = dataDir(), query = queryUsage } = {}) {
  const p = paths(dir, input?.conversationId);
  if (!p) return 'skipped';
  const observation = read(p.observation);
  if (typeof observation?.revision !== 'string') return 'skipped';
  const token = randomUUID();
  try {
    // Recover after a killed hook. Normal queries end within 20 seconds.
    try { if (Date.now() - statSync(p.lock).mtimeMs > 60000) unlinkSync(p.lock); } catch {}
    writeFileSync(p.lock, token, { mode: 0o600, flag: 'wx' });
  } catch { return 'busy'; }
  try {
    const baseline = { schema: 1, revision: observation.revision, nativeRevisions: revisions(observation) };
    atomic(p.snapshot, { ...baseline, checkedAt: Date.now(), status: 'checking' });
    const queryDir = join(p.root, 'query');
    mkdirSync(queryDir, { recursive: true, mode: 0o700 });
    let result;
    try { result = await query({ cwd: queryDir }); } catch { result = { status: 'failed' }; }
    const status = ['ok', 'timeout'].includes(result?.status) ? result.status : 'failed';
    // A native update during the query wins; this snapshot cannot match its revision.
    atomic(p.snapshot, { ...baseline, checkedAt: Date.now(), status,
      ...(status === 'ok' ? { quota: quotaFields(result.quota) } : {}) });
    return status;
  } finally {
    try { if (readFileSync(p.lock, 'utf8') === token) unlinkSync(p.lock); } catch {}
  }
}
