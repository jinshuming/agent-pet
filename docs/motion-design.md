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
