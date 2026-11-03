# Quota refresh: redraws and data freshness

The HUD renders agy's native `quota` object plus a validated result from official `/usage` after each turn. A redraw alone can change the agent state or reset countdown while reusing the same quota balance. It is not evidence of a new server query.

## Current behavior

- agy owns status-line invocations. Its [status-line contract](https://antigravity.google/docs/cli/statusline/) describes state-change triggers, a 300 ms minimum interval between invocations, and a five-second command timeout. This is not a promise to fetch quota every 300 ms.
- The renderer exits after displaying data. The plugin's synchronous `Stop` hook runs the official headless `/usage` command with a 20-second limit. There is no background polling timer. Set `quotaRefresh` to `native` to disable the additional query.
- The query runs only when this HUD is installed, configured and enabled. Its child cannot recursively refresh. Errors and timeouts allow the turn to stop and show a native-data fallback; they never inject a new model prompt.
- A successful response is reduced to quota fields and written atomically to a private, conversation-scoped snapshot. Native changes invalidate the corresponding bucket, account changes invalidate all buckets, and snapshots expire after five minutes. Relative countdown changes alone do not invalidate a snapshot. A snapshot cannot return after a native value changes away and back.
- `Quota: /usage checked 0s ago` shows successful command-return time. `native updates kept` means changed native buckets take precedence while unchanged buckets still use the query. `refresh failed`, `refresh timed out` and `snapshot expired` identify fallback conditions. The clock updates only when agy redraws.
- Quota percentages retain one decimal place, omitting a trailing `.0`. A positive value below the rounding threshold displays `<0.1%`; a partly used bucket above the upper threshold displays `>99.9%`. The ten-cell bar remains coarse, and context percentages remain whole numbers.
- Use agy's official [`/usage`](https://antigravity.google/docs/cli/commands/usage/) to request quota information. If `/usage` shows a different balance from the HUD, that distinguishes stale host input from a display rounding issue. Neither command can guarantee an immediately updated upstream balance.

## Evidence from agy 1.4.12, 2026-11-03

An isolated status-line probe recorded invocation time, agent state, execution duration and exit status, without saving prompts, credentials or raw quota payloads. It observed renders while working and after returning to idle, taking 53–94 ms with successful exits. That verified rendering only.

The same session's agy log recorded `doRefreshQuota: skipped (throttled)` at completion. This establishes that the host can skip a quota refresh even when it redraws the HUD. It does not establish the exact throttle interval or explain every instance of delayed quota reporting.

Separately, the previous renderer rounded quota to whole numbers: 82.49%, 82.01% and 81.51% all appeared as 82%. The decimal display fix makes those changes visible; it cannot make an old input value current. Regression tests exercise both narrow and wide terminals and the nearly empty/full boundaries.

## Comparison with Claude HUD

Checked against [v0.15.1, commit dd8c0be](https://github.com/jarrodwatts/claude-hud/tree/dd8c0bebeeef81f94a9361af317492f626d3890d). Its renderer primarily reads native `rate_limits`; optional external snapshots have freshness validation and fill missing native data. It does not independently poll the billing service in that path.

[Claude Code documents](https://code.claude.com/docs/en/statusline#when-the-status-line-updates) message and session events that trigger rendering, plus an optional idle refresh interval. agy's host contract differs. A matching module layout cannot reproduce missing host behavior. The remaining architecture differences are listed in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Live validation and limitations

A local, session-isolated prototype called official headless `agy -p /usage --output-format json` from a `Stop` hook. The command returned structured quota information with zero model turns and zero reported tokens. Standalone checks took 7.2 and 10.3 seconds; the prototype hook took 7.1 seconds.

The implementation was then exercised in an isolated signed-in agy 1.4.12 session with two consecutive real model replies. Both normal completions emitted `NO_TOOL_CALL` Stop events. Queries took 8.2 and 9.3 seconds, returned successfully, and the actual footer showed `/usage checked 0s ago` before returning to idle. The query itself makes no model turn; the two test prompts did invoke a model.

[agy hooks run synchronously](https://antigravity.google/docs/hooks/), so that query delays the end of the turn. It is never placed in the renderer, where it could exceed the five-second timeout. Force-quitting the CLI cannot guarantee a Stop event. Cancellation depends on the host emitting that event. Tests exercise the hook shell entry and query child behavior across the CI matrix; a signed-in Windows agy session has not been tested.

The network verification through Proxyman MCP encountered connection timeouts before obtaining a decrypted service response. CLI output verifies the command and event integration, not the backend's freshness guarantees. No account data or private diagnostic files are included in the repository.

The turn-end query supplies a separate command result when the host retains unchanged quota. It does not modify agy's internal throttle, promise immediate backend accounting, or refresh an idle terminal on a timer. Its latency is an explicit tradeoff; native-only mode remains available.
