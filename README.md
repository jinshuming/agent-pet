# Agent Pet

一个真人感的 3D 桌面宠物，替你的 coding agent（**Claude Code** 或 **Codex**）演出它正在做的事：你发出指令它就托腮思考，agent 跑工具时它疯狂敲键盘，需要你授权时它挥手求批准，任务完成后先累瘫喘气、再得意比心。等待的时候，你可以摸头、戳它、拖着甩飞、转圈转晕；长时间不理它，它会自己走到屏幕边靠墙坐下，再过一会儿靠墙睡着。

> A 3D Gaussian-splat desktop pet that acts out what Claude Code or Codex is doing: thinking, typing while tools run, begging for permission, panting and then showing off when the turn is done. Install: `/plugin marketplace add jinshuming/agent-pet` then `/plugin install agent-pet@agent-pet` in Claude Code; for Codex see [安装到 Codex](#安装到-codex).

- [系统要求](#系统要求)
- [安装到 Claude Code](#安装到-claude-code)
- [安装到 Codex](#安装到-codex)
- [使用方法](#使用方法)
- [接入你自己的 agent](#接入你自己的-agent)
- [常见问题](#常见问题)
- [更新与卸载](#更新与卸载)
- [隐私](#隐私)
- [开发](#开发)

## 系统要求

| | |
|---|---|
| 系统 | macOS，或 Windows 10 / 11（在 macOS 上开发；Windows 已适配，但测试较少） |
| Node.js | 20 或更高版本，且在 `PATH` 里（终端里 `node -v` 能看到版本号）。Claude Code / Codex 用户一般已经有了 |
| 磁盘 | 约 350 MB，用于 Electron（唯一的运行时依赖），首次启动时自动下载 |
| 资源占用 | 待机时约占一个 CPU 核心的 8%，内存约 850 MB。它平时按 30 帧渲染，和它互动时 60 帧，睡着时 15 帧，可以放心开一整天 |

## 安装到 Claude Code

**1. 在 Claude Code 里运行这两条命令：**

```
/plugin marketplace add jinshuming/agent-pet
/plugin install agent-pet@agent-pet
```

也可以在终端里安装，效果一样：

```bash
claude plugin marketplace add jinshuming/agent-pet
```

```bash
claude plugin install agent-pet@agent-pet
```

**2. 开一个新的 Claude Code 会话。** 宠物会在会话开始时自动启动。

- **第一次启动要等一两分钟**：它会在后台下载 Electron（约 350 MB）。如果从 GitHub 下载失败，会自动改用国内镜像 npmmirror.com 重试。进度写在日志里，见[常见问题](#常见问题)。
- 之后每次开会话，宠物在 1–2 秒内出现；已经在运行时不会重复启动。
- 同时开多个 Claude Code 会话也没问题，所有会话共用一只宠物。

## 安装到 Codex

Codex 和 Claude Code 的 hook 格式相同，宠物复用同一套脚本。

**1. 克隆仓库并安装 hook：**

```bash
git clone https://github.com/jinshuming/agent-pet.git
```

```bash
cd agent-pet && node scripts/install-codex.mjs
```

安装脚本会把本仓库的 hook 合并进 `~/.codex/hooks.json`，不会动你已有的 hook。

**2. 在 Codex 里信任这些 hook：** 启动 Codex，输入 `/hooks`，审阅并信任 Agent Pet 的 hook。Codex 不会运行没有被信任过的 hook，这一步只需要做一次。

**3. 开一个新的 Codex 会话**，宠物就会出现。第一次启动同样要等一两分钟下载 Electron。

注意：hook 指向你克隆下来的这个目录，**安装后不要移动或删除这个目录**。如果移动了，在新位置重新运行一次 `node scripts/install-codex.mjs` 即可。

Claude Code 和 Codex 可以同时用，它们驱动的是同一只宠物；几个会话状态不同时，显示最紧急的那个（等待授权 > 出错 > 工作中 > 思考中 > 完成 > 待机）。

## 使用方法

### 它会替 agent 演出什么

不用做任何操作，宠物会跟着 agent 的状态自动切换：

| agent 在做什么 | 宠物的表现 |
|---|---|
| 会话开始 | 挥手打招呼 |
| 你发出指令、agent 在思考 | 托腮思考 |
| agent 在跑工具 | 疯狂敲键盘，头顶气泡显示在做什么，比如「✏️ main.ts」「💻 npm test」 |
| 需要你授权、回答问题 | 挥手求批准，直到你处理完 |
| 任务完成 | 累瘫喘气，然后得意比心 |
| 出错 | 抱头懊恼，身上泛红 |
| 5 分钟没有任何 agent 活动 | 睡着 |

### 和它互动

| 操作 | 它的反应 |
|---|---|
| 点头 / 点身体 | 被摸头害羞 / 被戳怕痒。agent 忙的时候点它，它会不耐烦地说「等一下嘛」 |
| 双击 / 连点三下 | 比耶拍照 / 头顶比大心 |
| 拖动 | 被拎起来乱蹬。松手时带点速度就能把它甩出去：会飞、会撞到屏幕两侧反弹，重重落地会头晕 |
| 往屏幕顶上甩 | 抓住顶边挂着：先双手，15 秒后手酸剩一只手，再撑一会儿就掉下来。慢慢点它会挣扎（也会累得更快），1 秒多内连点 4 下直接把它戳下来 |
| 放在屏幕左右两侧 | 靠墙耍帅 |
| 在它**身边的空白处**横向拖动，或按住 ⌥（Windows 上是 Alt）拖动它，或在触控板上双指左右滑 | 原地转圈，划得越快转得越猛；转满 3 圈会头晕站不稳 |
| 在它身上双指捏合，或按住 ⌘（Windows 上是 Ctrl）滚动滚轮 | 调整大小 |
| 3 分钟不理它 / 8 分钟不理它 | 走到最近的屏幕边靠墙坐下 / 靠墙睡着；碰它一下就会站起来 |

### 右键菜单

在宠物身上点右键：

- **切换角色**：内置 8 个角色（Asian Actor、Man in Suit、Young Man、DJ Neko、Chibi Guitarist、Satoru Gojo、Creepy Log Man、Miles Morales）。
- **大小**：默认 75%。可以选 10%–250% 的预设，或者「自定义…」输入任意百分比（最大值取决于屏幕高度）。
- **模拟 Agent 状态 / 模拟互动 / 预览单个动作**：不用等 agent，直接看各种状态和动作，包括「休息：走到墙边坐下 / 靠墙睡着」。
- **退出**。

角色和大小会记住，下次启动沿用（保存在 `~/.agent-pet/settings.json`）。

### 托盘图标

菜单栏（macOS）或任务栏右下角（Windows）有一个爪印图标，可以**显示 / 隐藏**宠物、把它**找回屏幕上**（比如它被拖到屏幕外，或者拔掉了外接显示器），以及**退出**。

宠物退出后，下次开 Claude Code / Codex 会话时会自动重新启动。

## 接入你自己的 agent

宠物不绑定 Claude Code 或 Codex。它在本机开了一个 HTTP 服务，任何 agent 只要在工作时把生命周期事件发过来，宠物就会跟着演出。

### 第一步：启动宠物

在你的 agent 启动时运行一次下面的命令（宠物已经在运行时它什么也不做，会立即返回；第一次运行会先下载 Electron）：

```bash
node /path/to/agent-pet/plugin/scripts/launch.mjs
```

也可以在仓库的 `app` 目录下手动运行 `npm start`。宠物启动后，`GET http://127.0.0.1:23456/health` 返回 `{"ok":true}`。

### 第二步：发送事件

有两种接法，任选一种。

**方式一：你的 agent 已经能产出 Claude Code 格式的 hook JSON**（含 `hook_event_name`、`session_id`、`tool_name`、`tool_input` 等字段）：把这段 JSON 通过标准输入交给 `emit.mjs`。它会裁掉敏感内容、转成宠物的事件格式并发送，宠物没运行时也会安静退出。

```bash
echo '{"hook_event_name":"PreToolUse","session_id":"s1","cwd":"/my/project","tool_name":"Bash","tool_input":{"command":"npm test"}}' | node /path/to/agent-pet/plugin/scripts/emit.mjs
```

**方式二：直接 POST 事件**到 `http://127.0.0.1:23456/event`，请求体是 JSON：

```json
{
  "event": "PreToolUse",
  "session": "my-agent-run-42",
  "cwd": "/my/project",
  "tool": "Bash",
  "toolInput": { "command": "npm test", "description": "运行测试" }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `event` | 是 | 事件名，见下表 |
| `session` | 否 | 会话 id。同一次任务用同一个值；多个会话同时在跑时，宠物显示最紧急的那个。不填就当成同一个会话 `default` |
| `cwd` | 否 | 工作目录。几个会话在不同项目里时，气泡前面会加上项目名 |
| `tool` | 否 | 工具名，决定工作时气泡显示什么（见下文） |
| `toolInput` | 否 | `command`、`filePath`、`pattern`、`description`，都是字符串，用来生成气泡文字。**请只放简短的摘要，不要放文件内容或输出** |
| `notificationType` | 否 | 配合 `Notification` 事件，见下表 |
| `errorType` | 否 | 配合 `StopFailure` 事件，显示在气泡里的出错原因 |

### 事件与宠物状态

| `event` | 宠物的表现 |
|---|---|
| `SessionStart` | 挥手打招呼 |
| `UserPromptSubmit` | 开始思考 |
| `PreToolUse` | 开始工作（敲键盘），气泡显示当前工具 |
| `PostToolUse` | 工具结束。1.5 秒内没有下一个工具就回到思考状态，所以连续的工具调用不会闪烁 |
| `PostToolUseFailure` | 工具失败：短暂懊恼一下，然后继续思考 |
| `PermissionRequest` | 挥手求批准，直到下一个 `PostToolUse`、`Stop` 等事件 |
| `Notification` | `notificationType` 为 `permission_prompt` 或 `agent_needs_input` 时求批准，为 `idle_prompt` 时回到待机 |
| `SubagentStart` / `SubagentStop` | 派出 / 收回子 agent，子 agent 在跑时保持工作状态 |
| `PreCompact` | 思考中（气泡显示「整理上下文」） |
| `Stop` | 任务完成：累瘫喘气再比心，然后待机 |
| `StopFailure` | 任务出错：抱头懊恼，身上泛红，然后待机 |
| `Interrupt` | 被用户中断，直接回到待机 |
| `SessionEnd` | 会话结束，从宠物的会话列表里移除 |

最简单的一轮是：`UserPromptSubmit` → 若干对 `PreToolUse` / `PostToolUse` → `Stop`。

工作状态下，气泡按 `tool` 生成：`Bash` 显示 `description` 或 `command`；`Edit`、`Write`、`apply_patch` 显示文件名；`Read`、`Grep`、`Glob` 显示文件名或 `pattern`；`WebFetch`、`WebSearch` 显示「查资料」；`mcp__服务__工具` 显示「🔌 服务.工具」；其他工具显示「🛠 工具名」。`tool` 为 `AskUserQuestion` 或 `ExitPlanMode` 的 `PreToolUse` 会被当成在等用户回答。

一个会话 10 分钟没有任何事件会被当成已经结束（比如 agent 崩溃了），5 分钟没有任何会话有活动，宠物就会睡着。

### 示例

用 curl 模拟一轮完整的任务：

```bash
for e in UserPromptSubmit PreToolUse PostToolUse Stop; do curl -s -X POST -d "{\"event\":\"$e\",\"session\":\"demo\",\"tool\":\"Bash\",\"toolInput\":{\"command\":\"npm test\"}}" http://127.0.0.1:23456/event; sleep 2; done
```

Node.js：

```js
const pet = (event, extra = {}) =>
  fetch('http://127.0.0.1:23456/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, session: 'my-agent', ...extra }),
  }).catch(() => {}); // 宠物没运行时忽略

await pet('UserPromptSubmit');
await pet('PreToolUse', { tool: 'Edit', toolInput: { filePath: 'src/app.ts' } });
await pet('PostToolUse', { tool: 'Edit' });
await pet('Stop');
```

Python：

```python
import json, urllib.request

def pet(event, **extra):
    body = json.dumps({"event": event, "session": "my-agent", **extra}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:23456/event", body, {"Content-Type": "application/json"}), timeout=0.5)
    except OSError:
        pass  # 宠物没运行时忽略

pet("PreToolUse", tool="Bash", toolInput={"command": "pytest"})
```

### 不走生命周期、直接指定状态

如果你的 agent 没有「工具调用」这类概念，可以直接切换宠物状态：

```bash
curl -X POST -d '{"state":"working"}' http://127.0.0.1:23456/state
```

`state` 可选 `greet`、`idle`、`thinking`、`working`、`permission`、`done`、`error`、`sleep`。它会绕过会话逻辑直接生效，但下一个 `/event` 事件到来时会被覆盖，所以两种方式不要混用。

### 注意事项

- **只能从本机的程序调用**，比如你 agent 的后端进程、CLI 或脚本。宠物会拒绝一切来自浏览器的请求（带 `Origin` 或 `Sec-Fetch-Site` 请求头的，或 `Host` 不是 `127.0.0.1` / `localhost` 的），以防网页操控它。所以如果你的 agent 界面是网页或 Electron 渲染进程，请从后端或主进程发送事件。
- 请求体最大 16 KB；发送要异步、超时要短（`emit.mjs` 用的是 400 ms），宠物没运行时直接忽略错误，不要让它拖慢你的 agent。
- 端口可以用环境变量 `AGENT_PET_PORT` 修改，你的 agent 和宠物要用同一个值。
- 想改台词、动作或状态逻辑：台词在 `app/src/renderer/pet/lines.ts`，状态与动作的对应在 `app/src/renderer/pet/clips.ts`，事件到状态的转换在 `app/src/main/agent-sessions.cjs`。开发方法见[开发](#开发)。

## 常见问题

**第一次装完，开了新会话但宠物没出现？**
第一次要下载 Electron，等一两分钟。进度和错误都在日志里：

- macOS：`$TMPDIR/agent-pet.log`（在终端里运行 `open $TMPDIR/agent-pet.log`）
- Windows：`%TEMP%\agent-pet.log`

日志里出现 `starting` 就说明已经启动了。如果显示安装失败（比如网络问题），下次开会话时会自动重试。

**提示 `node` 找不到？**
安装 [Node.js](https://nodejs.org) 20 或更高版本，确保终端里 `node -v` 能用，然后重开一个会话。

**宠物找不到了？**
点托盘图标 → **回到屏幕上**。

**23456 端口被别的程序占用了？**
设置环境变量 `AGENT_PET_PORT` 换一个端口。Claude Code / Codex 和宠物要用同一个值，改完后重开会话。

**不想让它每次开会话都自动启动？**
设置环境变量 `AGENT_PET_NO_LAUNCH=1`。需要时可以手动启动：在仓库的 `app` 目录下运行 `npm start`。

**要把问题报告给开发者？**
设置 `AGENT_PET_DEBUG=1` 后重启宠物，日志会记录每个 agent 事件和渲染日志。附上日志提一个 [issue](https://github.com/jinshuming/agent-pet/issues)。

## 更新与卸载

**更新（Claude Code）：**

```bash
claude plugin marketplace update agent-pet
```

```bash
claude plugin update agent-pet@agent-pet
```

更新后退出宠物（托盘 → 退出），再开一个新会话。如果新版本需要不同的依赖，会自动重新安装。

**更新（Codex）：** 在克隆的目录里运行 `git pull`，然后退出宠物、开新会话。

**卸载（Claude Code）：**

```bash
claude plugin uninstall agent-pet@agent-pet
```

```bash
claude plugin marketplace remove agent-pet
```

**卸载（Codex）：** 在克隆的目录里运行 `node scripts/install-codex.mjs --uninstall`，然后删掉这个目录。

卸载后可以删掉 `~/.agent-pet` 文件夹，里面只有设置和 app 位置记录。

## 隐私

- 所有数据只在你的电脑上流转：hook 只把事件名、会话 id、工作目录、工具名，以及截短的命令或文件路径发给本机的 `127.0.0.1`。**你的指令内容、文件内容和工具输出都不会离开 hook。**
- 宠物的本地服务只接受本机程序的请求，网页发来的请求一律拒绝。
- 有两件事 Claude Code 的 hook 不会上报：按 Esc 中断，以及拒绝授权。这两件事是宠物在本地读取会话记录文件得知的（`app/src/main/transcript-tail.cjs`）：只读会话忙碌期间新增的行，只检查这两个标记，什么也不保存。Codex 自带 `Interrupt` hook，不需要这样做。

## 开发

```
plugin/    Claude Code 插件：转发生命周期事件的 hook（没有 npm 依赖）；Codex 复用同一套脚本
app/       Electron + PlayCanvas + @viggle/splat-engine 桌面宠物
scripts/   install-codex.mjs
docs/      动作设计：每个动作的提示词、选样理由和处理流程
```

```bash
cd app && npm install
```

```bash
npm run dev
```

`npm run dev` 用 Vite 开发服务器运行宠物，支持热更新，并开启 `/debug/*` 调试接口。想让 Claude Code 会话连到这份代码，在仓库根目录运行 `claude --plugin-dir ./plugin`。

- 用户运行的是 `app/dist/` 里构建好的渲染层（已提交到仓库，所以用户只需要装 Electron）。**改了 `app/src/renderer/` 下的代码，要运行 `npm run build` 并连同 `dist/` 一起提交**，否则 CI 会报错。
- 新生成的 PINOC 动作要先运行 `npm run slim-clips`，把骨骼精简到角色用的 86 根，CI 也会检查这一点。详见 [docs/motion-design.md](docs/motion-design.md)。
- 事件流：

```
Claude Code / Codex hook（异步）→ plugin/scripts/emit.mjs → POST 127.0.0.1:23456/event
  → app/src/main/agent-sessions.cjs   每个会话一份状态，最紧急的胜出
  → renderer PetController            拖拽 > 授权/出错 > 互动反应 > agent 状态
  → SplatPetRenderer                  在 splat 角色上交叉淡入 PINOC 动作
```

```bash
curl -s localhost:23456/debug/sessions
```

```bash
curl -X POST -d '{"state":"done"}' localhost:23456/state
```

第一条查看每个会话的实时状态，第二条强制切换到某个状态。

| 环境变量 | 作用 |
|---|---|
| `AGENT_PET_PORT` | 换端口（默认 23456；agent 和宠物要设成同一个值） |
| `AGENT_PET_NO_LAUNCH=1` | 开会话时不自动启动宠物 |
| `AGENT_PET_APP_DIR` | 让启动器使用另一份 app 目录 |
| `AGENT_PET_DEBUG=1` | 记录每个 hook 事件和渲染日志，并开启只读的 `/debug/stats` |

## 致谢与许可

角色和动作用 [PINOC](https://viggle.ai/pinoc/app) 制作，由 [@viggle/splat-engine](https://www.npmjs.com/package/@viggle/splat-engine)（MIT）在 [PlayCanvas](https://playcanvas.com) 上渲染。

代码采用 [MIT](LICENSE) 许可；`app/assets/` 里的角色和动作文件采用 [CC BY-NC 4.0](app/assets/LICENSE)，可以免费用于非商业用途，使用时请注明出处。
