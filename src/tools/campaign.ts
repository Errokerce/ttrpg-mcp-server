import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { ObjectId } from "mongodb";

let activeCampaignId: string | null = null;

export function getActiveCampaignId(): string {
  if (!activeCampaignId) throw new Error("No active campaign. Use create_campaign or switch_campaign first.");
  return activeCampaignId;
}

export function registerCampaignTools(server: McpServer) {
  server.registerTool(
    "create_campaign",
    {
      description: "Create a new campaign and set it as active",
      inputSchema: {
        name: z.string().describe("Campaign name"),
        description: z.string().optional().describe("Campaign description"),
        setting: z.string().optional().describe("World setting description"),
      },
    },
    async ({ name, description, setting }) => {
      const db = getDb();
      const doc = { name, description: description || "", setting: setting || "", createdAt: new Date() };
      const result = await db.collection("campaigns").insertOne(doc);
      activeCampaignId = result.insertedId.toHexString();
      return { content: [{ type: "text", text: JSON.stringify({ id: activeCampaignId, ...doc }, null, 2) }] };
    }
  );

  server.registerTool(
    "list_campaigns",
    { description: "List all campaigns" },
    async () => {
      const db = getDb();
      const campaigns = await db.collection("campaigns").find().project({ name: 1, description: 1, createdAt: 1 }).toArray();
      return { content: [{ type: "text", text: JSON.stringify(campaigns, null, 2) }] };
    }
  );

  server.registerTool(
    "switch_campaign",
    {
      description: "Switch to an existing campaign by ID",
      inputSchema: { campaignId: z.string().describe("Campaign ID to switch to") },
    },
    async ({ campaignId }) => {
      const db = getDb();
      const campaign = await db.collection("campaigns").findOne({ _id: new ObjectId(campaignId) });
      if (!campaign) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
      activeCampaignId = campaignId;
      return { content: [{ type: "text", text: `Switched to campaign: ${campaign.name}` }] };
    }
  );

  server.registerTool(
    "get_current_campaign",
    { description: "Get the currently active campaign" },
    async () => {
      if (!activeCampaignId) return { content: [{ type: "text", text: "No active campaign" }], isError: true };
      const db = getDb();
      const campaign = await db.collection("campaigns").findOne({ _id: new ObjectId(activeCampaignId) });
      return { content: [{ type: "text", text: JSON.stringify(campaign, null, 2) }] };
    }
  );
}
