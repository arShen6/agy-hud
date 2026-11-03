import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hud } from '../src/main.mjs';

const now = Date.parse('2026-11-03T10:00:00Z');
const payload = { conversation_id: 'test-conversation', email: 'private@example.test',
  quota: { 'gemini-5h': { remaining_fraction: .8, reset_time: '2026-11-03T12:00:00Z' } } };
const config = { color: false, quotaRefresh: 'turn-end' };
const facts = { quotaRefresh: { revision: 'r1', record: { schema: 1, revision: 'r1', status: 'ok', checkedAt: now,
  quota: { 'gemini-5h': { remaining_fraction: .7123, reset_time: '2026-11-03T12:00:00Z' } } } } };
const usage = { num_turns: 0, command: { name: 'usage', data: { groups: [
  { name: 'Gemini', buckets: [{ id: 'gemini-5h', remaining_fraction: .7123, reset_time: '2026-11-03T12:00:00Z', description: 'PRIVATE' }] },
] } } };

test('a completed turn-end query updates the displayed balance and identifies the query time', () => {
  const text = hud(payload, config, facts, now + 1000);
  assert.match(text, /Gemini 5h left .*71\.2%/);
  assert.match(text, /\/usage checked 1s ago/);
  assert.doesNotMatch(text, /private|conversation|r1/);
});

test('expired, future, superseded, failed and disabled refreshes fall back to native quota', () => {
  const cases = [
    { ...facts.quotaRefresh, revision: 'new-native-revision' },
    { ...facts.quotaRefresh, record: { ...facts.quotaRefresh.record, checkedAt: now - 300001 } },
    { ...facts.quotaRefresh, record: { ...facts.quotaRefresh.record, checkedAt: now + 1000 } },
    { ...facts.quotaRefresh, record: { ...facts.quotaRefresh.record, status: 'timeout' } },
  ];
  for (const quotaRefresh of cases) {
    const text = hud(payload, config, { quotaRefresh }, now);
    assert.match(text, /Gemini 5h left .*80%/);
    assert.doesNotMatch(text, /\/usage checked/);
  }
  assert.match(hud(payload, { ...config, quotaRefresh: 'native' }, facts, now), /Gemini 5h left .*80%/);
  assert.match(hud(payload, config, { quotaRefresh: cases[3] }, now), /refresh timed out.*native/);
});

test('snapshot parsing accepts only zero-turn usage responses and quota fields', async () => {
  const { parseUsage } = await import('../src/quota.mjs');
  assert.deepEqual(parseUsage(usage), { 'gemini-5h': { remaining_fraction: .7123, reset_time: '2026-11-03T12:00:00.000Z' } });
  for (const invalid of [null, {}, { ...usage, num_turns: 1 }, { ...usage, command: { name: 'other', data: usage.command.data } },
    { num_turns: 0, command: { name: 'usage', data: { groups: [{ buckets: [{ id: 'q', remaining_fraction: '0.5' }] }] } } }]) {
    assert.equal(parseUsage(invalid), null);
  }
});

test('newer native buckets and disabled buckets are never replaced with old snapshot values', () => {
  const changed = { ...payload, quota: { ...payload.quota, '3p-5h': { disabled: true, remaining_fraction: 0 } } };
  const updated = structuredClone(facts);
  updated.quotaRefresh.record.quota['3p-5h'] = { remaining_fraction: .9 };
  assert.match(hud(changed, config, updated, now), /Claude\/GPT 5h · disabled/);
});

test('a native update in one bucket keeps the queried balance for other unchanged buckets', () => {
  const input = { quota: { 'gemini-5h': { remaining_fraction: .8 }, '3p-5h': { remaining_fraction: .4 } } };
  const quotaRefresh = { revision: 'account-generation', nativeRevisions: { 'gemini-5h': 'g1', '3p-5h': 'c2' }, record: {
    schema: 1, revision: 'account-generation', status: 'ok', checkedAt: now,
    nativeRevisions: { 'gemini-5h': 'g1', '3p-5h': 'c1' },
    quota: { 'gemini-5h': { remaining_fraction: .7 }, '3p-5h': { remaining_fraction: .5 } },
  } };
  const text = hud(input, config, { quotaRefresh }, now);
  assert.match(text, /Gemini 5h left .*70%/);
  assert.match(text, /Claude\/GPT 5h left .*40%/);
  assert.match(text, /native updates kept/);
});

