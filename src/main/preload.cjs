/**
 * Preload script (CommonJS): exposes a safe IPC bridge to the renderer.
 *
 * NOTE: Electron preload scripts MUST be CommonJS. ESM preload scripts
 * fail silently with "Unable to load preload script".
 *
 * This file is copied to dist/main/preload.cjs by the build script.
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // Debug
  _dbg: (msg) => ipcRenderer.send('app:debug', msg),
  // Agent actions
  sendPrompt: (message) => ipcRenderer.invoke('agent:prompt', message),
  abort: () => ipcRenderer.invoke('agent:abort'),
  newSession: () => ipcRenderer.invoke('agent:new-session'),
  getState: () => ipcRenderer.invoke('agent:get-state'),
  getMessages: () => ipcRenderer.invoke('agent:get-messages'),
  getModels: () => ipcRenderer.invoke('agent:get-models'),
  setModel: (provider, modelId) => ipcRenderer.invoke('agent:set-model', provider, modelId),
  setThinking: (level) => ipcRenderer.invoke('agent:set-thinking', level),
  compact: () => ipcRenderer.invoke('agent:compact'),
  setWorkingDir: () => ipcRenderer.invoke('agent:set-working-dir'),
  quit: () => ipcRenderer.invoke('app:quit'),
  // App features
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  exportChat: (format) => ipcRenderer.invoke('app:export-chat', format),
  getSessionHistory: () => ipcRenderer.invoke('app:get-session-history'),
  restoreSession: (sessionFile) => ipcRenderer.invoke('app:restore-session', sessionFile),
  // Event listeners
  onSessionEvent: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('session:event', handler);
    return () => ipcRenderer.removeListener('session:event', handler);
  },
  onStateUpdate: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('session:state', handler);
    return () => ipcRenderer.removeListener('session:state', handler);
  },
  onMessagesUpdate: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('session:messages', handler);
    return () => ipcRenderer.removeListener('session:messages', handler);
  },
  onModelsUpdate: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('session:models', handler);
    return () => ipcRenderer.removeListener('session:models', handler);
  },
  onStatusUpdate: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('session:status', handler);
    return () => ipcRenderer.removeListener('session:status', handler);
  },
  // Menu event listeners
  onToggleSidebar: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('toggle-sidebar', handler);
    return () => ipcRenderer.removeListener('toggle-sidebar', handler);
  },
  onShowShortcuts: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('show-shortcuts', handler);
    return () => ipcRenderer.removeListener('show-shortcuts', handler);
  },
  onShowAbout: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('show-about', handler);
    return () => ipcRenderer.removeListener('show-about', handler);
  },
  onUpdateAvailable: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('app:update-available', handler);
    return () => ipcRenderer.removeListener('app:update-available', handler);
  },
};

contextBridge.exposeInMainWorld('piDesktop', api);
