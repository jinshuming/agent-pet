// Motion clips (PINOC, metahuman-glb) and what each pet state plays.
// Library clips are free; the `*` ones were generated for this pet (see docs/motion-design.md).

export const CLIP_FILES = {
  idle: 'motions/idle.glb',
  hang: 'motions/hang.glb',
  // * generated (P0)
  typing: 'motions/work-typing.glb',
  interrupted: 'motions/work-interrupted.glb',
  exhausted: 'motions/done-exhausted.glb',
  think: 'motions/think.glb',
  plead: 'motions/permission-plead.glb',
  frustrated: 'motions/error-frustrated.glb',
  // * generated (idle life)
  breathe: 'motions/idle-breathe.glb',
  fidgetHair: 'motions/idle-fix-hair.glb',
  fidgetStretch: 'motions/idle-stretch.glb',
  // * generated (P1)
  greet: 'motions/greet.glb',
  proud: 'motions/done-proud.glb',
  headpat: 'motions/react-headpat.glb',
  pokeBack: 'motions/react-poke.glb',
  pose: 'motions/react-pose.glb',
  bigHeart: 'motions/react-bigheart.glb',
  land: 'motions/react-land.glb',
  doze: 'motions/sleep-doze.glb',
  // * generated (spin game)
  dizzy: 'motions/react-dizzy.glb',
  // * generated (leaning on a side of the screen). "right" = the wall is the screen's
  // right edge, so he leans on his left shoulder (he faces the viewer); "left" mirrors it.
  leanInRight: 'motions/lean-in-right.glb',
  leanRight: 'motions/lean-right.glb',
  leanInLeft: 'motions/lean-in-left.glb',
  leanLeft: 'motions/lean-left.glb',
  // * generated (picked up / in the air)
  flail: 'motions/drag-flail.glb',
  // * generated (hanging from the top of the screen, getting tired)
  hangLoseGrip: 'motions/hang-lose-grip.glb',
  hangOneArm: 'motions/hang-one-arm.glb',
  hangStruggle: 'motions/hang-struggle.glb',
  hangSlip: 'motions/hang-one-arm-slip.glb',
  // * resting (left alone): walk to a side of the screen, sit against it, nod off.
  // Generated with the wall behind him; the renderer turns him so his back is to the screen edge.
  walk: 'motions/walk-in-place.glb', // library Walking with its travel removed (scripts/make-in-place.mjs)
  sitDown: 'motions/sit-down.glb',
  sitIdle: 'motions/sit-idle.glb',
  sitDoze: 'motions/sit-doze.glb',
  sitSleep: 'motions/sit-sleep.glb',
  standUp: 'motions/stand-up.glb',
  // * generated (bored while idle: the longer nobody gives him work, the more he fidgets)
  scratchHead: 'motions/idle-scratch-head.glb',
  scratchItch: 'motions/idle-scratch-itch.glb',
  kickPebble: 'motions/idle-kick-pebble.glb',
  yawn: 'motions/idle-yawn.glb',
  checkWatch: 'motions/idle-check-watch.glb',
  tapFoot: 'motions/idle-tap-foot.glb',
  // * generated (acting out the agent's work)
  accept: 'motions/task-accept.glb',
  thinkScratch: 'motions/think-scratch.glb',
  thinkCount: 'motions/think-count.glb',
  read: 'motions/work-read.glb',
  search: 'motions/work-search.glb',
  run: 'motions/work-run.glb',
  tidy: 'motions/work-tidy.glb',
  dispatch: 'motions/agent-dispatch.glb',
  supervise: 'motions/agent-supervise.glb',
  report: 'motions/agent-report.glb', // library Nod Yes
  // * generated (waiting on you, more and more insistently)
  urgent: 'motions/permission-urgent.glb',
  knock: 'motions/permission-knock.glb',
  // Game mode (library clips): Running and the air / landing parts of Jump, all in place.
  gameRun: 'motions/game-run.glb',
  gameJump: 'motions/game-jump.glb',
  gameLand: 'motions/game-land.glb',
  gameCrouch: 'motions/game-crouch.glb',
} as const;

