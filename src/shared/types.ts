/**
 * Shared types for IPC between main and renderer processes.
 */

// ─── Agent Events (mirrors pi SDK events) ────────────────────────────

export interface TextDeltaEvent {
  type: "text_delta";
  contentIndex: number;
  delta: string;
}

export interface ThinkingDeltaEvent {
  type: "thinking_delta";
  contentIndex: number;
  delta: string;
}

export interface ToolCallStartEvent {
  type: "toolcall_start";
  contentIndex: number;
  toolCall: { id: string; name: string; arguments: string };
}

export interface ToolCallDeltaEvent {
  type: "toolcall_delta";
  contentIndex: number;
  delta: string;
}

export interface ToolCallEndEvent {
  type: "toolcall_end";
  contentIndex: number;
  toolCall: { id: string; name: string; arguments: string };
}

export interface MessageDoneEvent {
  type: "done";
  reason: string;
}

export interface MessageErrorEvent {
  type: "error";
  reason: string;
}

export type AssistantMessageEvent =
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallEndEvent
  | MessageDoneEvent
  | MessageErrorEvent;

// ─── Agent session events forwarded to renderer ──────────────────────

export type SessionEventType =
  | "agent_start"
  | "agent_end"
  | "turn_start"
  | "turn_end"
  | "message_start"
  | "message_update"
  | "message_end"
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end"
  | "queue_update"
  | "compaction_start"
  | "compaction_end"
  | "error";

export interface SessionEvent {
  type: SessionEventType;
  [key: string]: unknown;
}

// ─── Model ───────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  reasoning: boolean;
}

// ─── Session info ────────────────────────────────────────────────────

export interface SessionState {
  model: ModelInfo | null;
  thinkingLevel: string;
  isStreaming: boolean;
  sessionFile: string | undefined;
  sessionId: string;
  sessionName: string | undefined;
  messageCount: number;
  contextUsage: { tokens: number; contextWindow: number; percent: number } | null;
}

// ─── Chat messages for the renderer ──────────────────────────────────

export interface UserMessage {
  role: "user";
  content: string;
  timestamp: number;
}

export interface AssistantTextBlock {
  type: "text";
  text: string;
}

export interface AssistantThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface AssistantToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  arguments: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: (AssistantTextBlock | AssistantThinkingBlock | AssistantToolCallBlock)[];
  stopReason?: string;
  timestamp: number;
}

export interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: { type: string; text: string }[];
  isError: boolean;
  timestamp: number;
}

export type ChatMessage = UserMessage | AssistantMessage | ToolResultMessage;

// ─── IPC channels ────────────────────────────────────────────────────

export const IPC = {
  // Renderer → Main
  SEND_PROMPT: "agent:prompt",
  ABORT: "agent:abort",
  NEW_SESSION: "agent:new-session",
  GET_STATE: "agent:get-state",
  GET_MESSAGES: "agent:get-messages",
  GET_MODELS: "agent:get-models",
  SET_MODEL: "agent:set-model",
  SET_THINKING: "agent:set-thinking",
  SET_WORKING_DIR: "agent:set-working-dir",
  COMPACT: "agent:compact",
  QUIT: "app:quit",
  DEBUG: "app:debug",
  GET_VERSION: "app:get-version",
  EXPORT_CHAT: "app:export-chat",
  GET_SESSION_HISTORY: "app:get-session-history",
  RESTORE_SESSION: "app:restore-session",

  // Main → Renderer
  SESSION_EVENT: "session:event",
  STATE_UPDATE: "session:state",
  MESSAGES_UPDATE: "session:messages",
  MODELS_UPDATE: "session:models",
  STATUS_UPDATE: "session:status",
  UPDATE_AVAILABLE: "app:update-available",
} as const;
