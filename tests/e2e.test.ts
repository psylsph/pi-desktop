/**
 * E2E smoke test: verifies build output, DOM structure, and Electron launch.
 */

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

describe("Build output", () => {
  const distDir = path.join(projectRoot, "dist", "main");

  it("main process JS exists", () => {
    expect(fs.existsSync(path.join(distDir, "main.js"))).toBe(true);
  });

  it("preload script exists", () => {
    expect(fs.existsSync(path.join(distDir, "preload.cjs"))).toBe(true);
  });

  it("renderer files exist", () => {
    const rDir = path.join(distDir, "renderer");
    expect(fs.existsSync(path.join(rDir, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(rDir, "renderer.js"))).toBe(true);
    expect(fs.existsSync(path.join(rDir, "styles.css"))).toBe(true);
  });

  it("index.html references assets correctly", () => {
    const html = fs.readFileSync(path.join(distDir, "renderer", "index.html"), "utf-8");
    expect(html).toContain("renderer.js");
    expect(html).toContain("styles.css");
  });

  it("index.html has all required DOM elements", () => {
    const html = fs.readFileSync(path.join(distDir, "renderer", "index.html"), "utf-8");
    const requiredIds = [
      "messages", "prompt-input", "btn-send", "btn-abort",
      "btn-new-session", "btn-open-dir", "btn-sidebar-toggle",
      "btn-compact", "sidebar", "working-dir", "status-dot",
      "status-text", "model-info", "session-info", "thinking-levels",
      "model-select", "toast-container",
      // New elements
      "btn-export-md", "btn-export-json", "btn-theme-toggle",
      "session-history", "drop-overlay", "update-banner",
    ];
    for (const id of requiredIds) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("renderer.js handles all event types", () => {
    const js = fs.readFileSync(path.join(distDir, "renderer", "renderer.js"), "utf-8");
    const eventTypes = [
      "agent_start", "agent_end", "message_start", "message_update",
      "tool_execution_start", "tool_execution_update", "tool_execution_end",
    ];
    for (const t of eventTypes) {
      expect(js).toContain(`"${t}"`);
    }
  });

  it("preload script exposes the full API surface", () => {
    const js = fs.readFileSync(path.join(distDir, "preload.cjs"), "utf-8");
    const apiMethods = [
      "sendPrompt", "abort", "newSession", "getState", "getMessages",
      "getModels", "setModel", "setThinking", "compact", "setWorkingDir",
      "quit", "onSessionEvent", "onStateUpdate", "onMessagesUpdate",
      "onStatusUpdate", "onModelsUpdate",
      // New API methods
      "getVersion", "exportChat", "getSessionHistory", "restoreSession",
      "onUpdateAvailable",
    ];
    for (const m of apiMethods) {
      expect(js).toContain(m);
    }
  });

  it("main.ts registers SET_MODEL handler", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("SET_MODEL");
    expect(js).toContain("getAvailable");
  });

  it("main.ts auto-selects a model on init", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("getAvailable");
    expect(js).toContain("firstModel");
  });

  it("main.ts includes export functionality", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("EXPORT_CHAT");
    expect(js).toContain("markdown");
    expect(js).toContain("messagesToMarkdown");
  });

  it("main.ts includes session history", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("GET_SESSION_HISTORY");
    expect(js).toContain("RESTORE_SESSION");
    expect(js).toContain("getSessionHistory");
  });

  it("main.ts includes window state persistence", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("window-state.json");
    expect(js).toContain("persistWindowState");
  });

  it("main.ts includes auto-update check", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("checkForUpdates");
    expect(js).toContain("UPDATE_AVAILABLE");
  });

  it("main.ts includes version endpoint", () => {
    const js = fs.readFileSync(path.join(distDir, "main.js"), "utf-8");
    expect(js).toContain("GET_VERSION");
    expect(js).toContain("getVersion");
  });

  it("styles.css has light theme", () => {
    const css = fs.readFileSync(path.join(distDir, "renderer", "styles.css"), "utf-8");
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("--bg-primary");
    expect(css).toContain("--text-primary");
  });

  it("styles.css has code block wrapper styles", () => {
    const css = fs.readFileSync(path.join(distDir, "renderer", "styles.css"), "utf-8");
    expect(css).toContain("code-block-wrapper");
    expect(css).toContain("code-copy-btn");
    expect(css).toContain("code-line-numbers");
  });

  it("styles.css has drop overlay styles", () => {
    const css = fs.readFileSync(path.join(distDir, "renderer", "styles.css"), "utf-8");
    expect(css).toContain("drop-overlay");
  });

  it("styles.css has update banner styles", () => {
    const css = fs.readFileSync(path.join(distDir, "renderer", "styles.css"), "utf-8");
    expect(css).toContain("update-banner");
  });

  it("styles.css has session history styles", () => {
    const css = fs.readFileSync(path.join(distDir, "renderer", "styles.css"), "utf-8");
    expect(css).toContain("session-history");
  });
});

describe("Electron launch", () => {
  it.skipIf(process.env.CI === "true")("launches without crashing", async () => {
    const electronPath = path.join(projectRoot, "node_modules", ".bin", "electron");
    const child = spawn(electronPath, [projectRoot], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
    });

    const stderr: string[] = [];
    child.stderr.on("data", (d) => stderr.push(d.toString()));

    await new Promise((r) => setTimeout(r, 5000));

    const alive = child.pid && !child.killed;
    child.kill("SIGTERM");

    await new Promise<void>((r) => {
      child.on("exit", () => r());
      setTimeout(() => r(), 3000);
    });

    expect(alive).toBe(true);

    const err = stderr.join("");
    expect(err).not.toContain("Uncaught Exception");
    expect(err).not.toContain("ERR_FILE_NOT_FOUND");
  }, 15000);
});
