import "server-only";
import { parseServerConfig } from "./config-policy";
export function serverConfig() {
  return parseServerConfig(process.env);
}
