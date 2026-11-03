# Quota refresh: redraws and data freshness

The HUD renders the `quota` object supplied by agy. A redraw can change the agent state or reset countdown while reusing the same quota balance. It is not evidence of a new server query.

## Current behavior

- agy owns status-line invocations. Its [status-line contract](https://antigravity.google/docs/cli/statusline/) describes state-change triggers, a 300 ms minimum interval between invocations, and a five-second command timeout. This is not a promise to fetch quota every 300 ms.
- The HUD exits after rendering. It has no quota query, timer, hook, or account cache.
- Quota percentages retain one decimal place, omitting a trailing `.0`. A positive value below the rounding threshold displays `<0.1%`; a partly used bucket above the upper threshold displays `>99.9%`. The ten-cell bar remains coarse, and context percentages remain whole numbers.
- Use agy's official [`/usage`](https://antigravity.google/docs/cli/commands/usage/) to request quota information. If `/usage` shows a different balance from the HUD, that distinguishes stale host input from a display rounding issue. Neither command can guarantee an immediately updated upstream balance.

## Evidence from agy 1.4.12, 2026-11-03

An isolated status-line probe recorded invocation time, agent state, execution duration and exit status, without saving prompts, credentials or raw quota payloads. It observed renders while working and after returning to idle, taking 53–94 ms with successful exits. That verified rendering only.

The same session's agy log recorded `doRefreshQuota: skipped (throttled)` at completion. This establishes that the host can skip a quota refresh even when it redraws the HUD. It does not establish the exact throttle interval or explain every instance of delayed quota reporting.

Separately, the previous renderer rounded quota to whole numbers: 82.49%, 82.01% and 81.51% all appeared as 82%. The decimal display fix makes those changes visible; it cannot make an old input value current. Regression tests exercise both narrow and wide terminals and the nearly empty/full boundaries.

## Comparison with Claude HUD

Checked against [v0.15.1, commit dd8c0be](https://github.com/jarrodwatts/claude-hud/tree/dd8c0bebeeef81f94a9361af317492f626d3890d). Its renderer primarily reads native `rate_limits`; optional external snapshots have freshness validation and fill missing native data. It does not independently poll the billing service in that path.

[Claude Code documents](https://code.claude.com/docs/en/statusline#when-the-status-line-updates) message and session events that trigger rendering, plus an optional idle refresh interval. agy's host contract differs. A matching module layout cannot reproduce missing host behavior. The remaining architecture differences are listed in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Prototype and limitations

A local, session-isolated prototype called official headless `agy -p /usage --output-format json` from a `Stop` hook. The command returned structured quota information with zero model turns and zero reported tokens. Standalone checks took 7.2 and 10.3 seconds; the hook check took 7.1 seconds. The subsequent status-line invocation saw the resulting local snapshot.

[agy hooks run synchronously](https://antigravity.google/docs/hooks/), so that query delayed the end of the turn. It must not be placed in the renderer, where it could exceed the five-second timeout. The hook test used a custom termination before a model request; normal completion, cancellation and Windows behavior have not been validated for this prototype. It is **not installed or shipped**.

The network verification through Proxyman MCP encountered connection timeouts before obtaining a decrypted service response. CLI output verifies the command and event integration, not the backend's freshness guarantees. No account data or private diagnostic files are included in the repository.

Any future automatic refresh adapter needs an explicit latency policy, bounded execution, failure fallback, per-session/account isolation, snapshot expiration and precedence rules that cannot overwrite newer native data with an older snapshot. Its source and verification time must be distinguishable from the render time. The current release does not claim to solve host quota throttling.
