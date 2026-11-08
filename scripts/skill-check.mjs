import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
for (const name of ["registration-review", "frontend-design"]) {
  const a = await fs.readFile(`.agents/skills/${name}/SKILL.md`, "utf8");
  assert.match(a, /^---\nname: .+\ndescription: .+\n(?:[^\n]+\n)*?---/);
  assert.equal(a, await fs.readFile(`.claude/skills/${name}/SKILL.md`, "utf8"));
}
for (const root of [".agents/skills/frontend-design", ".claude/skills/frontend-design"]) {
  const source = JSON.parse(await fs.readFile(`${root}/source.json`, "utf8"));
  assert.equal(source.revision, "2c5958ecac7cee2b583967a2c4981d0f4a75c579");
  for (const [name, hash] of Object.entries(source.files))
    assert.equal(
      createHash("sha256")
        .update(await fs.readFile(`${root}/${name}`))
        .digest("hex"),
      hash,
    );
}
for (const file of [".mcp.json", ".codex/hooks.json", ".claude/settings.json"])
  JSON.parse(await fs.readFile(file, "utf8"));
assert.match(
  await fs.readFile(".codex/config.toml", "utf8"),
  /https:\/\/developers.openai.com\/mcp/,
);
console.log(
  "Skill copies, pinned source hashes, license and hook/MCP configuration structure passed. Host activation requires /skills, /hooks and /mcp inspection.",
);
