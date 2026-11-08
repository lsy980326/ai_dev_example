export function validateReleaseSource({ sha, head, dirty }) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || sha !== head)
    throw new Error("RELEASE_SHA must equal the current full Git HEAD.");
  if (dirty)
    throw new Error(
      "Commit the reviewed source first. Refusing to publish modified or untracked files under a tested commit tag.",
    );
}
