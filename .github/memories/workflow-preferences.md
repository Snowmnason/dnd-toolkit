# Workflow Preferences

## Use For
- Durable collaboration preferences that should shape multiple workflows.
- Stable habits about scope, tone, handoff style, and artifact choices.
- Cross-agent quirks that should survive chat crashes, restarts, or handoffs.

## Do Not Include
- Issue-specific status, temporary to-do lists, or current branch state.
- Full issue drafts, PR bodies, review reports, or copied docs.
- Speculative ideas that were not confirmed with the user or the repo.
- Secrets, credentials, tokens, or machine-local details.

## Notes
- Prefer smaller, scoped edits over broad refactors unless expansion is necessary.
- Do not add a dedicated milestone-plan prompt or reusable milestone template by default; rely on `issue-planner`, the issue doc, and existing planning docs unless a repeated real gap appears.
- Keep the three memory layers distinct: active chat continuity, shared issue or workflow artifacts, and small persistent memory notes.
- Preserve durable quirks and habits through concise write-back so new chats or machines can recover after chat loss.
- Avoid emojis in responses and docs unless explicitly requested.
