---
name: agy-hud
description: Set up, preview, diagnose, configure or remove the AGY HUD status line for Antigravity CLI. Use when the user explicitly asks for AGY HUD or invokes /agy-hud.
disable-model-invocation: true
---

Resolve the plugin root from this skill's location: two directories above this file.
Run Node.js 20 or newer with `<plugin-root>/scripts/agy-hud.mjs` and the requested command:

- `preview [--zh]`: show a clearly labeled demonstration with synthetic quotas.
- `setup [--zh]`: back up settings and wire the HUD into agy's native statusLine; use `--zh` for Chinese users.
- `doctor`: check paths and current wiring without printing credentials or the full settings file.
- `configure zh` or `configure en`: change the language.
- `uninstall`: restore the previous statusLine without reverting unrelated settings.

When the user requests installation or setup, run `setup` followed by `doctor`. Tell the user to restart agy once. Do not invoke a model to calculate quota; agy pipes the native quota object to the renderer. Missing fields mean unavailable, never zero. The standard footer remains stacked above the HUD, retaining native controls and credit indicators. Quota bars show REMAINING quota; the context bar shows USED context.

Installing the plugin does not wire statusLine automatically: `/agy-hud` setup performs that step. Disabling or removing the plugin alone does not remove statusLine. Run `uninstall` before `agy plugin uninstall arshen-agy-hud`. If another status line replaced this HUD, leave it untouched.

The HUD reads no credentials or conversations and makes no network requests. Never ask for tokens, dump raw stdin, upload real account data, or modify permission/billing settings. No tool history or todo completion data is exposed by the native status payload; do not invent those features. Use the official `/usage` command to compare visible quotas. An explicit unknown or disabled bucket is not a zero balance.
