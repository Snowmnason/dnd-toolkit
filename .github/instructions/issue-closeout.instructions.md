---
applyTo: "docs/issues/**/*.md"
description: "Use when writing issue closeout docs under docs/issues/**, including USAGE_GUIDE.md, IMPLEMENTATION.md, and optional companion issue files"
---

# Issue Closeout Rules

- Issue closeout docs document what was built after implementation. They do not replace planning issues in `docs/suggestions/**`.
- Every issue closeout should include `USAGE_GUIDE.md` and `IMPLEMENTATION.md`.
- Optional files such as `ARCHITECTURE.md`, `EXAMPLES.md`, `LIMITS.md`, `GAPS.md`, or other focused docs are allowed only when they genuinely improve the issue folder.
- Never create `README.md` inside an issue folder.

## Purpose Summary

- Preserve a short summary of the original issue purpose near the top of the issue-doc set so future readers remember why the work exists.
- Keep that summary short and factual.

## USAGE_GUIDE.md

- Explain how to use or integrate what was built.
- Audience is future developers.
- Keep the structure concise and practical: overview, how it works when needed, basic usage, key surfaces, configuration when relevant, troubleshooting when relevant.
- Link to module READMEs or deeper notes instead of copying large blocks of detail.

## IMPLEMENTATION.md

- Record what files were added or meaningfully edited and what each change does.
- Focus on what changed, not the full decision history.
- Use concise tables when listing files.
- Do not document deleted files unless the deletion itself is necessary context.

## General Rules

- Keep issue docs scannable and human-facing.
- Use present tense and plain language.
- Use inline code for files, types, flags, keys, and symbols.
- Do not turn issue docs into changelogs, status diaries, or patch dumps.
- Do not embed implementation patches or test code in the doc.
- Do not use emojis.