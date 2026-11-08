import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const revision = "2c5958ecac7cee2b583967a2c4981d0f4a75c579";
const base = `https://raw.githubusercontent.com/anthropics/skills/${revision}/skills/frontend-design`;
const files = {};
for (const name of ["SKILL.md", "LICENSE.txt"]) {
  const response = await fetch(`${base}/${name}`);
  if (!response.ok) throw new Error(`Official skill download failed: ${response.status}`);
  files[name] = Buffer.from(await response.arrayBuffer());
}
for (const parent of [".agents/skills", ".claude/skills"]) {
  const target = `${parent}/frontend-design`;
  await fs.mkdir(target, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    let existing;
    try {
      existing = await fs.readFile(`${target}/${name}`);
    } catch {}
    if (existing && !existing.equals(bytes) && !process.argv.includes("--replace"))
      throw new Error(`Refusing to replace changed ${target}/${name}; review then use --replace.`);
    await fs.writeFile(`${target}/${name}`, bytes);
  }
  await fs.writeFile(
    `${target}/source.json`,
    JSON.stringify(
      {
        repository: "https://github.com/anthropics/skills",
        revision,
        files: Object.fromEntries(
          Object.entries(files).map(([name, bytes]) => [
            name,
            createHash("sha256").update(bytes).digest("hex"),
          ]),
        ),
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  "Pinned official frontend-design skill and Apache license installed in both project skill directories. Restart the project session and inspect /skills to confirm discovery.",
);
