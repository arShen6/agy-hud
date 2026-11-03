# Architecture

Inspired by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud): a small launcher, isolated responsibilities for collection and rendering, an explicit installer, an on-demand setup skill, and repeatable input-based tests. This is an independent implementation for agy's native payload, not a Claude Code plugin or a fork of the existing franksde/agy-hud project. The comparison below was checked against [Claude HUD v0.15.1, commit dd8c0be](https://github.com/jarrodwatts/claude-hud/tree/dd8c0bebeeef81f94a9361af317492f626d3890d) on 2026-11-03.

```text
agy --stdin JSON--> scripts/agy-hud.mjs
                         |-- scripts/collector.mjs: bounded input, config, optional Git probe
                         |-- src/main.mjs
                              |-- normalize.mjs: defensive parsing, quota semantics
                              |-- render/: terminal width, colors, lines
                         '-- stdout --> agy footer

/agy-hud --> scripts/install.mjs --> backup + merge settings / restore previous statusLine
```

The current `src/` modules perform no filesystem, process, shell, network or credential I/O. `scripts/check.mjs` is a lightweight source/import smoke check, not a security boundary or a complete dependency-graph validator. This is source-level separation, not the permission cage shipped by current claude-hud; we do not claim OS-enforced isolation. All modules run in the same Node.js process with the user's permissions.

## What is and is not adapted from Claude HUD

| Area | Claude HUD reference | This project |
| --- | --- | --- |
| Responsibility split | Launcher, capability collector, parsing/rendering, installer | Similar roles in `scripts/` and `src/`, independently implemented |
| Runtime isolation | Permission-constrained worker and import fence | Not implemented; a single Node.js process |
| Architecture enforcement | Import graph checks and owner-owned verification gates | Basic source smoke check and behavioral tests only |
| Host data | Claude status payload and transcript-derived information | agy's native status payload; no transcript parser |
| Quota source | Native `rate_limits`; optional timestamped external snapshot fills missing data | Native `quota` only; no external snapshot adapter |
| Refresh events | Claude Code owns redraw triggers; supports `statusLine.refreshInterval` for idle redraw | agy owns redraw triggers; no equivalent interval documented in the checked agy contract |
| Windows launch | Claude-specific Git Bash / PowerShell handling | agy's documented cmd shell; quote executable and script paths separately |
| Maintainer automation | Agent/owner capability boundary and release governance | Not implemented; ordinary GitHub Actions tests |

The accurate description is a **layered adaptation inspired by Claude HUD**, not a port or an equivalent implementation of its full architecture. In particular, passing the import smoke check does not establish runtime confinement.

Only the collector starts a program: a fixed, optional, 250 ms Git status probe with hooks and fsmonitor disabled, no shell, no untracked-file scan, no optional locks. Quotas come only from agy stdin. We do not call undocumented APIs, poll a billing endpoint, read authentication files, read transcripts, or cache account data. The Git probe may read repository metadata. The project name is derived from the cwd passed by agy.

The installer is the only path that writes configuration. `setup` backs up agy's settings, preserves all unrelated keys, remembers the original statusLine and uses atomic file replacement. `uninstall` restores only that key and refuses if a different command has since replaced it. Repeated setup preserves the original restoration target. Stop agy before changing settings to avoid concurrent application writes.

Rendering is stateless. Every invocation receives a native payload, capped at 1 MiB. A new invocation does **not** prove that agy fetched new quota data. Missing quota is unknown, disabled is disabled, zero is exhausted. Remaining fraction and absolute remaining amount are never interchangeable. Expired reset timestamps never imply a refreshed balance. Known buckets have friendly labels and future buckets remain visible under their IDs.

Claude HUD v0.15.1 also primarily reads host-supplied quota: [`main.ts`](https://github.com/jarrodwatts/claude-hud/blob/dd8c0bebeeef81f94a9361af317492f626d3890d/src/main.ts) calls `getUsageFromStdin` and `resolveUsage`. Its [`external-usage.ts`](https://github.com/jarrodwatts/claude-hud/blob/dd8c0bebeeef81f94a9361af317492f626d3890d/src/external-usage.ts) validates timestamped snapshots and gives native data precedence. Copying that renderer or adding a redraw timer cannot force agy's quota cache to refresh. See [quota refresh findings](docs/QUOTA-REFRESH.md) for the observed host throttling, the separate display precision defect, and the limits of the tested event-hook prototype.

No transcript tools/todo parser is included: agy exposes agent state and subagents, but not the Claude-specific tool/todo event format. The built-in footer stays stacked above this HUD to preserve native credit and interaction indicators.

Tests cover quota semantics, partial/malformed input, terminal injection, privacy, Unicode width, installer round trips, and executing the persisted command with real Node and plugin paths containing spaces and punctuation. Windows also executes that command as a native cmd batch statement. Failed launches include command, stdout, stderr, exit status and signal in assertions. CI runs Node 20/22/24 on macOS/Linux/Windows with fail-fast disabled. This matrix tests the HUD and shell integration; it does not start a signed-in Windows agy session. Actual CLI validation is a separate check.
