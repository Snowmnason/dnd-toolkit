---
applyTo: "docs/A Testing Guide/**/*.md"
description: "Use when writing or refining non-developer QA guides under docs/A Testing Guide/** and keep them short, consistent, and user-facing"
---

# QA Guide Rules

- These guides are for non-developers. Write for QA testers, product reviewers, or other humans validating visible behavior.
- Keep the guide short, checklist-driven, and easy to scan.
- Use simple user actions and expected results, not developer terminology.
- Do not require code knowledge.
- Do not tell the reader to install packages, run Vitest, or use developer tooling unless the user explicitly asked for a technical guide.
- Prefer updating an existing guide over creating a new one.

## When To Create One

- Create or update a QA guide only when the feature has user-visible behavior a non-developer can verify.
- Do not create a QA guide for invisible backend logic, pure plumbing, or refactors with no user-facing effect.

## Required Shape

- `# Feature Name - Testing Guide`
- Short overview
- Prerequisites when needed
- Test cases with clear steps and expected outcomes
- Platform-specific notes when relevant
- Short pass or fail recording instructions

## Style Rules

- Use plain language and present tense.
- Prefer numbered steps and short expected-result bullets.
- Keep screenshots or evidence requests simple.
- Do not use emojis.