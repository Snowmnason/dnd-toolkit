---
name: test-plan
description: "Start the tests agent to add backend Vitest coverage or write a non-developer QA guide for the current issue slice"
agent: tests
argument-hint: "Point to the issue file, touched backend slice, or user-visible feature needing a QA guide"
---

Use [tests.agent.md](../agents/tests.agent.md) to add tests for the current issue slice.

Working rules:

- Write Vitest tests only under `__tests__/**`.
- Only test backend or logic-heavy code, not UI rendering changes.
- Do not install packages or add new test tooling.
- If the issue needs a non-developer verification guide, create or update it under `docs/A Testing Guide/**`.
- If a failing test exposes an implementation bug, report it clearly and stop instead of fixing the production code.

Deliver:

- the test or QA guide update
- the command that was run
- any implementation failure that must be handed back to implementation