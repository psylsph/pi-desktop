/**
 * Tests for the pi SDK integration — verifies we can create sessions,
 * subscribe to events, and prompt the agent.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

describe("Pi SDK integration", () => {
  it("can import the SDK", async () => {
    // If this fails, the ESM import is broken
    expect(createAgentSession).toBeTypeOf("function");
    expect(AuthStorage).toBeDefined();
    expect(ModelRegistry).toBeDefined();
    expect(SessionManager).toBeDefined();
    expect(SettingsManager).toBeDefined();
  });

  it("can create AuthStorage", () => {
    const auth = AuthStorage.create();
    expect(auth).toBeDefined();
  });

  it("can create a ModelRegistry", () => {
    const auth = AuthStorage.create();
    const registry = ModelRegistry.create(auth);
    expect(registry).toBeDefined();
  });

  it("can create an in-memory session", async () => {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
    });

    const result = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      settingsManager,
    });

    expect(result).toBeDefined();
    expect(result.session).toBeDefined();
    expect(result.session.sessionId).toBeTypeOf("string");
    expect(result.session.messages).toEqual([]);
    expect(result.session.isStreaming).toBe(false);

    // Clean up
    result.session.dispose();
  });

  it("can subscribe and unsubscribe to events", async () => {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const settingsManager = SettingsManager.inMemory({});

    const result = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      settingsManager,
    });

    const events = [];
    const unsub = result.session.subscribe((event) => {
      events.push(event);
    });

    expect(unsub).toBeTypeOf("function");

    // Unsubscribe should not throw
    unsub();

    // Clean up
    result.session.dispose();
  });

  it("session exposes expected properties", async () => {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const settingsManager = SettingsManager.inMemory({});

    const result = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      settingsManager,
    });

    const session = result.session;

    // Check all properties we rely on in main.ts exist
    expect(session).toHaveProperty("sessionId");
    expect(session).toHaveProperty("messages");
    expect(session).toHaveProperty("isStreaming");
    expect(session).toHaveProperty("model");
    expect(session).toHaveProperty("thinkingLevel");
    expect(session).toHaveProperty("sessionFile");
    expect(session).toHaveProperty("subscribe");
    expect(session).toHaveProperty("dispose");
    expect(session).toHaveProperty("abort");
    expect(session).toHaveProperty("prompt");
    expect(session).toHaveProperty("steer");
    expect(session).toHaveProperty("setThinkingLevel");
    expect(session).toHaveProperty("compact");

    session.dispose();
  });

  it("can set thinking level", async () => {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const settingsManager = SettingsManager.inMemory({});

    const result = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      settingsManager,
    });

    const session = result.session;
    session.setThinkingLevel("high");
    expect(session.thinkingLevel).toBe("high");

    session.setThinkingLevel("off");
    expect(session.thinkingLevel).toBe("off");

    session.dispose();
  });
});
