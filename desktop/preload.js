'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  state: () => ipcRenderer.invoke('state:get'),
  capture: (p) => ipcRenderer.invoke('capture', p),
  place: (p) => ipcRenderer.invoke('place', p),
  edit: (p) => ipcRenderer.invoke('edit', p),
  undo: () => ipcRenderer.invoke('undo'),
  redo: () => ipcRenderer.invoke('redo'),
  addType: (p) => ipcRenderer.invoke('type:add', p),
  gitSync: (p) => ipcRenderer.invoke('git:sync', p || {}),
  search: (p) => ipcRenderer.invoke('search', p),
  openFile: (p) => ipcRenderer.invoke('file:open', p),
  openFileExtern: (p) => ipcRenderer.invoke('file:openExtern', p),
  preview: (p) => ipcRenderer.invoke('file:preview', p),
  reveal: (p) => ipcRenderer.invoke('file:reveal', p),
  ai: (p) => ipcRenderer.invoke('ai:exec', p),
  qa: (p) => ipcRenderer.invoke('qa:ask', p),
  qaInfo: () => ipcRenderer.invoke('qa:info'),
  ingest: (p) => ipcRenderer.invoke('ingest:batch', p),
  openPdf: (p) => ipcRenderer.invoke('pdf:open', p),
  qaConfig: () => ipcRenderer.invoke('qa:config'),
  setQaConfig: (p) => ipcRenderer.invoke('qa:config:set', p),
  resetState: () => ipcRenderer.invoke('state:reset'),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  info: () => ipcRenderer.invoke('app:info'),
  onMenu: (fn) => {
    ipcRenderer.on('menu', (e, payload) => fn(payload));
    ipcRenderer.on('zoom', (e, dir) => fn({ type: 'zoom', dir }));
    ipcRenderer.on('fit', () => fn({ type: 'fit' }));
    ipcRenderer.on('toggle-edit', () => fn({ type: 'toggle-edit' }));
    ipcRenderer.on('reload', () => fn({ type: 'reload' }));
  },
});
