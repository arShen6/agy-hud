# Architecture

Inspired by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud): a small launcher, isolated responsibilities for collection and rendering, an explicit installer, an on-demand setup skill, and repeatable input-based tests. This is an independent implementation for agy's native payload, not a Claude Code plugin or a fork of the existing franksde/agy-hud project.

```text
agy --stdin JSON--> scripts/agy-hud.mjs
                         |-- scripts/collector.mjs: bounded input, config, optional Git probe
                         |-- src/main.mjs
                              |-- normalize.mjs: defensive parsing, quota semantics
                              |-- render/: terminal width, colors, lines
                         '-- stdout --> agy footer

/agy-hud --> scripts/install.mjs --> backup + merge settings / restore previous statusLine
```

The `src/` tree is pure logic. It has no filesystem, process, shell, network or credential access. `scripts/check.mjs` checks this import boundary. This is a source-level separation, not the permission cage shipped by current claude-hud; we do not claim OS-enforced isolation. The launcher runs under the user's Node.js permissions.

Only the collector starts a program: a fixed, optional, 250 ms Git status probe with hooks and fsmonitor disabled, no shell, no untracked-file scan, no optional locks. Quotas come only from agy stdin. We do not call undocumented APIs, poll a billing endpoint, read authentication files, read transcripts, or cache account data. The Git probe may read repository metadata. The project name is derived from the cwd passed by agy.

The installer is the only path that writes configuration. `setup` backs up agy's settings, preserves all unrelated keys, remembers the original statusLine and uses atomic file replacement. `uninstall` restores only that key and refuses if a different command has since replaced it. Repeated setup preserves the original restoration target. Stop agy before changing settings to avoid concurrent application writes.

Rendering is stateless. Every refresh is a fresh native payload, capped at 1 MiB. Missing quota is unknown, disabled is disabled, zero is exhausted. Remaining fraction and absolute remaining amount are never interchangeable. Expired reset timestamps never imply a refreshed balance. Known buckets have friendly labels and future buckets remain visible under their IDs.

No transcript tools/todo parser is included: agy exposes agent state and subagents, but not the Claude-specific tool/todo event format. The built-in footer stays stacked above this HUD to preserve native credit and interaction indicators.

Tests cover quota semantics, partial/malformed input, terminal injection, privacy, Unicode width, installer round trips, and executing the generated shell command. CI runs Node 20/22/24 on macOS/Linux/Windows. Actual local CLI validation is separate from mocked render tests.
