# Agent Pet

**English** | [简体中文](README.zh-CN.md)

**A 3D desktop pet that acts out what your coding agent is doing.** Works with Claude Code and Codex, and with any agent that can send an HTTP request.

<!-- Demo GIF: record it to docs/media/demo.gif, then uncomment the next line. Shot list: docs/media/README.md -->
<!-- <p align="center"><img src="docs/media/demo.gif" alt="Agent Pet demo" width="720"></p> -->

You send a prompt and it rolls up its sleeves and starts thinking. When the agent reads files it studies a tablet. When the agent searches code it shades its eyes and looks around. While a command runs it watches the machine, and when the agent sends out subagents it hands out tasks like a team captain. When the agent needs your permission it turns to you and waves, and if you keep it waiting it knocks on the screen. When the turn is done it collapses, out of breath, then shows off with a finger heart. Its head follows your mouse the whole time.

While you wait, you can pat its head, poke it, drag it and fling it across the screen, or spin it until it's dizzy. Ignore it long enough and it walks to the edge of the screen, sits against the wall, and falls asleep.

**Install in Claude Code:**

```
/plugin marketplace add jinshuming/agent-pet
/plugin install agent-pet@agent-pet
```

Then start a new session. [Codex instructions](#install-for-codex) · [Connect your own agent](#connect-your-own-agent)

- [Requirements](#requirements)
- [Install for Claude Code](#install-for-claude-code)
- [Install for Codex](#install-for-codex)
- [Usage](#usage)
- [Connect your own agent](#connect-your-own-agent)
- [FAQ](#faq)
- [Update and uninstall](#update-and-uninstall)
- [Privacy](#privacy)
- [Development](#development)
- [Contributing](#contributing)
- [Credits and license](#credits-and-license)

> The pet's menus and speech bubbles are currently in Chinese. Translations are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

| | |
|---|---|
| OS | macOS, or Windows 10 / 11 (developed on macOS; Windows is supported but less tested) |
| Node.js | 20 or later, on your `PATH` (`node -v` prints a version). Claude Code and Codex users usually have it already |
| Disk | About 350 MB for Electron, its only runtime dependency, downloaded automatically on first launch |
| Resources | About 8% of one CPU core and about 850 MB of memory at idle. It renders at 30 fps normally, 60 fps while you interact with it, and 15 fps while asleep, so it's fine to leave running all day |

## Install for Claude Code

**1. Run these two commands in Claude Code:**

```
/plugin marketplace add jinshuming/agent-pet
/plugin install agent-pet@agent-pet
```

Or from a terminal, with the same result:

```bash
claude plugin marketplace add jinshuming/agent-pet
```

```bash
claude plugin install agent-pet@agent-pet
```

**2. Start a new Claude Code session.** The pet launches automatically when a session starts.

- **The first launch takes a minute or two** while Electron (about 350 MB) downloads in the background. If the download from GitHub fails, it retries from the npmmirror.com mirror. Progress goes to the log; see the [FAQ](#faq).
- After that, the pet appears within 1–2 seconds of each new session, and it won't launch twice if it's already running.
- Several Claude Code sessions at once are fine. They all share one pet.

## Install for Codex

Codex reads Claude Code–style plugins, so Agent Pet installs the same way.

**1. Add the marketplace and install the plugin from a terminal:**

```bash
codex plugin marketplace add jinshuming/agent-pet
```

```bash
codex plugin add agent-pet@agent-pet
```

**2. Trust the hooks in Codex:** start Codex, type `/hooks`, then review and trust the Agent Pet hooks. Codex doesn't run hooks you haven't trusted. You only need to do this once, and again if an update changes the hooks.

**3. Start a new Codex session** and the pet appears. The first launch also takes a minute or two to download Electron.

Tested with Codex CLI 0.160. If your Codex doesn't have `codex plugin` yet, update it, or use the install script instead:

<details>
<summary>Install with the script (older Codex, or to run from a checkout)</summary>

```bash
git clone https://github.com/jinshuming/agent-pet.git
```

```bash
cd agent-pet && node scripts/install-codex.mjs
```

The script merges this repo's hooks into `~/.codex/hooks.json` and leaves your existing hooks alone. Then trust them with `/hooks` as above. The hooks point at the directory you cloned, so **don't move or delete it after installing**; if you do move it, run the script again from the new location.

</details>

Use one method, not both: with the plugin and the script installed, every event reaches the pet twice. If you used the script before, run `node scripts/install-codex.mjs --uninstall` in that checkout first.

You can use Claude Code and Codex at the same time; they drive the same pet. When sessions are in different states, the pet shows the most urgent one (waiting for permission > error > working > thinking > done > idle).

## Usage

### What it acts out for the agent

You don't need to do anything. The pet follows the agent's state:

| What the agent is doing | What the pet does |
|---|---|
| Session starts | Waves hello |
| You send a new prompt | "Got it!" Claps, rolls up its sleeves, starts thinking |
| Thinking | Hand on chin. If it thinks for a while, it alternates between scratching its head and counting off a plan on its fingers |
| Editing files | Types furiously |
| Reading files / searching code or the web | Reads a tablet / shades its eyes and looks around |
| Running a command or an MCP tool | Presses a button, then crosses its arms and watches it run |
| Spawning subagents | Hands out assignments like a captain, then stands hands-on-hips watching the team. Each subagent shows up as a small card beside it saying what it's doing, ticked off when done, and the pet nods to "receive the report" |
| Compacting context | Tidies up files |
| Needs your permission or an answer | Turns to look at you and pleads, with a red bubble saying what it wants (for example "Can I run npm test?"). After 12 s with no response it waves at you; after 35 s it knocks on the screen |
| Turn done | Collapses out of breath, then a proud finger heart |
| Error | Grabs its head in frustration, glowing red |
| Nothing to do | Fixes its hair, stretches. Later it scratches its head, scratches an itch, kicks a pebble. Later still it yawns, checks its watch, taps its foot, getting more and more bored |
| No agent activity for 5 minutes | Yawns, walks to the edge of the screen, sits against the wall, and soon falls asleep |

Its head follows your mouse and its body slowly catches up. When the mouse is still and it has nothing to do, it looks around. While busy it only glances at you now and then; while waiting for your permission it keeps its eyes on you.

When you have other sessions open, the ones that are busy or waiting for permission also show up as small cards beside it.

### Playing with it

| Do this | It reacts |
|---|---|
| Click its head / body | Shy at the head pat / ticklish at the poke. Click it while the agent is busy and it impatiently says "hang on" |
| Double-click / triple-click | Peace-sign selfie / big heart over its head |
| Drag | Kicks its legs while dangling. Let go with some speed and it flies: it bounces off the sides of the screen, and a hard landing leaves it dizzy |
| Fling it at the top of the screen | Grabs the top edge and hangs: two hands at first, one hand after 15 s when its arms get tired, then it drops. Click it slowly and it struggles (and tires faster); click 4 times within about a second to knock it down |
| Put it at the left or right edge | Leans against the wall, looking cool |
| Drag sideways in the **empty space next to it**, hold ⌥ (Alt on Windows) and drag it, or swipe sideways with two fingers on a trackpad | Spins in place, faster the harder you swipe. After 3 full turns it's too dizzy to stand |
| Pinch on it, or hold ⌘ (Ctrl on Windows) and scroll | Resize |
| Ignore it for 3 minutes / 8 minutes | Walks to the nearest screen edge and sits against the wall / falls asleep against the wall. Touch it and it gets up |

### Right-click menu

Right-click the pet:

- **Switch character**: Young Man by default. 8 characters are built in: Asian Actor, Man in Suit, Young Man, DJ Neko, Chibi Guitarist, Satoru Gojo, Creepy Log Man, Miles Morales. Satoru Gojo and Miles Morales are unofficial fan works; see [Credits and license](#credits-and-license).
- **Size**: 75% by default. Pick a preset from 10% to 250%, or choose "Custom…" and enter any percentage (the maximum depends on your screen height).
- **Game mode (WASD + Space)**: steer the character around your desktop like a side-scroller. See [Game mode](#game-mode).
- **Simulate agent state / Simulate interaction / Preview a single motion**: see every state and motion without waiting for an agent, including "Rest: walk to the wall and sit / fall asleep against the wall".
- **Quit**.

Character and size are remembered for next time (in `~/.agent-pet/settings.json`).

### Game mode

Check **Game mode** in the right-click menu (or the tray menu) and the pet takes over the keyboard so you can run and jump around the desktop:

| Key | Action |
|---|---|
| A / D (or ← / →) | Run left / right |
| Space / W / ↑ | Jump. Hold longer to jump higher; press again in the air to double-jump; press against the left or right screen edge to wall-jump |
| S / ↓ | Crouch on the ground; dive in the air, and a hard enough dive ends in a heavy landing |
| Esc | Leave game mode (if you leave mid-air, it finishes the jump with the speed it had) |

The floor is the top of the Dock, the walls are the screen edges (hold a direction against a wall in mid-air to wall-slide), and the ceiling is the menu bar. When you click another window the keyboard goes with it, so the pet stops and waits; click it to keep playing. Agent state keeps being tracked during game mode, and the pet picks up acting it out as soon as you leave.

### Tray icon

The paw-print icon in the menu bar (macOS) or the taskbar notification area (Windows) lets you **show / hide** the pet, **bring it back on screen** (say it was dragged off-screen or you unplugged an external monitor), and **quit**.

After you quit the pet, it launches again with your next Claude Code / Codex session.

## Connect your own agent

The pet isn't tied to Claude Code or Codex. It runs a local HTTP server, and any agent that sends it lifecycle events while it works gets acted out.

### Step 1: launch the pet

Run this once when your agent starts. If the pet is already running it does nothing and returns immediately; the first run downloads Electron first.

```bash
node /path/to/agent-pet/plugin/scripts/launch.mjs
```

You can also run `npm start` in the repo's `app` directory. Once the pet is up, `GET http://127.0.0.1:23456/health` returns `{"ok":true}`.

### Step 2: send events

There are two ways to do it; pick either.

**Option 1: your agent already produces Claude Code–style hook JSON** (with `hook_event_name`, `session_id`, `tool_name`, `tool_input` and so on). Pipe that JSON to `emit.mjs` on stdin. It strips sensitive content, converts it to the pet's event format and sends it, and exits quietly if the pet isn't running.

```bash
echo '{"hook_event_name":"PreToolUse","session_id":"s1","cwd":"/my/project","tool_name":"Bash","tool_input":{"command":"npm test"}}' | node /path/to/agent-pet/plugin/scripts/emit.mjs
```

**Option 2: POST events directly** to `http://127.0.0.1:23456/event` with a JSON body:

```json
{
  "event": "PreToolUse",
  "session": "my-agent-run-42",
  "cwd": "/my/project",
  "tool": "Bash",
  "toolInput": { "command": "npm test", "description": "Run the tests" }
}
```

| Field | Required | Description |
|---|---|---|
| `event` | Yes | Event name; see the table below |
| `session` | No | Session id. Use the same value for one task. When several sessions run at once, the pet shows the most urgent one. Defaults to a single session called `default` |
| `cwd` | No | Working directory. When sessions are in different projects, the bubble is prefixed with the project name |
| `tool` | No | Tool name, which decides the bubble text while working (see below) |
| `toolInput` | No | `command`, `filePath`, `pattern`, `description`, all strings, used to build the bubble text. **Send short summaries only, never file contents or output** |
| `notificationType` | No | Used with the `Notification` event; see below |
| `errorType` | No | Used with the `StopFailure` event; the error reason shown in the bubble |

### Events and pet states

| `event` | What the pet does |
|---|---|
| `SessionStart` | Waves hello |
| `UserPromptSubmit` | Starts thinking |
| `PreToolUse` | Starts working (typing), with the current tool in the bubble |
| `PostToolUse` | Tool finished. If no new tool starts within 1.5 s it goes back to thinking, so back-to-back tool calls don't flicker |
| `PostToolUseFailure` | Tool failed: a brief moment of frustration, then back to thinking |
| `PermissionRequest` | Pleads for approval until the next `PostToolUse`, `Stop` or similar event |
| `Notification` | Pleads for approval when `notificationType` is `permission_prompt` or `agent_needs_input`; back to idle when it's `idle_prompt` |
| `SubagentStart` / `SubagentStop` | Sends out / takes back a subagent; stays in the working state while subagents run |
| `PreCompact` | Thinking (the bubble says it's tidying up context) |
| `Stop` | Turn done: collapses out of breath, finger heart, then idle |
| `StopFailure` | Turn failed: grabs its head, glows red, then idle |
| `Interrupt` | Interrupted by the user; straight back to idle |
| `SessionEnd` | Session over; removed from the pet's session list |

The simplest turn is `UserPromptSubmit` → some `PreToolUse` / `PostToolUse` pairs → `Stop`.

While working, the bubble depends on `tool`: `Bash` shows `description` or `command`; `Edit`, `Write` and `apply_patch` show the file name; `Read`, `Grep` and `Glob` show the file name or `pattern`; `WebFetch` and `WebSearch` show that it's looking things up; `mcp__server__tool` shows "🔌 server.tool"; any other tool shows "🛠 tool name". A `PreToolUse` whose `tool` is `AskUserQuestion` or `ExitPlanMode` counts as waiting for the user's answer.

A session with no events for 10 minutes is treated as ended (say the agent crashed), and when no session has had activity for 5 minutes the pet falls asleep.

### Examples

Simulate a full turn with curl:

```bash
for e in UserPromptSubmit PreToolUse PostToolUse Stop; do curl -s -X POST -d "{\"event\":\"$e\",\"session\":\"demo\",\"tool\":\"Bash\",\"toolInput\":{\"command\":\"npm test\"}}" http://127.0.0.1:23456/event; sleep 2; done
```

Node.js:

```js
const pet = (event, extra = {}) =>
  fetch('http://127.0.0.1:23456/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, session: 'my-agent', ...extra }),
  }).catch(() => {}); // ignore when the pet isn't running

await pet('UserPromptSubmit');
await pet('PreToolUse', { tool: 'Edit', toolInput: { filePath: 'src/app.ts' } });
await pet('PostToolUse', { tool: 'Edit' });
await pet('Stop');
```

Python:

```python
import json, urllib.request

def pet(event, **extra):
    body = json.dumps({"event": event, "session": "my-agent", **extra}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:23456/event", body, {"Content-Type": "application/json"}), timeout=0.5)
    except OSError:
        pass  # ignore when the pet isn't running

pet("PreToolUse", tool="Bash", toolInput={"command": "pytest"})
```

### Set the state directly, without lifecycle events

If your agent has no notion of tool calls, you can switch the pet's state directly:

```bash
curl -X POST -d '{"state":"working"}' http://127.0.0.1:23456/state
```

`state` is one of `greet`, `idle`, `thinking`, `working`, `permission`, `done`, `error`, `sleep`. It takes effect immediately, bypassing the session logic, but the next `/event` overrides it, so don't mix the two approaches.

### Notes

- **Only local programs can call it**, such as your agent's backend process, CLI or scripts. The pet rejects anything that looks like a browser request (an `Origin` or `Sec-Fetch-Site` header, or a `Host` other than `127.0.0.1` / `localhost`) so web pages can't control it. If your agent's UI is a web page or an Electron renderer, send events from the backend or main process.
- Request bodies are capped at 16 KB. Send asynchronously with a short timeout (`emit.mjs` uses 400 ms) and ignore errors when the pet isn't running, so it never slows your agent down.
- Change the port with the `AGENT_PET_PORT` environment variable; your agent and the pet must use the same value.
- To change the lines, motions or state logic: lines are in `app/src/renderer/pet/lines.ts`, the state-to-motion mapping is in `app/src/renderer/pet/clips.ts`, and the event-to-state logic is in `app/src/main/agent-sessions.cjs`. See [Development](#development).

## FAQ

**I installed it and started a new session, but no pet?**
The first launch downloads Electron, so give it a minute or two. Progress and errors are in the log:

- macOS: `$TMPDIR/agent-pet.log` (run `open $TMPDIR/agent-pet.log` in a terminal)
- Windows: `%TEMP%\agent-pet.log`

A `starting` line means it has launched. If the install failed (a network problem, say), it retries with your next session.

**It says `node` isn't found?**
Install [Node.js](https://nodejs.org) 20 or later, make sure `node -v` works in a terminal, then start a new session.

**Lost the pet?**
Tray icon → **Bring back on screen**.

**Port 23456 is taken by another program?**
Set the `AGENT_PET_PORT` environment variable to another port. Claude Code / Codex and the pet must use the same value; start a new session after changing it.

**Don't want it to launch with every session?**
Set `AGENT_PET_NO_LAUNCH=1`. Launch it by hand when you want it: run `npm start` in the repo's `app` directory.

**Reporting a problem?**
Set `AGENT_PET_DEBUG=1` and restart the pet; the log then records every agent event and the renderer log. Open an [issue](https://github.com/jinshuming/agent-pet/issues) with the log attached.

## Update and uninstall

**Update (Claude Code):**

```bash
claude plugin marketplace update agent-pet
```

```bash
claude plugin update agent-pet@agent-pet
```

Then quit the pet (tray → Quit) and start a new session. If the new version needs different dependencies, they're reinstalled automatically.

**Update (Codex):** quit the pet first (tray → Quit), then:

```bash
codex plugin marketplace upgrade agent-pet
```

```bash
codex plugin add agent-pet@agent-pet
```

Then start a new session and, if Codex asks, trust the updated hooks in `/hooks`. An upgrade replaces Codex's copy of the repo, so the first launch afterwards downloads Electron again (a minute or two). If you installed with the script, run `git pull` in the cloned directory instead.

**Uninstall (Claude Code):**

```bash
claude plugin uninstall agent-pet@agent-pet
```

```bash
claude plugin marketplace remove agent-pet
```

**Uninstall (Codex):**

```bash
codex plugin remove agent-pet@agent-pet
```

```bash
codex plugin marketplace remove agent-pet
```

If you installed with the script, run `node scripts/install-codex.mjs --uninstall` in the cloned directory instead, then delete the directory.

After uninstalling you can delete the `~/.agent-pet` folder; it only holds settings and the app location.

## Privacy

- Everything stays on your computer. The hooks only send the event name, session id, working directory, tool name, and a truncated command or file path, and only to `127.0.0.1`. **Your prompts, file contents and tool output never leave the hook.** There is no telemetry.
- The pet's local server only accepts requests from local programs and rejects anything from a web page.
- Claude Code hooks don't report two things: pressing Esc to interrupt, and denying permission. The pet learns about these by reading the session transcript locally (`app/src/main/transcript-tail.cjs`). It only reads lines added while the session is busy, only checks for those two markers, and saves nothing. Codex has its own `Interrupt` hook, so this isn't needed there.

## Development

```
plugin/    Claude Code plugin: hooks that forward lifecycle events (no npm dependencies); Codex reuses the same scripts
app/       Electron + PlayCanvas + @viggle/splat-engine desktop pet
scripts/   install-codex.mjs (script install for Codex; the plugin route reads plugin/.codex-plugin and plugin/hooks/codex-hooks.json)
docs/      Motion design: each motion's prompt, why that sample was picked, and the processing pipeline
```

```bash
cd app && npm install
```

```bash
npm run dev
```

`npm run dev` runs the pet on the Vite dev server with hot reload and turns on the `/debug/*` endpoints. To connect a Claude Code session to this checkout, run `claude --plugin-dir ./plugin` from the repo root.

- Users run the prebuilt renderer in `app/dist/` (it's committed, so users only need to install Electron). **If you change anything under `app/src/renderer/`, run `npm run build` and commit `dist/` along with it**, or CI fails.
- Newly generated PINOC motions must go through `npm run slim-clips`, which trims the skeleton to the 86 bones the characters use; CI checks this too. See [docs/motion-design.md](docs/motion-design.md).
- Event flow:

```
Claude Code / Codex hook (async) → plugin/scripts/emit.mjs → POST 127.0.0.1:23456/event
  → app/src/main/agent-sessions.cjs   one state per session, most urgent wins
  → renderer PetController            drag > permission/error > interaction reactions > agent state
  → SplatPetRenderer                  crossfades PINOC motions on the splat character
```

```bash
curl -s localhost:23456/debug/sessions
```

```bash
curl -X POST -d '{"state":"done"}' localhost:23456/state
```

The first shows each session's live state; the second forces a state.

| Environment variable | Effect |
|---|---|
| `AGENT_PET_PORT` | Change the port (default 23456; the agent and the pet must match) |
| `AGENT_PET_NO_LAUNCH=1` | Don't launch the pet when a session starts |
| `AGENT_PET_APP_DIR` | Make the launcher use a different app directory |
| `AGENT_PET_DEBUG=1` | Log every hook event and the renderer log, and turn on the read-only `/debug/stats` |

## Contributing

Issues and PRs are welcome: new lines, new motions, new characters, translations, support for more agents. Start with [CONTRIBUTING.md](CONTRIBUTING.md), which covers the dev workflow and how to submit a character.

## Credits and license

Characters and motions were made with [PINOC](https://viggle.ai/pinoc/app) and are rendered by [@viggle/splat-engine](https://www.npmjs.com/package/@viggle/splat-engine) (MIT) on [PlayCanvas](https://playcanvas.com).

The code is [MIT](LICENSE)-licensed. The character and motion files in `app/assets/` are licensed under [CC BY-NC 4.0](app/assets/LICENSE): free for non-commercial use, with attribution.

Satoru Gojo (*Jujutsu Kaisen*) and Miles Morales (Marvel's *Spider-Man*) are **unofficial fan works**. They are not affiliated with or endorsed by the original rights holders, who own all rights to those characters, and they are for non-commercial use only. If you are a rights holder and want one removed, please [open an issue](https://github.com/jinshuming/agent-pet/issues) and we'll take care of it promptly.
