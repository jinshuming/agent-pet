# Motion design

The pet is an idol who works alongside you in a coding agent. When the agent is busy he types frantically, and if you poke him mid-task he gets impatient. When the job is done he is out of breath, hands on hips. The state and reaction tables live in `app/src/renderer/pet/clips.ts`, and the speech-bubble lines live in `lines.ts`.

## Pipeline for a new clip

1. **Generate it with PINOC `generate_motion`**, with `rewritePrompt: false` so the constraints below survive. Every prompt ends with: *"Feet planted in place, facing forward. Start and end in the same pose so it loops seamlessly."* For one-shot clips, the ending instead reads *"…in a neutral standing pose."*
2. **Download all 4 samples** (metahuman-glb) and score them with
   `node app/scripts/score-clips.mjs app/assets/motions/idle.glb <samples>.glb`.
   It reports pelvis drift, loop seam, crossfade distance to idle, and arm energy.
3. **Copy the pick into `app/assets/motions/`**, then run
   `node app/scripts/fix-clip-facing.mjs app/assets/motions/<clip>.glb`.
   Generated clips face away from the camera. The script turns the pelvis track 180°. Only run it on generated clips, because a library clip can fool its heuristic (it flipped `nod.glb` once).
4. **Restart the app, don't hot-reload.** Vite only serves public files that existed when it started. A clip requested before its file existed gets cached as HTML in splat-engine's CacheStorage, and dev startup now clears that cache.

Loops don't need a perfect seam. The renderer crossfades each loop back into its own first frame.

## P0 (generated 2026-09-23, 30 credits)

| Clip file | State / reaction | Sample | Why |
|---|---|---|---|
| `work-typing.glb` | working | Frantic Typing (1) | Most frantic arms (178°/s). 15° seam, hidden by the crossfade loop |
| `work-interrupted.glb` | click while busy | Annoyed Interruption (2) | Most expressive "wait" |
| `done-exhausted.glb` | done | Exhausted Sprint Recovery (2) | Least drift, visible sweat-wipe |
| `think.glb` | thinking | Thoughtful Pose (1) | Least drift, 6° seam |
| `permission-plead.glb` | permission | Eager Wave Plea (4) | Least drift, bouncy |
| `error-frustrated.glb` | error | Frustrated Try Again (2) | 5.9 cm drift, clean end pose |

## Prompts

**work_typing (loop, 6s)**: A person standing and typing frantically on an invisible keyboard held at waist height in front of them. The upper body leans slightly forward with shoulders hunched, elbows bent at about 90 degrees, and both hands and all fingers hammer rapidly and unevenly like a speed typist racing a deadline. The head bobs with the rhythm and the eyes stay locked forward on an imaginary screen. About every two seconds the right hand lifts high and slams down hard on the enter key, then the fast typing immediately resumes. Feet stay planted in place facing forward, no walking or turning. Start and end in the same typing pose so the clip loops seamlessly.

**work_interrupted (one-shot, 3s)**: A person busy typing on an invisible keyboard at waist height gets interrupted. They stop typing, turn their head and shoulders toward the viewer with a slightly annoyed frown, raise one open palm toward the viewer in a firm "wait a moment" gesture, give two small quick shakes of the head, let out a short exaggerated sigh with a visible shoulder drop, then turn back and immediately resume typing fast. Stay in place with feet planted, facing forward. Start and end in the same typing pose.

**done_exhausted (one-shot, 6s)**: A person who just finished an exhausting sprint. Their arms drop, they bend forward at the waist and put both hands on their hips, chest and shoulders heaving with big deep breaths, head hanging down. After a few heavy breaths they lift one hand to wipe sweat off the forehead with the back of the wrist, then slowly straighten up while still breathing hard with both hands on the hips, and give a small relieved nod toward the viewer. Feet planted in place, facing forward. Ends standing upright with hands on hips.

**think (loop, 6s)**: A person standing and thinking hard. The right hand rests on the chin with that elbow supported by the left forearm folded across the chest. The head tilts slowly from one side to the other, eyes glancing upward as if searching for an idea, the index finger occasionally taps the chin, and the weight shifts gently from foot to foot. Calm, subtle movement, feet planted in place facing forward. Start and end in the same pose so it loops seamlessly.

