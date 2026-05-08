/**
 * Pi Desktop — Renderer
 *
 * Handles UI, IPC communication with main process, and message rendering.
 */

const api = window.piDesktop;

// ─── DOM references ──────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const messagesEl = $("messages");
const promptInput = $("prompt-input");
const btnSend = $("btn-send");
const btnAbort = $("btn-abort");
const btnNewSession = $("btn-new-session");
const btnOpenDir = $("btn-open-dir");
const btnSidebarToggle = $("btn-sidebar-toggle");
const btnCompact = $("btn-compact");
const btnExportMd = $("btn-export-md");
const btnExportJson = $("btn-export-json");
const btnThemeToggle = $("btn-theme-toggle");
const sidebar = $("sidebar");
const workingDirEl = $("working-dir");
const statusDot = $("status-dot");
const statusText = $("status-text");
const modelInfoEl = $("model-info");
const sessionInfoEl = $("session-info");
const thinkingLevels = $("thinking-levels");
const modelSelect = $("model-select");
const toastContainer = $("toast-container");
const sessionHistoryEl = $("session-history");
const dropOverlay = $("drop-overlay");
const updateBanner = $("update-banner");
const updateBannerText = $("update-banner-text");
const updateBannerLink = $("update-banner-link");
const updateBannerClose = $("update-banner-close");

// ─── State ───────────────────────────────────────────────────────────

let currentState = { isStreaming: false, thinkingLevel: "medium", model: null, workingDir: "~" };
let allModels = [];
let messages = [];
let streamingText = "";
let streamingThinking = "";
let currentToolCalls = new Map();
let isStreaming = false;
let appVersion = "0.0.0";
let currentTheme = "dark";

// ─── Sound effects (Web Audio API) ───────────────────────────────────

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playBeep(frequency, duration, volume) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.value = volume || 0.1;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.2));
    oscillator.stop(ctx.currentTime + (duration || 0.2));
  } catch {
    // non-critical
  }
}

function playCompleteSound() {
  playBeep(880, 0.1, 0.08);
  setTimeout(() => playBeep(1100, 0.15, 0.08), 120);
}

function playErrorSound() {
  playBeep(300, 0.2, 0.08);
}

// ─── Theme management ────────────────────────────────────────────────

function loadTheme() {
  try {
    const saved = localStorage.getItem("pi-desktop-theme");
    if (saved === "light" || saved === "dark") {
      currentTheme = saved;
    }
  } catch { /* localStorage unavailable */ }
  applyTheme();
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  const darkIcon = $("theme-icon-dark");
  const lightIcon = $("theme-icon-light");
  if (darkIcon && lightIcon) {
    darkIcon.style.display = currentTheme === "dark" ? "" : "none";
    lightIcon.style.display = currentTheme === "light" ? "" : "none";
  }
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("pi-desktop-theme", currentTheme);
  } catch { /* ignore */ }
  applyTheme();
}

// ─── Initialization ──────────────────────────────────────────────────

function init() {
  loadTheme();
  bindButtons();
  bindInput();
  bindThinkingLevels();
  bindModelSelector();
  bindIpcListeners();
  bindDragDrop();
  bindUpdateBanner();
  loadInitialState();
}

function bindButtons() {
  btnSend.addEventListener("click", sendPrompt);
  btnAbort.addEventListener("click", () => api.abort());
  btnNewSession.addEventListener("click", async () => {
    showToast("Starting new session…", "info");
    await api.newSession();
    showToast("New session started", "success");
    loadSessionHistory();
  });
  btnOpenDir.addEventListener("click", () => api.setWorkingDir());
  btnCompact.addEventListener("click", async () => {
    showToast("Compacting context…", "info");
    await api.compact();
  });
  btnSidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
  btnExportMd.addEventListener("click", async () => {
    showToast("Exporting chat as Markdown…", "info");
    await api.exportChat("markdown");
    showToast("Chat exported", "success");
  });
  btnExportJson.addEventListener("click", async () => {
    showToast("Exporting chat as JSON…", "info");
    await api.exportChat("json");
    showToast("Chat exported", "success");
  });
  btnThemeToggle.addEventListener("click", toggleTheme);
}