test('cache isolates conversations and invalidates snapshots when native quota or account changes', async () => {
  const { collectQuota, refreshQuota } = await import('../scripts/quota-cache.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'agy-quota-'));
  try {
    collectQuota(payload, config, { dir });
    const queried = await refreshQuota({ conversationId: payload.conversation_id }, { dir, query: async () => ({ status: 'ok', quota: { 'gemini-5h': { remaining_fraction: .7123 } } }) });
    assert.equal(queried, 'ok');
    assert.match(hud(payload, config, { quotaRefresh: collectQuota(payload, config, { dir }) }), /71\.2%/);
    const unrelated = { ...payload, quota: { ...payload.quota, '3p-5h': { remaining_fraction: .4 } } };
    assert.match(hud(unrelated, config, { quotaRefresh: collectQuota(unrelated, config, { dir }) }), /71\.2%/);
    assert.doesNotMatch(hud({ ...payload, conversation_id: 'another' }, config,
      { quotaRefresh: collectQuota({ ...payload, conversation_id: 'another' }, config, { dir }) }), /71\.2%/);
    const changed = { ...payload, quota: { 'gemini-5h': { remaining_fraction: .65 } } };
    assert.match(hud(changed, config, { quotaRefresh: collectQuota(changed, config, { dir }) }), /65%/);
    // Returning to an old native value must not resurrect an invalidated snapshot.
    assert.doesNotMatch(hud(payload, config, { quotaRefresh: collectQuota(payload, config, { dir }) }), /71\.2%/);
    await refreshQuota({ conversationId: payload.conversation_id }, { dir, query: async () => ({ status: 'ok', quota: { 'gemini-5h': { remaining_fraction: .7123 } } }) });
    const otherAccount = { ...payload, email: 'other@example.test' };
    assert.doesNotMatch(hud(otherAccount, config, { quotaRefresh: collectQuota(otherAccount, config, { dir }) }), /71\.2%/);
    const stored = readdirSync(join(dir, 'quota')).filter(n => n.endsWith('.json')).map(n => readFileSync(join(dir, 'quota', n), 'utf8')).join('');
    assert.doesNotMatch(stored, /private@example|other@example|test-conversation|PRIVATE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a wired Stop hook fails open when agy is missing and native mode skips the query', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-hook-'));
  const entry = resolve('scripts/agy-hud.mjs'), hookEntry = resolve('scripts/refresh-quota.mjs');
  const env = { ...process.env, AGY_HUD_HOME: join(dir, 'state'), AGY_HUD_SETTINGS: join(dir, 'settings.json'),
    AGY_HUD_AGY: join(dir, 'missing-agy-executable'), NO_COLOR: '1' };
  const run = (file, args = [], input = '{}') => spawnSync(process.execPath, [file, ...args], { env, input, encoding: 'utf8', timeout: 4000 });
  try {
    assert.equal(run(entry, ['setup']).status, 0);
    assert.equal(run(entry, ['render'], JSON.stringify(payload)).status, 0);
    const result = run(hookEntry, [], JSON.stringify({ conversationId: payload.conversation_id, terminationReason: 'NO_TOOL_CALL', lastUserInput: 'PRIVATE PROMPT' }));
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.match(run(entry, ['render'], JSON.stringify(payload)).stdout, /refresh failed.*native/);
    assert.equal(run(entry, ['configure', 'quota-refresh', 'native']).status, 0);
    const cache = join(dir, 'state', 'quota');
    const queryFile = join(cache, readdirSync(cache).find(n => n.endsWith('.query.json')));
    const before = readFileSync(queryFile, 'utf8');
    assert.equal(run(hookEntry, [], JSON.stringify({ conversationId: payload.conversation_id })).status, 0);
    assert.equal(readFileSync(queryFile, 'utf8'), before);
    assert.doesNotMatch(run(entry, ['render'], JSON.stringify(payload)).stdout, /refresh failed|\/usage checked/);
    assert.doesNotMatch(before, /PRIVATE PROMPT|private@example|test-conversation/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('concurrent Stop events query only once; failure releases the lock and permits the next turn', async () => {
  const { collectQuota, refreshQuota } = await import('../scripts/quota-cache.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'agy-quota-lock-'));
  try {
    collectQuota(payload, config, { dir });
    let release, calls = 0;
    const pending = refreshQuota({ conversationId: payload.conversation_id }, { dir, query: () => { calls++; return new Promise(r => { release = r; }); } });
    assert.equal(await refreshQuota({ conversationId: payload.conversation_id }, { dir, query: () => { calls++; } }), 'busy');
    release({ status: 'timeout' });
    assert.equal(await pending, 'timeout');
    assert.equal(calls, 1);
    assert.match(hud(payload, config, { quotaRefresh: collectQuota(payload, config, { dir }) }), /refresh timed out/);
    assert.equal(await refreshQuota({ conversationId: payload.conversation_id }, { dir, query: async () => ({ status: 'failed' }) }), 'failed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('official command invocation uses fixed slash-command arguments, bounds runtime, and blocks recursive refresh', async () => {
  const { queryUsage } = await import('../scripts/query-usage.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'agy-query-'));
  try {
    const fake = join(dir, 'fake-cli.mjs');
    writeFileSync(fake, `import assert from 'node:assert/strict';
assert.equal(process.env.AGY_HUD_REFRESH_CHILD, '1');
const args = process.argv.slice(2);
assert.equal(args.at(-1), '/usage');
assert.equal(args[args.indexOf('--output-format') + 1], 'json');
const settings = JSON.parse(args[args.indexOf('--settings') + 1]);
assert.equal(settings.disableSlashCommands, false);
assert.equal(settings.statusLine.enabled, false);
assert.equal(settings.useG1Credits, false);
console.log(${JSON.stringify(JSON.stringify(usage))});`);
    assert.equal((await queryUsage({ executable: process.execPath, prefix: [fake], cwd: dir })).status, 'ok');
    writeFileSync(fake, 'setInterval(() => {}, 1000);');
    const start = Date.now();
    assert.equal((await queryUsage({ executable: process.execPath, prefix: [fake], cwd: dir, timeout: 200 })).status, 'timeout');
    assert.ok(Date.now() - start < 4000);
    const hook = spawnSync(process.execPath, [resolve('scripts/refresh-quota.mjs')], {
      input: '{"conversationId":"test","lastUserInput":"PRIVATE PROMPT"}', encoding: 'utf8', timeout: 3000,
      env: { ...process.env, AGY_HUD_REFRESH_CHILD: '1', AGY_HUD_HOME: dir },
    });
    assert.equal(hook.status, 0, hook.stderr);
    assert.deepEqual(JSON.parse(hook.stdout), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
