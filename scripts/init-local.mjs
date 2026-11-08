import fs from "node:fs";
import { randomBytes } from "node:crypto";
fs.mkdirSync(".local", { recursive: true });
const target = ".local/runtime.env";
if (!fs.existsSync(target)) {
  const secret = () => randomBytes(32).toString("hex");
  fs.writeFileSync(
    target,
    [
      `OWNER_DB_PASSWORD=${secret()}`,
      `MIGRATOR_DB_PASSWORD=${secret()}`,
      `APP_DB_PASSWORD=${secret()}`,
      `NEXTAUTH_SECRET=${secret()}`,
      `OIDC_CLIENT_SECRET=${secret()}`,
    ].join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log("로컬 실행 설정을 생성했습니다. 값은 출력하지 않습니다.");
} else console.log("기존 로컬 실행 설정을 유지합니다.");
