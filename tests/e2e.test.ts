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

  it("preload JS exists", () => {
    expect(fs.existsSync(path.join(distDir, "preload.js"))).toBe(true);
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

  it("preload.js exposes the full API surface", () => {
    const js = fs.readFileSync(path.join(distDir, "preload.js"), "utf-8");
    const apiMethods = [
      "sendPrompt", "abort", "newSession", "getState", "getMessages",
      "getModels", "setModel", "setThinking", "compact", "setWorkingDir",
      "quit", "onSessionEvent", "onStateUpdate", "onMessagesUpdate",
      "onStatusUpdate", "onModelsUpdate",
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
});

describe("Electron launch", () => {
  it("launches without crashing", async () => {
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
