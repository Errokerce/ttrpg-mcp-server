import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { getActiveCampaignId } from "./campaign.js";

export function registerPlayerTools(server: McpServer) {
  server.registerTool(
    "create_player",
    {
      description: "Create a new player character in the active campaign",
      inputSchema: {
        name: z.string(),
        hp: z.number().optional().default(10),
        maxHp: z.number().optional().default(10),
        attributes: z.record(z.string(), z.number()).optional().default({}),
        skills: z.array(z.string()).optional().default([]),
        inventory: z.array(z.string()).optional().default([]),
        customFields: z.record(z.string(), z.unknown()).optional().default({}),
      },
    },
    async ({ name, hp, maxHp, attributes, skills, inventory, customFields }) => {
      const db = getDb();
      const campaignId = getActiveCampaignId();
      const doc = { campaignId, name, hp, maxHp, attributes, skills, inventory, customFields, createdAt: new Date() };
      await db.collection("players").insertOne(doc);
      return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
    }
  );

  server.registerTool(
    "get_player",
    {
      description: "Get a player character by name",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const db = getDb();
      const player = await db.collection("players").findOne({ campaignId: getActiveCampaignId(), name });
      if (!player) return { content: [{ type: "text", text: `Player "${name}" not found` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(player, null, 2) }] };
    }
  );

  server.registerTool(
    "update_player",
    {
      description: "Update a player character (partial merge update)",
      inputSchema: {
        name: z.string().describe("Player name to update"),
        hp: z.number().optional(),
        maxHp: z.number().optional(),
        attributes: z.record(z.string(), z.number()).optional(),
        skills: z.array(z.string()).optional(),
        inventory: z.array(z.string()).optional(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ name, ...updates }) => {
      const db = getDb();
      const campaignId = getActiveCampaignId();
      const setOps: Record<string, any> = {};
      if (updates.hp !== undefined) setOps.hp = updates.hp;
      if (updates.maxHp !== undefined) setOps.maxHp = updates.maxHp;
      if (updates.attributes) {
        for (const [k, v] of Object.entries(updates.attributes)) setOps[`attributes.${k}`] = v;
      }
      if (updates.skills) setOps.skills = updates.skills;
      if (updates.inventory) setOps.inventory = updates.inventory;
      if (updates.customFields) {
        for (const [k, v] of Object.entries(updates.customFields)) setOps[`customFields.${k}`] = v;
      }
      const result = await db.collection("players").findOneAndUpdate(
        { campaignId, name },
        { $set: setOps },
        { returnDocument: "after" }
      );
      if (!result) return { content: [{ type: "text", text: `Player "${name}" not found` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_players",
    { description: "List all players in the active campaign" },
    async () => {
      const db = getDb();
      const players = await db.collection("players").find({ campaignId: getActiveCampaignId() }).toArray();
      return { content: [{ type: "text", text: JSON.stringify(players, null, 2) }] };
    }
  );
}
