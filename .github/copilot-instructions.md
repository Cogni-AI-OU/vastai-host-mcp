# Copilot Instructions

## Project Overview

This is the `vastai-host-mcp` repository.
It provides a TypeScript FastMCP server focused on Vast.ai host/provider workflows.

Key contents:

- **MCP server implementation**: `src/index.ts` with modular client/tools/rules
- **Host API client**: `src/client/VastAIHostClient.ts`
- **Tool definitions**: `src/tools/hostTools.ts`
- **Automation rules**: `src/rules/MCPRules.ts`
- **Environment/config**: `.env.example`, `src/config.ts`, `src/logger.ts`
- **Agent configurations**: `AGENTS.md`, `CLAUDE.md`

### Getting started

- Refer to the `README.md` in the project root for setup and installation instructions.
- Check also `.tours/getting-started.tour` which provides a guided walkthrough of key project features and structure.

Quick local setup:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

### Vast API References

When adding or changing host/provider endpoints, always validate against official Vast API docs first.

- Start with the README section: `Where to check Vast API` in `README.md`.
- Use docs index: <https://docs.vast.ai/llms.txt>
- Use API intro: <https://docs.vast.ai/api-reference/introduction>
- Prefer machine/search endpoint pages referenced in `README.md` for route/method validation.

Important rules for endpoint work:

- Do not invent or guess endpoint paths.
- Confirm both HTTP method and request payload shape from docs.
- If an operation is not documented as API, prefer explicit CLI-only handling with clear messaging.

## Coding Standards

### TypeScript

- Use **TypeScript strict mode** (`tsconfig.json`) and keep types explicit in MCP tools.
- Define tool parameters with **Zod** and preserve stable tool names with `vastai_host_` prefix.
- Use `VastAIHostClient` for endpoint access; avoid ad-hoc HTTP calls in tools.
- Keep host/provider scope only. Do not add renter-centric workflows in this server.
- For undocumented host operations, prefer explicit CLI-only guidance over guessed API routes.

### Runtime and scripts

- Use Node 20+ and pnpm scripts from `package.json`:

  ```bash
  pnpm dev
  pnpm build
  pnpm inspect
  ```

## Formatting Guidelines

### JSON

Follow the JSON rules in `.github/instructions/json.instructions.md`, which mirror the repository `.editorconfig` configuration.

To test locally, use `jq` for validation or use the VS Code JSON formatter.

### Markdown

Follow the Markdown rules in `.github/instructions/markdown.instructions.md`, which mirror the repository markdownlint configuration.

To test locally, run via `pre-commit run markdownlint -a` or use the VS Code Markdownlint extension.

### YAML

Follow the YAML rules in `./.github/instructions/yaml.instructions.md`, which mirror the repository `.yamllint` configuration.

Notes:

- Project utilizes Codespaces with config at `.devcontainer/devcontainer.json` and requirements at `.devcontainer/requirements.txt`.
- GitHub Actions run pre-commit checks (`.pre-commit-config.yaml`).
- To verify locally, run `pre-commit run yamllint -a` from the repo root.

## Project Structure

Current high-level layout:

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
├── .github/
│   ├── ISSUE_TEMPLATE/      # Issue templates (bug reports, feature requests)
│   ├── instructions/         # Language-specific coding standards
│   ├── workflows/            # GitHub Actions workflows
│   ├── copilot-instructions.md
│   └── pull_request_template.md
├── .vscode/
│   └── mcp.json              # Workspace MCP server config for VS Code
├── .tours/                   # VS Code guided tours
├── .env.example
├── package.json
├── tsconfig.json
├── AGENTS.md                 # AI agent guidance
├── CLAUDE.md                 # Claude-specific configuration
├── CODE_OF_CONDUCT.md        # Community standards
└── README.md                 # Repository documentation
```

### Tours

- Keep the `.tours` folder up-to-date (especially `.tours/getting-started.tour`)
  when making significant changes to the codebase.
  Update existing tours or create new ones to reflect changes in project structure,
  workflows, or key files.

## Troubleshooting

### Finding Build Errors

To identify and diagnose the latest build errors:

1. **Reproduce errors locally:**
  - For TypeScript compile errors: Run `pnpm build`
  - For MCP wiring issues: Run `pnpm inspect`
  - For pre-commit errors: Run `pre-commit run -a` to check all files
   - For specific hooks: Run `pre-commit run <hook-name> -a` (e.g., `markdownlint`, `yamllint`)
   - For actionlint errors: Install actionlint and run it on workflow files

2. **Common error patterns:**
   - **Markdown linting errors:** Check `.markdownlint.yaml` for rules; errors show line numbers
   - **YAML linting errors:** Check `.yamllint` for rules; verify indentation and structure
   - **JSON formatting errors:** Use `jq . <file>` to validate JSON syntax
