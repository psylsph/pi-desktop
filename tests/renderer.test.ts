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

  // Fenced code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const lines = code.split("\n");
    if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    const lineNums = lines.map((_, i) =>
      `<span class="line-num">${i + 1}</span>`
    ).join("");
    return `<div class="code-block-wrapper"><button class="code-copy-btn" onclick="this.__copy(this)">Copy</button><div class="code-line-numbers">${lineNums}</div><pre class="code-block-content"><code class="lang-${lang}">${code}</code></pre></div>`;
  });

  // Inline code
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

  it("renders code blocks with wrapper and line numbers", () => {
    const input = "```js\nconst x = 1\n```";
    const result = renderMarkdown(input);
    expect(result).toContain("code-block-wrapper");
    expect(result).toContain("code-copy-btn");
    expect(result).toContain("code-line-numbers");
    expect(result).toContain("const x = 1");
    expect(result).toContain("lang-js");
  });

  it("renders code blocks with multiple lines", () => {
    const input = "```\nline1\nline2\nline3\n```";
    const result = renderMarkdown(input);
    expect(result).toContain('<span class="line-num">1</span>');
    expect(result).toContain('<span class="line-num">2</span>');
    expect(result).toContain('<span class="line-num">3</span>');
  });

  it("renders h1 headers", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
  });

  it("renders h2 headers", () => {
    expect(renderMarkdown("## Subtitle")).toBe("<h2>Subtitle</h2>");
  });

  it("renders h3 headers", () => {
    expect(renderMarkdown("### Section")).toBe("<h3>Section</h3>");
  });

  it("renders h4 headers", () => {
    expect(renderMarkdown("#### Detail")).toBe("<h4>Detail</h4>");
  });

  it("renders links", () => {
    const result = renderMarkdown("[Click here](https://example.com)");
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain("Click here");
  });

  it("renders horizontal rules", () => {
    expect(renderMarkdown("---")).toBe("<hr>");
  });

  it("renders blockquotes", () => {
    const result = renderMarkdown("> quoted text");
    expect(result).toContain("<blockquote>");
    expect(result).toContain("quoted text");
  });

  it("renders unordered lists", () => {
    const result = renderMarkdown("- item one\n- item two");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>item one</li>");
    expect(result).toContain("<li>item two</li>");
  });

  it("renders ordered list items", () => {
    const result = renderMarkdown("1. first\n2. second");
    expect(result).toContain("<li>first</li>");
    expect(result).toContain("<li>second</li>");
  });

  it("escapes HTML in regular text", () => {
    expect(renderMarkdown("<b>not bold</b>")).toContain("&lt;b&gt;");
  });

  it("renders complex multi-format text", () => {
    const input = "## Header\n\nSome **bold** and *italic* text with `code` and a [link](https://example.com).";
    const result = renderMarkdown(input);
    expect(result).toContain("<h2>Header</h2>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<code>code</code>");
    expect(result).toContain('<a href="https://example.com"');
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
