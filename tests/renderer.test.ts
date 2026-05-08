/**
 * Tests for the renderer pure functions and utilities.
 */

import { describe, it, expect } from "vitest";

// Replicate pure functions from renderer.js for testing
// (renderer.js uses window/document so can't be imported directly)

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

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${code}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return html;
}

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("renderMarkdown", () => {
  it("returns empty string for falsy input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown(null)).toBe("");
    expect(renderMarkdown(undefined)).toBe("");
  });

  it("renders inline code", () => {
    expect(renderMarkdown("use `console.log` here")).toBe(
      "use <code>console.log</code> here"
    );
  });

  it("renders bold text", () => {
    expect(renderMarkdown("this is **bold** text")).toBe(
      "this is <strong>bold</strong> text"
    );
  });

  it("renders italic text", () => {
    expect(renderMarkdown("this is *italic* text")).toBe(
      "this is <em>italic</em> text"
    );
  });

  it("renders code blocks", () => {
    const input = "```js\nconst x = 1\n```";
    const result = renderMarkdown(input);
    expect(result).toContain("<pre><code");
    expect(result).toContain("const x = 1");
    expect(result).toContain("</code></pre>");
  });

  it("escapes HTML in regular text", () => {
    expect(renderMarkdown("<b>not bold</b>")).toContain("&lt;b&gt;");
  });
});

describe("extractText", () => {
  it("handles string content", () => {
    expect(extractText("hello")).toBe("hello");
  });

  it("handles array of content blocks", () => {
    const content = [
      { type: "text", text: "hello " },
      { type: "text", text: "world" },
    ];
    expect(extractText(content)).toBe("hello \nworld");
  });

  it("filters non-text blocks from array", () => {
    const content = [
      { type: "text", text: "see image" },
      { type: "image", data: "base64..." },
      { type: "text", text: "above" },
    ];
    expect(extractText(content)).toBe("see image\nabove");
  });

  it("handles null/undefined", () => {
    expect(extractText(null)).toBe("");
    expect(extractText(undefined)).toBe("");
  });

  it("handles empty array", () => {
    expect(extractText([])).toBe("");
  });
});
