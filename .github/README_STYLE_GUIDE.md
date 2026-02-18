# README Style Guide

This document defines the canonical structure and formatting for all `README.md` files under `lib/`. It exists so that different contributors and AI models produce consistent, navigable documentation.

> **Scope**: This guide applies only to module READMEs (`lib/*/README.md`).  
> For issue docs (`docs/issues/`) see the writing conventions in `.github/copilot-instructions.md`.

---

## Document Structure

Every module README must follow this section order. Sections that do not apply to a module may be omitted, but the order of present sections must not change.

```
# [Module Name]
[one-sentence or short summary paragraph]

## When to Use This Module       ← required
## Architecture & Data Flow      ← required
## API Reference                 ← required
## Configuration                 ← if the module has config
## Dependencies                  ← required
## Error Handling & Edge Cases   ← required
## Performance Notes             ← required
## Observability & Analytics     ← if the module emits meaningful events/logs
## Related Modules               ← required
## File Breakdown                ← required
```

> **Do NOT include** a `## Testing` section or a `## Future Enhancements` section.  
> Testing belongs in `docs/A Testing Guide/`. Future work belongs in `docs/suggestions/`.

---

## Section-by-Section Rules

### `# [Module Name]`

- H1 uses the human-readable module name, not the folder path.
- Follow the H1 immediately with a **single short paragraph** (1–3 sentences) describing what the module is and what problem it solves. This is the summary — it should give a reader enough context to know if this is the right module before reading further.
- No bullet list here, no sub-heading — just plain prose.

```markdown
# Auth Module

Comprehensive authentication system providing email/password auth with secure session management...
```

---

### `## When to Use This Module`

Two bold sub-headings (not H3), each followed by a bullet list.  
The exact wording of the headings must be:

```markdown
**Use this module if you need to:**

- ...

**Do NOT use this module for:**

- ...
```

- `NOT` is always all-caps.
- Each bullet is a short imperative sentence ending without a period.
- Cross-module references in bullet text use inline links: `[lib/storage's SecureStorage](../storage/README.md)`.
- Backtick code formatting is used for symbol names inline: `` `useAuthGuard` ``.

