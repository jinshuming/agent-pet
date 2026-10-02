# Agent Pet 首发文案

所有文案都默认配了 docs/media 清单里的演示素材（动图、30 秒视频）。还没录好之前先别发，没有视频的版本效果会差很多。

**关于披露**：你在 Viggle 工作，而素材是用 PINOC 做的。HN 和 Reddit 对「没说明身份的员工推自家产品」很敏感，被发现会被当成软广。所以英文帖子里都加了一句披露，建议保留。

---

## 1. X / Twitter（英文主推，thread）

**主推文（配 30 秒视频）：**

> I gave Claude Code a body.
>
> Agent Pet is a 3D desktop pet that acts out what your agent is doing: thinking, typing while tools run, waving at you when it needs permission, knocking on your screen if you ignore it, collapsing when the turn is done.
>
> Free and open source. Works with Codex too 🧵

**2/**
> Install in Claude Code:
>
> /plugin marketplace add jinshuming/agent-pet
> /plugin install agent-pet@agent-pet
>
> github.com/jinshuming/agent-pet

**3/（配甩飞动图）**
> While you wait, you can pat it, poke it, fling it across the screen, or hang it off the top edge until its arms get tired.
>
> Leave it alone for 8 minutes and it sits against the wall and falls asleep.

**4/**
> It isn't tied to Claude Code. It listens on localhost, so any agent can drive it with one POST:
>
> curl -X POST -d '{"event":"PreToolUse","tool":"Bash"}' 127.0.0.1:23456/event
>
> No telemetry: prompts, file contents and tool output never leave your machine.

**5/**
> The characters are Gaussian splats and every motion was generated from a text prompt with PINOC (I work at Viggle, which makes it). The prompts are all in the repo.
>
> Which agent should I support next?

@ 提及建议：@claudeai、@AnthropicAI、@OpenAIDevs，以及 Claude Code 团队里常转发社区作品的成员。不要在一条推文里 @ 太多人，3 个以内。

---

## 2. Hacker News（Show HN）

**标题**（HN 标题限制 80 字符，不要用感叹号和营销词）：

> Show HN: Agent Pet – A 3D desktop pet that acts out what Claude Code is doing

**正文：**

> Hi HN. I spend a lot of my day waiting on coding agents, and the terminal is a bad way to notice "it's been waiting for my permission for 5 minutes". So I made a desktop pet that acts out the agent's state.
>
> It hooks into Claude Code and Codex lifecycle events. Reading files, searching, running a command, and spawning subagents each get their own animation. When the agent needs permission it turns to you and pleads, with the actual request in a speech bubble ("Can I run npm test?"). After 12 seconds it waves, and after 35 it knocks on the screen. When the turn ends it collapses out of breath.
>
> Some details that might interest people here:
>
> - The hooks are dependency-free Node scripts that POST to a local HTTP server and fail silently in 400 ms if the pet isn't running, so they never slow the agent down. Any agent can drive it with the same HTTP API.
> - Only event names, tool names and truncated commands or paths are sent, and only to 127.0.0.1. The server rejects anything with an Origin or Sec-Fetch-Site header so web pages can't drive it. There's no telemetry.
> - Claude Code hooks don't report Esc-interrupts or denied permissions, so the pet tails the session transcript for just those two markers while a turn is busy.
> - Characters are Gaussian splats rendered with PlayCanvas in a transparent Electron window. Motions were generated from text prompts with PINOC, a product of the company I work for (Viggle); the prompts and selection notes are in docs/motion-design.md.
> - Honest costs: Electron is about 350 MB on first launch and the pet uses about 850 MB of RAM. It renders at 30 fps, 15 fps when asleep, which is about 8% of one core.
>
> Code is MIT, assets are CC BY-NC. macOS is the main platform; Windows works but is less tested, and Linux isn't supported yet.
>
> https://github.com/jinshuming/agent-pet

**发帖提示：**
- 美东时间周二到周四上午 8–10 点发（北京时间晚上 8–10 点）。
- 发完之后至少守 3 小时，每条评论都回。批评内存占用的评论要认真回应，不要辩解。
- 不要找人去点赞，HN 会检测投票环。

---

## 3. Reddit

### r/ClaudeAI 或 r/ClaudeCode

**标题：**
> I made Claude Code a 3D desktop pet that begs me for permission and knocks on my screen if I ignore it

**正文（直接上传视频，正文写在评论或描述里）：**
> Every time Claude Code stops to ask for permission, I'd notice 10 minutes later. So now there's a little guy on my desktop who acts out what Claude is doing: thinking, typing while tools run, reading a tablet when it reads files, bossing around a team when it spawns subagents. When it needs permission he turns to me and pleads with the actual command in a bubble, then waves, then knocks on the screen.
>
> It's a free, open-source plugin:
>
> `/plugin marketplace add jinshuming/agent-pet`
> `/plugin install agent-pet@agent-pet`
>
> Repo: https://github.com/jinshuming/agent-pet
>
> Everything stays local; no telemetry. Disclosure: the characters and motions were made with PINOC, from Viggle, where I work. The plugin itself is a side project and MIT-licensed.
>
> Happy to hear what other states or reactions you'd want.

### r/codex 或 r/OpenAI

标题把 Claude Code 换成 Codex，正文第一段改成：「Installs as a native Codex plugin: `codex plugin marketplace add jinshuming/agent-pet`, then `codex plugin add agent-pet@agent-pet`, then trust the hooks in `/hooks`.」

### r/ChatGPTCoding、r/LocalLLaMA（偏「接入任意 agent」）

> **标题：** A desktop pet any coding agent can drive with one HTTP POST
>
> 正文的重点放在 HTTP 接口和那段 curl 示例上。

**提示：** 发帖前先看各版的规则，有的版块要求周末才能发自我推广。每个版块间隔至少一天发，不要同一天连发。

---

## 4. Product Hunt

- **Name**: Agent Pet
- **Tagline**（60 字符内）: A 3D desktop pet that acts out what your coding agent does
- **Topics**: Developer Tools, Artificial Intelligence, Open Source, Desktop
- **Description**:
  > Agent Pet sits on your desktop and acts out what Claude Code or Codex is doing: thinking, typing, reading, running commands, managing subagents. When the agent needs your permission, it turns to you and pleads, then waves, then knocks on your screen. Pat it, poke it, fling it, or play it like a platformer with WASD. Free, open source, and fully local.
- **Maker 首评**:
  > Hey Product Hunt 👋 I built Agent Pet because I kept missing Claude Code's permission prompts. A terminal doesn't ask for your attention; a small person waving at you does. It started as a notification fix and turned into a pet with 57 motions, 8 characters, and a game mode. It's open source, and any agent can drive it over a local HTTP API. I'd love to hear which agent you want supported next.
- **素材**: 封面用 `characters.png`；画廊图依次是：求授权的红气泡、子 Agent 小卡片、挂在屏幕顶边、游戏模式；再加 30 秒视频。

---

## 5. V2EX（分享创造节点）

**标题：**
> 给 Claude Code / Codex 做了个 3D 桌面宠物：等你授权时会盯着你挥手，再不理就敲屏幕

**正文：**
> 用 Claude Code 最烦的一件事：它停下来等授权，我十分钟后才发现。
>
> 所以做了个桌面宠物替 agent 演出：思考时托腮，改文件时疯狂敲键盘，读文件时捧着平板，派子 Agent 时像队长一样分派任务。需要授权时它会转过来看着你，气泡里写着「可以运行 npm test 吗？」，12 秒没人理就挥手，35 秒后敲屏幕。任务完成后先累瘫喘气，再得意比心。
>
> 等的时候还能摸头、戳它、拖着甩飞、挂在屏幕顶上看它手酸掉下来，或者开游戏模式用 WASD 在桌面上跑跳。
>
> 安装（Claude Code 里两行命令）：
> ```
> /plugin marketplace add jinshuming/agent-pet
> /plugin install agent-pet@agent-pet
> ```
> Codex 也支持，见 README。
>
> 一些细节：
> - 全部本地运行，hook 只把事件名和截短的命令发到 127.0.0.1，没有遥测
> - 本地有 HTTP 接口，任何 agent 一个 POST 就能接入
> - 角色是 Gaussian splat，动作用 PINOC 文生动作生成（我在 Viggle 工作），提示词都在仓库里
> - 首次启动要下载约 350 MB 的 Electron，国内会自动走 npmmirror 镜像
>
> GitHub：https://github.com/jinshuming/agent-pet
>
> 欢迎提需求，想接哪个 agent、想加什么动作都可以说。

---

## 6. 即刻（圈子：AI 探索站、独立开发者、程序员）

> 做了个替 Claude Code 演戏的桌面小人 🧍
>
> agent 思考它托腮，改代码它狂敲键盘，要你授权它就盯着你挥手，再不理就敲屏幕。干完活累瘫喘气，然后比心。
>
> 闲着没事可以摸头、甩飞、挂屏幕顶上看它手酸，长时间不理它会自己靠墙睡着 😴
>
> 开源免费，Codex 也能用 👉 github.com/jinshuming/agent-pet

（配 2–3 张动图）

---

## 7. 小红书

**标题**（20 字以内）：
> 程序员的赛博搭子：AI 写代码时它在演戏

**正文：**
> 让 AI 写代码的时候，我桌面上多了个小人 🥹
>
> 🤔 AI 在想 → 他托腮苦想
> ⌨️ AI 在改代码 → 他疯狂敲键盘
> 🙏 AI 要我授权 → 他转过来盯着我挥手
> 👊 我不理他 → 他开始敲屏幕
> 😮‍💨 活干完了 → 累瘫喘气，然后比心
>
> 摸头会害羞，戳他会怕痒，拖着甩出去会撞墙反弹 😂 太久不理他，他会自己走到屏幕边靠墙睡着。
>
> 有 8 个角色可以换，还有五条悟和迈尔斯（同人二创）。
>
> 支持 Claude Code 和 Codex，开源免费。GitHub 搜 agent-pet
>
> #程序员 #AI编程 #ClaudeCode #桌面宠物 #打工人 #效率工具 #开源

**提示：** 小红书不能放外链，正文写「GitHub 搜 agent-pet」即可。封面用竖版 3:4，最好是五条悟角色挂在屏幕顶边的那一帧。

---

## 8. B 站 / 抖音（竖屏短视频）

**标题：**
> 我给 AI 编程助手做了个身体，它等我授权的样子太卑微了

**60 秒脚本：**

| 时间 | 画面 | 字幕或口播 |
|---|---|---|
| 0–3 s | 宠物对着镜头敲屏幕 | 「我的 AI 助手在敲我的屏幕。」 |
| 3–10 s | 发指令 → 撸袖子 → 思考 → 敲键盘 | 「我让它写代码，它就在桌面上演给我看。」 |
| 10–20 s | 红气泡「可以运行 npm test 吗？」→ 挥手 → 敲屏幕 | 「要我授权的时候，先求我，再喊我，最后敲屏幕。」 |
| 20–28 s | 完成 → 累瘫 → 比心 | 「干完活累瘫，然后跟我要夸奖。」 |
| 28–45 s | 甩飞、撞墙、挂顶边、手酸掉下来、头晕 | 「等它的时候，我就这么玩它。」 |
| 45–55 s | 切换 8 个角色的快剪 | 「8 个角色随便换。」 |
| 55–60 s | GitHub 页面 | 「开源免费，GitHub 搜 agent-pet。」 |

**简介：**
> Agent Pet：替 Claude Code / Codex 演出的 3D 桌面宠物。开源免费：github.com/jinshuming/agent-pet ，角色用 PINOC 制作。

**标签：** 程序员、AI 编程、Claude Code、桌面宠物、开源项目、Gaussian Splatting

---

## 9. 投稿：HelloGitHub（月刊）

在 [HelloGitHub](https://github.com/521xueweihan/HelloGitHub) 按它的投稿模板提一个 issue：

> **项目地址**：https://github.com/jinshuming/agent-pet
> **类别**：JavaScript（或「其它」）
> **项目标题**：替 AI 编程助手演出的 3D 桌面宠物
> **项目描述**：一个跟着 Claude Code 或 Codex 状态演出的 3D 桌面宠物：agent 思考、改文件、跑命令、派子 Agent 时各有动作；需要授权时会盯着你挥手，等久了敲屏幕催你。可以摸头、甩飞、挂在屏幕顶边，还有 WASD 游戏模式。全部本地运行，提供本地 HTTP 接口，任何 agent 都能接入。
> **亮点**：1. 授权提醒不再错过；2. 角色是 Gaussian splat，动作由文本生成，提示词全部开源；3. 一个 POST 即可接入任意 agent。
> **截图**：（演示动图链接）

## 10. 投稿：阮一峰《科技爱好者周刊》

在 [ruanyf/weekly](https://github.com/ruanyf/weekly) 的 issue 里自荐，一段话即可：

> **Agent Pet**：一个开源的 3D 桌面宠物，会跟着 Claude Code / Codex 的状态演出，agent 等你授权时它会挥手、敲屏幕提醒你。https://github.com/jinshuming/agent-pet

---

## 11. awesome 列表的条目（提 PR 时用）

各列表格式不同，按它的格式改一下即可：

> - [Agent Pet](https://github.com/jinshuming/agent-pet) - A 3D desktop pet that acts out what Claude Code or Codex is doing and waves at you when the agent needs permission. Any agent can drive it over a local HTTP API.

---

## 发布节奏建议

| 天 | 渠道 |
|---|---|
| 第 1 天 | X thread + 即刻；同时给 awesome 列表提 PR、提交 Anthropic 目录（审核需要时间） |
| 第 2 天 | r/ClaudeAI |
| 第 3 天 | Show HN（北京时间晚上） |
| 第 4 天 | V2EX + B 站 / 抖音 / 小红书视频 |
| 第 5 天 | r/codex，HelloGitHub 和阮一峰周刊投稿 |
| 第 2 周 | Product Hunt（周二到周四发） |
