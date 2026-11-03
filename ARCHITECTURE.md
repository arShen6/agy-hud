# Architecture

Inspired by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud): a small launcher, isolated responsibilities for collection and rendering, an explicit installer, an on-demand setup skill, and repeatable input-based tests. This is an independent implementation for agy's native payload, not a Claude Code plugin or a fork of the existing franksde/agy-hud project. The comparison below was checked against [Claude HUD v0.15.1, commit dd8c0be](https://github.com/jarrodwatts/claude-hud/tree/dd8c0bebeeef81f94a9361af317492f626d3890d) on 2026-11-03.

```text
agy --stdin JSON--> scripts/agy-hud.mjs
                         |-- scripts/collector.mjs: bounded input, config, optional Git probe
                         |-- scripts/quota-cache.mjs: native fingerprints + query snapshot
                         |-- src/main.mjs
                              |-- quota.mjs: validation, freshness, source precedence
                              |-- normalize.mjs: defensive parsing, quota semantics
                              |-- render/: terminal width, colors, lines
                         '-- stdout --> agy footer

/agy-hud --> scripts/install.mjs --> backup + merge settings / restore previous statusLine

agy Stop --> scripts/refresh-quota.mjs --> scripts/query-usage.mjs
                                           '-- agy /usage (20-second limit, no model turn)
                         '-- private quota snapshot --> next status-line invocation
```

The current `src/` modules perform no filesystem, process, shell, network or credential I/O. `scripts/check.mjs` is a lightweight source/import smoke check, not a security boundary or a complete dependency-graph validator. This is source-level separation, not the permission cage shipped by current claude-hud; we do not claim OS-enforced isolation. Each renderer or hook invocation runs its modules in one Node.js process with the user's permissions. The slow quota query runs in the separate hook path, never inside the renderer.

## What is and is not adapted from Claude HUD

| Area | Claude HUD reference | This project |
| --- | --- | --- |
| Responsibility split | Launcher, capability collector, parsing/rendering, installer | Similar roles in `scripts/` and `src/`, independently implemented |
| Runtime isolation | Permission-constrained worker and import fence | No permission cage; hook and renderer are separate invocations |
| Architecture enforcement | Import graph checks and owner-owned verification gates | Basic source smoke check and behavioral tests only |
| Host data | Claude status payload and transcript-derived information | agy's native status payload; no transcript parser |
| Quota source | Native `rate_limits`; optional timestamped external snapshot fills missing data | Native `quota` plus a validated, five-minute `/usage` snapshot scoped to a conversation |
| Refresh events | Claude Code owns redraw triggers; supports `statusLine.refreshInterval` for idle redraw | agy owns redraw triggers; a synchronous Stop hook queries official `/usage` after a turn |
| Windows launch | Claude-specific Git Bash / PowerShell handling | agy's documented cmd shell; quote executable and script paths separately |
| Maintainer automation | Agent/owner capability boundary and release governance | Not implemented; ordinary GitHub Actions tests |

The accurate description is a **layered adaptation inspired by Claude HUD**, not a port or an equivalent implementation of its full architecture. In particular, passing the import smoke check does not establish runtime confinement.

The collector starts a fixed, optional, 250 ms Git status probe with hooks and fsmonitor disabled, no shell, no untracked-file scan, no optional locks. The Stop hook starts agy with a fixed `/usage` command, `disableSlashCommands: false`, a disabled child status line and no credits opt-in. It accepts only a structured zero-turn usage result. A child-process marker prevents recursion. We do not directly call undocumented APIs, poll a billing endpoint, read authentication files or read transcripts. agy handles its own authentication and networking. The Git probe may read repository metadata. The project name is derived from the cwd passed by agy.

`scripts/quota-cache.mjs` owns bounded local reads and private atomic writes. It stores only validated quota fields, query timestamps, per-bucket native fingerprints and generation IDs. Conversation IDs are hashed into filenames. The account label contributes only a hash to distinguish account changes. Native relative countdowns do not change the fingerprint. When a native bucket changes, that bucket's generation changes permanently; an older query cannot overwrite it, even if the native value later returns to its previous value. Changes in another bucket do not invalidate a still-useful query result. An observed account change invalidates the whole snapshot. Sessions should be restarted after switching agy's login because the child uses the CLI's current login.

Concurrent Stop events for the same conversation share an exclusive query lock. Queries time out after 20 seconds, failures are recorded without raw child output, and the hook always returns an empty JSON object to allow the turn to end. A stale lock can recover after 60 seconds if a hook was forcibly killed. Refresh is skipped when the HUD is uninstalled, disabled, replaced, or configured for `native` mode. Cache files are ignored after five minutes but remain on disk until removed locally.

The installer is the only path that writes configuration. `setup` backs up agy's settings, preserves all unrelated keys, remembers the original statusLine and uses atomic file replacement. `uninstall` restores only that key and refuses if a different command has since replaced it. Repeated setup preserves the original restoration target. Stop agy before changing settings to avoid concurrent application writes.

The pure renderer is stateless. Every invocation receives a native payload, capped at 1 MiB, plus collected snapshot facts. A new invocation does **not** prove that agy fetched new quota data. `src/quota.mjs` checks the snapshot's generation, age and fields before resolving each bucket. Failed, future-dated, expired or invalid snapshots fall back to native data. The displayed `/usage checked` age is the successful command-return time, not the render time or a promise of backend settlement. Missing quota is unknown, disabled is disabled, zero is exhausted. Remaining fraction and absolute remaining amount are never interchangeable. Expired reset timestamps never imply a refreshed balance. Known buckets have friendly labels and future buckets remain visible under their IDs.

Claude HUD v0.15.1 also primarily reads host-supplied quota: [`main.ts`](https://github.com/jarrodwatts/claude-hud/blob/dd8c0bebeeef81f94a9361af317492f626d3890d/src/main.ts) calls `getUsageFromStdin` and `resolveUsage`. Its [`external-usage.ts`](https://github.com/jarrodwatts/claude-hud/blob/dd8c0bebeeef81f94a9361af317492f626d3890d/src/external-usage.ts) validates timestamped snapshots and gives native data precedence. AGY HUD adapts this collection/resolution split but needs different precedence to replace agy's unchanged, throttled quota input. Native changes observed after query start take precedence. See [quota refresh findings](docs/QUOTA-REFRESH.md) for the host behavior and live checks.

No transcript tools/todo parser is included: agy exposes agent state and subagents, but not the Claude-specific tool/todo event format. The built-in footer stays stacked above this HUD to preserve native credit and interaction indicators.

Tests cover quota semantics, partial/malformed input, terminal injection, privacy, Unicode width, installer round trips, snapshot precedence/expiry/account isolation, duplicate-query locking, real child-process timeout and recursion protection. Persisted renderer and hook commands execute from paths containing spaces and punctuation. Windows also executes the renderer as a native cmd batch statement. Failed launches include command, stdout, stderr, exit status and signal in assertions. CI runs Node 20/22/24 on macOS/Linux/Windows with fail-fast disabled. This matrix tests the HUD and shell integration; it does not start a signed-in Windows agy session. Actual CLI validation is a separate check.
