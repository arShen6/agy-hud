import { object, number } from './normalize.mjs';

export const FRESHNESS_MS = 5 * 60 * 1000;
// Store quota fields only; never retain CLI responses, account labels or prompts.
export function quotaFields(value) {
  const result = {};
  for (const [id, raw] of Object.entries(object(value)).slice(0, 30).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[a-zA-Z0-9_.:-]{1,80}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) continue;
    const q = object(raw), next = {};
    if (number(q.remaining_fraction) !== null && q.remaining_fraction >= 0 && q.remaining_fraction <= 1) next.remaining_fraction = q.remaining_fraction;
    if (number(q.remaining_amount) !== null && q.remaining_amount >= 0) next.remaining_amount = q.remaining_amount;
    if (typeof q.disabled === 'boolean') next.disabled = q.disabled;
    if (q.reset_time != null) {
      const reset = typeof q.reset_time === 'string' ? Date.parse(q.reset_time) : NaN;
      if (!Number.isFinite(reset)) continue;
      next.reset_time = new Date(reset).toISOString();
    }
    if (next.remaining_fraction !== undefined || next.remaining_amount !== undefined || next.disabled === true) result[id] = next;
  }
  return result;
}

export function parseUsage(value) {
  const p = object(value), cmd = object(p.command), groups = object(cmd.data).groups;
  if (p.num_turns !== 0 || cmd.name !== 'usage' || !Array.isArray(groups)) return null;
  const entries = [];
  for (const group of groups.slice(0, 30)) {
    const buckets = object(group).buckets;
    if (!Array.isArray(buckets)) continue;
    for (const bucket of buckets.slice(0, 30)) {
      const b = object(bucket);
      if (typeof b.id === 'string') entries.push([b.id, b]);
    }
  }
  if (new Set(entries.map(([id]) => id)).size !== entries.length) return null;
  const quota = quotaFields(Object.fromEntries(entries));
  return Object.keys(quota).length ? quota : null;
}

export function resolveQuota(native, facts, now = Date.now()) {
  const fallback = { quota: native, label: 'Quota: native · turn-end refresh on' };
  const f = object(facts), r = object(f.record);
  if (r.schema !== 1 || typeof f.revision !== 'string' || r.revision !== f.revision) return fallback;
  const age = number(r.checkedAt) === null ? Infinity : now - r.checkedAt;
  if (age < 0 || age > FRESHNESS_MS) return { quota: native, label: 'Quota: snapshot expired · native' };
  if (r.status === 'checking') return { quota: native, label: age < 25000 ? 'Quota: refreshing /usage' : 'Quota: refresh interrupted · native' };
  if (r.status !== 'ok') return { quota: native, label: r.status === 'timeout' ? 'Quota: refresh timed out · native' : 'Quota: refresh failed · native' };
  const snapshot = quotaFields(r.quota);
  if (!Object.keys(snapshot).length) return fallback;
  const quota = { ...object(native) };
  let applied = 0, updated = false;
  for (const [id, q] of Object.entries(snapshot)) {
    // A disabled host bucket is authoritative. Missing snapshot buckets stay native.
    if (object(r.nativeRevisions)[id] !== object(f.nativeRevisions)[id] || object(quota[id]).disabled === true) {
      updated = true;
      continue;
    }
    quota[id] = q;
    applied++;
  }
  if (!applied) return { quota: native, label: 'Quota: native updated after /usage' };
  const seconds = Math.floor(age / 1000);
  return { quota, label: `Quota: /usage checked ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago${updated ? ' · native updates kept' : ''}` };
}
