---
name: get-help
description: Investigate unresolved questions and decisions, help users understand their options, recommend evidence-based approaches, and seek human input when needed or requested. Use when a user cannot answer a question, lacks the expertise to make a decision, requests another person's input, or encounters uncertainty that may block progress.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Get Help

*Built by the team at [pargoo](https://www.pargoo.com/).*

Help the user move past an unanswered question without inventing a decision or repeatedly asking what they cannot answer. Work directly from the supplied question, task, conversation, repository, or Issue context. Require neither a repository nor an Issue when unnecessary, and no other DevFlow skill.

## Investigate and recommend

- Identify the actual unanswered question, why it matters, and which work depends on it. Reuse established decisions and inspect relevant supplied information, project conventions, documentation, and available evidence before asking for discoverable facts.
- Separate facts from choices requiring judgment or authority. Evaluate whether a choice can responsibly be made, rather than its technical difficulty; use neither numeric confidence scores nor rigid difficulty categories.
- Explain the question and practical options in accessible language. Recommend an approach when evidence supports it, stating material assumptions and trade-offs. Resolve routine technical choices from evidence and project conventions where authorized.
- A recommendation is not an accepted business decision. If the user accepts a recommendation within their authority, record the confirmed decision; otherwise keep it unresolved when essential evidence or human approval is missing. Identify a decision owner only when supported by context; do not invent people, roles, assignments, or authority.
- When input is needed, ask for the specific missing information or decision from the appropriate person rather than repeating the original question. Preserve the open question in the conversation or relevant existing artifacts. Continue only independent, authorized work where safe; resume dependent work only when the necessary decision is resolved.

## Human handoff

When another person's input is required or explicitly requested, prepare a concise handoff even if you have a recommended solution. Make it answerable without reading the full conversation. Include only relevant fields:

- **Question:** The specific decision or information needed.
- **Context:** Essential facts and constraints.
- **Options / recommendation:** Practical alternatives and a supported recommendation, if available.
- **Why input is requested:** Missing evidence, authority, material risk, or the user's requested consultation.
- **Impact:** What is blocked and what can continue independently.

Exclude unnecessary history, private reasoning, speculative claims, and unrelated sensitive data. A draft does not mean anyone was notified. Do not contact people or invent assignments through this handoff.

## Optional Issue comment

Offer an Issue comment when human input is needed or explicitly requested and an existing Issue is available. Use supported GitHub tooling; `gh` is not required when equivalent tools exist.

1. Resolve and verify the repository and intended Issue from established context. Use the active child Issue for child-specific blockers, otherwise the relevant current Issue. Read relevant existing comments to check for an answer or prior escalation.
2. If human input is still required or requested and no equivalent request exists, preview the complete concise handoff comment and exact target Issue. Obtain explicit approval for that preview before posting; phase authorization or approval of a recommendation is not comment approval. If the preview or target changes, obtain approval again.
3. After approval, publish with the required tool permissions, re-fetch and verify the published comment, and return its URL when available. Distinguish drafted, approved, posted, and verified outcomes. Never claim publication or notification without evidence.
4. On resume or after an uncertain write outcome, inspect existing context and comments before retrying. Reuse a matching request; if publication cannot be determined, stop publication and explain the uncertainty rather than risk a duplicate. Evaluate any reply against the actual unanswered question and necessary authority; a posted comment or a reply alone does not resolve it.

If the user declines publication or GitHub access, permissions, or suitable tooling are unavailable, provide the reusable draft and state its publication status and any limitation. Keep the question available for follow-up.

Without an Issue, help normally and provide a handoff draft when needed. Never create an Issue just to publish a question. Return unresolved planning questions to the caller's existing refinement and Issue-creation process; do not bypass its approval gate.

This operation permits only the separately approved comment. Do not change Issue bodies, labels, assignees, milestones, or workflow status, create Issues or PRs, or weaken the caller's permissions and completion gates. Keep all actions read-only when invoked in a read-only context; return the handoff to the caller instead of posting.

## Return to the caller

Give a short, understandable result containing the question, established facts or recommendation, any confirmed decision, remaining human decision and known owner, handoff/publication status, verified Issue/comment links when available, blocked and independent work, and the immediate next action. Use conversation context and existing artifacts without custom state files or complex schemas.

Return control with unresolved questions intact. Resolving a question does not grant authorization for another workflow phase or turn failed or blocked verification into a pass.
