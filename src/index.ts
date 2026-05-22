import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerDiceTools } from "./tools/dice.js";
import { registerCampaignTools } from "./tools/campaign.js";
import { registerPlayerTools } from "./tools/player.js";
import { registerProgressTools } from "./tools/progress.js";
import { registerWorldTools } from "./tools/world.js";
import { registerRuleTools } from "./tools/rules.js";
import { registerResources } from "./resources/index.js";
import { connectDb, disconnectDb } from "./db/connection.js";

const server = new McpServer(
  { name: "ttrpg-mcp-server", version: "1.0.0" },
  {
    instructions: `TTRPG MCP Server - A generic tabletop RPG game management server.

Workflow:
1. Use create_campaign or switch_campaign to set the active campaign.
2. Use create_player to add characters, update_player to modify them.
3. Use set_rule to define game rules for the campaign.
4. Use roll_dice for any dice rolls during gameplay.
5. Use advance_progress to record game progress (LLM decides when to advance).
6. Use upsert_world_entity to track NPCs, locations, factions.
7. Use log_event to record significant world events.

Resources are available for reading campaign state without tool calls:
- rules://{campaignId}/{category} - Game rules
- player://{campaignId}/{playerName} - Character sheets
- world://{campaignId}/summary - World state overview
- progress://{campaignId}/current - Current progress`,
  }
);

server.registerTool("ping", { description: "Health check" }, async () => ({
  content: [{ type: "text", text: "pong" }],
}));

registerDiceTools(server);
registerCampaignTools(server);
registerPlayerTools(server);
registerProgressTools(server);
registerWorldTools(server);
registerRuleTools(server);
registerResources(server);

async function main() {
  const transport = process.env.TRANSPORT === "http"
    ? await (await import("./transports/http.js")).createHttpTransport(server)
    : new StdioServerTransport();

  if (process.env.MONGODB_URI) {
    await connectDb();
  }

  if (transport instanceof StdioServerTransport) {
    await server.connect(transport);
  }

  process.on("SIGINT", async () => {
    await disconnectDb();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
