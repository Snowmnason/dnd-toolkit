---
name: start-implementation
description: "Start the implementation agent for a specific issue track, phase, step, bug fix, or feature slice"
agent: implementation
argument-hint: "Point to the issue file and name the current track, phase, step, or implementation slice"
---

Use [implementation.agent.md](../agents/implementation.agent.md) to implement the current issue slice.

Working rules:

- Treat the current issue doc and the named track, phase, or step as the source of truth for scope.
- Read [copilot-instructions.md](../copilot-instructions.md) first and follow the implementation agent's hard boundaries.
- Implement code only. Do not write docs, issue docs, READMEs, tests, or Vitest files in this workflow.
- If docs or tests are requested, stop and tell the user to switch to the docs or tests workflow.
- If a small adjacent scope expansion is required to make the implementation correct, disclose it before doing it.
- Validate the touched slice with the narrowest useful check after editing.
- If the user indicates the issue or PR scope is complete, include a concise PR body draft.

Deliver:

- the code change for the current issue slice
- the validation result
- the PR body draft when the issue or PR scope is complete
- any small disclosed scope expansion or remaining blocker