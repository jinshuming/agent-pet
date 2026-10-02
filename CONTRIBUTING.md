# Contributing to Agent Pet

**English** | [简体中文](#参与贡献中文)

Thanks for helping. New lines, motions, characters, translations, and support for more agents are all welcome.

## Where to start

- **Bugs**: open a [bug report](https://github.com/jinshuming/agent-pet/issues/new?template=bug_report.yml) with the debug log (set `AGENT_PET_DEBUG=1`).
- **Ideas**: open an [idea issue](https://github.com/jinshuming/agent-pet/issues/new?template=feature_request.yml) before a large PR, so we can agree on the behavior first.
- **Small changes** (a typo, a new line, a fix in one function): just send a PR.

Good first contributions:

- **Speech-bubble lines** in `app/src/renderer/pet/lines.ts`. Keep them short; the bubble is small.
- **Translations.** Menus and lines are Chinese only today. An English translation needs a small locale layer first (lines in `lines.ts`, menus in `app/src/main/main.cjs`); open an issue to agree on the shape before you start.
- **More agents.** Anything that can send an HTTP request can drive the pet; see [Connect your own agent](README.md#connect-your-own-agent). An install script or a short guide for another agent (like `scripts/install-codex.mjs`) is a great PR.
- **Linux.** The pet is developed on macOS and adapted for Windows. Linux isn't supported yet.

## Development setup

You need Node.js 20 or later.

```bash
cd app && npm install
npm run dev
```

`npm run dev` runs the pet with hot reload and the `/debug/*` endpoints. To point a Claude Code session at your checkout, run `claude --plugin-dir ./plugin` from the repo root. The right-click menu's "simulate agent state", "simulate interaction" and "preview a single motion" entries let you test without a real agent.

Before you push, make sure CI will pass:

```bash
cd app
npm run typecheck
npm run build   # only if you changed app/src/renderer/; commit app/dist/ with it
```

- Users run the committed `app/dist/`, so **renderer changes must include the rebuilt `dist/`**. CI fails if it's stale.
- The plugin scripts in `plugin/` have no npm dependencies. Keep it that way: they run on every hook event.
- The hooks must never slow the agent down. Send asynchronously, use short timeouts, and fail silently when the pet isn't running.
- **Privacy is a feature.** Never send prompt text, file contents or tool output out of the hook, and don't add telemetry.
- If you change user-facing behavior, update both `README.md` and `README.zh-CN.md`. If you can only write one, say so in the PR and we'll translate.

Code style: match the surrounding code. Comments explain *why*, not *what*.

## Adding a motion

Motions are generated with [PINOC](https://viggle.ai/pinoc/app). Follow the pipeline in [docs/motion-design.md](docs/motion-design.md): generate with the standard prompt endings, score the samples, fix the facing, run `npm run slim-clips`, and record the prompt and why you picked that sample in the doc. Then wire the clip up in `app/src/renderer/pet/clips.ts`.

Include a recording of the motion on the pet in your PR.

## Submitting a character

Anyone can wear any character locally: export the optimized `.vsplat` from PINOC into `app/assets/characters/local/` and list it in `app/assets/characters/local.json` (both are gitignored):

```json
[{ "id": "my-character", "name": "My Character", "file": "characters/local/my-character.vsplat" }]
```

To get a character into the built-in list, open a [character submission](https://github.com/jinshuming/agent-pet/issues/new?template=character_submission.yml) with a preview first. If it's accepted, send a PR that adds the `.vsplat` to `app/assets/characters/` and a line to `CHARACTERS` in `app/src/renderer/pet/characters.ts`.

Rules for built-in characters:

- **Use the optimized PINOC export, under 2 MB.** Every character ships with every install.
- **It works with the existing motions.** Check idle, typing, hanging, and sitting against the wall; hands and feet shouldn't clip badly.
- **You made it or have the right to share it**, and you agree to license it under [CC BY-NC 4.0](app/assets/LICENSE) like the other assets.
- **No likeness of a real person** without their consent.
- **Fan works of existing characters are welcome as non-commercial fan works.** Name the source work in the PR so we can add it to the fan-works notice in the READMEs and `app/assets/LICENSE`. If a rights holder asks us to remove one, we will.

## Licensing of contributions

Code you contribute is licensed under the [MIT License](LICENSE). Characters and motions you contribute to `app/assets/` are licensed under [CC BY-NC 4.0](app/assets/LICENSE).

---

## 参与贡献（中文）

欢迎贡献新台词、新动作、新角色、翻译，以及适配更多 agent。

**从哪里开始**

- **问题反馈**：提一个 [bug report](https://github.com/jinshuming/agent-pet/issues/new?template=bug_report.yml)，附上日志（设置 `AGENT_PET_DEBUG=1`）。
- **新想法**：大的改动请先开一个 [idea issue](https://github.com/jinshuming/agent-pet/issues/new?template=feature_request.yml)，先对齐行为再写代码。
- **小改动**（错别字、新台词、单个函数的修复）：直接提 PR。

适合第一次贡献的方向：台词（`app/src/renderer/pet/lines.ts`，要短，气泡很小）；翻译（目前菜单和台词只有中文，需要先加一层多语言支持，动手前请开 issue 讨论方案）；适配更多 agent（参考 `scripts/install-codex.mjs`）；Linux 支持。

**开发**：需要 Node.js 20+。在 `app/` 下运行 `npm install` 和 `npm run dev`；在仓库根目录运行 `claude --plugin-dir ./plugin` 让 Claude Code 连到你的代码。推送前运行 `npm run typecheck`；改了 `app/src/renderer/` 就要运行 `npm run build`，并把 `app/dist/` 一起提交，否则 CI 会报错。

几条原则：

- `plugin/` 里的脚本不引入 npm 依赖；hook 必须异步、超时短，宠物没运行时安静失败，不能拖慢 agent。
- **隐私是功能的一部分**：不要把指令内容、文件内容、工具输出带出 hook，也不要加遥测。
- 改了用户能看到的行为，请同时更新 `README.md` 和 `README.zh-CN.md`。只会写一种语言也没关系，在 PR 里说一声，我们来翻译。

**新动作**：用 [PINOC](https://viggle.ai/pinoc/app) 生成，按 [docs/motion-design.md](docs/motion-design.md) 的流程处理，并在文档里记下提示词和选样理由。PR 里请附上动作在宠物身上的录屏。

**角色投稿**：自己用的角色，放在 `app/assets/characters/local/` 并写进 `local.json` 即可（不会进 git，格式见上文英文部分）。想收进内置列表，请先提一个[角色投稿](https://github.com/jinshuming/agent-pet/issues/new?template=character_submission.yml)并附上预览，通过后再提 PR，把 `.vsplat` 放进 `app/assets/characters/`，并在 `app/src/renderer/pet/characters.ts` 的 `CHARACTERS` 里加一行。内置角色的要求：

- 用 PINOC 优化后导出的版本，小于 2 MB；
- 和现有动作配合正常：至少检查待机、敲键盘、挂在顶边、靠墙坐下；
- 是你做的或你有权分享，并同意采用 [CC BY-NC 4.0](app/assets/LICENSE) 许可；
- 未经本人同意，不能是某个真人的形象；
- 已有角色的同人二创可以，但只作非商业的同人作品。请在 PR 里写明原作，我们会把它加进 README 和 `app/assets/LICENSE` 里的同人声明。版权方要求移除时我们会移除。

**许可**：贡献的代码采用 [MIT](LICENSE) 许可；贡献到 `app/assets/` 的角色和动作采用 [CC BY-NC 4.0](app/assets/LICENSE) 许可。