export type ClipName = keyof typeof CLIP_FILES;

/** Right-click "预览单个动作" labels; ✨ marks clips generated for this pet. */
export const CLIP_LABELS: Record<ClipName, string> = {
  idle: '站立待机',
  hang: '挂在屏幕顶上',
  typing: '✨ 疯狂敲键盘',
  interrupted: '✨ 被打扰·等一下',
  exhausted: '✨ 撑腰喘气',
  think: '✨ 托腮思考',
  plead: '✨ 求批准',
  frustrated: '✨ 抱头翻车',
  breathe: '✨ 呼吸待机',
  fidgetHair: '✨ 整理发型',
  fidgetStretch: '✨ 伸懒腰张望',
  greet: '✨ 挥手比心',
  proud: '✨ 得意比心',
  headpat: '✨ 被摸头害羞',
  pokeBack: '✨ 被戳怕痒',
  pose: '✨ 比耶拍照',
  bigHeart: '✨ 头顶比大心',
  land: '落地缓冲',
  doze: '✨ 站着打瞌睡',
  dizzy: '✨ 转晕了站不稳',
  leanInRight: '✨ 靠上右边的墙',
  leanRight: '✨ 靠右墙耍酷',
  leanInLeft: '✨ 靠上左边的墙',
  leanLeft: '✨ 靠左墙耍酷',
  flail: '✨ 被拎起来乱蹬',
  hangLoseGrip: '✨ 手滑·剩一只手',
  hangOneArm: '✨ 单臂吊着摇晃',
  hangStruggle: '✨ 挂着被戳·乱蹬反抗',
  hangSlip: '✨ 单臂被戳·打滑乱抓',
  walk: '原地走',
  sitDown: '✨ 靠墙滑坐下',
  sitIdle: '✨ 靠墙坐着',
  sitDoze: '✨ 坐着犯困',
  sitSleep: '✨ 靠墙睡着',
  standUp: '✨ 靠墙站起来',
  scratchHead: '✨ 无聊挠头',
  scratchItch: '✨ 挠痒痒',
  kickPebble: '✨ 踢小石子',
  yawn: '✨ 打哈欠',
  checkWatch: '✨ 看表·有活吗',
  tapFoot: '✨ 抱臂抖腿',
  accept: '✨ 接到任务·撸袖子',
  thinkScratch: '✨ 挠头苦想',
  thinkCount: '✨ 掰手指列计划',
  read: '✨ 读文件',
  search: '✨ 手搭凉棚找东西',
  run: '✨ 按按钮·盯着跑',
  tidy: '✨ 整理文件',
  dispatch: '✨ 派出子 Agent',
  supervise: '✨ 叉腰看团队干活',
  report: '点头·收到汇报',
  urgent: '✨ 挥手喊你',
  knock: '✨ 敲屏幕',
  gameRun: '游戏：原地跑',
  gameJump: '游戏：起跳腾空',
  gameLand: '游戏：落地',
  gameCrouch: '游戏：蹲下',
};

/**
 * One step of a motion sequence. Non-looping steps advance when the clip finishes.
 * `fade`: crossfade into it, in seconds (default 0.25; game mode's jump needs quicker).
 */
export type Step = { clip: ClipName; loop: boolean; fade?: number };

export type AgentState = 'greet' | 'idle' | 'thinking' | 'working' | 'permission' | 'done' | 'error' | 'sleep';

/** What kind of work the agent is doing (from the tool it runs; see toolActivity in agent-sessions.cjs). */
export type Activity = 'edit' | 'read' | 'search' | 'run' | 'web' | 'agent' | 'mcp' | 'other' | 'tidy';

