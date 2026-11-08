import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const roots = [
  "api/src",
  "api/build.gradle",
  "api/settings.gradle",
  "api/gradle",
  "api/gradlew",
  "api/gradlew.bat",
  "api/gradle.properties",
  "api/Dockerfile",
  ".dockerignore",
  "api/.dockerignore",
  "web/.dockerignore",
  "api/certs",
  "web/src",
  "web/public",
  "web/e2e",
  "web/package.json",
  "web/package-lock.json",
  "web/next.config.ts",
  "web/tsconfig.json",
  "web/eslint.config.mjs",
  "web/vitest.config.ts",
  "web/playwright.config.ts",
  "web/Dockerfile",
  "compose.yaml",
  "compose.local.yaml",
  "docker",
  "infra",
  "scripts",
  "tests",
  "dev",
  "AGENTS.md",
  "DESIGN.md",
  "CLAUDE.md",
  ".agents",
  ".claude",
  ".codex",
  ".mcp.json",
  ".github",
  "docs/registration.md",
  "docs/slides-map.json",
];
export async function sourceDigest(root = process.cwd()) {
  const hash = createHash("sha256");
  async function visit(relative) {
    if (
      /(^|\/)(node_modules|build|\.gradle|\.terraform|\.local)(\/|$)|\.tfvars$|\.tfstate|\.tfplan$|(^|\/)\.env|(^|\/)(settings\.local\.json|config\.local\.toml)$/.test(
        relative,
      )
    )
      return;
    const full = path.join(root, relative);
    let stat;
    try {
      stat = await fs.lstat(full);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Source symlink requires review: ${relative}`);
    if (stat.isDirectory()) {
      for (const entry of (await fs.readdir(full)).sort()) await visit(`${relative}/${entry}`);
    } else if (stat.isFile()) {
      hash.update(relative);
      hash.update("\0");
      hash.update(await fs.readFile(full));
      hash.update("\0");
    }
  }
  for (const relative of roots) await visit(relative);
  return hash.digest("hex");
}
