import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";
import { z } from "zod";

export function registerDiceTools(server: McpServer) {
  server.registerTool(
    "roll_dice",
    {
      description: "Roll dice using standard notation. Supports: basic (2d6+3), keep highest (4d6kh3), exploding (8d10!), success counting (8d10>=8), reroll (2d6r1).",
      inputSchema: {
        notation: z.string().describe("Dice notation string, e.g. '2d6+3', '4d6kh3', '8d10!>=8'"),
        reason: z.string().optional().describe("Optional reason for the roll"),
      },
    },
    async ({ notation, reason }) => {
      try {
        const roll = new DiceRoll(notation);
        const result = {
          notation: roll.notation,
          output: roll.output,
          total: roll.total,
          rolls: roll.rolls.map((r: any) =>
            r.rolls ? r.rolls.map((d: any) => ({ value: d.value, modifiers: d.modifiers || [] })) : r
          ),
          ...(reason && { reason }),
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Dice roll error: ${e.message}` }], isError: true };
      }
    }
  );
}