/** Working, acted out by kind of tool: typing for edits, a tablet for reads, scanning for searches… */
export const ACTIVITY_CLIPS: Record<Activity, ClipName> = {
  edit: 'typing',
  read: 'read',
  search: 'search',
  web: 'search',
  run: 'run',
  mcp: 'run',
  agent: 'supervise', // after sending them off with `dispatch`
  tidy: 'tidy', // compacting the context
  other: 'typing',
};
/** Thinking for a while: he switches between ways of thinking every THINK_VARY_MS. */
export const THINK_CLIPS: ClipName[] = ['think', 'thinkScratch', 'thinkCount'];
export const THINK_VARY_MS = { min: 9_000, max: 15_000 };
/** A busy motion plays at least this long before the next tool may change it (tools come in bursts). */
export const BUSY_DWELL_MS = 2_500;

/**
 * Waiting on you (a permission prompt or a question): polite at first, then waving,
 * then knocking on the screen. After the last stage he alternates the last two.
 */
export const PERMISSION_STAGES: { afterMs: number; clip: ClipName }[] = [
  { afterMs: 0, clip: 'plead' },
  { afterMs: 12_000, clip: 'urgent' },
  { afterMs: 35_000, clip: 'knock' },
];
export const PERMISSION_ALTERNATE_MS = 14_000;

/** States in which the pet is "busy": clicks get the impatient "wait a moment" reaction. */
export const BUSY: ReadonlySet<AgentState> = new Set(['thinking', 'working']);

/**
 * Agent state → motion sequence. A sequence whose last step does not loop is
 * transient: when it finishes the pet settles into whatever the main process says.
 */
export const AGENT_SEQUENCES: Record<AgentState, Step[]> = {
  // App start and a new/resumed Claude Code session.
  greet: [{ clip: 'greet', loop: false }],
  // Breathing loop; `idle` (the still library pose) remains the fallback and framing pose.
  idle: [{ clip: 'breathe', loop: true }],
  thinking: [{ clip: 'think', loop: true }],
  working: [{ clip: 'typing', loop: true }],
  permission: [{ clip: 'plead', loop: true }],
  // Pant first, then show off. Keep FLASH_MS.done in agent-sessions.cjs longer than both.
  done: [
    { clip: 'exhausted', loop: false },
    { clip: 'proud', loop: false },
  ],
  error: [{ clip: 'frustrated', loop: false }],
  // Every session quiet for SLEEP_AFTER_MS: a yawn, then he goes off to nap against a wall (REST_SLEEPY_MS).
  sleep: [
    { clip: 'yawn', loop: false },
    { clip: 'breathe', loop: true },
  ],
};

export type Reaction = 'busyPoke' | 'headPat' | 'poke' | 'doubleClick' | 'petted' | 'drop' | 'dizzy';

/** Right-click "模拟互动" labels. */
export const REACTION_LABELS: Record<Reaction, string> = {
  busyPoke: '忙碌时点他（不耐烦）',
  headPat: '摸头',
  poke: '戳身体',
  doubleClick: '双击',
  petted: '连点三下',
  drop: '拖拽后放下',
  dizzy: '转圈转晕',
};

export const REACTION_SEQUENCES: Record<Reaction, Step[]> = {
  busyPoke: [{ clip: 'interrupted', loop: false }],
  headPat: [{ clip: 'headpat', loop: false }],
  poke: [{ clip: 'pokeBack', loop: false }],
  doubleClick: [{ clip: 'pose', loop: false }],
  petted: [{ clip: 'bigHeart', loop: false }],
  // A proper landing reaction; the previous hitFront fallback read as being struck.
  drop: [{ clip: 'land', loop: false }],
  // Spun round DIZZY_TURNS times. The renderer adds a fading body sway on top (see main.ts).
  dizzy: [{ clip: 'dizzy', loop: false }],
};

/** Picked up or in the air: feet off the ground, arms flung wide, panicking. */
export const DRAG_SEQUENCE: Step[] = [{ clip: 'flail', loop: true }];
/** Only once he has caught the top edge of the screen: arms up, hanging. */
export const HANG_SEQUENCE: Step[] = [{ clip: 'hang', loop: true }];

