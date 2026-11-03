# Windows status-line launch regression

On 2026-11-03, the [diagnostic run](https://github.com/arShen6/agy-hud/actions/runs/41560881041) reproduced the original failure on Windows Node 20, 22 and 24. Linux and macOS passed. The diagnostic commit changed only test reporting and matrix fail-fast behavior, leaving the installer unchanged.

In all three Windows jobs, the persisted command had an unnecessary pair of quotes around the entire command, in addition to the executable and script path quotes. The exit status was 1 with empty stdout and stderr `The filename, directory name, or volume label syntax is incorrect.` Removing only the outer pair produced exit status 0, empty stderr and rendered HUD output on the same runners.

Node's [Windows shell launcher](https://github.com/nodejs/node/blob/v22.23.4/lib/child_process.js) already wraps the command for `cmd.exe /d /s /c`. The installer had mixed up a shell command with the enclosing command-line argument. Version 0.1.2 keeps the individual path quotes and removes the redundant whole-command quotes.

Regression coverage executes the installed command rather than comparing strings: real Node and plugin files under paths with spaces, an apostrophe, ampersand, parentheses and Unicode; JSON stdin; expected HUD output; settings preservation; uninstall restoration. Windows additionally runs the command as a native cmd batch statement. CI completes all nine OS/Node jobs even when one fails. Launch failures retain stdout/stderr in their assertion messages.

The new Unicode-path fixture exposed a separate Node 22.23.4 issue before HUD setup. [Directory diagnostics](https://github.com/arShen6/agy-hud/actions/runs/41561505716) showed `fs.cpSync` silently copying into a mojibake directory instead of the requested Unicode destination. This matches Node's [non-ASCII copy fix](https://github.com/nodejs/node/pull/61950). Test preparation now uses `mkdirSync` / `copyFileSync` to copy the fixture and checks that its entry exists. The Unicode launch case remains enabled on every platform and Node version; production HUD code does not use `cpSync`.

To repair an existing 0.1.0/0.1.1 installation, update the plugin and rerun setup from its installed directory (or invoke `/agy-hud` and request setup). Updating files alone does not replace the saved command in agy's settings. Setup preserves the original uninstall restoration target.

This validates the shell-launch regression. It is not evidence of a signed-in end-to-end agy session on Windows, nor of Claude HUD-equivalent process isolation. See [architecture scope](../ARCHITECTURE.md).
