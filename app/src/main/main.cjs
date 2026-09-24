// Electron main process: one transparent, frameless, always-on-top pet window.
// Transparent pixels pass clicks through to the desktop; the renderer decides
// (per-pixel alpha) when the cursor is over the pet and asks us to capture input.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, net, protocol, screen } = require('electron');
const { AgentSessions } = require('./agent-sessions.cjs');

const DEV = !!process.env.PET_DEV_URL;
/** Every hook event and state change goes to the log only while developing (or with AGENT_PET_DEBUG=1). */
const VERBOSE = DEV || !!process.env.AGENT_PET_DEBUG;
const APP_DIR = path.resolve(__dirname, '..', '..');

// The packaged renderer is served from pet://app/: the page and its scripts from dist/,
// characters and motions straight from assets/ (so they aren't duplicated into dist).
// A standard, secure scheme gets a real origin, fetch, CacheStorage and module workers.
protocol.registerSchemesAsPrivileged([
  { scheme: 'pet', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
const SERVE_ROOTS = [path.join(APP_DIR, 'dist'), path.join(APP_DIR, 'assets')];
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data:",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

function servePet(request) {
  const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
  for (const root of SERVE_ROOTS) {
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep)) continue; // no ../ out of the roots
    if (!require('node:fs').existsSync(file)) continue;
    return net.fetch(pathToFileURL(file).toString()).then((res) => {
      if (!file.endsWith('.html')) return res;
      const headers = new Headers(res.headers);
      headers.set('Content-Security-Policy', CSP);
      return new Response(res.body, { status: res.status, headers });
    });
  }
  return new Response('not found', { status: 404 });
}

// Much larger than the standing character: raised arms, jumps and drag poses
// need room, and the transparent margin passes clicks through anyway.
// These are the 100% size; the pet scales the whole window (see "Size" below).
const WIN_W = 520;
const WIN_H = 680;
// The renderer stands the feet FEET_MARGIN (0.15) of the height above the window
// bottom. Start the window that far below the work area so the feet rest just above the Dock.
const feetGapPx = (h) => Math.round(h * 0.15) - 8;
const CURSOR_POLL_MS = 33;
const MAX_BODY_BYTES = 16 * 1024;

let win = null;
/** Latest view pushed to the renderer, replayed after a reload. Starts with a hello. */
let currentView = { state: 'greet', settle: 'idle', label: '', activity: null, team: [] };

function pushView(view) {
  currentView = view;
  if (win && !win.isDestroyed()) win.webContents.send('pet:agent-state', view);
}

/** Dev only (/debug/pin-state): hold the pet in one agent state while other sessions keep reporting. */
let pinnedUntil = 0;
/** Dev only (/debug/cursor): where the pet thinks the cursor is (window coordinates), until `until`. */
let cursorOverride = { x: 0, y: 0, until: 0 };

const sessions = new AgentSessions((view) => {
  if (VERBOSE) console.log(`[agent] ${view.state}${view.settle !== view.state ? ` → ${view.settle}` : ''} ${view.label}`);
  if (Date.now() < pinnedUntil) return;
  pushView(view);
});

// ---------- Size ----------
// The camera frames the character relative to the canvas, so scaling the window
// scales the pet. The window grows around the character's feet, so he stays standing in place.
const SCALE_MIN = 0.1;
const SCALE_MAX = 2.5;
const SCALE_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const settingsPath = () => path.join(require('node:os').homedir(), '.agent-pet', 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(require('node:fs').readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  const fs = require('node:fs');
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify({ ...loadSettings(), ...patch }, null, 2) + '\n');
  } catch (err) {
    console.warn(`[main] could not save settings: ${err.message}`);
  }
}

/** Size on first launch, until the user picks one (then settings.json remembers it). */
const DEFAULT_SCALE = 0.75;
const clampScale = (s) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, Number(s) || DEFAULT_SCALE));
let scale = clampScale(loadSettings().scale ?? DEFAULT_SCALE);
let saveTimer = null;

/** The window's size at the current scale. */
const winSize = () => ({ width: Math.round(WIN_W * scale), height: Math.round(WIN_H * scale) });

/**
 * Every move goes through here, with the size pinned. On Windows at a display scale
 * other than 100%, setPosition grows or shrinks the window by 1–3 px (electron#9477,
 * #27651); splat-engine then resizes the WebGL drawing buffer, which clears it, and a
 * transparent window shows that empty frame: the pet flickers while dragged or flying.
 */
