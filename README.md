# Agent Pet

A 3D Gaussian-splat desktop pet that acts out what your coding agent is doing, for **Claude Code** and **Codex**. It thinks when you send a prompt, types while tools run, waves for permission, pants and then shows off when the turn is done. While you wait you can pat it, poke it, throw it around the screen, spin it until it's dizzy, or leave it alone until it wanders to the edge of the screen, sits down and dozes off.

> 一个真人感的 3D 桌面宠物，替你的 coding agent（Claude Code / Codex）演出它正在做的事：思考、敲代码、求授权、完成后累瘫再比心。等待时可以摸头、戳、拖拽甩飞、转圈转晕；长时间不理它，它会走到屏幕边靠墙坐下，再过一会儿靠墙睡着。

```
plugin/    Hooks that forward lifecycle events (no npm deps). A Claude Code plugin; Codex reuses the same scripts.
app/       Electron + PlayCanvas + @viggle/splat-engine desktop pet
scripts/   install-codex.mjs
```

## Requirements

- macOS (the pet is developed and tested there)
- Node.js 20 or newer on your `PATH`
- About 600 MB of disk for the app's dependencies (Electron), installed automatically on first run

## Install for Claude Code

Inside Claude Code:

```
/plugin marketplace add jinshuming/agent-pet
/plugin install agent-pet@agent-pet
```

Start a new session. The plugin's `SessionStart` hook launches the pet. The very first time it runs `npm install` in the app, so the pet appears after a minute or two. Progress goes to `$TMPDIR/agent-pet.log`.

## Install for Codex

```bash
git clone https://github.com/jinshuming/agent-pet.git
cd agent-pet
node scripts/install-codex.mjs
```

The script adds this checkout's hooks to `~/.codex/hooks.json` (merged with any hooks you already have). Then start Codex, run `/hooks`, and trust the Agent Pet hooks: Codex runs no new hook until you've reviewed it. Keep the checkout where it is, because the hooks point into it. To remove them, run `node scripts/install-codex.mjs --uninstall`.

Claude Code and Codex can run side by side: every session feeds the same pet, and the most urgent state wins (a permission request beats a running tool, which beats thinking).

## Playing with it

| Do this | It does |
|---|---|
| Click its head / body | Shy squirm / ticklish jolt. While the agent is busy: "wait a moment!" |
| Double / triple click | Poses for a photo / makes a big heart |
| Drag it | Flails in mid-air. Throw it and it flies, bounces off the screen sides, lands (dizzy if it lands hard) |
| Throw it at the top of the screen | It grabs the edge and hangs there until its arms get tired |
| Set it down by a side of the screen | It leans on the wall |
| ⌥-drag sideways, or swipe two fingers sideways | Spins it. Three turns and it staggers around dizzy |
| Pinch, or ⌘-scroll, over it | Resizes it |
| Leave it alone for 3 min / 8 min | Walks to the nearest wall and sits / dozes off there. Touch it and it gets up |
| Right-click it | Switch character, change size, preview every state and motion |

## Privacy

`emit.mjs` only forwards the event name, session id, cwd, the transcript's path, tool name, and a clipped command or path, and only to `127.0.0.1`. Prompts, file contents and tool output never leave the hook. The app's control server accepts requests from local processes only and refuses anything a web page sends.

Two things no Claude Code hook reports, pressing Esc mid-turn and rejecting a permission prompt, are read from the session's transcript file by the app (`app/src/main/transcript-tail.cjs`). It reads only lines appended while a session is busy, checks each for those two markers, and keeps nothing else. Codex reports an Esc with its own `Interrupt` hook.

## How events flow

```
Claude Code / Codex hook (async) → plugin/scripts/emit.mjs → POST 127.0.0.1:23456/event
  → app/src/main/agent-sessions.cjs   per-session state, highest priority wins
  → renderer PetController            drag > permission/error > reaction > agent state
  → SplatPetRenderer                  crossfade PINOC motion clips on the splat character
```

## Develop

```bash
cd app && npm install
npm run dev                         # run the pet by hand
claude --plugin-dir ../plugin       # a Claude Code session wired to this checkout
```

Motion clips and how they were made, picked and fixed up are in [docs/motion-design.md](docs/motion-design.md).

```bash
curl -s localhost:23456/debug/sessions                          # live per-session state
curl -X POST -d '{"state":"done"}' localhost:23456/state         # force a state
```

| Env var | Effect |
|---|---|
| `AGENT_PET_PORT` | Change the port (default 23456; set it for both the agent and the app) |
| `AGENT_PET_NO_LAUNCH=1` | Don't auto-start the app from the hook |
| `AGENT_PET_APP_DIR` | Point the launcher at another app checkout |

## Credits and license

Characters and motions were made with [PINOC](https://viggle.ai/pinoc/app) and render with [@viggle/splat-engine](https://www.npmjs.com/package/@viggle/splat-engine) (MIT) on [PlayCanvas](https://playcanvas.com).

The code is [MIT](LICENSE). The character and motion files in `app/assets/` are [CC BY-NC 4.0](app/assets/LICENSE): free for non-commercial use with credit.
