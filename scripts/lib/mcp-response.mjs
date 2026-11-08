export function initializeResult(body) {
  const messages = body.trim().startsWith("{")
    ? [JSON.parse(body)]
    : body.split(/\r?\n\r?\n/).flatMap((event) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        return data ? [JSON.parse(data)] : [];
      });
  const reply = messages.find((message) => message.id === 1);
  if (
    reply?.error ||
    !reply?.result ||
    typeof reply.result.protocolVersion !== "string" ||
    !reply.result.capabilities ||
    !reply.result.serverInfo
  )
    throw new Error("MCP initialize did not return a successful protocol result");
  return reply.result;
}
