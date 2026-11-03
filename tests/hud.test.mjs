import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { hud } from '../src/main.mjs';
import { normalize } from '../src/normalize.mjs';
import { cellWidth, strip } from '../src/render/terminal.mjs';
import { readInput } from '../scripts/collector.mjs';
const plain = { color: false };
test('quota shows remaining while context shows used', () => {
  const text = hud({ context_window: { used_percentage: 30 }, quota: { 'gemini-5h': { remaining_fraction: .7, reset_in_seconds: 3600 } } }, plain);
  assert.match(text, /Context used ███░░░░░░░ 30%/);
  assert.match(text, /Gemini 5h left ███████░░░ 70%/);
  assert.match(text, /reset 1h 0m/);
});
test('small quota changes remain visible in wide and narrow terminals', () => {
  for (const terminal_width of [40, 100]) {
    const before = hud({ terminal_width, quota: { 'gemini-5h': { remaining_fraction: .8249 } } }, plain);
    const after = hud({ terminal_width, quota: { 'gemini-5h': { remaining_fraction: .8151 } } }, plain);
    assert.match(before, /82\.5%/);
    assert.match(after, /81\.5%/);
    assert.notEqual(before, after);
  }
});
test('quota rounding never labels a nonempty bucket empty or a partly used bucket full', () => {
  for (const terminal_width of [40, 100]) {
    for (const [remaining_fraction, expected] of [[0, '0%'], [.0001, '<0.1%'], [.9999, '>99.9%'], [1, '100%']]) {
      const text = hud({ terminal_width, quota: { 'gemini-5h': { remaining_fraction } } }, plain);
      assert.ok(text.includes(` ${expected}`), text);
    }
  }
});
test('unknown and zero are distinct; amount is not a percentage', () => {
  const s = normalize({ quota: { unknown: {}, empty: { remaining_fraction: 0 }, credits: { remaining_amount: 120 } } });
  assert.equal(s.quota[0].remaining, null); assert.equal(s.quota[1].remaining, 0);
  assert.equal(s.quota[2].remaining, null); assert.equal(s.quota[2].amount, 120);
  assert.match(hud({}, plain), /waiting for agy/);
  assert.match(hud({ quota: { credits: { remaining_amount: 120 } } }, plain), /credits left 120 │/);
});
test('disabled quota has no percentage; forward-compatible unknown buckets', () => {
  const text = hud({ quota: { '3p-5h': { disabled: true, remaining_fraction: 0 }, 'new-model-weekly': { remaining_fraction: .4 } } }, plain);
  assert.match(text, /Claude\/GPT 5h · disabled/); assert.doesNotMatch(text, /Claude\/GPT 5h.*0%/);
  assert.match(text, /new-model-weekly left .*40%/);
});
test('absolute reset time wins; expired data never pretends quota refreshed', () => {
  const s = normalize({ quota: { q: { reset_time: '2026-11-02T10:00:00Z', reset_in_seconds: 999 } } }, Date.parse('2026-11-02T10:01:00Z'));
  assert.equal(s.quota[0].seconds, 0);
  assert.match(hud({ quota: { q: { reset_in_seconds: 0 } } }, plain), /await refresh/);
});
test('terminal injection and private account fields never appear', () => {
  const text = hud({ email: 'secret@example.com', transcript_path: '/secret/chat', conversation_id: 'PRIVATE-ID',
    model: { display_name: '\x1b]52;c;evil\x07Model\x1b[2J\r\nOK' }, vcs: { branch: 'main\u202evil' } }, plain);
  assert.doesNotMatch(text, /secret|PRIVATE|\x1b|\r|\u202e|evil/);
  assert.match(text, /ModelOK/);
});
test('narrow terminals, Chinese and emoji stay within reported width', () => {
  for (const width of [12, 20, 40, 64, 80, 120]) {
    const text = hud({ terminal_width: width, model: { display_name: '模型测试 👨‍👩‍👧‍👦 很长的名字' },
      cwd: '/项目/中文文件夹', quota: { 'gemini-weekly': { remaining_fraction: .54, reset_in_seconds: 90000 } } }, { language: 'zh', color: true });
    for (const line of text.split('\n')) assert.ok(cellWidth(line) <= width, `${width}: ${strip(line)}`);
  }
});
test('null, arrays and malformed optional fields remain renderable', () => {
  for (const p of [null, [], {}, { model: null, quota: { q: null }, subagents: [null, 9], terminal_width: 0 },
    { context_window: { used_percentage: '4' }, quota: { q: { remaining_fraction: '0' } } }]) assert.equal(typeof hud(p, plain), 'string');
});
test('subagent counters distinguish active from completed', () => {
  assert.match(hud({ subagents: [{ name: 'review', status: 'running' }, { name: 'test', status: 'completed' }], task_count: 2 }, plain), /Agents 1 active \/ 1 done │ review │ Tasks 2/);
});
test('bounded stdin handles split UTF-8 and rejects malformed / oversized input', async () => {
  const b = Buffer.from('{"model":{"display_name":"模型"}}');
  const p = await readInput(Readable.from([b.subarray(0, 27), b.subarray(27)]));
  assert.equal(p.model.display_name, '模型');
  await assert.rejects(readInput(Readable.from(['{'])));
  await assert.rejects(readInput(Readable.from(['x'.repeat(1024 * 1024 + 1)])), /1 MiB/);
});
