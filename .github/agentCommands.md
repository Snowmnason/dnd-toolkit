Typical flow:

`/new-issue` -> `/start-implementation` -> `/test-plan` and/or `/doc-closeout` -> `/code-review` -> `/pr-body`

Examples:

- Need to shape a new cleanup issue or refine an existing one: start with `/new-issue`.
- Finished a code slice and want the normal closeout flow: use `/test-plan`, `/doc-closeout`, `/code-review`, then `/pr-body` as needed.

`Issue Planner` — open the `issue-planner` agent when you want a long-lived planning chat about app needs, bugs, features, issue scope, or milestone sequencing.
`/new-issue` — start the issue-planning workflow and produce or refine a human-facing issue draft using the built-in `issue-planner` method.
`Implementation` — open the `implementation` agent when you want to code a specific issue track, phase, step, or bug-fix slice without drifting into docs or tests.
`/start-implementation` — start the implementation workflow for the current issue slice and validate the touched code.
`/pr-body` — draft a concise PR body for a completed issue or finished implementation scope.
`Docs` — open the `docs` agent when you want issue closeout docs, README updates, or a suggested deep technical note after implementation.
`/doc-closeout` — start the docs workflow for issue closeout docs, top-level README updates, or approval-gated deep notes.
`Tests` — open the `tests` agent when you want backend Vitest coverage or a short QA guide for user-visible behavior.
`/test-plan` — start the testing workflow for backend Vitest coverage or a non-developer QA guide.
`Review` — open the `review` agent when you want a fresh review against the issue, PR body, and current changes, with small review corrections when appropriate.
`/code-review` — start the review workflow and return findings first.