---
applyTo: ".github/*.md"
description: "Rules for maintaining root-level .github markdown docs during the cleanup and agent-workflow refactor"
---

# `.github` Markdown Rules

Use [.github/DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md) as the routing source before creating or expanding any root-level `.github` markdown file.

## Intent

- Keep `.github/` focused on stable workflow references, instructions, prompts, and agent definitions.
- Prefer refining an existing canonical guide over creating a new overlapping markdown file.
- Treat procedural behavior as a better fit for prompts, instructions, or agents unless the behavior is a durable contract multiple files will reuse.

## Keep As Canonical References

These files should remain small, intentional reference points:

- `copilot-instructions.md`
- `naming_schema.md`

## Cleanup Rules

- Do not create a new guide when an existing guide can be refined.
- Do not duplicate the same rules in both `.github/` and `docs/`.
- Do not keep procedural placeholder docs at the root once a prompt or agent replaces them.
- Prefer retiring root-level issue-planning guides after their behavior is absorbed by `issue-planner`, `/new-issue`, or scoped issue instructions.
- Prefer retiring root-level documentation style guides after their behavior is absorbed by `docs`, `/doc-closeout`, or scoped documentation instructions.
- Prefer retiring root-level testing guides after their behavior is absorbed by `tests`, `/test-plan`, or scoped testing instructions.
- Prefer retiring root-level review and PR-body guides after their behavior is absorbed by `review`, `/code-review`, `implementation`, or `/pr-body`.
- Keep root-level `.github` markdown concise; move long app-specific docs out of `.github`.
- Preserve `naming_schema.md` as a stable standalone reference unless there is a strong reason to change it.

## File-Specific Direction

- `agentCommands.md`: use as a human-facing index only; do not store primary workflow logic there.
- `copilot-instructions.md`: keep always-on rules high value and non-duplicative; link to other docs instead of embedding everything.

## During This Refactor

When changing a `.github` markdown file, explicitly decide whether the content belongs in:

1. a stable reference doc
2. a prompt
3. an instruction file
4. an agent definition

If the content is mostly step-by-step behavior for one workflow, prefer a prompt or agent.
If the content is a reusable contract, keep it as a reference doc.
