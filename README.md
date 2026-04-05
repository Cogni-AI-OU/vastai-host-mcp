# vastai-host-mcp

[![PR Reviews][pr-reviews-image]][pr-reviews-link]
[![License][license-image]][license-link]
[![TypeScript][typescript-image]][typescript-link]
[![FastMCP][fastmcp-image]][fastmcp-link]
[![Vast.ai][vastai-image]][vastai-link]

Production-ready Model Context Protocol (MCP) server for Vast.ai host/provider operations using FastMCP and TypeScript.

This project is the host/provider counterpart to renter-focused tools.
For renting GPUs as a customer, use [CryDevOk/vastai-mcp][renter-server-link].

## Table of contents

<!-- TOC -->

- [What this server is for](#what-this-server-is-for)
- [Feature summary](#feature-summary)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Development workflow](#development-workflow)
- [Connect from MCP clients](#connect-from-mcp-clients)
- [Use with GitHub Copilot](#use-with-github-copilot)
- [Where to check Vast API](#where-to-check-vast-api)
- [Run on Vast.ai machines](#run-on-vastai-machines)
- [Project layout](#project-layout)
- [Contributing](#contributing)
- [License](#license)

<!-- /TOC -->

## What this server is for

This MCP server is purpose-built for Vast.ai providers (hosts who own and operate machines).
It focuses on host-side workflows including:

- Viewing and managing hosted machines.
- Updating default jobs, pricing, and offer settings.
- Running verification and self-test operations.
- Inspecting reliability, uptime, and host operational signals.
- Managing host scripts and daemon restart workflows.

## Feature summary

- TypeScript-first server implementation with strict compiler settings.
- FastMCP tool definitions with rich tool metadata and strict Zod schemas.
- Singleton Vast.ai host client with:
  - Bearer token API auth
  - `/api/v0/...` endpoint targeting
  - robust error handling
  - timestamped logging via Pino
- API-first execution with optional Vast CLI fallback for host commands.
- stdio and httpStream transport support.
- Host automation helper rules for pricing and reliability recommendations.

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Vast.ai API key with host/provider permissions

### Install and run

- Install dependencies:

```bash
pnpm install
```

- Copy environment file and edit values:

```bash
cp .env.example .env
```

- Set at least `VAST_API_KEY` in `.env`.

- Start development server (FastMCP dev mode):

```bash
pnpm dev
```

- Inspect tools interactively:

```bash
pnpm inspect
```

- Build and run production bundle:

```bash
pnpm build
pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VAST_API_KEY` | Yes | none | Vast.ai API token for host/provider operations |
| `VAST_SERVER_URL` | No | `https://console.vast.ai` | Vast.ai API base URL |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio` or `httpStream` |
| `MCP_HTTP_HOST` | No | `0.0.0.0` | Host bind for `httpStream` transport |
| `MCP_HTTP_PORT` | No | `8080` | Port for `httpStream` transport |
| `VAST_REQUEST_TIMEOUT_MS` | No | `30000` | API and CLI timeout in milliseconds |
| `VAST_USE_CLI_FALLBACK` | No | `true` | Enable CLI fallback for host operations |
| `VAST_CLI_PATH` | No | `vastai` | Vast CLI executable path |
| `VAST_AUTO_PRICING_ENABLED` | No | `false` | Toggle automation hints for price workflows |
| `VAST_AUTO_RELIABILITY_GUARD` | No | `false` | Toggle automation hints for reliability workflows |
| `LOG_LEVEL` | No | `info` | Pino log level |

## Development workflow

Default local development workflow (warning-free in pnpm-managed environments):

```bash
pnpm dev
```

FastMCP terminal harness workflow (optional):

```bash
pnpm dev:fastmcp
pnpm inspect
```

Codespaces inspector workflow:

```bash
# If you had a prior inspector run, free default ports first
pkill -f mcp-inspector || true

# Start inspector with Codespaces-safe host and origin settings
pnpm inspect:codespaces

# If token/auth forwarding is problematic, use no-auth mode in dev only
pnpm inspect:codespaces:noauth
```

If the browser opens but cannot connect, ensure both forwarded ports are active:

- 6274 (Inspector UI)
- 6277 (Inspector proxy)

If the UI still shows `Disconnected`, use these manual values in Inspector:

- Transport Type: `STDIO`
- Command: `pnpm`
- Arguments: `exec tsx src/index.ts`
- Then click `Connect`

If auth is enabled, open `Auth Settings` and paste the `MCP_PROXY_AUTH_TOKEN` printed in terminal.

Production build workflow:

```bash
pnpm build
pnpm start
```

Key host tools currently implemented:

- `vastai_host_show_machines`
- `vastai_host_set_defjob`
- `vastai_host_upsert_offer`
- `vastai_host_set_min_bid`
- `vastai_host_verification_status`
- `vastai_host_self_test_machine`
- `vastai_host_get_stats`
- `vastai_host_recommend_pricing`
- `vastai_host_update_script`
- `vastai_host_restart_daemon`
- `vastai_host_search_offers`
- `vastai_host_show_logs`
- `vastai_host_network_status`
- `vastai_host_reliability_actions`

## Connect from MCP clients

Use `stdio` transport for desktop tools unless you specifically need network transport.

### Claude Desktop example

```json
{
  "mcpServers": {
    "vastai-host": {
      "command": "pnpm",
      "args": ["start"],
      "cwd": "/absolute/path/to/vastai-host-mcp",
      "env": {
        "VAST_API_KEY": "YOUR_VAST_API_KEY",
        "VAST_SERVER_URL": "https://console.vast.ai",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Cursor example

```json
{
  "mcpServers": {
    "vastai-host": {
      "command": "pnpm",
      "args": ["start"],
      "cwd": "/absolute/path/to/vastai-host-mcp",
      "env": {
        "VAST_API_KEY": "YOUR_VAST_API_KEY",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### VS Code MCP example

```json
{
  "servers": {
    "vastai-host": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["start"],
      "cwd": "/absolute/path/to/vastai-host-mcp",
      "env": {
        "VAST_API_KEY": "YOUR_VAST_API_KEY"
      }
    }
  }
}
```

## Use with GitHub Copilot

For GitHub Copilot Chat in VS Code, this repository already includes a workspace MCP config at
[.vscode/mcp.json](.vscode/mcp.json).

Recommended flow:

1. Set your real `VAST_API_KEY` in `.vscode/mcp.json`.
2. Stop any manually running local server process (`pnpm dev`) so VS Code can own the MCP process lifecycle.
3. In VS Code, reload MCP servers from the Command Palette.
4. In Copilot Chat, test a tool call such as `vastai_host_show_machines`.

Note: For VS Code MCP usage, you usually do not need to run `pnpm dev` manually.

## Where to check Vast API

Use these sources to validate endpoint existence and request format:

- API docs index: [llms.txt](https://docs.vast.ai/llms.txt)
- API intro: [Vast API Reference](https://docs.vast.ai/api-reference/introduction)
- Machines: [show machines](https://docs.vast.ai/api-reference/machines/show-machines.md)
- Machines: [set min-bid](https://docs.vast.ai/api-reference/machines/set-min-bid.md)
- Machines: [set defjob](https://docs.vast.ai/api-reference/machines/set-defjob.md)
- Machines: [list machine](https://docs.vast.ai/api-reference/machines/list-machine.md)
- Search: [search offers](https://docs.vast.ai/api-reference/search/search-offers.md)

The current endpoint mapping used by this MCP server is implemented in
[src/client/VastAIHostClient.ts](src/client/VastAIHostClient.ts).

Quick local checks:

```bash
pnpm build
pnpm inspect
```

When using the Inspector, a command returning HTTP 404 is usually a route mismatch, while HTTP 400/403/500 generally
means the route exists and your payload, permissions, or backend state should be checked.

## Run on Vast.ai machines

When deploying this MCP server inside a Vast.ai instance:

1. Keep API keys in environment variables only. Never hardcode secrets.
2. Use `stdio` mode for local desktop tunneling workflows.
3. Use `httpStream` only behind trusted network boundaries or a reverse proxy.
4. Install Vast CLI in the runtime if you want CLI fallback behavior.
5. Monitor logs with your preferred process manager (systemd, pm2, supervisord).

For onboarding guidance, see [Building your first MCP server on Vast.ai][vastai-first-mcp-link].

## Project layout

```text
.
├── src/
│   ├── client/
│   │   └── VastAIHostClient.ts
│   ├── rules/
│   │   └── MCPRules.ts
│   ├── tools/
│   │   └── hostTools.ts
│   ├── config.ts
│   ├── index.ts
│   └── logger.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

1. Open an issue describing the host/provider workflow or API gap.
2. Keep additions host-focused (not renter workflow features).
3. Add or update tool descriptions so they remain LLM-friendly and explicit.
4. Run local checks before opening a PR.

Repository-wide conventions and agent behavior are documented in [AGENTS.md][agents-link].

## License

This project is licensed under the MIT License.
See [LICENSE](LICENSE).

<!-- Named links -->

[agents-link]: AGENTS.md
[fastmcp-image]: https://img.shields.io/badge/FastMCP-Framework-0f766e?logo=typescript
[fastmcp-link]: https://github.com/punkpeye/fastmcp
[license-image]: https://img.shields.io/badge/License-MIT-blue.svg
[license-link]: https://tldrlegal.com/license/mit-license
[pr-reviews-image]: https://img.shields.io/github/issues-pr/Cogni-AI-OU/vastai-host-mcp?label=PR+Reviews&logo=github
[pr-reviews-link]: https://github.com/Cogni-AI-OU/vastai-host-mcp/pulls
[renter-server-link]: https://github.com/CryDevOk/vastai-mcp
[typescript-image]: https://img.shields.io/badge/TypeScript-Strict-3178c6?logo=typescript&logoColor=white
[typescript-link]: https://www.typescriptlang.org/
[vastai-first-mcp-link]: https://vast.ai/article/building-your-first-mcp-server-on-vast-ai
[vastai-image]: https://img.shields.io/badge/Vast.ai-Host%20Provider-0ea5e9
[vastai-link]: https://docs.vast.ai/api-reference/introduction