function bindInput() {
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + "px";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isStreaming) {
      api.abort();
    }
  });
}

function bindThinkingLevels() {
  thinkingLevels.addEventListener("click", (e) => {
    const btn = e.target.closest(".level-btn");
    if (!btn) return;
    const level = btn.dataset.level;
    api.setThinking(level);
    updateThinkingUI(level);
  });
}

function bindModelSelector() {
  modelSelect.addEventListener("change", async () => {
    const val = modelSelect.value;
    if (!val) return;
    const [provider, ...rest] = val.split("/");
    const modelId = rest.join("/");
    showToast(`Switching to ${modelSelect.options[modelSelect.selectedIndex].text}…`, "info");
    const result = await api.setModel(provider, modelId);
    if (result.error) {
      showToast(result.error, "error");
    } else if (result.success) {
      showToast(`Switched model`, "success");
    }
  });
}

function bindIpcListeners() {
  api.onSessionEvent(handleSessionEvent);
  api.onStateUpdate(handleStateUpdate);
  api.onMessagesUpdate(handleMessagesUpdate);
  api.onStatusUpdate(handleStatusUpdate);
  api.onModelsUpdate(handleModelsUpdate);

  // Menu event listeners
  api.onToggleSidebar(() => {
    sidebar.classList.toggle("collapsed");
  });

  api.onShowShortcuts(showShortcutsDialog);
  api.onShowAbout(showAboutDialog);

  // Update available
  api.onUpdateAvailable((data) => {
    if (data && data.version) {
      updateBannerText.textContent = `Version ${data.version} is available!`;
      updateBannerLink.href = data.url || "#";
      updateBanner.style.display = "flex";
    }
  });
}

function bindUpdateBanner() {
  updateBannerClose.addEventListener("click", () => {
    updateBanner.style.display = "none";
  });
}

// ─── Drag & drop ─────────────────────────────────────────────────────

function bindDragDrop() {
  let dragCounter = 0;

  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      dropOverlay.style.display = "flex";
    }
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      dropOverlay.style.display = "none";
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.style.display = "none";

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const paths = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].path) {
        paths.push(files[i].path);
      }
    }

    if (paths.length > 0) {
      const text = paths.length === 1
        ? paths[0]
        : paths.map(p => `- ${p}`).join("\n");
      promptInput.value = promptInput.value
        ? promptInput.value + "\n" + text
        : text;
      promptInput.style.height = "auto";
      promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + "px";
      promptInput.focus();
      showToast(`${paths.length} file${paths.length > 1 ? "s" : ""} added`, "info");
    }
  });
}

// ─── Session history ─────────────────────────────────────────────────

async function loadSessionHistory() {
  try {
    const history = await api.getSessionHistory();
    renderSessionHistory(history);
  } catch (e) {
    console.error("[renderer] getSessionHistory error:", e);
  }
}

function renderSessionHistory(entries) {
  sessionHistoryEl.innerHTML = "";

  if (!entries || entries.length === 0) {
    sessionHistoryEl.innerHTML = '<div class="session-history-empty">No previous sessions</div>';
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("button");
    item.className = "session-history-item";

    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const cwdShort = (entry.cwd || "").replace(/^\/home\/[^/]+/, "~").split("/").pop() || entry.cwd;

    item.innerHTML = `
      <div class="session-history-date">${dateStr} ${timeStr}</div>
      <div class="session-history-meta">${cwdShort} • ${entry.messageCount} msgs</div>
    `;

    item.addEventListener("click", async () => {
      showToast("Restoring session…", "info");
      const result = await api.restoreSession(entry.filename);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Session restored", "success");
        loadSessionHistory();
      }
    });

    sessionHistoryEl.appendChild(item);
  }
}

// ─── Initial state ───────────────────────────────────────────────────

async function loadInitialState() {
  try {
    appVersion = await api.getVersion() || "0.0.0";
  } catch (e) { console.error("[renderer] getVersion error:", e); }

  try {
    const state = await api.getState();
    if (state) handleStateUpdate(state);
  } catch (e) { console.error("[renderer] getState error:", e); }

  try {
    const models = await api.getModels();
    if (models && models.length > 0) {
      handleModelsUpdate(models);
    }
  } catch (e) { console.error("[renderer] getModels error:", e); }

  try {
    const msgs = await api.getMessages();
    if (msgs && msgs.length > 0) handleMessagesUpdate(msgs);
  } catch (e) { console.error("[renderer] getMessages error:", e); }

  loadSessionHistory();
}

