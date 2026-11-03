---
name: agy-hud
description: Set up, preview, diagnose, configure or remove the AGY HUD status line for Antigravity CLI. Use when the user explicitly asks for AGY HUD or invokes /agy-hud.
disable-model-invocation: true
---

Resolve the plugin root from this skill's location: two directories above this file.
Run Node.js 20 or newer with `<plugin-root>/scripts/agy-hud.mjs` and the requested command:

- `preview`: show a clearly labeled demonstration with synthetic quotas.
- `setup`: back up settings and wire the HUD into agy's native statusLine.
- `doctor`: check paths and current wiring without printing credentials or the full settings file.
- `configure en`: reset legacy language settings to English. The HUD UI is English-only; Chinese documentation is available in `README.zh-CN.md`.
- `configure quota-refresh turn-end`: enable automatic official `/usage` queries at turn end (the default).
- `configure quota-refresh native`: use host quota only, with no additional end-of-turn wait.
- `uninstall`: restore the previous statusLine without reverting unrelated settings.

When the user requests installation or setup, run `setup` followed by `doctor`. Tell the user to restart agy once to load the Stop hook. Explain that default turn-end queries added 7–10 seconds in local checks and have a 20-second timeout. Do not invoke a model to calculate quota: the hook runs the fixed official headless `/usage` command and validates a zero-turn response. The renderer uses that snapshot or agy's native quota. Missing fields mean unavailable, never zero. The standard footer remains stacked above the HUD, retaining native controls and credit indicators. Quota bars show REMAINING quota; the context bar shows USED context.

Installing the plugin does not wire statusLine automatically: `/agy-hud` setup performs that step. Disabling or removing the plugin alone does not remove statusLine. Run `uninstall` before `agy plugin uninstall arshen-agy-hud`. If another status line replaced this HUD, leave it untouched.

The HUD reads no credentials or conversations and calls no service API directly. The agy child handles authentication and networking. Validated quota snapshots and query timestamps are stored locally under the HUD config directory; conversation IDs and account labels are fingerprinted, not logged in clear text. Never ask for tokens, dump raw stdin, upload real account data, or modify permission/billing settings. No tool history or todo completion data is exposed by the native status payload; do not invent those features. Use the official `/usage` command to compare visible quotas. A checked timestamp means the command returned successfully, not that upstream usage has settled. An explicit unknown or disabled bucket is not a zero balance.
