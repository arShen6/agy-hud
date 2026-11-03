# AGY HUD

[English](README.md) | 中文说明

为 **Google Antigravity CLI（`agy`）**提供的紧凑状态栏，参考 [claude-hud](https://github.com/jarrodwatts/claude-hud) 的显示方式与模块划分，独立实现。

**HUD 界面、安装提示和预览全部使用英文。** 本文提供中文使用说明。无需额外 API Key，无 npm 运行依赖，没有后台定时轮询。

**0.2 版默认每轮结束调用官方 `/usage` 查询额度。** 本机实测增加约 7–10 秒收尾等待，单次查询最多 20 秒；失败时显示提示并使用宿主数据。可以切换为原生模式，取消额外等待。

## 安装

需要 Node.js 20 或以上版本，以及支持原生状态栏数据的 agy。已在 agy 1.4.12 验证。

```sh
agy plugin install https://github.com/arShen6/agy-hud
```

随后启动 agy，输入 `/agy-hud`，要求安装状态栏。配置完成后重启一次 agy。

如果希望直接配置、不调用模型，使用安装命令输出的插件目录：

```sh
node /absolute/path/to/arshen-agy-hud/scripts/agy-hud.mjs setup
node /absolute/path/to/arshen-agy-hud/scripts/agy-hud.mjs doctor
```

将示例路径替换为实际安装路径。安装标识为 `arshen-agy-hud`，避免与其他作者的同名插件冲突。安装插件和配置状态栏是两个步骤。

## 显示内容

以下是演示数据，不代表你的实际额度：

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

- `Context used`：上下文已使用比例。
- `left`：对应额度的剩余比例；`5h` 是 5 小时窗口，`7d` 是每周窗口。
- `reset`：距离额度重置的时间；随 agy 刷新状态栏更新。
- `disabled`：当前未启用的额度桶；`--` 表示没有可用数值，不代表额度耗尽。
- `Agents` 和 `Tasks`：代理与后台任务状态。

额度过低或上下文接近用满时会使用警示颜色。窗口变窄时自动简化进度条、换行。原生状态栏保留在 HUD 上方，继续显示 agy 的积分和交互提示。

额度来自 agy 原生输入或官方 `/usage` 查询结果；可以手动输入 `/usage` 对照。积分余额仅在 agy 提供相关字段时显示，也可查看原生状态栏或 `/credits`。本插件没有移植 Claude 专用的工具历史和待办解析，不能显示宿主没有提供的数据。

Windows 用户从 0.1.0/0.1.1 升级后，请重新运行 setup 或 `/agy-hud` 配置，以替换旧版保存的启动命令。详见 [Windows 启动问题修复记录](docs/WINDOWS-LAUNCH.md)。

额度百分比保留一位小数，避免较小变化被整数取整掩盖。每轮结束的 `Stop` 事件会查询额度，接下来的状态栏重画读取结果。看到 `Quota: /usage checked 0s ago` 表示查询命令已成功返回，额度没有变化也会显示。失败、超时会明确提示并回退到原生数据。宿主额度或账号变化会使旧快照失效，快照有效期为 5 分钟。查询成功不保证上游计费数据已经结算，详见 [刷新调查与 claude-hud 对比](docs/QUOTA-REFRESH.md)。

## 配置、升级与卸载

配置文件：`~/.config/agy-hud/config.json`。

```json
{ "color": true, "showAgents": true, "showDisabled": true, "git": true, "quotaRefresh": "turn-end" }
```

界面固定使用英文，旧版 `language: "zh"` 不再生效。项目名、分支名等用户原始内容会保留，不会强行翻译。`NO_COLOR` 环境变量可关闭颜色。

升级时重新执行安装命令，再运行 `/agy-hud` 配置，并重启 agy 以加载新的结束事件。诊断、切换模式和卸载命令如下，请从实际安装目录运行：

```sh
node scripts/agy-hud.mjs doctor
node scripts/agy-hud.mjs configure quota-refresh native
node scripts/agy-hud.mjs configure quota-refresh turn-end
node scripts/agy-hud.mjs uninstall
agy plugin uninstall arshen-agy-hud
```

先恢复状态栏，再移除插件。单独禁用插件不会撤销 `statusLine` 配置。配置或卸载前应退出 agy，避免程序同时写设置。安装程序备份原设置，仅修改状态栏；卸载时恢复此前的状态栏并保留其他设置。

## 隐私与架构

HUD 不读取登录凭据或聊天记录，不记录提示词或完整输入，不直接调用服务接口。自动查询通过已登录的 agy 执行固定 `/usage` 命令，由 agy 处理认证和网络。经过校验的额度、查询时间和原生数据指纹保存在 `~/.config/agy-hud/quota/`，会话 ID 仅用哈希文件名，账号只参与指纹计算以识别切换。快照按会话隔离，过期后不再使用；文件可在本地删除。切换 agy 登录账号后，应重启已有会话。

结束事件需要 `node` 和 `agy` 在命令搜索路径中。也可以用 `AGY_HUD_AGY` 指定 agy 可执行文件的绝对路径。数据采集、额度解析、渲染、安装分别放在独立模块中，详见 [架构说明](ARCHITECTURE.md)。

GitHub 版本可以直接安装。官方市场需要另外提交审核，公开仓库不代表已经在市场上架。

MIT © 2026 arShen6。社区独立项目，与 Google、Anthropic 或 claude-hud 作者无隶属关系。
