# GitHub Actions Workflows (Agent Catalog)

Authoritative, agent-facing catalog of workflows in this repository. Use this when loading or modifying
workflows and keep it in sync with the files in this directory.

For a human-readable overview, see [README.md](README.md).

## Workflow catalog

| Workflow | Purpose | Key triggers / notes |
| -------- | ------- | -------------------- |
| [check.yml](check.yml) | Linting and quality gates via actionlint and pre-commit | push, pull_request, schedule; reusable via `workflow_call` |
| [devcontainer-ci.yml](devcontainer-ci.yml) | Build/test devcontainer and required tools/packages | push/pull_request touching .devcontainer or workflow |

## Details

### check.yml

- Purpose: run actionlint and pre-commit to enforce workflow and repo standards.
- Reusable: `uses: Cogni-AI-OU/.github/.github/workflows/check.yml@main`.
- Jobs: `actionlint`, `pre-commit`.

### devcontainer-ci.yml

- Purpose: build and validate the dev container; ensure required tools and Python packages exist.
- Inputs: `required_commands` and `required_python_packages` are passed through from this repository wrapper.
- Triggers: pull_request/push affecting `.devcontainer/` or this workflow.
- Permissions: grants `packages: write` for GHCR operations in the reusable workflow.
- Reusable: `uses: Cogni-AI-OU/.github/.github/workflows/devcontainer-ci.yml@main`.

## Notes

- Follow [.github/instructions/github-workflows.instruction.md](../instructions/github-workflows.instruction.md)
  when editing workflow files (ordering, formatting, validation).
- Keep this catalog updated when workflows are added, removed, or renamed.
