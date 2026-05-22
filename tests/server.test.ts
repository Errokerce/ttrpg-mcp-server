import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiceTools } from "../src/tools/dice.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

describe("MCP Server E2E (no DB)", () => {
  async function createTestClient() {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    server.registerTool("ping", { description: "Health check" }, async () => ({
      content: [{ type: "text", text: "pong" }],
    }));
    registerDiceTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  }

  it("ping tool returns pong", async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: "ping", arguments: {} });
    expect(result.content).toEqual([{ type: "text", text: "pong" }]);
  });

  it("roll_dice returns structured result", async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: "roll_dice", arguments: { notation: "2d6+3" } });
    const content = result.content as any[];
    const parsed = JSON.parse(content[0].text);
    expect(parsed.notation).toBe("2d6+3");
    expect(parsed.total).toBeGreaterThanOrEqual(5);
    expect(parsed.total).toBeLessThanOrEqual(15);
  });

  it("roll_dice handles invalid notation", async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: "roll_dice", arguments: { notation: "xyz" } });
    expect(result.isError).toBe(true);
  });

  it("lists all tools", async () => {
    const client = await createTestClient();
    const result = await client.listTools();
    const names = result.tools.map(t => t.name);
    expect(names).toContain("ping");
    expect(names).toContain("roll_dice");
  });
});