function place(x, y) {
  if (!win) return;
  win.setBounds({ x: Math.round(x) || 0, y: Math.round(y) || 0, ...winSize() });
}

/** The renderer pins its canvas to this size, so a stray pixel of window resize can't rebuild the buffer. */
const sendSize = () => win?.webContents.send('pet:size', winSize());

/** Where the feet stand, as a fraction of the window height from the top (renderer: 1 - FEET_MARGIN). */
const FEET_AT = 0.85;

/** Largest scale whose window fits the display the pet is on: macOS caps windows at the work-area height. */
function maxScaleFor(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  return Math.min(SCALE_MAX, workArea.height / WIN_H);
}

function setScale(next) {
  if (!win) return;
  const b = win.getBounds();
  next = Math.round(Math.min(clampScale(next), maxScaleFor(b)) * 100) / 100;
  if (next === scale) return;
  scale = next;
  const width = Math.round(WIN_W * scale);
  const height = Math.round(WIN_H * scale);
  // Grow around the feet, so the character stays standing where it was. Keep the
  // window's top on screen and the feet no lower than just above the Dock.
  const { workArea } = screen.getDisplayMatching(b);
  const feetMax = workArea.y + workArea.height - 8;
  const feetY = Math.min(b.y + b.height * FEET_AT, feetMax);
  const y = Math.max(workArea.y, Math.round(feetY - height * FEET_AT));
  // resizable:false also blocks programmatic resizes on some platforms.
  win.setResizable(true);
  win.setBounds({ x: Math.round(b.x + b.width / 2 - width / 2) || 0, y, width, height });
  win.setResizable(false);
  sendSize();
  sizeDialog?.webContents.send('size:current', Math.round(scale * 100));
  // Pinch gestures fire many steps; write the file once they settle.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSettings({ scale }), 500);
}

