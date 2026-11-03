# Publishing

Status (2026-11-02): version 0.1.1 submitted through the official Marketplace interest form. The form confirmed the response was recorded. Review is pending; this is not an approval or a live listing.

Repository: https://github.com/arShen6/agy-hud

Plugin identifier: `arshen-agy-hud`. Display name: `AGY HUD by arShen6`.

1. Run `npm test`, `npm run check`, `agy plugin validate --strict .`.
2. Install with `agy plugin install .`, run the installed `scripts/agy-hud.mjs setup`, and verify a real interactive agy footer.
3. Publish the complete repository, including `hooks.json`, `src/`, `scripts/`, `skills/`, and `assets/`. No build step or npm installation is required.
4. Test `agy plugin install https://github.com/arShen6/agy-hud`.
5. Submit the repository through the [official Marketplace intake form](https://forms.gle/2EX5RFYPoJe1UgxR9). Review/acceptance is controlled by Google. Do not claim listing before confirmation.

Suggested submission description:

AGY HUD is a native, zero-dependency Antigravity CLI status-line plugin inspired by Claude HUD. It displays per-model remaining quota, reset countdowns, context usage, current model, Git branch and subagent activity. It has an English UI, Chinese documentation and support for narrow terminals. Version 0.2 adds a Stop hook that queries official /usage at turn end with a 20-second limit, then stores a private quota snapshot for the renderer. This may add 7–10 seconds of waiting; native-only mode is available. The HUD never reads credentials or calls service APIs directly; agy handles authentication and networking. Setup backs up settings; uninstall restores the previous status line.

Capabilities: one explicitly invoked `agy-hud` skill, one Stop hook and local Node.js scripts/cache. No MCP servers, custom authentication, always-on rules or extra paid service. Local Node.js 20+ and agy on PATH required. The earlier Marketplace intake has not been resubmitted or approved; this description documents the current repository capabilities.