/**
 * Hanging wears him out like a person: both hands for `twoHandMs`, then one hand
 * slips and he dangles from the other for `oneArmMs`, then he drops. Every slow
 * poke makes him struggle, which costs `pokeCostMs` of grip; `fastClicks` clicks
 * within `fastWindowMs` knock him straight off.
 */
export const HANG = {
  twoHandMs: 15_000,
  oneArmMs: { min: 6_000, max: 9_000 },
  pokeCostMs: 2_500,
  fastClicks: 4,
  fastWindowMs: 1_200,
};

/** A clip that isn't there yet plays this instead of the standing idle (hanging clips keep him hanging). */
export const CLIP_FALLBACK: Partial<Record<ClipName, ClipName>> = {
  hangLoseGrip: 'hang',
  hangOneArm: 'hang',
  hangStruggle: 'hang',
  hangSlip: 'hang',
};

/**
 * Left alone (no clicks, drags or spins, and the agent idle): after `sit` he walks
 * to the nearest side of the screen and sits against it; after `sleep` he nods off there.
 * Both count from the last time you touched him or the agent was busy.
 */
export const REST_MS = { sit: 3 * 60_000, sleep: 8 * 60_000 };
/** Once every agent has gone quiet (the `sleep` state) he's drowsy: he sits and nods off much sooner. */
export const REST_SLEEPY_MS = { sit: 30_000, sleep: 60_000 };
/** How fast the walk clip travelled before make-in-place removed it: the window moves at this. */
export const WALK_SPEED_MPS = 1.552;
/** Walking: side-on. Sitting: back to the wall but turned toward you, so you still see his face. */
export const WALK_YAW_DEG = 90;
export const SIT_YAW_DEG = 55;

/** A side of the screen he can lean on. */
export type Wall = 'left' | 'right';
/** Idle against a wall: lean in once, then hold the pose. */
export const LEAN_CLIPS: Record<Wall, { enter: ClipName; hold: ClipName }> = {
  left: { enter: 'leanInLeft', hold: 'leanLeft' },
  right: { enter: 'leanInRight', hold: 'leanRight' },
};

export type Fidget = { clip: ClipName; lines: string[] };
/**
 * Idle with no task: he gets more and more bored. Each tier starts `afterMs` into the
 * wait and plays one of its fidgets every `every` ms. After REST_MS.sit he gives up and
 * goes to sit against a wall.
 */
export const BOREDOM: { afterMs: number; every: { min: number; max: number }; fidgets: Fidget[] }[] = [
  {
    afterMs: 0,
    every: { min: 12_000, max: 25_000 },
    fidgets: [
      { clip: 'fidgetHair', lines: ['（整理一下发型）', '帅吗？', ''] },
      { clip: 'fidgetStretch', lines: ['伸个懒腰～', '你在忙什么呀？', ''] },
    ],
  },
  {
    afterMs: 40_000,
    every: { min: 10_000, max: 20_000 },
    fidgets: [
      { clip: 'scratchHead', lines: ['嗯…干点什么好呢', '好无聊呀～', ''] },
      { clip: 'scratchItch', lines: ['（挠挠）', '哪里痒…', ''] },
      { clip: 'kickPebble', lines: ['（踢石子）', '有活儿吗？', ''] },
      { clip: 'fidgetStretch', lines: ['伸个懒腰～', ''] },
    ],
  },
  {
    afterMs: 100_000,
    every: { min: 9_000, max: 16_000 },
    fidgets: [
      { clip: 'yawn', lines: ['哈啊～好困', '（打哈欠）'] },
      { clip: 'checkWatch', lines: ['派个任务给我呗', '还没有活儿吗…'] },
      { clip: 'tapFoot', lines: ['等得花儿都谢了…', '（抖腿）', ''] },
      { clip: 'scratchHead', lines: ['好无聊呀～', ''] },
    ],
  },
];