**permission_plead (loop, 5s)**: A person trying to get the viewer's attention, eager but polite. They look straight at the viewer, raise one hand high and wave it side to side, then bring both palms together in front of the chest in a pleading "please" gesture with a small bow and a hopeful head tilt, then point toward the viewer twice with a little bounce. Cute and bouncy, feet planted in place facing forward. Start and end in the same pose so it loops seamlessly.

**error_frustrated (one-shot, 4s)**: A person reacting to a sudden failure. They freeze for a beat, grab their head with both hands in frustration and lean back with a silent groan, then drop into a quick facepalm with the right hand. Then they shake it off by rolling their shoulders and pushing up both sleeves with determination, ready to try again. Feet planted in place, facing forward. Start and end in a neutral standing pose.

## Idle life (generated 2026-09-23, 17 credits)

The idle state plays a breathing loop. Every 15–35 s (`IDLE_FIDGET_MS`) a random fidget from `IDLE_FIDGETS` plays once, sometimes with a line, and then he goes back to breathing. A click, a drag, or any agent state change cancels it.

| Clip file | Use | Sample | Why |
|---|---|---|---|
| `idle-breathe.glb` | idle loop | Calm Breathing (1) | Both clavicles rise about 7° together, so it reads as breathing (the old idle moves about 1°). Seam 5.8° |
| `idle-fix-hair.glb` | fidget | Pop Idol Pose (3) | 1.7 cm drift |
| `idle-stretch.glb` | fidget | Idle Stretch Glance (4) | Lively arms, 6.5 cm drift |

The prompts:

**idle_breathe (loop, 8s)**: A relaxed person standing still and breathing calmly but visibly. With each slow deep breath the chest clearly rises and expands and the shoulders lift slightly, then both sink back down as they exhale, about one full breath every three to four seconds. Arms hang loosely at the sides and sway very slightly with the breathing. The weight shifts gently and slowly from one foot to the other, the head makes small natural micro-movements and tilts a little as if glancing at the viewer. Soft, alive, subtle, never frozen. Feet planted in place facing forward, no walking or turning. Start and end in the same pose so it loops seamlessly.

**idle_fix_hair (one-shot, 4s)**: A person standing idle casually fixes their appearance like a pop idol before going on stage: runs one hand through the hair from front to back, then tugs down both sides of the jacket to straighten it and gives one small satisfied nod toward the viewer. Relaxed and confident, feet planted in place facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

**idle_stretch (one-shot, 5s)**: A person standing idle takes a short break: stretches both arms up overhead with interlaced fingers and leans slightly to one side, lowers the arms, rolls the shoulders once, then glances curiously to the left and to the right before looking back at the viewer. Relaxed and easygoing, feet planted in place facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

Older clips in the PINOC library (Casual Idle, Phone Photo, Finger Snap) have no metahuman-glb download (the CDN returns 404/403), so the pet can't use them.

## P1 (generated 2026-09-23, 25 credits)

| Clip file | State / reaction | Sample | Why |
|---|---|---|---|
| `greet.glb` | greet (app start, new/resumed session) | Idol Greeting (1) | Least drift (8.9 cm), liveliest arms |
| `done-proud.glb` | done, after `done-exhausted` | Finger Heart Pose (2) | Least drift. All four start ~20° from the end of exhausted; the crossfade covers it |
| `react-headpat.glb` | click on the head | Head Pat Reaction (4) | Least drift (4.6 cm) |
| `react-poke.glb` | click on the body | Tickle Defense (3) | Most startled (196°/s arms) |
| `react-pose.glb` | double click | Pop Idol Pose (2) | Least drift, liveliest |
| `react-bigheart.glb` | triple click | Heart Arms (1) | Least drift (9 cm) |
| `sleep-doze.glb` | sleep loop | Standing Nod Off (2) | Smallest seam (2.3°) and bob |

**greet (one-shot, 4s)**: A cheerful person greets the viewer like a pop idol meeting fans. They look straight at the viewer, raise the right hand high and wave it side to side energetically three times with a bright bounce, then bring the hand down in front of the chest and cross the thumb and index finger into a small finger heart held toward the viewer, with a playful head tilt and a quick little shoulder shrug. Then they lower the hand. Feet planted in place, facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