// ─── Send prompt ─────────────────────────────────────────────────────

async function sendPrompt() {
  const text = promptInput.value.trim();
  if (!text) return;

  if (!currentState.model) {
    showToast("No model selected. Pick a model from the sidebar first.", "error");
    return;
  }

  promptInput.value = "";
  promptInput.style.height = "auto";

  appendUserMessage(text);

  const result = await api.sendPrompt(text);
  if (result.error) {
    showToast(result.error, "error");
    appendSystemMessage(result.error);
  }
}

// ─── Event handlers ──────────────────────────────────────────────────

function handleSessionEvent(event) {
  switch (event.type) {
    case "agent_start":
      isStreaming = true;
      updateStreamUI(true);
      break;

    case "agent_end":
      isStreaming = false;
      finalizeStreaming();
      updateStreamUI(false);
      playCompleteSound();
      promptInput.focus();
      break;

    case "message_start":
      if (event.message?.role === "assistant") {
        startStreamingMessage();
      }
      break;

    case "message_update": {
      const ame = event.assistantMessageEvent;
      if (!ame) break;

      switch (ame.type) {
        case "text_delta":
          streamingText += ame.delta;
          updateStreamingText();
          break;

        case "thinking_delta":
          streamingThinking += ame.delta;
          updateStreamingThinking();
          break;

        case "toolcall_start":
          currentToolCalls.set(ame.toolCall.id, {
            name: ame.toolCall.name,
            arguments: ame.toolCall.arguments,
            status: "running",
            output: "",
          });
          renderStreamingToolCalls();
          break;

        case "toolcall_end": {
          const tc = currentToolCalls.get(ame.toolCall.id);
          if (tc) {
            tc.arguments = ame.toolCall.arguments;
          }
          renderStreamingToolCalls();
          break;
        }
      }
      break;
    }

    case "tool_execution_start":
      if (event.toolCallId) {
        const existing = currentToolCalls.get(event.toolCallId);
        if (existing) {
          existing.status = "running";
        } else {
          currentToolCalls.set(event.toolCallId, {
            name: event.toolName,
            arguments: JSON.stringify(event.args || {}),
            status: "running",
            output: "",
          });
        }
        renderStreamingToolCalls();
      }
      break;

    case "tool_execution_update":
      if (event.toolCallId) {
        const tc = currentToolCalls.get(event.toolCallId);
        if (tc && event.partialResult?.content) {
          tc.output = event.partialResult.content
            .map((c) => c.text || "")
            .join("\n");
          renderStreamingToolCalls();
        }
      }
      break;

    case "tool_execution_end":
      if (event.toolCallId) {
        const tc = currentToolCalls.get(event.toolCallId);
        if (tc) {
          tc.status = event.isError ? "error" : "success";
          if (event.result?.content) {
            tc.output = event.result.content
              .map((c) => c.text || "")
              .join("\n");
          }
          renderStreamingToolCalls();
        }
      }
      break;

    case "error":
      showToast(event.message || "Unknown error", "error");
      appendSystemMessage(event.message || "Unknown error");
      playErrorSound();
      promptInput.focus();
      break;
  }

  scrollToBottom();
}

function handleStateUpdate(state) {
  currentState = state;

  if (state.model) {
    modelInfoEl.textContent = `${state.model.provider}/${state.model.name}`;
    document.title = `Pi Desktop — ${state.model.name}`;
  } else {
    modelInfoEl.textContent = "No model — select one above";
  }

  if (state.sessionId) {
    sessionInfoEl.textContent = `Session: ${state.sessionId.slice(0, 8)}… • ${state.messageCount || 0} msgs`;
  }

  if (state.workingDir) {
    workingDirEl.textContent = state.workingDir.replace(/^\/home\/[^/]+/, "~");
  }

  updateThinkingUI(state.thinkingLevel);
  updateModelSelectFromState();
}

function handleMessagesUpdate(msgs) {
  messages = msgs;
  rebuildMessages();
}

