import { bar, color, duration, pack, fit, quotaPercent } from './terminal.mjs';
export function render(s, config = {}) {
  const enabled = config.color !== false;
  const width = s.width, lines = [];
  lines.push(...pack([
    color(`[${s.model}]`, 36, enabled), s.effort,
    s.project, s.branch ? `git:(${s.branch}${s.dirty ? '*' : ''})` : '', s.plan,
  ], width));
  const context = `Context used ${width >= 55 ? bar(s.context, false, enabled) : s.context === null ? '--' : Math.round(s.context) + '%'}`;
  lines.push(...pack([context, s.state, s.mode, s.confirmation ? 'approval pending' : ''], width));
  if (!s.quota.length) lines.push('Quota: waiting for agy data (/usage)');
  for (const q of s.quota) {
    const label = q.label;
    if (q.disabled) {
      if (config.showDisabled !== false) lines.push(color(`${label} · disabled`, 90, enabled));
      continue;
    }
    const value = q.remaining !== null ? (width >= 65 ? bar(q.remaining, true, enabled) : quotaPercent(q.remaining))
      : q.amount !== null ? String(q.amount) : '--';
    const segments = [`${label} left ${value}`, duration(q.seconds)];
    lines.push(...pack(segments, width));
  }
  if (config.showAgents !== false) {
    const running = s.agents.filter(a => a.status === 'running');
    const done = s.agents.filter(a => a.status === 'completed').length;
    if (running.length || done || s.tasks) lines.push(...pack([
      `Agents ${running.length} active / ${done} done`,
      running.map(a => a.name).filter(Boolean).join(', '),
      s.tasks ? `Tasks ${s.tasks}` : '',
    ], width));
  }
  return lines.map(line => fit(line, width)).join('\n');
}
