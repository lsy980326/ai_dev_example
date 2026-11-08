import { initializeResult } from "./lib/mcp-response.mjs";
const url = "https://developers.openai.com/mcp";
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "study-docs-check", version: "1.0.0" },
    },
  }),
  signal: AbortSignal.timeout(15000),
});
const body = await response.text();
if (!response.ok) throw new Error(`Read-only docs MCP initialize failed: HTTP ${response.status}`);
initializeResult(body);
console.log(
  "Official read-only documentation MCP responded to initialize. This checks the endpoint, not whether this chat loaded the project MCP. Inspect /mcp in the project session.",
);
