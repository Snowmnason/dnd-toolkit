# Testing Guide Guide

Use this file when creating, rewriting, merging, or deleting QA guides in this folder.

## Keep Each Guide Simple

1. Start with `# Feature Name - Testing Guide`.
2. Add a short overview that says what needs to be tested.
3. Add prerequisites only when they are actually needed.
4. Use a small number of clear test headers.
5. Under each test header, use a few bullets for what should happen.
6. Add platform notes only when app and web behavior differ.
7. End with short pass or fail recording instructions.

## Do Not Include

- Package install steps, Vitest commands, or developer tooling.
- Code snippets, internal file paths, hook names, or implementation notes.
- Large troubleshooting sections, architecture notes, or root-cause analysis.
- Repeated explanations that already exist in another guide.
- Extra sections that do not help a non-developer verify visible behavior.

## Folder Layout

- Prefer one to three root-level guides for broad QA coverage.
- Use sections inside a guide before creating a new subfolder.
- Only split into separate files when testers truly need different platform instructions.
- Delete old platform folders after their useful content has been merged.

## Preferred Shape

```md
# Feature Name - Testing Guide

Short overview.

## Prerequisites
- Only when needed

## What To Test

### Header 1
- Expected result
- Expected result

### Header 2
- Expected result
- Expected result

## Pass / Fail
- Pass: what success looks like
- Fail: what to capture or report
```

## Cleanup Rule

- Prefer one clear guide per feature set or major flow.
- Merge overlapping guides instead of keeping near-duplicates.
- Delete outdated guides and empty platform folders once their useful content has been moved.