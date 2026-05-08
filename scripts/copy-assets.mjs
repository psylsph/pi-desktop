/**
 * Cross-platform asset copy script (replaces mkdir -p / cp -r shell commands).
 * Works on Windows, macOS, and Linux.
 */
import { cpSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distMain = join(root, "dist", "main");

// Ensure renderer output dir exists
mkdirSync(join(distMain, "renderer"), { recursive: true });

// Copy renderer assets
cpSync(join(root, "src", "renderer"), join(distMain, "renderer"), {
  recursive: true,
});

// Copy preload script
cpSync(
  join(root, "src", "main", "preload.cjs"),
  join(distMain, "preload.cjs")
);

console.log("Assets copied successfully.");