function handleModelsUpdate(models) {
  allModels = models;
  populateModelSelect();
}

function handleStatusUpdate({ status, text }) {
  statusText.textContent = text;

  statusDot.className = "status-dot";
  if (status === "streaming") statusDot.classList.add("streaming");
  else if (status === "error") statusDot.classList.add("error");
  else if (status === "tool") statusDot.classList.add("tool");
  else if (status === "compacting") statusDot.classList.add("compacting");
}

// ─── Model selector ──────────────────────────────────────────────────

function populateModelSelect() {
  const prev = modelSelect.value;
  modelSelect.innerHTML = "";

  if (allModels.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No models found — check API keys";
    modelSelect.appendChild(opt);
    return;
  }

  // Group by provider
  const groups = {};
  for (const m of allModels) {
    if (!groups[m.provider]) groups[m.provider] = [];
    groups[m.provider].push(m);
  }

  for (const [provider, models] of Object.entries(groups)) {
    const group = document.createElement("optgroup");
    group.label = provider;
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = `${m.provider}/${m.id}`;
      opt.textContent = m.name;
      group.appendChild(opt);
    }
    modelSelect.appendChild(group);
  }

  // Restore previous selection or match current state
  updateModelSelectFromState();

  if (!modelSelect.value && prev) {
    modelSelect.value = prev;
  }
}

function updateModelSelectFromState() {
  if (currentState.model && allModels.length > 0) {
    const val = `${currentState.model.provider}/${currentState.model.id}`;
    modelSelect.value = val;
  }
}

// ─── Message rendering ───────────────────────────────────────────────

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n");
  }
  return String(content || "");
}

function rebuildMessages() {
  const welcome = messagesEl.querySelector(".welcome-message");
  messagesEl.innerHTML = "";
  if (messages.length === 0) {
    if (welcome) messagesEl.appendChild(welcome);
    return;
  }

  for (const msg of messages) {
    if (msg.role === "user") {
      appendUserMessage(extractText(msg.content), false);
    } else if (msg.role === "assistant") {
      appendAssistantMessage(msg);
    } else if (msg.role === "toolResult") {
      appendToolResult(msg);
    }
  }
  scrollToBottom();
}

function appendUserMessage(text, scroll = true) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = "msg msg-user";
  div.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(div);
  if (scroll) scrollToBottom();
}

function appendAssistantMessage(msg) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = "msg msg-assistant";

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = "Pi";
  div.appendChild(label);

  for (const block of msg.content || []) {
    if (block.type === "text") {
      const bubble = document.createElement("div");
      bubble.className = "msg-bubble";
      bubble.innerHTML = renderMarkdown(block.text);
      addCodeBlockButtons(bubble);
      div.appendChild(bubble);
    } else if (block.type === "thinking") {
      const thinkDiv = document.createElement("div");
      thinkDiv.className = "thinking-block";
      thinkDiv.textContent = block.thinking;
      thinkDiv.style.display = "none";

      const toggle = document.createElement("div");
      toggle.className = "thinking-toggle";
      toggle.textContent = "▶ Thinking";
      toggle.addEventListener("click", () => {
        thinkDiv.style.display = thinkDiv.style.display === "none" ? "block" : "none";
        toggle.textContent = thinkDiv.style.display === "none" ? "▶ Thinking" : "▼ Thinking";
      });

      div.appendChild(toggle);
      div.appendChild(thinkDiv);
    } else if (block.type === "toolCall") {
      const toolDiv = createToolBlock(block.name, block.arguments, "", "pending");
      div.appendChild(toolDiv);
    }
  }

  messagesEl.appendChild(div);
}

function appendToolResult(msg) {
  const output = (msg.content || []).map((c) => c.text || "").join("\n");
  const div = createToolBlock(msg.toolName, "", output, msg.isError ? "error" : "success");
  messagesEl.appendChild(div);
  scrollToBottom();
}

