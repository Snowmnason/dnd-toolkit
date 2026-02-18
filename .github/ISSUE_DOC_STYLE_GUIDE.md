# Issue Doc Style Guide

This document defines where to place issue docs, what files to create, and how to write them. It exists so that all contributors and AI models produce consistent, easy-to-scan documentation for completed issues.

> **Scope**: This guide applies only to issue docs under `docs/issues/`.  
> For module READMEs (`lib/*/README.md`) see `docs/Important Notes/README_STYLE_GUIDE.md`.

---

## Placement Rules

### Step 1 — Pick the Milestone folder

Always place new issue docs in the **highest-numbered Milestone** folder that exists.

```
docs/issues/
  MileStone 1/      ← older
  MileStone 2/      ← current highest → use this one
```

When MileStone 3 is created, all new docs go there instead.

### Step 2 — Pick the Tier subfolder (if tiers exist)

If the Milestone contains Tier subfolders, use the **highest-numbered Tier** that fits the issue's scope.  
If a new issue does not belong to any existing Tier, place it directly in the Milestone folder.

```
MileStone 2/
  Teir 1/     ← note: existing typo in folder name, do not rename
  Tier 2/
  Tier 3/
  Tier 4/     ← use this, it's the highest
```

### Step 3 — Create the issue folder

Name the folder: `NNN - Short Description`

- `NNN` is the GitHub issue number.
- Short Description is a few words matching the issue title (Title Case, no special characters).
- Example: `194 - Platform Specific Config`

---

## What Files to Create

Each issue folder should contain **at minimum** these two files:

| File | Purpose |
| ---- | ------- |
| `USAGE_GUIDE.md` | How to use or integrate what was built. Audience: future devs. |
| `IMPLEMENTATION.md` | What files were added or edited and what each change does. Audience: reviewer or dev picking up later. |

Additional files are allowed and encouraged when needed:

| File (example names) | When to create it |
| -------------------- | ----------------- |
| `ARCHITECTURE.md` | When the feature has a non-trivial data flow or system design worth diagramming separately |
| `EXAMPLES.md` | When the Usage Guide would get too long with all examples inline |
| `LIMITS.md` | When the feature has important constraints, quotas, or known boundaries a dev needs to know |
| `MISSING.md` or `GAPS.md` | When scope was intentionally cut and a future dev needs to know what is not done yet |
| `VARIANT_TRACKING_GUIDE.md` | Feature-specific doc for A/B test variant tracking, etc. |

**Rule**: Only create extra files when they would be genuinely useful. Don't pad the folder.  
**Rule**: Never name any file `README.md` inside an issue folder. That name is reserved for module READMEs.

---

## USAGE_GUIDE.md

### Purpose

Explains **how to use** what was built. A future developer should be able to read this and integrate the feature without digging into the source code.

### Required Sections (in order)

```
# [Feature Name] - Usage Guide   or   # [Feature Name]

[One short paragraph explaining what this feature does and when to use it.]

## Overview               ← bullet list: what it's for, what NOT to use it for

## How It Works           ← optional, only if the mental model needs explaining
                            use sub-sections (###) per concept

## Basic Usage            ← step-by-step integration, numbered where order matters
                            include code examples for each step

## [Function/API Name]    ← one section per major function or API surface
                            describe params, return value, short example

## Configuration          ← if the feature has config options

## Troubleshooting        ← optional, include only if there are real gotchas
```

### Writing Style

- Short, direct sentences. This is a quick-reference doc, not a tutorial.
- Code examples for every non-trivial function. Use `typescript` fenced blocks.
- Bullet lists for options, requirements, and "do/don't" pairs.
- Bold the first time a key term appears.
- Link to the module README for deeper detail: `See [lib/jobs README](../../../lib/jobs/README.md)`.
- No changelogs, no design rationale, no implementation history.

---

## IMPLEMENTATION.md

### Purpose

Records **what changed in the codebase** for this issue. A reviewer or a dev picking up later can read this to understand exactly where things live and what each change does — without reading every diff.

### What to Include

- **New files**: List every new file, its path, and a one-sentence description of its purpose. Include key exports if they are not obvious from the name.
- **Edited files**: List every file that was meaningfully changed, and briefly describe what the edit does (not *why* — just *what*).

### What NOT to Include

- Deleted files — do not document them.
- Trivial edits (import additions, formatting fixes) — skip these.
- Design rationale or decision history — that belongs in commit messages or issue comments.
- Function-level "why" explanations — just say what the change does.

### Required Sections (in order)

```
# [Feature Name] - Implementation

[One sentence: what this feature does at a high level.]

## New Files

| File | Purpose |
| ---- | ------- |
| `path/to/file.ts` | What it does, key exports if relevant |

## Edited Files

| File | What Changed |
| ---- | ------------ |
| `path/to/existing.ts` | Brief description of what the edit does |
```

### Writing Style

- Tables are the standard format for file lists — consistent and scannable.
- File paths are in backticks.
- Keep "What Changed" to one or two sentences per file. If a file had many changes, summarize the theme.
- If a file had multiple distinct changes, use a short bullet list in the table cell instead of one sentence.

---

## ARCHITECTURE.md (when to create it)

Create this when the feature has a meaningful data flow, system diagram, or interaction between multiple modules that is not obvious from usage alone.

### Typical Contents

- ASCII or box-drawing flow diagram showing how data moves through the system.
- Sub-sections per phase or layer if the architecture has distinct stages.
- Notes on evaluation order, merge priority, caching strategy, etc.

It should read like a **map**, not a tutorial. No step-by-step instructions — that belongs in USAGE_GUIDE.md.

---

## General Rules for All Issue Docs

| Rule | Detail |
| ---- | ------ |
| **No `README.md` filenames** | That name is only for module READMEs. Use descriptive ALL_CAPS names. |
| **ALL_CAPS filenames** | All issue doc files use ALL_CAPS with underscores: `USAGE_GUIDE.md`, `IMPLEMENTATION.md`, `ARCHITECTURE.md`. |
| **No code edits** | Issue docs describe code, never contain or modify it. |
| **No changelogs** | Don't list dates, phases, or "Phase 1 / Phase 2" completion history. |
| **Keep it quick** | A dev should get what they need in under 2 minutes of reading. |
| **Link, don't duplicate** | If something is fully documented in a module README, link to it instead of copying it. |
| **Tense** | Present tense ("The file exports…", not "The file was written to export…"). |
| **No emojis** | Keep it plain and professional. |
