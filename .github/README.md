# GitHub Workflows and Actions

This directory contains GitHub Actions workflows, agent prompts, and related configuration.

## Workflows

### Check workflow

The `workflows/check.yml` file is a thin wrapper that delegates to the organization-standard reusable workflow:

- `uses: Cogni-AI-OU/.github/.github/workflows/check.yml@main`

This keeps repository CI behavior aligned with centralized updates.

### Development Containers (CI)

The `workflows/devcontainer-ci.yml` file delegates to the reusable org workflow and passes repository-specific
required commands and Python packages.

Important notes:

- The job grants `packages: write` permission so GHCR push operations can succeed.
- Trigger scope is limited to `.devcontainer/**` and the workflow file itself.

## Agent prompts

The `prompts/` directory contains ready-to-use prompts for automation and repository maintenance.

- Agent-facing prompt catalog: [prompts/AGENTS.md](prompts/AGENTS.md)
- Human-friendly prompt notes: [prompts/README.md](prompts/README.md)

## Problem matchers

GitHub Actions problem matchers automatically annotate pull requests with linting errors and warnings.

### Available matchers

- `actionlint-matcher.json`: captures `actionlint` diagnostics
- `pre-commit-matcher.json`: captures `pre-commit` diagnostics

### Configuration

Problem matchers are registered from the reusable check workflow and used to surface file/line diagnostics in CI.

## Security notes

Repository administrators should maintain branch protections and review requirements for all protected branches.

Recommended baseline:

1. Require pull request reviews before merge.
2. Require status checks to pass.
3. Restrict direct pushes to protected branches.
4. Keep `CODEOWNERS` updated for sensitive paths.
