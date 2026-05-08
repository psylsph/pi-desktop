/**
 * Tests for shared types and IPC channel definitions.
 * Validates the contract between main and renderer processes.
 */

import { describe, it, expect } from "vitest";
import { IPC } from "../src/shared/types.js";

describe("IPC channels", () => {
  it("has all renderer-to-main channels", () => {
    expect(IPC.SEND_PROMPT).toBe("agent:prompt");
    expect(IPC.ABORT).toBe("agent:abort");
    expect(IPC.NEW_SESSION).toBe("agent:new-session");
    expect(IPC.GET_STATE).toBe("agent:get-state");
    expect(IPC.GET_MESSAGES).toBe("agent:get-messages");
    expect(IPC.GET_MODELS).toBe("agent:get-models");
    expect(IPC.SET_MODEL).toBe("agent:set-model");
    expect(IPC.SET_THINKING).toBe("agent:set-thinking");
    expect(IPC.SET_WORKING_DIR).toBe("agent:set-working-dir");
    expect(IPC.COMPACT).toBe("agent:compact");
    expect(IPC.QUIT).toBe("app:quit");
  });

  it("has all main-to-renderer channels", () => {
    expect(IPC.SESSION_EVENT).toBe("session:event");
    expect(IPC.STATE_UPDATE).toBe("session:state");
    expect(IPC.MESSAGES_UPDATE).toBe("session:messages");
    expect(IPC.MODELS_UPDATE).toBe("session:models");
    expect(IPC.STATUS_UPDATE).toBe("session:status");
  });

  it("has no duplicate channel names", () => {
    const values = Object.values(IPC);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
