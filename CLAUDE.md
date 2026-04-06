# CLAUDE.md

Guidance for Claude Code and compatible coding agents in this repository.

## Repository context

- Project: `vastai-host-mcp`
- Stack: TypeScript, FastMCP, Node.js
- Purpose: Vast.ai host/provider MCP tools and automation rules

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Common commands

```bash
pnpm build
pnpm inspect
pre-commit run -a
molecule syntax
molecule test
```

## Required standards

- Follow project instructions in `.github/copilot-instructions.md` and `.github/instructions/`.
- Validate host/provider API behavior against official Vast.ai docs before endpoint changes.
- Prefer `VastAIHostClient` for API access and Zod schemas for tool inputs.
- Keep workflow and YAML keys in deterministic, readable order.

## Safe operation rules

- Do not invent undocumented Vast.ai API endpoints.
- For CLI-only operations, return explicit guidance rather than guessed API calls.
- Preserve existing repository style and avoid unrelated refactors.

## MCP and tooling notes

- Reusable GitHub workflow wrappers are in `.github/workflows/`.
- Devcontainer setup is defined in `.devcontainer/devcontainer.json`.
- Prompt catalog is documented in `.github/prompts/AGENTS.md`.
