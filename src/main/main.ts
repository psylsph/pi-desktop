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
import * as fs from "node:fs";
import * as os from "node:os";
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

// ─── Window state persistence ────────────────────────────────────────

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getWindowStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(getWindowStatePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return { width: 1100, height: 800, isMaximized: false };
  }
}

function saveWindowState(state: WindowState): void {
  try {
    fs.mkdirSync(path.dirname(getWindowStatePath()), { recursive: true });
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
  } catch {
    // non-critical
  }
}

// ─── Sound playback ──────────────────────────────────────────────────

function playSound(name: "complete" | "error"): void {
  try {
    // Use the system bell / notification sound
    if (process.platform === "darwin") {
      const sound = name === "complete" ? "Glass" : "Basso";
      import("node:child_process").then(({ exec }) => {
        exec(`afplay /System/Library/Sounds/${sound}.aiff`);
      });
    } else if (process.platform === "linux") {
      import("node:child_process").then(({ exec }) => {
        exec("which paplay && paplay /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null || true");
      });
    }
    // Windows: no simple built-in; renderer can handle it
  } catch {
    // non-critical
  }
}

// ─── Menu creation ───────────────────────────────────────────────────

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
        {
          label: "Export Chat as Markdown",
          click: async () => {
            if (mainWindow) {
              await handleExportChat("markdown");
            }
          },
        },
        {
          label: "Export Chat as JSON",
          click: async () => {
            if (mainWindow) {
              await handleExportChat("json");
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
  const savedState = loadWindowState();

  const options: Electron.BrowserWindowConstructorOptions = {
    width: savedState.width,
    height: savedState.height,
    minWidth: 600,
    minHeight: 400,
    title: "Pi Desktop",
    backgroundColor: "#1a1b26",
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  if (savedState.x !== undefined && savedState.y !== undefined) {
    options.x = savedState.x;
    options.y = savedState.y;
  }

  mainWindow = new BrowserWindow(options);

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(import.meta.dirname, "renderer", "index.html"));

  // Persist window state on changes
  const saveDebounce = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(persistWindowState, 500);
    };
  })();

  mainWindow.on("resize", saveDebounce);
  mainWindow.on("move", saveDebounce);
  mainWindow.on("maximize", saveDebounce);
  mainWindow.on("unmaximize", saveDebounce);

  mainWindow.on("closed", () => {
    persistWindowState();
    mainWindow = null;
  });
}

function persistWindowState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    });
  } catch {
    // ignore
  }
}

// ─── Agent lifecycle ─────────────────────────────────────────────────

async function initSession(cwd: string, sessionFile?: string) {
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
  const sessionManager = SessionManager.create(cwd);

  // Find an available model before creating the session
  const available = await modelRegistry.getAvailable();
  const firstModel = available.length > 0 ? available[0] : undefined;

  const result = await createAgentSession({
    cwd,
    model: firstModel,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager,
    ...(sessionFile ? { sessionFile } : {}),
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
      playSound("complete");
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
    case "error":
      playSound("error");
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

// ─── Export ──────────────────────────────────────────────────────────

async function handleExportChat(format: "json" | "markdown"): Promise<void> {
  if (!mainWindow || !session) return;

  const messages = session.messages;
  if (!messages || messages.length === 0) {
    sendStatus("ready", "No messages to export");
    return;
  }

  const ext = format === "json" ? "json" : "md";
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export Chat as ${format === "json" ? "JSON" : "Markdown"}`,
    defaultPath: `pi-chat-${new Date().toISOString().slice(0, 10)}.${ext}`,
    filters: [
      { name: format === "json" ? "JSON" : "Markdown", extensions: [ext] },
    ],
  });

  if (result.canceled || !result.filePath) return;

  try {
    let content: string;
    if (format === "json") {
      content = JSON.stringify(messages, null, 2);
    } else {
      content = messagesToMarkdown(messages);
    }
    fs.writeFileSync(result.filePath, content, "utf-8");
    sendStatus("ready", `Chat exported to ${result.filePath}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendStatus("error", `Export failed: ${msg}`);
  }
}

function messagesToMarkdown(messages: any[]): string {
  const lines: string[] = ["# Pi Desktop Chat Export", "", `Exported: ${new Date().toISOString()}`, ""];

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push("## 👤 User", "");
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text || "").join("\n")
          : String(msg.content || "");
      lines.push(text, "");
    } else if (msg.role === "assistant") {
      lines.push("## 🤖 Pi", "");
      for (const block of msg.content || []) {
        if (block.type === "text") {
          lines.push(block.text, "");
        } else if (block.type === "thinking") {
          lines.push("<details><summary>💭 Thinking</summary>", "");
          lines.push(block.thinking, "");
          lines.push("</details>", "");
        } else if (block.type === "toolCall") {
          lines.push(`<details><summary>🔧 ${block.name}</summary>`, "");
          lines.push("```", block.arguments || "", "```", "");
          lines.push("</details>", "");
        }
      }
    } else if (msg.role === "toolResult") {
      const output = (msg.content || []).map((c: any) => c.text || "").join("\n");
      lines.push(`<details><summary>📄 ${msg.toolName || "Tool"} result</summary>`, "");
      lines.push("```", output, "```", "");
      lines.push("</details>", "");
    }
  }

  return lines.join("\n");
}

