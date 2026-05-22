import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { getActiveCampaignId } from "./campaign.js";

export function registerRuleTools(server: McpServer) {
  server.registerTool(
    "set_rule",
    {
      description: "Create or update a game rule for the active campaign",
      inputSchema: {
        category: z.enum(["combat", "magic", "skill", "exploration", "social", "custom"]),
        title: z.string(),
        content: z.string().describe("Rule content in markdown"),
      },
    },
    async ({ category, title, content }) => {
      const db = getDb();
      const campaignId = getActiveCampaignId();
      await db.collection("rules").updateOne(
        { campaignId, category, title },
        { $set: { content, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      return { content: [{ type: "text", text: `Rule set: [${category}] ${title}` }] };
    }
  );

  server.registerTool(
    "delete_rule",
    {
      description: "Delete a game rule",
      inputSchema: {
        category: z.enum(["combat", "magic", "skill", "exploration", "social", "custom"]),
        title: z.string(),
      },
    },
    async ({ category, title }) => {
      const db = getDb();
      const result = await db.collection("rules").deleteOne({ campaignId: getActiveCampaignId(), category, title });
      if (result.deletedCount === 0) return { content: [{ type: "text", text: "Rule not found" }], isError: true };
      return { content: [{ type: "text", text: `Deleted rule: [${category}] ${title}` }] };
    }
  );

  server.registerTool(
    "list_rules",
    {
      description: "List all rules for the active campaign",
      inputSchema: {
        category: z.enum(["combat", "magic", "skill", "exploration", "social", "custom"]).optional(),
      },
    },
    async ({ category }) => {
      const db = getDb();
      const filter: any = { campaignId: getActiveCampaignId() };
      if (category) filter.category = category;
      const rules = await db.collection("rules").find(filter).project({ category: 1, title: 1, updatedAt: 1 }).toArray();
      return { content: [{ type: "text", text: JSON.stringify(rules, null, 2) }] };
    }
  );
}