> **Exception**: Some modules use domain-specific heading names (e.g., `## When to Use Safe Mode` in `lib/error`) when "module" is not the right framing. The two-list pattern (do/don't) still applies.

---

### `## Architecture & Data Flow`

Two required parts, in order:

1. **ASCII flow diagram** in a fenced code block (no language tag):

```
Request Call
        ↓
Step One
        ↓
Step Two
        ↓
Return Result
```

- Each step is on its own line.
- Arrow `↓` is vertically aligned (8 spaces of indent before `↓` is the common pattern).
- Step labels are concise noun phrases or short sentences.
- Optional: brief inline annotations in parentheses `(e.g., non-blocking)`.

2. **Key Principles** bold sub-heading followed by a bullet list:

```markdown
**Key Principles:**

- **Principle name**: Short explanation of what this means in practice.
- **Another principle**: ...
```

- Each bullet starts with the principle name in bold, followed by a colon, then a plain-text explanation.
- Explanations end with a period (unlike the "When to Use" lists).
- Additional prose paragraphs can appear between the diagram and Key Principles when context is needed (see `lib/feature-flags` for examples with multiple sub-paths).

---

### `## API Reference`

Organize under H3 headings per class or logical group. If a class or object is the entry point, use:

```markdown
### `ClassName`

One sentence describing what this class/object manages.
```

Methods under a class are H4:

```markdown
#### `ClassName.methodName(params): ReturnType`

One sentence description.
```

Each method should include:

- **Parameters** list (if any):
  ```markdown
  **Parameters:**
  - `paramName` (Type) – Description
  ```
- **Returns** line (if non-void):
  ```markdown
  **Returns:** `ReturnType` – Description
  ```
- A code example in a `ts` fenced block.
- An optional **Process** or **Example** section for complex flows.

Standalone functions (not on a class) follow the same method pattern but under a plain H3:

```markdown
### `functionName(params): ReturnType`
```

Horizontal rules `---` separate major logical groups within the API Reference section.

---

### `## Configuration`

Use only when the module reads from `appsettings.*.json` or similar. Show the JSON shape in a `json` fenced block:

```markdown
```json
{
  "sectionName": {
    "field": "value"
  }
}
```
```

Follow with a TypeScript snippet showing how to load it, if non-obvious.

---

### `## Dependencies`

Two fixed sub-headings:

```markdown
### External Packages

- **`package-name`** – What it is used for (one sentence)

### Internal Dependencies

- **`lib/module-name`** – What this module uses it for (one sentence)
```

- Internal links use relative paths: `[lib/cache](../cache/README.md)`.
- If neither external nor internal dependencies exist, note "None" under that heading rather than omitting it.

---

### `## Error Handling & Edge Cases`

Named subsections per scenario using H3:

```markdown
### Scenario Name

Explanation of the edge case and what happens. Code example if helpful.
```

- Each scenario gets its own H3.
- Include a `ts` or `json` code block only when the usage pattern is non-obvious.

---

### `## Performance Notes`

Named subsections using H3:

```markdown
### Operation Name

O(n) / O(1) analysis or a plain prose note about cost or throughput.
```

- Keep these short and factual.
- Mention caching behaviour, polling intervals, or subscription setup cost where relevant.

---

### `## Observability & Analytics`

Only include this section if the module emits meaningful analytics events or logger categories worth documenting. List:

- Events tracked (name + when it fires)
- Performance metrics
- Logger categories in use

---

### `## Related Modules`

Bullet list. Each bullet is a bold module reference with a one-sentence description of the relationship:

```markdown
- **`lib/storage` (SecureStorage)** – Encrypts and stores auth state and attempt history
- **`lib/analytics`** – Tracks auth flow events (signup/signin success and failure)
```

Use `---` horizontal rule before this section to visually separate it.

---

### `## File Breakdown`

A Markdown table with exactly two columns:

```markdown
| File            | Purpose                              |
| --------------- | ------------------------------------ |
| `file-name.ts`  | One sentence describing what it does |
```

- File names are wrapped in backticks.
- Purpose column is a single sentence; no period required but keep it consistent within the table.
- Include every file in the module folder that has non-trivial content.

---

## General Formatting Rules

| Rule | Detail |
| ---- | ------ |
| **Heading levels** | H1 for title, H2 for top-level sections, H3 for sub-sections, H4 for methods. Never skip levels. |
| **All top-level sections use `##`** | Every collapsible section must be `##`. This lets readers collapse sections while reading. |
| **Bold** | Used for sub-headings that are not `##`/`###`, key terms in Key Principles bullets, parameter names in description text, and module names in Related Modules. |
| **Backticks** | All symbol names: function names, class names, file names, config keys, type names, enum values. |
| **Code blocks** | Always include a language tag (`ts`, `json`, `sql`). ASCII diagrams use a plain fenced block (no language tag). |
| **Inline links** | Use relative paths for internal module links: `[lib/storage's SecureStorage](../storage/README.md)`. |
| **Cross-module depth** | When referencing another module, name it and describe the relationship in one sentence. Do not reproduce that module's internals — link to its README instead. |
| **Horizontal rules** | `---` is used to visually separate major groups within long sections (API Reference). Not used between every section. |
| **Sentence endings** | Bullet lists in "When to Use" end without periods. Bullet lists in Key Principles end with periods. Be consistent within each list. |
| **Tense** | Present tense throughout ("Returns the current state", not "Will return"). |
| **Person** | Third person ("The module provides…", not "This gives you…"). |
| **Line length** | Not enforced, but keep prose lines readable (~120 chars). Tables may be longer. |
| **Blank lines** | One blank line between a heading and its first content. One blank line between list items that have sub-content. No blank line between a bold sub-heading and its following bullet list. |

---

## What NOT to Do

- **Do not add a `## Testing` section.** Testing belongs in `docs/A Testing Guide/`.
- **Do not add a `## Future Enhancements` section.** Future work belongs in `docs/suggestions/`.
- **Do not add a "Changelog" or "History" section.** These files are living docs, not changelogs.
- **Do not go deep into another module's internals.** If something works with `lib/offline`, say so and link to its README. Do not reproduce its API.
- **Do not duplicate code** that already exists in other READMEs. Link to it instead.
- **Do not use H5 or H6.** If you need more nesting, restructure the section.
- **Do not call the file anything other than `README.md`.** Naming variation breaks navigation conventions.
- **Do not write installation instructions** unless the module is truly standalone (none are, currently).
- **Do not use emojis.**
- **Do not write in first person** ("I implemented…", "We decided…").
