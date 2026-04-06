# Prompt Catalog for Agents

Authoritative list of prompts in this directory. Use these entries for loading prompts in workflows or
agent sessions, and keep the catalog in sync with files on disk.

For a human-readable overview, see [README.md](README.md).

## Prompts

| Prompt | Format | Purpose |
| ------ | ------ | ------- |
| [default.prompt.yml](default.prompt.yml) | YAML | Default system prompt for general repository automation tasks |
| [repository-setup.prompt.md](repository-setup.prompt.md) | Markdown | Full repository setup checklist using org standards from Cogni-AI-OU/.github |
| [test.prompt.yml](test.prompt.yml) | YAML | Minimal test prompt fixture for workflow and prompt pipeline validation |

## Notes

- Apply prompt files only when a user or task explicitly requests or approves their use.
- Use Markdown prompts for human-readable checklists and structured guidance.
- Use YAML prompts for GitHub Models or programmatic consumption.
- Update this catalog whenever prompts are added, removed, or renamed.

## Usage

- For GitHub Models, load YAML prompts directly; for chat agents, paste Markdown prompt content.
- Keep prompts in sync with this catalog when creating or removing files.
