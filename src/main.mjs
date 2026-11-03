import { normalize } from './normalize.mjs';
import { render } from './render/index.mjs';
import { resolveQuota } from './quota.mjs';
export function hud(payload, config, facts = {}, now = Date.now()) {
  const resolved = config?.quotaRefresh === 'turn-end' ? resolveQuota(payload?.quota, facts.quotaRefresh, now) : null;
  const state = normalize(resolved ? { ...payload, quota: resolved.quota } : payload, now);
  if (resolved) state.quotaStatus = resolved.label;
  if (!state.branch && facts.branch) {
    // Run probe labels through the same sanitizer as the input payload.
    const vcs = normalize({ vcs: facts }); state.branch = vcs.branch; state.dirty = vcs.dirty;
  }
  return render(state, config);
}
