# Publishing

Repository: https://github.com/arShen6/agy-hud

Plugin identifier: `arshen-agy-hud`. Display name: `AGY HUD by arShen6`.

1. Run `npm test`, `npm run check`, `agy plugin validate --strict .`.
2. Install with `agy plugin install .`, run the installed `scripts/agy-hud.mjs setup`, and verify a real interactive agy footer.
3. Publish the complete repository, including `src/`, `scripts/`, `skills/`, and `assets/`. No build step or npm installation is required.
4. Test `agy plugin install https://github.com/arShen6/agy-hud`.
5. Submit the repository through the [official Marketplace intake form](https://forms.gle/2EX5RFYPoJe1UgxR9). Review/acceptance is controlled by Google. Do not claim listing before confirmation.

Suggested submission description:

AGY HUD is a native, zero-dependency Antigravity CLI status-line plugin inspired by Claude HUD. It displays per-model remaining quota, reset countdowns, context usage, current model, Git branch and subagent activity. It supports English/Chinese and narrow terminals, uses only the status payload supplied by agy, and never reads credentials or calls quota endpoints. Setup backs up settings; uninstall restores the previous status line.

Capabilities: one explicitly invoked `agy-hud` skill plus local Node.js scripts. No MCP servers, auth, hooks, always-on rules or paid service. Local Node.js 20+ required.