// ─── Session history ─────────────────────────────────────────────────

interface SessionHistoryEntry {
  filename: string;
  id: string;
  timestamp: string;
  cwd: string;
  messageCount: number;
}

function getSessionHistoryDir(): string {
  // Normalize workingDir to match SessionManager's directory naming
  const normalized = workingDir.replace(/\/+$/, "");
  const safeName = normalized.replace(/\//g, "--").replace(/^--/, "--");
  return path.join(os.homedir(), ".pi", "agent", "sessions", safeName);
}

async function getSessionHistory(): Promise<SessionHistoryEntry[]> {
  const dir = getSessionHistoryDir();
  if (!fs.existsSync(dir)) return [];

  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".jsonl"))
      .sort()
      .reverse(); // newest first

    const entries: SessionHistoryEntry[] = [];
    for (const file of files.slice(0, 20)) { // limit to 20
      try {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const lines = content.split("\n").filter(l => l.trim());
        let header: any = null;
        let msgCount = 0;

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "session") header = parsed;
            if (parsed.type === "message") msgCount++;
          } catch { /* skip malformed lines */ }
        }

        if (header) {
          entries.push({
            filename: file,
            id: header.id || file,
            timestamp: header.timestamp || file.split("_")[0],
            cwd: header.cwd || workingDir,
            messageCount: msgCount,
          });
        }
      } catch { /* skip unreadable files */ }
    }

    return entries;
  } catch {
    return [];
  }
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

  // New IPC handlers

  ipcMain.handle(IPC.GET_VERSION, async () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC.EXPORT_CHAT, async (_e, format: "json" | "markdown") => {
    await handleExportChat(format);
    return { success: true };
  });

  ipcMain.handle(IPC.GET_SESSION_HISTORY, async () => {
    return await getSessionHistory();
  });

  ipcMain.handle(IPC.RESTORE_SESSION, async (_e, sessionFile: string) => {
    try {
      const dir = getSessionHistoryDir();
      const fullPath = path.join(dir, sessionFile);
      // Validate the file exists and is within the sessions directory
      if (!fullPath.startsWith(dir) || !fs.existsSync(fullPath)) {
        return { error: "Session file not found" };
      }
      await initSession(workingDir, fullPath);
      sendStatus("ready", "Session restored");
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  });
}

// ─── Auto-update check ───────────────────────────────────────────────

async function checkForUpdates(): Promise<void> {
  try {
    const currentVersion = app.getVersion();
    const response = await fetch("https://api.github.com/repos/psylsph/pi-desktop/releases/latest");
    if (!response.ok) return;

    const data = await response.json() as { tag_name?: string; html_url?: string };
    const latestTag = data.tag_name;
    if (!latestTag) return;

    const latestVersion = latestTag.replace(/^v/, "");
    if (latestVersion !== currentVersion && latestVersion > currentVersion) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.UPDATE_AVAILABLE, {
          version: latestVersion,
          url: data.html_url || `https://github.com/psylsph/pi-desktop/releases/tag/${latestTag}`,
        });
      }
    }
  } catch {
    // non-critical — network may be unavailable
  }
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

  // Check for updates in the background (non-blocking)
  checkForUpdates();

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
