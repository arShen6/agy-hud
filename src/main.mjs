import { normalize } from './normalize.mjs';
import { render } from './render/index.mjs';
export function hud(payload, config, facts = {}, now = Date.now()) {
  const state = normalize(payload, now);
  if (!state.branch && facts.branch) {
    // Run probe labels through the same sanitizer as the input payload.
    const vcs = normalize({ vcs: facts }); state.branch = vcs.branch; state.dirty = vcs.dirty;
  }
  return render(state, config);
}
