import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb } from "../db/connection.js";

export function registerResources(server: McpServer) {
  // Rules resource
  server.registerResource(
    "rules-template",
    new ResourceTemplate("rules://{campaignId}/{category}", { list: undefined }),
    { description: "Game rules by campaign and category", mimeType: "text/markdown" },
    async (uri, { campaignId, category }) => {
      const db = getDb();
      const rules = await db.collection("rules")
        .find({ campaignId: campaignId as string, category: category as string }).toArray();
      const content = rules.map(r => `## ${r.title}\n\n${r.content}`).join("\n\n---\n\n");
      return { contents: [{ uri: uri.href, text: content || "No rules defined for this category." }] };
    }
  );

  // Player character sheet resource
  server.registerResource(
    "player-template",
    new ResourceTemplate("player://{campaignId}/{playerName}", { list: undefined }),
    { description: "Player character sheet", mimeType: "text/markdown" },
    async (uri, { campaignId, playerName }) => {
      const db = getDb();
      const player = await db.collection("players")
        .findOne({ campaignId: campaignId as string, name: playerName as string });
      if (!player) return { contents: [{ uri: uri.href, text: "Player not found." }] };
      const lines = [
        `# ${player.name}`,
        `**HP:** ${player.hp}/${player.maxHp}`,
        `**Attributes:** ${Object.entries(player.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
        `**Skills:** ${(player.skills || []).join(", ")}`,
        `**Inventory:** ${(player.inventory || []).join(", ")}`,
        ...(player.customFields ? Object.entries(player.customFields).map(([k, v]) => `**${k}:** ${v}`) : []),
      ];
      return { contents: [{ uri: uri.href, text: lines.join("\n") }] };
    }
  );

  // World summary resource
  server.registerResource(
    "world-summary-template",
    new ResourceTemplate("world://{campaignId}/summary", { list: undefined }),
    { description: "World state summary", mimeType: "text/markdown" },
    async (uri, { campaignId }) => {
      const db = getDb();
      const entities = await db.collection("world_states")
        .find({ campaignId: campaignId as string }).toArray();
      const grouped: Record<string, any[]> = {};
      for (const e of entities) {
        (grouped[e.type] ||= []).push(e);
      }
      const lines = Object.entries(grouped).map(([type, items]) =>
        `## ${type}s\n${items.map(i => `- **${i.name}**: ${JSON.stringify(i.properties)}`).join("\n")}`
      );
      return { contents: [{ uri: uri.href, text: lines.join("\n\n") || "No world entities yet." }] };
    }
  );

  // Progress resource
  server.registerResource(
    "progress-template",
    new ResourceTemplate("progress://{campaignId}/current", { list: undefined }),
    { description: "Current game progress", mimeType: "text/markdown" },
    async (uri, { campaignId }) => {
      const db = getDb();
      const entries = await db.collection("progress")
        .find({ campaignId: campaignId as string }).sort({ day: -1, sequence: -1 }).limit(5).toArray();
      if (!entries.length) return { contents: [{ uri: uri.href, text: "No progress recorded." }] };
      const lines = entries.reverse().map(e => `### Day ${e.day}, Part ${e.sequence}: ${e.title}\n${e.summary}`);
      return { contents: [{ uri: uri.href, text: `# Recent Progress\n\n${lines.join("\n\n")}` }] };
    }
  );
}
