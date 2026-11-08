import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { validateReleaseSource } from "./release-policy.mjs";
const config = JSON.parse(await fs.readFile(".local/aws/deploy-config.json", "utf8")),
  sha = process.env.RELEASE_SHA;
if (!/^[a-f0-9]{40}$/.test(sha ?? ""))
  throw new Error("RELEASE_SHA must be a full tested Git commit SHA");
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
  encoding: "utf8",
});
if (head.status !== 0 || status.status !== 0) throw new Error("Unable to inspect release source");
validateReleaseSource({ sha, head: head.stdout.trim(), dirty: status.stdout.trim().length > 0 });
const registry = config.repositories.web.split("/")[0];
const password = spawnSync("aws", ["ecr", "get-login-password", "--region", config.region], {
  encoding: "utf8",
});
if (password.status !== 0) throw new Error("ECR authentication failed");
const login = spawnSync("docker", ["login", "--username", "AWS", "--password-stdin", registry], {
  input: password.stdout,
  stdio: ["pipe", "ignore", "ignore"],
});
if (login.status !== 0) throw new Error("Docker ECR login failed");
try {
  for (const name of ["api", "web"]) {
    // Immutable tag collision is an error; never replace a previous commit's image.
    const result = spawnSync(
      "docker",
      [
        "buildx",
        "build",
        "--platform",
        "linux/amd64",
        "--provenance=false",
        "--tag",
        `${config.repositories[name]}:${sha}`,
        "--push",
        name,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0) throw new Error(`${name} build/push failed`);
  }
} finally {
  spawnSync("docker", ["logout", registry], { stdio: "ignore" });
}
