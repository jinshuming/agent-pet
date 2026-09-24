const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sizeDialog', {
  set: (pct) => ipcRenderer.send('size:set', pct),
  close: () => ipcRenderer.send('size:close'),
  /** The size main actually applied (it may cap a value the screen can't fit). */
  onCurrent: (cb) => ipcRenderer.on('size:current', (_e, pct) => cb(pct)),
});
