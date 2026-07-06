---
name: new-issue
description: "Start the issue planner to discuss an app need and produce or refine a GitHub-ready issue draft"
agent: issue-planner
argument-hint: "Describe the feature, bug, gap, next step, or issue file to refine"
---

Use [issue-planner.agent.md](../agents/issue-planner.agent.md) to turn the current discussion into a human-facing issue.

Working rules:

- Start with discussion and scope clarification unless the user already provided a near-finished issue.
- Treat any issue file or draft the user provided as the main shared artifact for this work.
- Use the `issue-planner` agent's built-in issue-shaping method for research, track design, scope boundaries, and acceptance criteria.
- Keep docs and tests as acceptance criteria unless the issue genuinely needs a different structure.
- Do not implement code in this workflow.

Deliver one of these:

- a clarified issue scope with open questions
- a refined issue outline
- a complete human-facing issue draft ready for GitHub or `docs/suggestions/**`