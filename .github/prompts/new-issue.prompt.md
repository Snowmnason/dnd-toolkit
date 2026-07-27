---
name: new-issue
description: "Start the issue planner to discuss an app need and create or refine a GitHub-ready issue draft in docs/suggestions by default"
agent: issue-planner
argument-hint: "Describe the feature, bug, gap, next step, or issue file to refine"
---

Use [issue-planner.agent.md](../agents/issue-planner.agent.md) to turn the current discussion into a human-facing issue.

Working rules:

- Start with discussion and scope clarification unless the user already provided a near-finished issue.
- Treat any issue file or draft the user provided as the main shared artifact for this work.
- Use the `issue-planner` agent's built-in issue-shaping method for research, track design, scope boundaries, and acceptance criteria.
- When the user wants a draft rather than chat-only planning, create or update a markdown file under `docs/suggestions/` by default.
- Prefer an existing suggestion file when the user points to one. Otherwise create a new file in `docs/suggestions/` unless the user asks for a different suggestion folder.
- Use chat for the concise summary, open questions, and the path you wrote, not for dumping the full draft when the draft now lives in the repo.
- Do not add time frames, estimates, or schedule language unless the user explicitly asks for them.
- Do not add standalone `Testing` or `Validation` sections unless the user explicitly asks for them.
- Keep docs and any necessary verification expectations in acceptance criteria unless the user explicitly wants a different structure.
- Do not implement code in this workflow.

Deliver one of these:

- a clarified issue scope with open questions
- a refined issue outline
- a created or updated human-facing issue draft in `docs/suggestions/**`, with a short chat summary and file path