// Right-click → 大小 → 自定义…: a small window with a slider and a percentage box. It resizes the pet live.
let sizeDialog = null;
function openSizeDialog() {
  if (sizeDialog) return sizeDialog.focus();
  const max = Math.floor(maxScaleFor(win.getBounds()) * 100);
  sizeDialog = new BrowserWindow({
    width: 340,
    height: 140,
    useContentSize: true, // the title bar comes on top, so the button always fits
    title: '自定义大小',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'size-dialog-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  sizeDialog.setMenu(null);
  sizeDialog.loadFile(path.join(__dirname, 'size-dialog.html'), {
    query: { current: String(Math.round(scale * 100)), min: String(Math.round(SCALE_MIN * 100)), max: String(max) },
  });
  sizeDialog.on('closed', () => (sizeDialog = null));
}
ipcMain.on('size:set', (_e, pct) => {
  const n = Number(pct);
  if (Number.isFinite(n)) setScale(n / 100);
});
ipcMain.on('size:close', () => sizeDialog?.close());

// ---------- Character ----------
// The list lives in the renderer (pet/characters.ts); main only remembers the choice.
let characterId = loadSettings().character ?? null;

function setCharacter(id) {
  if (!win || typeof id !== 'string' || !id) return;
  characterId = id;
  saveSettings({ character: id });
  win.webContents.send('pet:set-character', id);
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  // A size saved on a taller monitor must still fit this one.
  scale = Math.min(scale, maxScaleFor(workArea));
  const w = Math.round(WIN_W * scale);
  const h = Math.round(WIN_H * scale);
  win = new BrowserWindow({
    width: w,
    height: h,
    x: workArea.x + workArea.width - w - 40,
    y: workArea.y + workArea.height - h,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  // The pet never opens windows or navigates anywhere.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // The constructor clamps x/y to the work area; moving afterwards lets the
  // transparent bottom margin hang over the Dock.
  place(workArea.x + workArea.width - w - 40, workArea.y + workArea.height - h + feetGapPx(h));
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start fully click-through; `forward` keeps mousemove flowing so the renderer can hit-test.
  win.setIgnoreMouseEvents(true, { forward: true });

  // Mirror renderer logs into the log while developing (or with AGENT_PET_DEBUG=1).
  if (VERBOSE) win.webContents.on('console-message', (e) => console.log(`[renderer:${e.level}] ${e.message}`));
  if (process.env.PET_DEV_URL) {
    // A clip requested before its file existed gets Vite's HTML fallback with a 200,
    // and splat-engine keeps asset bytes in CacheStorage with an expiry, so that stale
    // "GLB" would be replayed on every restart. Start each dev run with clean caches.
    const { session } = win.webContents;
    const url = new URL(process.env.PET_DEV_URL);
    if (characterId) url.searchParams.set('character', characterId);
    Promise.allSettled([session.clearCache(), session.clearStorageData({ storages: ['cachestorage'] })]).finally(() =>
      win?.loadURL(url.toString()),
    );
    if (process.env.PET_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const url = new URL('pet://app/index.html');
    if (characterId) url.searchParams.set('character', characterId);
    win.loadURL(url.toString());
  }

  // Global cursor position → renderer, so the pet can turn toward the mouse
  // even when the cursor is outside the window. Only when it (or the window) moved, and not while hidden.
  let lastCursor = '';
  const timer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const b = win.getBounds();
    const c = Date.now() < cursorOverride.until ? { x: b.x + cursorOverride.x, y: b.y + cursorOverride.y } : screen.getCursorScreenPoint();
    const msg = { x: c.x - b.x, y: c.y - b.y, w: b.width, h: b.height };
    const key = `${msg.x},${msg.y},${msg.w},${msg.h}`;
    if (key === lastCursor) return;
    lastCursor = key;
    win.webContents.send('pet:cursor', msg);
  }, CURSOR_POLL_MS);
  // A reload starts the renderer from scratch: send the cursor again.
  win.webContents.on('did-finish-load', () => (lastCursor = ''));
  win.on('closed', () => {
    clearInterval(timer);
    win = null;
  });
}

ipcMain.on('pet:ready', () => {
  sendSize();
  pushView(currentView);
});

ipcMain.on('pet:set-interactive', (_e, interactive) => {
  if (!win) return;
  if (interactive) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('pet:scale-by', (_e, factor) => setScale(scale * Number(factor)));

ipcMain.on('pet:move-by', (_e, { dx, dy }) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  // place() rounds, and `|| 0` turns NaN and -0 (Math.round(-0.3)) into 0: setBounds throws on either.
  place(x + dx, y + dy);
});

// Dragging: main puts the window at the cursor minus where it was grabbed. Absolute, so
// rounding can't accumulate the way summing pointer deltas does; the renderer asks at
// most once per frame, however fast the mouse reports (1000 Hz mice are common on Windows).
let dragOffset = null;
ipcMain.on('pet:drag-begin', () => {
  if (!win) return;
  const c = screen.getCursorScreenPoint();
  const [x, y] = win.getPosition();
  dragOffset = { x: c.x - x, y: c.y - y };
});
ipcMain.on('pet:drag-move', () => {
  if (!win || !dragOffset) return;
  const c = screen.getCursorScreenPoint();
  place(c.x - dragOffset.x, c.y - dragOffset.y);
});

// ---------- Physics: fling, fall, hang from the top edge, lean on the side walls ----------
// The renderer reports how fast a drag was released; main owns the window, so it
// flies it. Window positions are top-left; the feet stand at FEET_AT of the height.
const GRAVITY = 3200; // px/s²
const FLING_MIN_SPEED = 700; // px/s: slower releases just set him down where he is
const MAX_FLING_SPEED = 6000;
const WALL_BOUNCE = 0.45;
const HARD_LANDING_SPEED = 2200; // px/s downward at touchdown: he lands dizzy
const BODY_HALF_W = 0.13; // half the standing silhouette's width, as a fraction of the window width
// macOS keeps a window's top at or below the menu bar, so a drag against the top edge ends here.
const TOP_GRAB_PX = 12;
// The renderer tires him out and lets go (see HANG in clips.ts); this only catches a renderer that never does.
const HANG_SAFETY_MS = 60_000;
// Set down this close (body edge to screen edge) to a side of the screen: he leans on it.
const WALL_SNAP_PX = 80;
const PHYSICS_TICK_MS = 16;

let sim = null;
let hangTimer = null;

const sendPhysics = (kind, extra = {}) => win?.webContents.send('pet:physics', { kind, ...extra });

function stopPhysics() {
  if (sim) clearInterval(sim.timer);
  sim = null;
  clearTimeout(hangTimer);
  hangTimer = null;
}

function startHang() {
  stopPhysics();
  const b = win.getBounds();
  place(b.x, screen.getDisplayMatching(b).workArea.y);
  sendPhysics('hang');
  hangTimer = setTimeout(() => letGo('tired'), HANG_SAFETY_MS);
}

/** reason: 'tired' (hung too long), 'poked' (clicked while hanging), 'critical' (the agent needs you). */
function letGo(reason) {
  if (win) fly(0, 0, reason);
}

function fly(vx, vy, reason = 'fling') {
  stopPhysics();
  const b = win.getBounds();
  const { workArea: wa } = screen.getDisplayMatching(b);
  const s = { x: b.x, y: b.y, vx, vy, last: Date.now(), timer: null };
  sim = s;
  sendPhysics('fly', { reason });
  s.timer = setInterval(() => {
    if (!win || sim !== s) return clearInterval(s.timer);
    const now = Date.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    const { width: w, height: h } = win.getBounds();
    s.vy += GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // Bounce off the screen's sides; the window itself may hang off-screen.
    const half = w * BODY_HALF_W;
    const left = wa.x + half - w / 2;
    const right = wa.x + wa.width - half - w / 2;
    if (s.x < left || s.x > right) {
      s.x = Math.min(right, Math.max(left, s.x));
      s.vx = -s.vx * WALL_BOUNCE;
    }
    const put = () => place(Math.round(s.x) || 0, Math.round(s.y) || 0);
    // Thrown up into the menu bar: he catches the edge.
    if (s.y <= wa.y && s.vy < 0) {
      s.y = wa.y;
      put();
      return startHang();
    }
    // Land with the feet just above the Dock, like the start position.
    const floor = wa.y + wa.height - 8 - h * FEET_AT;
    if (s.y >= floor) {
      const impact = s.vy;
      s.y = floor;
      put();
      stopPhysics();
      // Came down against a side of the screen: he leans on it.
      const wall = s.x <= left + 0.5 ? 'left' : s.x >= right - 0.5 ? 'right' : null;
      return sendPhysics('land', { hard: impact > HARD_LANDING_SPEED, wall });
    }
    put();
  }, PHYSICS_TICK_MS);
}

/**
 * Left alone, he walks to a side of the screen at `speed` px/s (the renderer matches it
 * to the walk clip's stride). At the wall he comes down to the floor if he isn't on it,
 * then main reports a landing against that wall, where he sits down.
 */
function walk(side, speed) {
  if (!win) return;
  stopPhysics();
  const s = { x: win.getBounds().x, last: Date.now(), timer: null };
  sim = s;
  s.timer = setInterval(() => {
    if (!win || sim !== s) return clearInterval(s.timer);
    const now = Date.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    const b = win.getBounds();
    const { workArea: wa } = screen.getDisplayMatching(b);
    const half = b.width * BODY_HALF_W;
    const target = side === 'left' ? wa.x + half - b.width / 2 : wa.x + wa.width - half - b.width / 2;
    const step = speed * dt;
    if (Math.abs(target - s.x) > step) {
      s.x += Math.sign(target - s.x) * step;
      return place(Math.round(s.x) || 0, b.y);
    }
    place(Math.round(target) || 0, b.y);
    stopPhysics();
    const floor = wa.y + wa.height - 8 - b.height * FEET_AT;
    if (b.y < floor - 2) return fly(0, 0, 'hop');
    sendPhysics('land', { hard: false, wall: side });
  }, PHYSICS_TICK_MS);
}

ipcMain.on('pet:walk', (_e, m) => {
  const speed = Math.min(2000, Math.max(20, Number(m?.speed) || 300));
  walk(m?.side === 'left' ? 'left' : 'right', speed);
});

/** A drag ended with this velocity (px/s): throw him, let him grab the top edge, or set him down. */
function release(v) {
  if (!win) return;
  const clamp = (n) => Math.max(-MAX_FLING_SPEED, Math.min(MAX_FLING_SPEED, Number(n) || 0));
  const vx = clamp(v?.vx);
  const vy = clamp(v?.vy);
  stopPhysics(); // a drag always wins over a flight or hang still in progress
  const b = win.getBounds();
  if (Math.hypot(vx, vy) >= FLING_MIN_SPEED) return fly(vx, vy);
  const { workArea: wa } = screen.getDisplayMatching(b);
  if (b.y <= wa.y + TOP_GRAB_PX) return startHang();
  // Set down near a side of the screen: slide over to it, come down to the floor, lean.
  const half = b.width * BODY_HALF_W;
  const cx = b.x + b.width / 2;
  const wall = cx - half - wa.x < WALL_SNAP_PX ? 'left' : wa.x + wa.width - (cx + half) < WALL_SNAP_PX ? 'right' : null;
  if (wall) {
    const x = wall === 'left' ? wa.x + half - b.width / 2 : wa.x + wa.width - half - b.width / 2;
    const floor = wa.y + wa.height - 8 - b.height * FEET_AT;
    place(Math.round(x) || 0, b.y);
    if (b.y < floor - 2) return fly(0, 0);
    return sendPhysics('land', { hard: false, wall });
  }
  sendPhysics('drop');
}

// Leaning: the renderer measured where the silhouette actually ends (window CSS px);
// shift the window so that edge touches the wall exactly, whatever the character's build.
ipcMain.on('pet:lean-contact', (_e, m) => {
  if (!win || sim) return;
  const b = win.getBounds();
  const { workArea: wa } = screen.getDisplayMatching(b);
  const edge = m?.side === 'left' ? b.x + Number(m.left) : b.x + Number(m.right);
  const target = m?.side === 'left' ? wa.x : wa.x + wa.width;
  const dx = target - edge;
  if (Number.isFinite(dx) && Math.abs(dx) < b.width / 2) place(Math.round(b.x + dx) || 0, b.y);
});

ipcMain.on('pet:release', (_e, v) => {
  dragOffset = null;
  release(v);
});
ipcMain.on('pet:grab', () => stopPhysics());
ipcMain.on('pet:let-go', (_e, reason) => letGo(['tired', 'critical'].includes(reason) ? reason : 'poked'));

// Right-click menu: trigger any agent state by hand, to preview it without Claude Code.
const AGENT_STATES = [
  ['greet', '打招呼 greet'],
  ['idle', '空闲 idle'],
  ['thinking', '思考 thinking'],
  ['working', '工作 working'],
  ['permission', '等待授权 permission'],
  ['done', '完成 done'],
  ['error', '出错 error'],
  ['sleep', '睡觉 sleep'],
];

// The renderer sends what it can preview (reactions and loaded clips) with each request.
ipcMain.on('pet:show-menu', (_e, catalog = {}) => {
  if (!win) return;
  const preview = (kind) => ({ id, label }) => ({
    label,
    click: () => win?.webContents.send('pet:preview', { kind, id }),
  });
  const menu = Menu.buildFromTemplate([
    {
      label: '模拟 Agent 状态',
      submenu: AGENT_STATES.map(([id, label]) => ({
        label,
        click: () => pushView({ state: id, settle: 'idle', label: '' }),
      })),
    },
    {
      label: '模拟互动',
      submenu: [
        ...(catalog.reactions ?? []).map(preview('reaction')),
        { type: 'separator' },
        { label: '休息：走到墙边坐下', click: () => win?.webContents.send('pet:preview', { kind: 'rest', id: 'sit' }) },
        { label: '休息：靠墙睡着', click: () => win?.webContents.send('pet:preview', { kind: 'rest', id: 'sleep' }) },
        { type: 'separator' },
        { label: `提示：按住 ${process.platform === 'darwin' ? '⌥' : 'Alt'} 左右拖动，或在他身边空白处横向拖动，让他转圈；转 3 圈他会晕`, enabled: false },
        { label: '提示：3 分钟不理他会去墙边坐下，8 分钟会靠墙睡着', enabled: false },
      ],
    },
    { label: '预览单个动作', submenu: (catalog.clips ?? []).map(preview('clip')) },
    { type: 'separator' },
    {
      label: '切换角色',
      submenu: (catalog.characters ?? []).map(({ id, label }) => ({
        label,
        type: 'radio',
        checked: id === catalog.character,
        click: () => setCharacter(id),
      })),
    },
    {
      label: `大小（${Math.round(scale * 100)}%）`,
      submenu: [
        ...SCALE_PRESETS.map((p) => ({
          label: `${Math.round(p * 100)}%`,
          type: 'radio',
          checked: Math.abs(scale - p) < 0.005,
          // Presets taller than this display can't be shown.
          enabled: p <= maxScaleFor(win.getBounds()) + 0.005,
          click: () => setScale(p),
        })),
        { label: '最大（适配屏幕）', click: () => setScale(SCALE_MAX) },
        { label: '自定义…', click: () => openSizeDialog() },
        { type: 'separator' },
        { label: `提示：在角色上双指捏合，或按住 ${process.platform === 'darwin' ? '⌘' : 'Ctrl'} 滚动滚轮微调`, enabled: false },
      ],
    },
    { type: 'separator' },
    { label: '开发者工具', click: () => win.webContents.openDevTools({ mode: 'detach' }) },
    { label: '重新加载', click: () => win.webContents.reload() },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
});

// Local control server (127.0.0.1 only).
//   POST /event   Claude Code hook payload, sent by plugin/scripts/emit.mjs
//   POST /state   {"state":"working"}  manual override for testing
//   POST /preview {"kind":"clip"|"reaction","id":"typing"}  same as the right-click previews
//   POST /scale   {"scale":1.5}  resize the pet (0.1–2.5), same as the 大小 menu
//   POST /character {"id":"man-in-suit"}  switch character, same as the 切换角色 menu
//   GET  /health
//   GET  /debug/sessions
//   POST /debug/fling {"vx":1500,"vy":-2500,"x"?,"y"?}  (dev only: like releasing a drag at that velocity)
//   POST /debug/snapshot?path=/abs/file.png  (dev only: saves the pet window as PNG)
//   GET  /debug/extents                       (dev only: plays every clip, reports how far it reaches)
//   POST /debug/cursor {"x":0,"y":0,"ms":5000} (dev only: pretend the cursor is there, in window coordinates)
//
// Only local processes (the hook, curl) may call it, never a web page: any site
// can fire requests at 127.0.0.1. See isFromBrowser().
const CONTROL_PORT = Number(process.env.AGENT_PET_PORT || 23456);
const ALLOWED_HOSTS = new Set([`127.0.0.1:${CONTROL_PORT}`, `localhost:${CONTROL_PORT}`]);

/**
 * Browsers put Origin on cross-site POSTs and Sec-Fetch-Site on every request
 * (even <img>); Node's fetch and curl send neither. A foreign Host means DNS
 * rebinding (evil.com resolved to 127.0.0.1), which would otherwise look same-origin.
 */
function isFromBrowser(req) {
  return !ALLOWED_HOSTS.has(req.headers.host) || 'origin' in req.headers || 'sec-fetch-site' in req.headers;
}
const VALID_STATES = new Set(AGENT_STATES.map(([id]) => id));

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) throw new Error('body too large');
  }
  return JSON.parse(raw);
}

function startControlServer() {
  const http = require('node:http');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const reply = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (isFromBrowser(req)) return reply(403, { error: 'forbidden' });

    if (req.method === 'GET' && url.pathname === '/health') return reply(200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/debug/sessions') return reply(200, sessions.snapshot());

    if (req.method === 'POST' && url.pathname === '/event') {
      let ev;
      try {
        ev = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      if (typeof ev?.event !== 'string') return reply(400, { error: 'missing event' });
      if (VERBOSE) console.log(`[event] ${String(ev.session).slice(0, 8)} ${ev.event}${ev.tool ? ` ${ev.tool}` : ''}${ev.notificationType ? ` ${ev.notificationType}` : ''}`);
      sessions.handle(ev);
      return reply(200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/state') {
      let state;
      try {
        state = (await readJson(req)).state;
      } catch (err) {
        return reply(400, { error: err.message });
      }
      if (!VALID_STATES.has(state)) return reply(400, { error: `unknown state: ${state}` });
      pushView({ state, settle: 'idle', label: '' });
      return reply(200, { ok: true, state });
    }

    if (!win) return reply(503, { error: 'no window' });

    // Dev only: same as releasing a drag at this velocity, e.g. {"vx":1500,"vy":-2500}.
    // {"x":…,"y":…} first moves the window there (as if dragged).
    if (process.env.PET_DEV_URL && req.method === 'POST' && url.pathname === '/debug/fling') {
      let v;
      try {
        v = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      stopPhysics();
      if (Number.isFinite(v.x) && Number.isFinite(v.y)) place(Math.round(v.x), Math.round(v.y));
      release(v);
      return reply(200, { ok: true, from: win.getBounds() });
    }

    if (req.method === 'POST' && url.pathname === '/character') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      if (typeof body?.id !== 'string') return reply(400, { error: 'expected {"id":"man-in-suit"}' });
      setCharacter(body.id);
      return reply(200, { ok: true, character: body.id });
    }

    if (req.method === 'POST' && url.pathname === '/scale') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      setScale(body.scale);
      return reply(200, { ok: true, scale, bounds: win.getBounds() });
    }

    // Same as the right-click previews: {"kind":"clip","id":"typing"} or {"kind":"reaction","id":"busyPoke"}
    if (req.method === 'POST' && url.pathname === '/preview') {
      let p;
      try {
        p = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      if (!['clip', 'reaction', 'rest'].includes(p?.kind) || typeof p.id !== 'string') {
        return reply(400, { error: 'expected {"kind":"clip"|"reaction"|"rest","id":"..."}' });
      }
      win.webContents.send('pet:preview', { kind: p.kind, id: p.id });
      return reply(200, { ok: true });
    }

    // POST, not GET: a side effect on disk must never hang off a plain link or <img>.
    if (process.env.PET_DEV_URL && req.method === 'POST' && url.pathname === '/debug/snapshot') {
      const out = url.searchParams.get('path');
      if (!out || !path.isAbsolute(out) || !out.endsWith('.png')) return reply(400, { error: 'absolute ?path=….png required' });
      const image = await win.webContents.capturePage();
      require('node:fs').writeFileSync(out, image.toPNG());
      return reply(200, { ok: true, path: out, size: image.getSize() });
    }

    // [{"type":"mouseDown","x":100,"y":300,"wait":16}, …]: replay mouse events into the pet window
    // (window coordinates) without touching the real cursor. For testing clicks and spins.
    if (process.env.PET_DEV_URL && req.method === 'POST' && url.pathname === '/debug/input') {
      let events;
      try {
        events = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      if (!Array.isArray(events)) return reply(400, { error: 'expected an array of events' });
      for (const ev of events.slice(0, 500)) {
        const type = ['mouseDown', 'mouseUp', 'mouseMove'].includes(ev?.type) ? ev.type : null;
        if (!type) continue;
        const [wx, wy] = win.getPosition();
        const x = Math.round(ev.x) || 0;
        const y = Math.round(ev.y) || 0;
        win.webContents.sendInputEvent({ type, x, y, globalX: wx + x, globalY: wy + y, button: 'left', clickCount: 1 });
        await new Promise((r) => setTimeout(r, Math.min(1000, Math.max(0, Number(ev.wait) || 0))));
      }
      return reply(200, { ok: true });
    }

    // {"x":400,"y":200}: put the window there (to test walking, leaning, hanging from anywhere).
    if (process.env.PET_DEV_URL && req.method === 'POST' && url.pathname === '/debug/cursor') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      const ms = Math.min(10 * 60_000, Math.max(0, Number(body?.ms) || 0));
      cursorOverride = { x: Number(body?.x) || 0, y: Number(body?.y) || 0, until: Date.now() + ms };
      return reply(200, { ok: true });
    }

    if (process.env.PET_DEV_URL && req.method === 'POST' && url.pathname === '/debug/move') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      stopPhysics();
      place(Math.round(Number(body?.x)) || 0, Math.round(Number(body?.y)) || 0);
      return reply(200, { ok: true, bounds: win.getBounds() });
    }

    // {"state":"idle","ms":60000}: show this state and ignore live sessions for ms (0 = unpin).
    // Optional "label", "activity" and "team" (see AgentSessions.view) fake the rest of the view.
    if (VERBOSE && req.method === 'POST' && url.pathname === '/debug/pin-state') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      const ms = Math.min(30 * 60_000, Math.max(0, Number(body?.ms) || 0));
      pinnedUntil = Date.now() + ms;
      if (ms && VALID_STATES.has(body?.state)) {
        const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
        const team = Array.isArray(body.team) ? body.team.slice(0, 8).map((m, i) => ({
          id: str(m?.id, 40) || `t${i}`,
          kind: m?.kind === 'session' ? 'session' : 'subagent',
          icon: str(m?.icon, 8) || '🤖',
          name: str(m?.name, 40),
          label: str(m?.label, 80),
          state: VALID_STATES.has(m?.state) ? m.state : 'working',
        })) : [];
        pushView({ state: body.state, settle: body.state, label: str(body.label, 120), activity: str(body.activity, 20) || null, team });
      }
      else if (!ms) pushView(sessions.view());
      return reply(200, { ok: true, pinnedMs: ms });
    }

    // The renderer's view of the pet: agent state, reaction, held, resting, which clip.
    if (VERBOSE && req.method === 'GET' && url.pathname === '/debug/pet') {
      return reply(200, await win.webContents.executeJavaScript('window.__petDebug.pet()'));
    }

    // Per-process CPU and memory (Electron's own accounting) plus the renderer's draw rate and JS heap.
    if (VERBOSE && req.method === 'GET' && url.pathname === '/debug/stats') {
      const procs = app.getAppMetrics().map((m) => ({
        type: m.type,
        cpu: Math.round(m.cpu.percentCPUUsage * 10) / 10,
        memMB: Math.round((m.memory.workingSetSize || 0) / 1024),
      }));
      let renderer = null;
      let bones;
      try {
        renderer = await win.webContents.executeJavaScript('window.__petDebug.stats()');
        if (url.searchParams.get('bones')) bones = await win.webContents.executeJavaScript('window.__petDebug.bones()');
      } catch {}
      return reply(200, { procs, renderer, bones });
    }

    // {"fps":30}: pin the renderer's frame budget (0 = let the pet choose again).
    if (VERBOSE && req.method === 'POST' && url.pathname === '/debug/fps') {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return reply(400, { error: err.message });
      }
      const fps = Math.min(120, Math.max(0, Math.round(Number(body?.fps) || 0)));
      await win.webContents.executeJavaScript(`window.__petDebug.setFps(${fps})`);
      return reply(200, { ok: true, fps });
    }

    if (process.env.PET_DEV_URL && req.method === 'GET' && url.pathname === '/debug/extents') {
      try {
        return reply(200, await win.webContents.executeJavaScript('window.__petDebug.measureClips()'));
      } catch (err) {
        return reply(500, { error: String(err) });
      }
    }

    reply(404, { error: 'not found' });
  });
  server.on('error', (err) => console.warn(`[main] control server disabled: ${err.message}`));
  server.listen(CONTROL_PORT, '127.0.0.1', () => console.log(`[main] control server on 127.0.0.1:${CONTROL_PORT}`));
}

// The SessionStart hook may try to launch us while we're already up.
if (!app.requestSingleInstanceLock()) app.exit(0);

// Tell the plugin's SessionStart launcher where this app lives. An installed
// plugin runs from ~/.claude/plugins/cache/…, which has no sibling app/ dir.
function recordAppLocation() {
  const fs = require('node:fs');
  const os = require('node:os');
  try {
    const dir = path.join(os.homedir(), '.agent-pet');
    fs.mkdirSync(dir, { recursive: true });
    const appDir = path.resolve(__dirname, '..', '..');
    fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify({ appDir }, null, 2) + '\n');
  } catch (err) {
    console.warn(`[main] could not record app location: ${err.message}`);
  }
}

