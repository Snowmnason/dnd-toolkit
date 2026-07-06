---
applyTo: "{lib,hooks,system}/*/README.md"
description: "Use when updating top-level module READMEs in lib/*, hooks/*, or system/* and keep them concise, scannable, and implementation-oriented"
---

# README Rules

- These README files are quick module maps for developers and the implementation agent, not deep tutorials.
- Applies to top-level README files only. Do not create nested README files for subdirectories unless the user explicitly asked for an exception.
- Keep descriptions short and concrete. A README should explain what the module contains, what its main parts do, and where to look next.
- Prefer one parent README section for notable subdirectories instead of creating subdirectory READMEs.
- Do not try to document every function in detail. Use concise surface summaries, code comments, or a deeper note when needed.

## Required Shape

- `# Module Name`
- One short summary paragraph
- `## What Lives Here`
- `## Key Responsibilities`
- `## Important Paths` or `## Key Entry Points` when the module has multiple surfaces
- `## Related Modules`
- `## File Breakdown`

## Style Rules

- Keep prose concise, present tense, and plain.
- Use inline code for file paths, types, symbols, and config keys.
- Prefer links to related modules instead of duplicating their internals.
- Do not add changelog sections, history sections, future enhancement sections, or testing sections.
- Do not use emojis.