function createToolBlock(name, args, output, status) {
  const div = document.createElement("div");
  div.className = "tool-block";

  const header = document.createElement("div");
  header.className = "tool-header";

  const nameEl = document.createElement("span");
  nameEl.className = "tool-name";
  nameEl.textContent = name;

  const statusEl = document.createElement("span");
  statusEl.className = `tool-status ${status}`;
  statusEl.textContent =
    status === "running" ? "⏳ Running…"
    : status === "error" ? "✗ Error"
    : status === "success" ? "✓ Done"
    : "⏸ Pending";

  header.appendChild(nameEl);
  header.appendChild(statusEl);
  div.appendChild(header);

  if (args) {
    try {
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      const body = document.createElement("div");
      body.className = "tool-body tool-args";
      body.textContent = typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed);
      div.appendChild(body);
    } catch {
      const body = document.createElement("div");
      body.className = "tool-body tool-args";
      body.textContent = String(args);
      div.appendChild(body);
    }
  }

  if (output) {
    const body = document.createElement("div");
    body.className = "tool-body";
    body.textContent = output;
    div.appendChild(body);
  }

  return div;
}

function appendSystemMessage(text) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = "msg msg-system";
  div.innerHTML = `<div class="msg-bubble system-bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

// ─── Code block buttons (copy, line numbers) ─────────────────────────

function addCodeBlockButtons(container) {
  const preBlocks = container.querySelectorAll("pre");
  preBlocks.forEach((pre) => {
    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    // Add line numbers
    const code = pre.querySelector("code") || pre;
    const text = code.textContent || "";
    const lines = text.split("\n");
    // Remove trailing empty line
    if (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    const lineNumbersDiv = document.createElement("div");
    lineNumbersDiv.className = "code-line-numbers";
    lineNumbersDiv.innerHTML = lines.map((_, i) =>
      `<span class="line-num">${i + 1}</span>`
    ).join("");

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
      } catch {
        copyBtn.textContent = "Failed";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
      }
    });

    // Build the wrapper
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(lineNumbersDiv);
    wrapper.appendChild(copyBtn);

    pre.classList.add("code-block-content");
  });
}

// ─── Streaming message rendering ─────────────────────────────────────

let streamingDiv = null;
let streamingTextEl = null;
let streamingThinkingEl = null;
let streamingThinkToggle = null;

function startStreamingMessage() {
  removeWelcome();
  streamingText = "";
  streamingThinking = "";
  currentToolCalls.clear();

  streamingDiv = document.createElement("div");
  streamingDiv.className = "msg msg-assistant streaming";
  streamingDiv.id = "streaming-msg";

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = "Pi";
  streamingDiv.appendChild(label);

  streamingThinkToggle = document.createElement("div");
  streamingThinkToggle.className = "thinking-toggle";
  streamingThinkToggle.textContent = "▶ Thinking";
  streamingThinkToggle.style.display = "none";
  streamingThinkToggle.addEventListener("click", () => {
    const visible = streamingThinkingEl.style.display !== "none";
    streamingThinkingEl.style.display = visible ? "none" : "block";
    streamingThinkToggle.textContent = visible ? "▶ Thinking" : "▼ Thinking";
  });

  streamingThinkingEl = document.createElement("div");
  streamingThinkingEl.className = "thinking-block";
  streamingThinkingEl.style.display = "none";

  streamingDiv.appendChild(streamingThinkToggle);
  streamingDiv.appendChild(streamingThinkingEl);

  streamingTextEl = document.createElement("div");
  streamingTextEl.className = "msg-bubble";
  streamingDiv.appendChild(streamingTextEl);

  const toolContainer = document.createElement("div");
  toolContainer.id = "streaming-tools";
  streamingDiv.appendChild(toolContainer);

  messagesEl.appendChild(streamingDiv);
  scrollToBottom();
}

function updateStreamingText() {
  if (!streamingTextEl) return;
  streamingTextEl.innerHTML = renderMarkdown(streamingText) + '<span class="streaming-cursor"></span>';
  scrollToBottom();
}

function updateStreamingThinking() {
  if (!streamingThinkingEl || !streamingThinkToggle) return;
  if (streamingThinking) {
    streamingThinkToggle.style.display = "flex";
    streamingThinkingEl.textContent = streamingThinking;
  }
  scrollToBottom();
}

function renderStreamingToolCalls() {
  const container = document.getElementById("streaming-tools");
  if (!container) return;
  container.innerHTML = "";
  for (const [id, tc] of currentToolCalls) {
    const block = createToolBlock(tc.name, tc.arguments, tc.output, tc.status);
    container.appendChild(block);
  }
  scrollToBottom();
}

function finalizeStreaming() {
  const cursor = streamingTextEl?.querySelector(".streaming-cursor");
  if (cursor) cursor.remove();

  // Add code block buttons to finalized message
  if (streamingTextEl) {
    addCodeBlockButtons(streamingTextEl);
  }

  if (streamingDiv) {
    streamingDiv.classList.remove("streaming");
    streamingDiv.removeAttribute("id");
  }

  streamingDiv = null;
  streamingTextEl = null;
  streamingThinkingEl = null;
  streamingThinkToggle = null;
  streamingText = "";
  streamingThinking = "";
  currentToolCalls.clear();
}

function updateStreamUI(streaming) {
  btnSend.style.display = streaming ? "none" : "flex";
  btnAbort.style.display = streaming ? "flex" : "none";
  promptInput.disabled = streaming;
}

// ─── Toast notifications ─────────────────────────────────────────────

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── UI helpers ──────────────────────────────────────────────────────

function updateThinkingUI(level) {
  if (!level) return;
  const btns = thinkingLevels.querySelectorAll(".level-btn");
  btns.forEach((b) => {
    b.classList.toggle("active", b.dataset.level === level);
  });
}

function showShortcutsDialog() {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";
  dialog.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-content">
        <table class="shortcuts-table">
          <tr><td><kbd>Enter</kbd></td><td>Send message</td></tr>
          <tr><td><kbd>Shift</kbd> + <kbd>Enter</kbd></td><td>New line</td></tr>
          <tr><td><kbd>Escape</kbd></td><td>Abort current request</td></tr>
          <tr><td><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>N</kbd></td><td>New session</td></tr>
          <tr><td><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>O</kbd></td><td>Open project</td></tr>
          <tr><td><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>B</kbd></td><td>Toggle sidebar</td></tr>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const closeBtn = dialog.querySelector(".modal-close");
  closeBtn.addEventListener("click", () => dialog.remove());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

function showAboutDialog() {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";
  dialog.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>About Pi Desktop</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-content">
        <div style="text-align: center; margin-bottom: 20px;">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2" style="color: #7aa2f7;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 12h8M12 8v8"/>
          </svg>
        </div>
        <h3 style="text-align: center; margin-bottom: 10px;">Pi Desktop</h3>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 20px;">Version ${escapeHtml(appVersion)}</p>
        <p style="text-align: center; margin-bottom: 10px;">
          A cross-platform desktop application for the pi coding agent.
        </p>
        <p style="text-align: center; margin-bottom: 20px;">
          Built with Electron, TypeScript, and the pi SDK.
        </p>
        <div style="text-align: center;">
          <a href="https://github.com/psylsph/pi-desktop" target="_blank" style="color: var(--accent);">GitHub Repository</a>
        </div>
        <p style="text-align: center; color: var(--text-muted); margin-top: 20px; font-size: 0.9em;">
          © ${new Date().getFullYear()} Stuart Harding • MIT License
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const closeBtn = dialog.querySelector(".modal-close");
  closeBtn.addEventListener("click", () => dialog.remove());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

function removeWelcome() {
  const welcome = messagesEl.querySelector(".welcome-message");
  if (welcome) welcome.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// ─── Utilities ───────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  // Fenced code blocks (must come before inline patterns)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const lines = code.split("\n");
    if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    const lineNums = lines.map((_, i) =>
      `<span class="line-num">${i + 1}</span>`
    ).join("");
    return `<div class="code-block-wrapper"><button class="code-copy-btn" onclick="this.__copy(this)">Copy</button><div class="code-line-numbers">${lineNums}</div><pre class="code-block-content"><code class="lang-${lang}">${code}</code></pre></div>`;
  });

  // Inline code (before other inline patterns)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  return html;
}

// Global copy handler for inline code block buttons from renderMarkdown
window.__copy = async function(btn) {
  const pre = btn.parentElement.querySelector("pre");
  if (pre) {
    try {
      await navigator.clipboard.writeText(pre.textContent || "");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    } catch {
      btn.textContent = "Failed";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    }
  }
};

// ─── Start ───────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", init);