// ---------- Tray ----------
// No Dock icon and no taskbar button: the tray is how you find, bring back or quit the pet.
let tray = null;
function createTray() {
  // macOS: a black template image the menu bar tints. Windows: a coloured one that shows on any taskbar.
  const icon = nativeImage.createFromPath(path.join(__dirname, process.platform === 'darwin' ? 'tray-icon.png' : 'tray-icon-win.png'));
  if (process.platform === 'darwin') icon.setTemplateImage(true); // follows the menu bar's light/dark
  tray = new Tray(icon);
  tray.setToolTip('Agent Pet');
  const menu = () =>
    Menu.buildFromTemplate([
      { label: win?.isVisible() ? '隐藏' : '显示', click: () => (win?.isVisible() ? win.hide() : win?.showInactive()) },
      { label: '回到屏幕上', click: () => bringBack() },
      { type: 'separator' },
      { label: '退出 Agent Pet', click: () => app.quit() },
    ]);
  // Rebuilt on open so 显示/隐藏 is always right.
  tray.on('click', () => tray.popUpContextMenu(menu()));
  tray.on('right-click', () => tray.popUpContextMenu(menu()));
}

/** Put the pet back at its start spot on the primary display (lost off-screen, display unplugged). */
function bringBack() {
  if (!win) return;
  stopPhysics();
  const { workArea } = screen.getPrimaryDisplay();
  const { width, height } = winSize();
  place(workArea.x + workArea.width - width - 40, workArea.y + workArea.height - height + feetGapPx(height));
  win.showInactive();
  win.webContents.send('pet:physics', { kind: 'drop' });
}

/** After a display goes away, a pet left on it would be invisible: bring it back. */
function onDisplaysChanged() {
  if (!win) return;
  const b = win.getBounds();
  const cx = b.x + b.width / 2;
  const feetY = b.y + b.height * FEET_AT;
  const visible = screen.getAllDisplays().some(({ bounds: d }) => cx >= d.x && cx < d.x + d.width && feetY >= d.y && feetY < d.y + d.height);
  if (!visible) bringBack();
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  protocol.handle('pet', servePet);
  recordAppLocation();
  createWindow();
  createTray();
  screen.on('display-removed', onDisplaysChanged);
  screen.on('display-metrics-changed', onDisplaysChanged);
  startControlServer();
});

app.on('window-all-closed', () => app.quit());
