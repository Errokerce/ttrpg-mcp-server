# TTRPG MCP Server

A generic MCP (Model Context Protocol) server for tabletop RPG game management. Enables LLM services (Claude, etc.) to manage dice rolling, player characters, game progress, world state, and game rules through standardized tool calls.

## Features

- **Dice Rolling** — Standard notation with exploding, keep highest/lowest, success counting
- **Campaign Management** — Multiple campaigns with switching
- **Player Characters** — Semi-structured with custom fields
- **Game Progress** — Day/sequence tracking, LLM-driven advancement
- **World State** — Entity management (NPCs, Locations, Factions, Items) + event log
- **Rules System** — Per-campaign rules stored and exposed as MCP Resources
- **Dual Interface** — MCP (for Claude/local LLM) + REST API with OpenAPI (for ChatGPT GPT Actions)
- **Dual Transport** — stdio (local) and Streamable HTTP (remote)

## Quick Start

### Prerequisites

- Node.js >= 20
- MongoDB Atlas account (free M0 tier: https://www.mongodb.com/atlas)

### Install

```bash
git clone <repo-url>
cd ttrpg-mcp-server
npm install
cp .env.example .env
# Edit .env with your MongoDB Atlas connection string
npm run build
```

### Run (stdio mode - for Claude Desktop)

```bash
npm start
```

### Run (HTTP mode - for remote deployment)

```bash
TRANSPORT=http MONGODB_URI=<your-uri> npm start
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ttrpg": {
      "command": "node",
      "args": ["/path/to/ttrpg-mcp-server/dist/index.js"],
      "env": {
        "MONGODB_URI": "mongodb+srv://...",
        "MONGODB_DB": "ttrpg"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `roll_dice` | Roll dice with standard notation (2d6+3, 4d6kh3, 8d10!, etc.) |
| `create_campaign` | Create a new campaign |
| `list_campaigns` | List all campaigns |
| `switch_campaign` | Switch active campaign |
| `get_current_campaign` | Get active campaign info |
| `create_player` | Create a player character |
| `get_player` | Get player by name |
| `update_player` | Partial update player (merge semantics) |
| `list_players` | List all players in campaign |
| `advance_progress` | Record game progress |
| `get_current_progress` | Get latest progress |
| `get_progress_history` | Get progress history |
| `upsert_world_entity` | Create/update world entity |
| `get_world_entity` | Get entity by name |
| `query_world_entities` | Query entities by type |
| `log_event` | Log a world event |
| `get_event_history` | Get event history |
| `set_rule` | Create/update a game rule |
| `delete_rule` | Delete a rule |
| `list_rules` | List rules |

## MCP Resources

| URI Pattern | Description |
|-------------|-------------|
| `rules://{campaignId}/{category}` | Game rules by category |
| `player://{campaignId}/{playerName}` | Character sheet |
| `world://{campaignId}/summary` | World state overview |
| `progress://{campaignId}/current` | Recent progress |

## Deploy to Render (Free)

1. Push to GitHub
2. Connect repo on [Render](https://render.com)
3. Render auto-detects from `render.yaml`
4. Set `MONGODB_URI` secret in Render dashboard
5. Deploy

Or use Docker:

```bash
docker build -t ttrpg-mcp .
docker run -p 3000:3000 -e MONGODB_URI=<uri> -e TRANSPORT=http ttrpg-mcp
```

## ChatGPT GPT Actions Setup

1. Deploy the server (Render or Docker)
2. In ChatGPT → Create a GPT → Configure → Actions
3. Import the OpenAPI spec from `https://your-app.onrender.com/openapi.json`
4. All REST endpoints under `/api/*` will be available as Actions
5. Update the `servers[0].url` in `openapi.json` to your actual deployment URL

### REST API Endpoints

When running in HTTP mode, all tools are also available as REST:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/roll_dice` | Roll dice |
| GET/POST | `/api/campaigns` | List/Create campaigns |
| POST | `/api/campaigns/:id/switch` | Switch campaign |
| GET/POST | `/api/players` | List/Create players |
| GET/PATCH | `/api/players/:name` | Get/Update player |
| GET/POST | `/api/progress` | History/Advance progress |
| GET/PUT | `/api/world/entities` | Query/Upsert entities |
| GET/POST | `/api/events` | History/Log events |
| GET/PUT/DELETE | `/api/rules` | List/Set/Delete rules |

## Development

```bash
npm run dev          # Run with tsx (hot reload)
npm test             # Run tests
npm run build        # Compile TypeScript
```

## Architecture

```
src/
├── index.ts              # Entry point, server setup
├── api/
│   └── rest.ts           # REST API router (for GPT Actions)
├── db/
│   └── connection.ts     # MongoDB connection manager
├── tools/
│   ├── dice.ts           # Dice rolling engine
│   ├── campaign.ts       # Campaign CRUD
│   ├── player.ts         # Player character management
│   ├── progress.ts       # Game progress tracking
│   ├── world.ts          # World entities + event log
│   └── rules.ts          # Rules management
├── resources/
│   └── index.ts          # MCP Resources (rules, player, world, progress)
└── transports/
    └── http.ts           # Express server (MCP + REST + OpenAPI)
```

## License

MIT