**done_proud (one-shot, 4s)**: A person who has just caught their breath after hard work, standing upright with both hands on their hips. They take one last deep satisfied breath, then proudly lift the chin, bring the right hand up in front of the chest and cross the thumb and index finger into a finger heart pointed at the viewer, with a confident little nod and a slight lean forward. Then they lower the hand to the side. Feet planted in place, facing forward. Start standing upright with both hands on the hips, end in a relaxed neutral standing pose with arms at the sides.

**react_headpat (one-shot, 3s)**: A person being patted on the top of the head. They hunch the shoulders up a little and duck the head slightly as if a hand is resting on it, close in with a shy happy squirm, the head tilting gently side to side under the pat, hands clasped loosely in front of the body, then they straighten up and look up at the viewer with a small pleased nod. Feet planted in place, facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

**react_poke (one-shot, 2s)**: A person gets poked in the side of the belly. They flinch with a quick ticklish jolt, twist the upper body away and pull both elbows in to protect the side, then turn back to the viewer, put one hand on the hip and wag the index finger of the other hand in a playful "hey, stop that" gesture. Feet planted in place, facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

**react_pose (one-shot, 3s)**: A person strikes a cute pose for a photo like a pop idol. They quickly raise the right hand beside the face in a V sign with index and middle fingers, tilt the head toward the hand, lean the upper body slightly to the side and put the left hand on the hip, hold the pose for a beat facing the viewer as if a camera just clicked, then relax and lower both hands. Feet planted in place, facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

**react_bigheart (one-shot, 3s)**: A delighted person makes a big heart for the viewer. They raise both arms overhead and curve them so the fingertips touch on top of the head, forming a large heart shape with the arms, sway the upper body happily from side to side while holding it, then bring the arms down. Feet planted in place, facing forward. Start and end in a relaxed neutral standing pose with arms at the sides.

**sleep_doze (loop, 6s)**: A person dozing off while standing. The arms hang loosely, the shoulders slump, and the head slowly droops forward as they nod off, then jerks gently back up for a moment before sinking down again. Breathing is slow and deep, the body sways very slightly, drowsy and limp. Feet planted in place facing forward, no walking or turning. Start and end in the same drooping pose so it loops seamlessly.

## Spin game (generated 2026-09-23, 6 credits)

⌥-drag sideways, or swipe two fingers sideways on the trackpad, and he spins with momentum. Every turn fills a dizziness meter that drains over time (`main.ts`). If it reaches `DIZZY_TURNS` (3) when he stops, he plays `react-dizzy.glb` while the renderer tips his whole body about the feet in wandering circles that shrink to nothing over `DIZZY_SWAY_MS`, so he wobbles, nearly falls, and steadies.

The pick is Dizzy Recovery (4). Staggering drifts all four samples 30–60 cm, so it was chosen on where it *ends*: 10 cm from its start (the others end 26–53 cm away and would slide back during the crossfade out).

**react_dizzy (one-shot, 6s)**: A person who was just spun around many times is extremely dizzy. They sway and wobble unsteadily in place, knees buckling slightly, the head rolling in slow loose circles, both arms drifting out to the sides to keep balance. They stagger with small unsteady shuffle steps but stay roughly on the same spot, nearly tip over to one side and catch themselves, then press one hand to the forehead and shake the head to clear it. Gradually the swaying gets smaller and smaller as they regain their balance, straighten up, take a deep breath and steady themselves. Facing forward. End in a relaxed neutral standing pose with arms at the sides.

## Landing

`react-land.glb` uses the PINOC library's **Hard Landing** clip for the ordinary drop reaction. It replaces the previous `hitFront` fallback, which read as being struck rather than safely landing.

## Picked up / airborne

`drag-flail.glb` is the fourth PINOC **Airborne Flail** sample generated on 2026-09-23. It was selected from four five-second candidates for its low loop seam (15.4°), low vertical drift (4.1 cm), and high arm energy (43°/s), then turned 180° with `fix-clip-facing.mjs` to face the pet camera. It drives both the drag and flying states.

## Resting (generated 2026-09-24, 25 credits)

