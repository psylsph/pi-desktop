/**
 * Main Electron process.
 * Manages the pi agent session via the SDK and bridges IPC to the renderer.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  type BrowserWindow as BrowserWindowType,
} from "electron";
import * as path from "node:path";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ModelRegistry as ModelRegistryType,
} from "@earendil-works/pi-coding-agent";
import { IPC } from "../shared/types.js";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

// ─── Globals ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindowType | null = null;
let session: AgentSession | null = null;
let unsubscribe: (() => void) | null = null;
let workingDir = app.getPath("home");
let authStorage: ReturnType<typeof AuthStorage.create> | null = null;
let modelRegistry: ModelRegistryType | null = null;

// ─── Window creation ─────────────────────────────────────────────────

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Session",
          accelerator: "CmdOrCtrl+N",
          click: async () => {
            if (mainWindow) {
              await initSession(workingDir);
              sendStatus("ready", "New session started");
            }
          },
        },
        { type: "separator" },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            if (mainWindow) {
              const result = await dialog.showOpenDialog(mainWindow, {
                properties: ["openDirectory"],
                title: "Select Working Directory",
                defaultPath: workingDir,
              });
              if (!result.canceled && result.filePaths.length > 0) {
                workingDir = result.filePaths[0];
                await initSession(workingDir);
                sendStatus("ready", `Working directory: ${workingDir}`);
              }
            }
          },
        },
        { type: "separator" },
        { role: "quit", label: "Exit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("toggle-sidebar");
            }
          },
        },
        { type: "separator" },
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle Developer Tools" },
        { type: "separator" },
        { role: "resetZoom", label: "Reset Zoom" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            await shell.openExternal("https://github.com/psylsph/pi-desktop#readme");
          },
        },
        {
          label: "Keyboard Shortcuts",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("show-shortcuts");
            }
          },
        },
        {
          label: "Report Issue...",
          click: async () => {
            await shell.openExternal("https://github.com/psylsph/pi-desktop/issues");
          },
        },
        {
          label: "Check for Updates",
          click: async () => {
            await shell.openExternal("https://github.com/psylsph/pi-desktop/releases");
          },
        },
        { type: "separator" },
        {
          label: "About Pi Desktop",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("show-about");
            }
          },
        },
      ],
    },
  ];

  // macOS app menu tweaks
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: "about", label: "About Pi Desktop" },
        { type: "separator" },
        { role: "services", label: "Services" },
        { type: "separator" },
        { role: "hide", label: "Hide Pi Desktop" },
        { role: "hideOthers", label: "Hide Others" },
        { role: "unhide", label: "Show All" },
        { type: "separator" },
        { role: "quit", label: "Quit Pi Desktop" },
      ],
    });

    // Window menu
    template.splice(3, 0, {
      role: "window",
      submenu: [
        { role: "minimize", label: "Minimize" },
        { role: "zoom", label: "Zoom" },
        { type: "separator" },
        { role: "front", label: "Bring All to Front" },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: "Pi Desktop",
    backgroundColor: "#1a1b26",
    webPreferences: {
      // Inline preload to test if file loading is the issue
      preload: path.join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(import.meta.dirname, "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── Agent lifecycle ─────────────────────────────────────────────────

async function initSession(cwd: string) {
  // Tear down previous
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (session) {
    session.dispose();
    session = null;
  }

  authStorage = AuthStorage.create();
  modelRegistry = ModelRegistry.create(authStorage);
  const settingsManager = SettingsManager.create(cwd);

  // Find an available model before creating the session
  const available = await modelRegistry.getAvailable();
  const firstModel = available.length > 0 ? available[0] : undefined;

  const result = await createAgentSession({
    cwd,
    model: firstModel,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager: SessionManager.create(cwd),
  });

  session = result.session;

  // Subscribe and forward events to renderer
  unsubscribe = session.subscribe((event) => {
    forwardEvent(event);
    if (
      event.type === "agent_end" ||
      event.type === "message_end" ||
      event.type === "compaction_end"
    ) {
      pushState();
      pushMessages();
    }
  });

  pushState();
  pushAllModels();
  sendStatus("ready", session.model ? "Ready" : "No model configured — select one in sidebar");
}

// ─── Forwarding helpers ──────────────────────────────────────────────

function forwardEvent(event: Record<string, unknown> & { type: string }) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send(IPC.SESSION_EVENT, {
    ...event,
    type: event.type,
  });

  switch (event.type) {
    case "agent_start":
      sendStatus("streaming", "Agent is thinking…");
      break;
    case "agent_end":
      sendStatus("ready", "Ready");
      pushState();
      break;
    case "tool_execution_start":
      sendStatus("tool", `Running: ${event.toolName}`);
      break;
    case "compaction_start":
      sendStatus("compacting", "Compacting context…");
      break;
    case "compaction_end":
      sendStatus("ready", "Compaction complete");
      break;
  }
}

function modelToInfo(m: any) {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    contextWindow: m.contextWindow,
    reasoning: m.reasoning,
  };
}

function pushState() {
  if (!mainWindow || mainWindow.isDestroyed() || !session) return;

  mainWindow.webContents.send(IPC.STATE_UPDATE, {
    model: session.model ? modelToInfo(session.model) : null,
    thinkingLevel: session.thinkingLevel,
    isStreaming: session.isStreaming,
    sessionFile: session.sessionFile,
    sessionId: session.sessionId,
    sessionName: undefined,
    messageCount: session.messages.length,
    contextUsage: null,
    workingDir,
  });
}

function pushMessages() {
  if (!mainWindow || mainWindow.isDestroyed() || !session) return;
  mainWindow.webContents.send(IPC.MESSAGES_UPDATE, session.messages);
}

async function pushAllModels() {
  if (!mainWindow || mainWindow.isDestroyed() || !modelRegistry) return;
  try {
    const available = await modelRegistry.getAvailable();
    const models = available.map(modelToInfo);
    mainWindow.webContents.send(IPC.MODELS_UPDATE, models);
  } catch {
    // non-critical
  }
}

function sendStatus(status: string, text: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC.STATUS_UPDATE, { status, text });
}

// ─── IPC handlers ────────────────────────────────────────────────────

function registerIpc() {
  ipcMain.handle(IPC.SEND_PROMPT, async (_e, message: string) => {
    if (!session) return { error: "No session" };
    if (!session.model) return { error: "No model configured. Select a model from the sidebar first." };
    try {
      sendStatus("streaming", "Agent is thinking…");
      if (session.isStreaming) {
        await session.steer(message);
      } else {
        await session.prompt(message);
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendStatus("error", msg);
      return { error: msg };
    }
  });

  ipcMain.handle(IPC.ABORT, async () => {
    if (!session) return;
    try {
      await session.abort();
      sendStatus("ready", "Aborted");
    } catch {
      // ignore
    }
  });

  ipcMain.handle(IPC.NEW_SESSION, async () => {
    await initSession(workingDir);
    sendStatus("ready", "New session started");
  });

  ipcMain.handle(IPC.GET_STATE, async () => {
    if (!session) return null;
    return {
      model: session.model ? modelToInfo(session.model) : null,
      thinkingLevel: session.thinkingLevel,
      isStreaming: session.isStreaming,
      sessionId: session.sessionId,
      messageCount: session.messages.length,
      workingDir,
    };
  });

  ipcMain.handle(IPC.GET_MESSAGES, async () => {
    if (!session) return [];
    return session.messages;
  });

  ipcMain.handle(IPC.GET_MODELS, async () => {
    if (!modelRegistry) return [];
    const available = await modelRegistry.getAvailable();
    return available.map(modelToInfo);
  });

  ipcMain.handle(IPC.SET_MODEL, async (_e, provider: string, modelId: string) => {
    if (!session || !modelRegistry) return { error: "No session" };
    try {
      const available = await modelRegistry.getAvailable();
      const model = available.find((m) => m.provider === provider && m.id === modelId);
      if (!model) return { error: `Model not found: ${provider}/${modelId}` };
      await session.setModel(model);
      pushState();
      pushAllModels();
      sendStatus("ready", `Switched to ${model.name}`);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  });

  ipcMain.handle(IPC.SET_THINKING, async (_e, level: string) => {
    if (!session) return;
    session.setThinkingLevel(level as ThinkingLevel);
    pushState();
  });

  ipcMain.handle(IPC.COMPACT, async () => {
    if (!session) return;
    try {
      sendStatus("compacting", "Compacting context…");
      await session.compact();
      sendStatus("ready", "Compaction complete");
      pushState();
      pushMessages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendStatus("error", `Compaction failed: ${msg}`);
    }
  });

  ipcMain.handle(IPC.SET_WORKING_DIR, async () => {
    if (!mainWindow) return;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select Working Directory",
      defaultPath: workingDir,
    });
    if (!result.canceled && result.filePaths.length > 0) {
      workingDir = result.filePaths[0];
      await initSession(workingDir);
      sendStatus("ready", `Working directory: ${workingDir}`);
    }
  });

  ipcMain.handle(IPC.QUIT, () => {
    app.quit();
  });

  ipcMain.on(IPC.DEBUG, (_e, msg: string) => {
    console.log("[renderer] " + msg);
  });

}

// ─── App lifecycle ───────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpc();
  createMenu();
  createWindow();

  // Initialize the session synchronously (awaited) so that modelRegistry
  // and session are ready before the renderer calls getModels() via IPC.
  try {
    await initSession(workingDir);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to initialize session:", msg);
    sendStatus("error", `Init failed: ${msg}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (unsubscribe) unsubscribe();
  if (session) session.dispose();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
