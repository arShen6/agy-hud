import { bar, color, duration, pack, fit } from './terminal.mjs';
export function render(s, config = {}) {
  const zh = config.language === 'zh', enabled = config.color !== false;
  const width = s.width, lines = [];
  lines.push(...pack([
    color(`[${s.model}]`, 36, enabled), s.effort,
    s.project, s.branch ? `git:(${s.branch}${s.dirty ? '*' : ''})` : '', s.plan,
  ], width));
  const context = `${zh ? '上下文已用' : 'Context used'} ${width >= 55 ? bar(s.context, false, enabled) : s.context === null ? '--' : Math.round(s.context) + '%'}`;
  const states = { idle: '就绪', working: '工作中', tool_use: '工具执行中', reviewing: '待审核', authenticating: '认证中', initializing: '初始化', error: '错误' };
  lines.push(...pack([context, zh ? states[s.state] || s.state : s.state, s.mode, s.confirmation ? (zh ? '等待确认' : 'approval pending') : ''], width));
  if (!s.quota.length) lines.push(zh ? '额度：等待 agy 提供数据（/usage）' : 'Quota: waiting for agy data (/usage)');
  for (const q of s.quota) {
    const label = q.label;
    if (q.disabled) {
      if (config.showDisabled !== false) lines.push(color(`${label} · ${zh ? '未启用' : 'disabled'}`, 90, enabled));
      continue;
    }
    const value = q.remaining !== null ? (width >= 65 ? bar(q.remaining, true, enabled) : Math.round(q.remaining) + '%')
      : q.amount !== null ? String(q.amount) : '--';
    const segments = [`${label} ${zh ? '剩余' : 'left'} ${value}`, duration(q.seconds, zh)];
    lines.push(...pack(segments, width));
  }
  if (config.showAgents !== false) {
    const running = s.agents.filter(a => a.status === 'running');
    const done = s.agents.filter(a => a.status === 'completed').length;
    if (running.length || done || s.tasks) lines.push(...pack([
      `${zh ? '代理' : 'Agents'} ${running.length} ${zh ? '运行' : 'active'} / ${done} ${zh ? '完成' : 'done'}`,
      running.map(a => a.name).filter(Boolean).join(', '),
      s.tasks ? `${zh ? '后台任务' : 'Tasks'} ${s.tasks}` : '',
    ], width));
  }
  return lines.map(line => fit(line, width)).join('\n');
}
