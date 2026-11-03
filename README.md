# AGY HUD

A compact, Claude HUD-inspired status line for **Google Antigravity CLI (`agy`)**. Native quota bars, reset countdowns, context, model, Git branch and agent activity. English interface, with [中文文档](README.zh-CN.md). Zero npm dependencies, API keys, polling or telemetry.

This is `arShen6/agy-hud`, installed as **`arshen-agy-hud`** to avoid colliding with other plugins named agy-hud. Independent community project; not affiliated with Google, Anthropic or the Claude HUD maintainers.

## Install

Requires Node.js 20+ and a current Antigravity CLI (tested locally with 1.4.12).

```sh
agy plugin install https://github.com/arShen6/agy-hud
```

Then open agy and run:

```text
/agy-hud
```

Ask it to **set up the HUD**. Restart agy once after setup. Installing a plugin does not itself configure the CLI status line. Setup saves a backup and changes only `statusLine`; it keeps the built-in footer above the HUD.

For direct setup without an agent/model invocation, use the plugin directory printed by `agy plugin install`:

```sh
node /absolute/path/to/arshen-agy-hud/scripts/agy-hud.mjs setup
node /absolute/path/to/arshen-agy-hud/scripts/agy-hud.mjs doctor
```

Or install from a local checkout:

```sh
git clone https://github.com/arShen6/agy-hud.git
cd agy-hud
agy plugin validate --strict .
agy plugin install .
```

## Preview (synthetic example, not your account)

```text
[Gemini 4 Argon] │ high │ agy-hud │ git:(main) │ Google AI Pro
Context used ██░░░░░░░░ 24% │ working
Gemini 5h left ████████░░ 82% │ reset 1h 30m
Gemini 7d left ██████░░░░ 64% │ reset 2d 5h
Claude/GPT 5h left ██░░░░░░░░ 18% │ reset 40m
Claude/GPT 7d left ████░░░░░░ 43% │ reset 3d 6h
Argon 7d left ████████░░ 76% │ reset 2d 5h
Agents 1 active / 0 done │ review │ Tasks 1
```

`node scripts/agy-hud.mjs preview` prints this demo with colors. Narrow terminals use percentages and wrap lines. Quota bars mean **remaining**; context means **used**. Red means quota is low or context is nearly full. All numbers come from the CLI's native payload. Disabled and unavailable buckets are labeled explicitly. Reset countdowns refresh when agy invokes the script; the HUD does not run a background polling timer. Absolute credit balances appear if agy supplies a `remaining_amount` bucket; otherwise consult the stacked native footer or `/credits`.

Windows users upgrading from 0.1.0/0.1.1 must rerun setup after updating to replace the saved launch command. See the [Windows launch fix](docs/WINDOWS-LAUNCH.md).

## Configure / remove

```sh
node scripts/agy-hud.mjs configure en   # reset a legacy language setting
node scripts/agy-hud.mjs doctor
node scripts/agy-hud.mjs uninstall     # restore previous statusLine first
agy plugin uninstall arshen-agy-hud
```

Run these from the installed plugin directory, or use absolute paths. User configuration lives at `~/.config/agy-hud/config.json`:

```json
{ "color": true, "showAgents": true, "showDisabled": true, "git": true }
```

The HUD interface always uses English; legacy `language: "zh"` settings are ignored. User-provided project, branch and model names retain their original text. `NO_COLOR` disables ANSI colors. `AGY_HUD_HOME` changes the HUD configuration directory; `AGY_HUD_SETTINGS` changes the agy settings path (useful for tests). The installer records an absolute Node path: rerun setup if Node is removed or moved. Stop agy before setup or uninstall to avoid simultaneous settings writes. Disabling a plugin alone does not remove its configured statusLine.

To upgrade, repeat the install command, then `/agy-hud` setup. Doctor verifies the installed path. Missing quotas: first compare agy's `/usage`; this HUD cannot invent fields the host did not supply. No active-tool history or todo progress is claimed: those Claude-specific transcript features are not available in this native adapter.

## Privacy and development

No network calls, credential files, transcript reads, payload logging or account caches. Email and conversation IDs are discarded. Config backups remain local and are not part of the repository. Git metadata is queried with a short timeout; turn off `git` to disable the probe. Read [ARCHITECTURE.md](ARCHITECTURE.md) for responsibilities and limits.

```sh
npm test
npm run check
agy plugin validate --strict .
```

The Marketplace requires a separate submission and review; a GitHub release alone does not mean Marketplace approval. See [publishing notes](docs/PUBLISHING.md).

## Acknowledgments

Design and architectural inspiration: [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) (MIT). Original code here; no upstream code is copied. Host contract: [agy status line documentation](https://antigravity.google/docs/cli/statusline/). Quota bucket labels checked against [agy-powerline's payload reference](https://agy-powerline.com/docs/payload/).

MIT © 2026 arShen6.
