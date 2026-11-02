export const object = v => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
export const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
export const percent = v => number(v) === null ? null : Math.max(0, Math.min(100, v));
// Drop terminal control sequences and bidi formatting from all untrusted labels.
export function clean(v, max = 160) {
  if (typeof v !== 'string') return '';
  return v.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, max);
}
const names = {
  'gemini-5h': 'Gemini 5h', 'gemini-weekly': 'Gemini 7d',
  '3p-5h': 'Claude/GPT 5h', '3p-weekly': 'Claude/GPT 7d',
  'gemini-argon-wtu-weekly': 'Argon 7d',
};
export function normalize(input, now = Date.now()) {
  const p = object(input), model = object(p.model), ctx = object(p.context_window);
  const quota = Object.entries(object(p.quota)).slice(0, 30).map(([key, raw]) => {
    const q = object(raw);
    const absolute = typeof q.reset_time === 'string' ? Date.parse(q.reset_time) : NaN;
    const seconds = Number.isFinite(absolute) ? Math.max(0, (absolute - now) / 1000) : number(q.reset_in_seconds);
    return { key: clean(key), label: names[key] || clean(key, 40), disabled: q.disabled === true,
      remaining: number(q.remaining_fraction) === null ? null : percent(q.remaining_fraction * 100),
      amount: number(q.remaining_amount), seconds: seconds === null ? null : Math.max(0, seconds) };
  });
  const cwd = clean(object(p.workspace).current_dir || p.cwd);
  return {
    model: clean(model.display_name || model.id) || 'AGY', effort: clean(model.effort),
    project: cwd.split(/[\\/]/).filter(Boolean).at(-1) || '',
    plan: clean(p.plan_tier), state: clean(p.agent_state) || 'idle', mode: clean(p.cycle_mode),
    context: percent(ctx.used_percentage), quota,
    width: number(p.terminal_width) === null ? 100 : Math.max(12, Math.min(500, Math.floor(p.terminal_width))),
    branch: clean(object(p.vcs).branch), dirty: object(p.vcs).dirty === true,
    agents: (Array.isArray(p.subagents) ? p.subagents : []).slice(0, 50).map(a => ({
      name: clean(object(a).name, 40), status: clean(object(a).status, 20) })),
    tasks: Math.max(0, number(p.task_count) || 0), confirmation: p.tool_confirmation_pending === true,
  };
}