Left alone (no click, drag, spin or right-click, and the agent idle or asleep) for `REST_MS.sit` (3 min), he walks to the nearer side of the screen and sits with his back to it, turned `SIT_YAW_DEG` toward you. At `REST_MS.sleep` (8 min) he nods off and sleeps there. Touching him, or the agent getting busy, makes him stand up (`Controller.wake`). Right-click → 模拟互动 → 休息 skips the wait.

The walk is the library Walking clip with its travel removed by `scripts/make-in-place.mjs`; main moves the window at the clip's own 1.552 m/s so the feet don't slide. The seated clips were generated "with a wall behind"; the renderer turns him so that wall is the screen edge.

| Clip file | Use | Sample | Why |
|---|---|---|---|
| `sit-down.glb` | stand → floor | Sit Down Floor (2) | Pelvis ends at 0.07 m, matching the seated loops. The first try (Wall Sit Sigh) read "slide down the wall" as a wall squat and stopped at 0.55 m. Travel removed with make-in-place |
| `sit-idle.glb` | seated loop | Relaxed Seated Recline (4) | Least drift (1.4 cm), 5.5° seam |
| `sit-doze.glb` | nodding off | Sleepy Head Nod (3) | Least drift, best hand-over into the sleep loop |
| `sit-sleep.glb` | asleep loop | Seated Sleep (2) | 3° seam |
| `stand-up.glb` | floor → stand | Floor Sit Up (3) | Best hand-over from sitting. 46 cm of forward travel removed with make-in-place |

`scripts/face-forward.mjs` measures a clip's heading from the pelvis twist and can turn it by any angle; these clips turned out to need nothing beyond `fix-clip-facing`.

## Hanging stamina (generated 2026-09-24, 14 credits)

He hangs like a person tiring out (`HANG` in `clips.ts`, state machine in `Controller.hangTick`): both hands for 15 s, then one hand slips (`hangLoseGrip`) and he dangles from the other (`hangOneArm`) for 6–9 s, then drops. A slow poke makes him fight it off (`hangStruggle` with two hands, `hangSlip` with one) and costs 2.5 s of grip; 4 clicks within 1.2 s knock him straight off. The renderer pins his higher hand to the top edge every frame, so any hanging clip lines up. If a file is missing, `CLIP_FALLBACK` plays the two-handed `hang.glb` in its place.

| Clip file | Use | Sample | Why |
|---|---|---|---|
| `hang-lose-grip.glb` | both hands → one | Hanging Slip Panic (4) | All four One-Hand Hang Slip samples kept both hands on the ledge (start and end 3° apart). The slip clip is exactly the moment a hand lets go: jolt, flail, settle on one hand. Liveliest of the one-armed slips |
| `hang-one-arm.glb` | one-armed loop | Hanging Pendulum (4) | 6° seam, least drift |
| `hang-struggle.glb` | poked, two hands | Annoyed Hang Ledge (1) | 3° seam, both hands stay up, strongest kicks |
| `hang-one-arm-slip.glb` | poked, one hand | Hanging Slip Panic (3) | Closest to the one-armed loop (14° either way) |

The prompts:

**hang-lose-grip.glb (one-shot, 3s)**: A person hanging from a high ledge above them with both hands gripping overhead, arms fully extended, feet dangling in the air. Their arms start to tremble with fatigue and they grimace, then the left hand slips off the ledge, the body drops slightly and swings and twists, the free left arm flails once and then dangles at the side, ending hanging by the right hand only with the right arm fully extended overhead. Facing forward, no climbing, feet never touch the ground. Start hanging by both hands, end hanging by the right hand only.

**hang-one-arm.glb (loop, 6s)**: An exhausted person hanging from a high ledge above them by the right hand only, right arm fully extended overhead, feet dangling in the air. The body swings slowly side to side like a pendulum, the free left arm dangles and every few seconds reaches up straining to regrab the ledge but falls back short, the legs kick weakly and dangle, the head tilts with effort and strain. Facing forward, no climbing, feet never touch the ground. Start and end in the same pose hanging by the right hand so it loops seamlessly.

**hang-struggle.glb (one-shot, 3s)**: A person hanging from a high ledge above them with both hands gripping overhead, arms fully extended, feet dangling in the air, gets poked and resists. Annoyed, they kick both legs wildly and swing the whole body side to side, twisting the hips to shake off whoever is poking them, while both hands keep gripping the ledge, then they settle back to hanging still. Facing forward, no climbing, feet never touch the ground. Start and end hanging still with both hands overhead.

