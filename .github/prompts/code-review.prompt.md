---
name: code-review
description: "Run a fresh review against the issue, PR body, and current changes, then apply small review corrections when appropriate"
agent: review
---

Use [review.agent.md](../agents/review.agent.md) to review the current branch with fresh eyes.

Working rules:

- Read the current issue doc first.
- Read the PR body or PR draft when one exists.
- Compare both against the actual code changes.
- Present findings first, ordered by severity.
- Apply small local review corrections when they stay inside the touched slice.
- If a finding requires substantial new implementation, hand it back instead of silently expanding scope.
- Run the narrowest useful validation after review corrections.

Deliver:

- findings first
- any local corrections applied
- validation results
- remaining concerns or follow-ups
