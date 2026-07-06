---
name: pr-body
description: "Draft a concise GitHub PR body for a completed issue or finished implementation slice"
agent: implementation
argument-hint: "Point to the issue file and the completed implementation scope to summarize"
---

Use [implementation.agent.md](../agents/implementation.agent.md) to draft a PR body for completed work.

Working rules:

- Use this only when the implementation scope is complete enough to summarize honestly.
- Keep the PR body human-readable, consistent, and concise.
- Summarize what changed and why without turning the PR body into a changelog or deep code walkthrough.
- Prefer high-level touched areas and behavior summaries over file-by-file noise.
- Include validation that was actually run.

Deliver a PR body with:

- issue title header
- short summary
- high-level changes
- key behaviors or outcomes
- validation
- optional follow-up notes only when they matter