**hang-one-arm-slip.glb (one-shot, 2s)**: A tired person hanging from a high ledge above them by the right hand only, right arm fully extended overhead, feet dangling, gets poked. Their grip slips a little and the body jolts down and swings wildly, the free left arm flails and grabs at the air in panic, the legs kick frantically, then they settle back to hanging by the right hand, panting. Facing forward, no climbing, feet never touch the ground. Start and end hanging by the right hand only.

## Slimming clips to the character rig (2026-09-24)

PINOC's metahuman-glb skins all 441 MetaHuman joints, and splat-engine sizes a clip by its skin: every joint gets a keyframe object per frame in the JS heap, and at play time the clip is filtered down to the characters' 86-bone rig anyway. `npm run slim-clips` (`scripts/slim-clips.mjs`) re-skins each clip to exactly those 86 bones (all their parents are inside the set) and drops the other channels, leaving the node hierarchy alone. The kept channels are bit-identical and splat-engine rebuilds the same keyframes from them, so poses don't change; the JS heap went from 1.2 GB to 0.29 GB, the clips from 33 MB to 7.5 MB, and the renderer's CPU at 60 fps from ~40% to ~10% of a core. Run it on every new clip (CI checks).

Library clips no state or reaction used any more (wave, cheer, clap, nod, jump, head-hit, hit-front, crouch, point, and the travelling walk that walk-in-place is made from) were removed; each cost about 7 MB of heap.

## Acting out the agent (generated 2026-09-24, 83 credits)

What the pet does while the agent works now depends on the kind of work, and idle time has a shape:

