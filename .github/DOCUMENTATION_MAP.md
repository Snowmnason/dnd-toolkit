# Documentation Map

Purpose: define which documentation in this repo is canonical, what belongs in `.github/` versus `docs/`, and how markdown cleanup should proceed before the new agent workflow is built.

## Guiding Rules

- Keep a small canonical reference layer in `.github/`.
- Move highly procedural behavior into prompts, instructions, or agents over time.
- Do not delete a standalone guide until its behavior has been absorbed by a replacement file.
- Keep portable foundation guidance separate from DnD-specific app documentation.
- Prefer linking to one canonical guide over duplicating the same rules in multiple files.

## Directory Roles

### `.github/`

Use for repo workflow and agent-facing operating guidance:

- Copilot/global instructions
- Agent and prompt definitions
- Scoped instruction files
- Contributor workflow guides
- Stable style guides that multiple agents reuse

### `docs/core/`

Planned home for app-agnostic foundation docs:

- Portable system architecture
- Reusable manager/middleware/system patterns
- Foundation-level operational guides
- Templates intended to survive repo cloning into a new app

### `docs/app-specific/`

Planned home for DnD-specific or app-instance-specific docs:

- Milestone and feature issue docs
- Manual QA flows tied to current app behavior
- Desktop/app-specific operational notes
- Suggestions and feature backlog notes tied to this app

### `docs/issues/`

Current issue workspace. Keep per-issue artifacts here for now, but make the structure portable:

- Per-issue docs
- Planned `WORKFLOW_STATE.md` files
- Portable templates should eventually live in a clearly shared template location

## `.github` Cleanup Classification

| File | Keep / Refine / Retire | Role After Cleanup | Notes |
| ---- | ---- | ---- | ---- |
| `copilot-instructions.md` | Keep and refine | Always-on repo architecture + workflow constraints | Separate dependency boundaries from orchestration flow more clearly |
| `naming_schema.md` | Keep | Canonical naming reference | Stable human and agent reference |
| `agents/issue-planner.agent.md` | Keep and refine | Canonical issue-planning workflow behavior | Owns issue creation behavior, repo-grounded research expectations, and track design rules |
| `instructions/docs-issue.instructions.md` | Keep and refine | Canonical issue-markdown style rules for `docs/suggestions/**` | Keeps issue writing concise and documentation-focused without owning planning logic |
| `agents/docs.agent.md` | Keep and refine | Canonical documentation workflow behavior | Owns issue closeout docs, README maintenance, and approval-gated deep-note suggestions |
| `instructions/readme.instructions.md` | Keep and refine | Canonical top-level README rules | Shared lean README rules for `lib/*`, `hooks/*`, and `system/*` |
| `instructions/issue-closeout.instructions.md` | Keep and refine | Canonical issue closeout doc rules | Shared rules for `docs/issues/**` deliverables |
| `agents/tests.agent.md` | Keep and refine | Canonical testing workflow behavior | Owns backend Vitest coverage, failure reporting, and QA-guide handoff |
| `instructions/testing.instructions.md` | Keep and refine | Canonical backend Vitest rules | Shared rules for `__tests__/**` coverage |
| `instructions/qa-testing-guide.instructions.md` | Keep and refine | Canonical QA guide rules | Shared rules for `docs/A Testing Guide/**` |
| `agents/review.agent.md` | Keep and refine | Canonical review workflow behavior | Owns findings-first review, merger checks, and small review corrections |
| `prompts/pr-body.prompt.md` | Keep and refine | Canonical PR body drafting behavior | Supports concise PR summaries after completed implementation |
| `agentCommands.md` | Replace | Human-facing index/quickstart only | Should point to actual prompts, instructions, and agents |

## Near-Term Cleanup Sequence

1. Use this map to avoid adding new duplicated markdown guides.
2. Refine the canonical `.github` references that should survive.
3. Create workflow-specific docs next:
   - `ISSUE_WORKFLOW_GUIDE.md`
   - `AGENT_COORDINATION_GUIDE.md`
4. Create the per-issue workflow-state template.
5. Start building prompts, instructions, and agents against the cleaned reference layer.
6. Retire or shrink procedural standalone docs only after replacement behavior exists.

## Practical Rule For This PR

When deciding whether to create a new markdown file, ask:

- Is this a stable reference multiple agents and humans will reuse?
- Or is this really prompt/agent behavior that should live in a customization file?

If it is behavior, prefer prompts, instructions, or agents.
If it is a reusable contract, keep it as a small canonical guide.
