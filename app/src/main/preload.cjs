const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petBridge', {
  setInteractive: (interactive) => ipcRenderer.send('pet:set-interactive', !!interactive),
  moveBy: (dx, dy) => ipcRenderer.send('pet:move-by', { dx, dy }),
  release: (vx, vy) => ipcRenderer.send('pet:release', { vx, vy }),
  grab: () => ipcRenderer.send('pet:grab'),
  letGo: (reason) => ipcRenderer.send('pet:let-go', reason),
  onPhysics: (cb) => ipcRenderer.on('pet:physics', (_e, p) => cb(p)),
  leanContact: (side, left, right) => ipcRenderer.send('pet:lean-contact', { side, left, right }),
  walk: (side, speed) => ipcRenderer.send('pet:walk', { side, speed }),
  scaleBy: (factor) => ipcRenderer.send('pet:scale-by', factor),
  showMenu: (catalog) => ipcRenderer.send('pet:show-menu', catalog),
  onPreview: (cb) => ipcRenderer.on('pet:preview', (_e, p) => cb(p)),
  onSetCharacter: (cb) => ipcRenderer.on('pet:set-character', (_e, id) => cb(id)),
  onCursor: (cb) => ipcRenderer.on('pet:cursor', (_e, p) => cb(p)),
  onAgentState: (cb) => ipcRenderer.on('pet:agent-state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('pet:ready'),
});