- **Gaze.** The head turns toward the cursor on top of any clip (`SplatPetRenderer.setLook` wraps the armature's post-pose step and turns spine_05 / neck_01 / neck_02 / head). The body follows more slowly (`stepGaze` in `main.ts`). `PetController.gaze` sets how much, per state: full and fast while waiting on you, a glance while working, eyes wandering when the cursor sits still and he has nothing to do.
- **A new task** (idle/sleep/done → thinking or working) plays `accept` first.
- **Thinking** rotates `think` / `thinkScratch` / `thinkCount` every 9–15 s.
- **Working** plays a clip per tool kind (`ACTIVITY_CLIPS`, from `toolActivity` in `agent-sessions.cjs`): edit → typing, read → `read`, search/web → `search`, Bash/MCP → `run`, subagents → `dispatch` then `supervise`, compaction → `tidy`. A motion plays at least 2.5 s (`BUSY_DWELL_MS`) before the next tool may change it.
- **Subagents** show as chips beside him (`pet/team.ts`), each with what it is doing; when one finishes he nods (`report`).
- **Waiting on you** escalates (`PERMISSION_STAGES`): `plead`, then `urgent` at 12 s, `knock` at 35 s, then alternating. The bubble turns red and shows the question.
- **Boredom** (`BOREDOM`): fix hair / stretch at first, scratching and pebble-kicking after 40 s, yawning / checking the watch / foot-tapping after 100 s, and after 3 minutes he goes to sit against a wall. Once every agent is asleep (`sleep`), he yawns and does it within 30 s and nods off after 60 s (`REST_SLEEPY_MS`); the old standing doze is no longer used.

| Clip file | Use | Sample | Why |
|---|---|---|---|
| `idle-scratch-head.glb` | bored fidget | Head Scratch (4) | Least drift (4.2 cm), liveliest |
| `idle-scratch-itch.glb` | bored fidget | Itch Scratch Shrug (2) | Least drift, liveliest arms |
| `idle-kick-pebble.glb` | bored fidget | Idle Pebble Kick (1) | Least drift (7.8 cm) |
| `idle-yawn.glb` | very bored; `sleep` state | Bored Yawn Stretch (4) | Least drift, only one that ends near its start (3.5°) |
| `idle-check-watch.glb` | very bored | Impatient Wait (4) | Low drift |
| `idle-tap-foot.glb` | very bored | Bored Wait (4) | 1.7° seam; make-in-place removed its travel |
| `task-accept.glb` | new task | Eager Work Prep (2) | Least drift (1.7 cm) |
| `think-scratch.glb` | thinking variation | Puzzled Thought (3) | Least drift, 6.5° seam |
| `think-count.glb` | thinking variation | Counting Plan (2) | Low drift, 8° seam (sample 3 had 23°) |
| `work-read.glb` | Read | Reading Scroll (1) | 2.1 cm drift, 2.3° seam |
| `work-search.glb` | Grep/Glob/web | Scan for Object (1) | Least drift |
| `work-run.glb` | Bash/MCP | Machine Operator (3) | Least drift, 5° seam |
| `work-tidy.glb` | compaction | Tidy Organize (3) | Best seam (9.5°); make-in-place |
| `agent-dispatch.glb` | subagents go out | Team Leader Send-off (1) | Least drift, liveliest |
| `agent-supervise.glb` | subagents working | Supervising Scan (2) | 3 cm drift, 2.8° seam |
| `agent-report.glb` | a subagent reports back | library Nod Yes | Free. It faced 106° off: `face-forward.mjs` turned it |
| `permission-urgent.glb` | waiting 12 s+ | Urgent Call Out (3) | Bouncy (arms 212°/s); make-in-place removed 12 cm of travel |
| `permission-knock.glb` | waiting 35 s+ | Window Knock Plea (1) | Least drift, 5° seam |

Each prompt ends with the usual *"Feet planted in place, facing forward"* plus either *"Start and end in the same pose so it loops seamlessly"* (loops) or *"Start and end in a relaxed neutral standing pose with arms at the sides"* (one-shots). The movement parts:

- **idle-scratch-head (one-shot, 4s)**: raises the right hand and slowly scratches the back of the head, head tilting with a sheepish, puzzled glance around, lowers the hand with a small sigh.
- **idle-scratch-itch (one-shot, 4s)**: reaches over the right shoulder to scratch the middle of the back, wriggling, then scratches the left forearm, a satisfied shrug.
- **idle-kick-pebble (one-shot, 4s)**: looks down and idly kicks a small invisible pebble twice, watches it roll away, looks back up with a shrug.
- **idle-yawn (one-shot, 5s)**: a big slow yawn, head back, right hand over the mouth, left arm stretching out, then rubs one eye and looks back drowsily.
- **idle-check-watch (one-shot, 4s)**: checks an invisible wristwatch, taps it twice, sighs, then shrugs at the viewer palms up ("anything for me to do?").
- **idle-tap-foot (one-shot, 6s)**: arms crossed, taps the right toe in a steady rhythm, head tilting, eyes wandering, a long sigh, unfolds the arms.
- **task-accept (one-shot, 3s)**: perks up, one firm nod toward the viewer, claps once, pushes up both sleeves and rubs the palms together eagerly.
- **think-scratch (loop, 6s)**: slowly scratches the side of the head with a furrowed brow, rubs the chin, head tilting, eyes up and to the side, a small hopeful nod.
- **think-count (loop, 6s)**: looks slightly up, counts off points on the left hand's fingers with the right index finger, nodding at each, pauses to think.
- **work-read (loop, 6s)**: holds an invisible tablet at chest height, head down, tracking the lines; every two seconds swipes up to scroll, a small focused nod.
- **work-search (loop, 5s)**: leans forward with a hand over the eyes like a visor, scans left and right, leans in and points at something, back to scanning.
- **work-run (loop, 6s)**: presses a big invisible button, folds the arms and watches intently, nodding along with small impatient weight shifts, presses it again.
- **work-tidy (loop, 5s)**: gathers invisible papers from both sides, taps the stack square on an invisible table, sets it aside, brushes off the hands.
- **agent-dispatch (one-shot, 4s)**: points forward decisively, sweeps the arm left and right assigning directions, claps twice, thumbs up toward the viewer.
- **agent-supervise (loop, 6s)**: hands on hips, turns head and shoulders slowly left, centre, right as if checking on workers, approving nods, now and then points or waves.
- **permission-urgent (loop, 5s)**: looks straight at the viewer, waves both arms high over the head in big crossing motions, bouncing, cups the hands around the mouth to call out.
- **permission-knock (loop, 4s)**: leans toward the viewer and knocks on the glass three times, presses both palms flat against it and peers in pleadingly, points at the viewer.
