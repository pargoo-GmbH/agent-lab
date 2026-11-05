---
name: grilling
description: Conduct a dependency-aware, one-question-at-a-time interview to clarify requirements or stress-test a plan, idea, or decision, recommending an answer for each question. Use when the user asks to be grilled, requests an interactive requirements or decision interview, or another workflow invokes Grilling. Supports Quick, Balanced, and Deep modes.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Grilling

*Built by the team at [pargoo](https://www.pargoo.com/).*

Interview the user until you reach a shared understanding. Maintain a **design tree**: each decision branches into the decisions that depend on it. Use decisions already established in the conversation or project context rather than asking the user to repeat them.

## Interview Depth

Use one skill, conversation, and design tree for **Quick**, **Balanced**, and **Deep**. Depth changes investigation scope and stopping criteria; the question format, fact-finding, user control over decisions, confirmation, and workflow handoff below stay the same.

Select depth in this order: explicit user preference for the current session, project default in `AGENTS.md`, then **Balanced** as the skill fallback. Start with that depth automatically; do not add a setup questionnaire. At the beginning of the session, briefly display the selected depth, for example `Grilling · Balanced`, and mention that the user can switch to Quick, Balanced, or Deep during the session. Do not ask for confirmation of the selected depth or display it before every question.

| Mode | Investigate | Stop investigating when |
| --- | --- | --- |
| **Quick — Essential Clarity** | Essential business requirements, intended outcome, necessary scope, critical constraints, and blocking uncertainties. Avoid optional improvements, secondary details, and unnecessary hypotheticals. | Essential decisions and critical uncertainties are resolved; optional exploration would not materially improve the required understanding. |
| **Balanced — Important Dependencies and Risks** | Essentials plus important dependencies, relevant common scenarios, and meaningful business or technical risks affecting decisions. Avoid unlikely or irrelevant hypothetical branches. | Essentials, important dependencies, common scenarios, and meaningful risks are sufficiently addressed; further investigation would not materially improve understanding at this depth. |
| **Deep — Thorough Investigation** | Essentials and important dependencies plus relevant alternatives and consequences, significant trade-offs, meaningful failure scenarios, applicable edge cases, constraints, and important uncertainties affecting the solution. | Meaningful branches, consequences, significant risks, and applicable edge cases are sufficiently explored; further investigation adds no meaningful value. Deep is not exhaustive. |

Do not use fixed question counts, timers, or rigid checklists to define depth. Never force unnecessary questions in Deep or skip essential decisions or critical uncertainties in Quick. Critical security, privacy, authorization, and other relevant constraints apply at every depth.

In Deep, prioritize understanding the existing task: compare meaningful approaches, examine consequences of agreed decisions, and investigate relevant failure scenarios, edge cases, and constraints. Look for simpler solutions that meet the intended outcome. More functionality does not imply a better solution: recommend additions only when their necessity or material value justifies their cost and complexity, and explain that trade-off. Selecting Deep does not add enhancements to the agreed scope.

When the user changes depth during the interview, acknowledge the new depth concisely, for example `Grilling · Deep`. Keep all prior answers, research, established decisions, and the existing tree. Reevaluate remaining branches under the new criteria without restarting, repeating resolved questions, or changing prior decisions. Quick → Deep reconsiders newly relevant branches. Deep → Quick stops nonessential exploration but still resolves essential or critical uncertainties; if Quick's criteria are already met, proceed to summary and confirmation. Apply the same principles to every switch, including changes from Balanced. A switch does not authorize another workflow phase.

## Shared Interview Loop

The **frontier** contains unresolved decisions whose prerequisites are settled. Choose one relevant decision from this frontier and ask **one question at a time**. Wait for the user's answer before choosing the next question; do not bundle separate decisions into one question. Each question must resolve one independently answerable choice: if the user could accept one part and reject another, ask them separately rather than shortening a mode by combining them.

Give one clear recommended answer with every regular interview question. Choose the format to fit the decision: use a binary question for a genuine Yes/No choice, or multiple choice for meaningful alternatives, interpretations, or approaches. Do not force either format or invent options just to fill a list. Keep alternatives concise, distinct, and relevant to the same independent decision.

Use the following Markdown format, without emoji or wrapping the actual question in a code block:

```markdown
**Q1 — <question title>**

<one decision to resolve>

**Recommendation:** <recommended answer and proportional reasoning>
```

For multiple choice, place labeled options (`A.`, `B.`, etc.) between the question and recommendation; identify the recommended label and answer. For binary questions, omit the options and recommend Yes or No explicitly. Interpret "yes" or "no" as the literal answer to a binary question, even when it differs from the recommendation. For multiple-choice questions, accept "yes" as agreement with the recommended option only when that intent is clear; otherwise ask which option the user chooses.

Briefly explain why the recommendation is preferable, including material assumptions and, when relevant, significant trade-offs, complexity, risks, or consequences. Pay particular attention to irreversible actions, possible data loss, privacy, security, and substantial scope changes. Keep reasoning proportional: **Quick** includes essential consequences and critical risks; **Balanced** covers important dependencies and meaningful trade-offs; **Deep** compares relevant alternatives and their significant consequences more carefully. Routine decisions do not need long pros-and-cons lists; still make a clear recommendation.

After each answer, update the tree and recompute the frontier. An answer may settle several decisions, remove irrelevant branches, or reveal new dependencies. Skip decisions already answered or made unnecessary. Resolve prerequisites before asking dependent questions.

After each unambiguous answer that resolves a decision, briefly restate the user's actual choice on its own line, starting with **Agreed:**, before asking the next question. If the answer is ambiguous, clarify it first. Do not treat recommendations or assumptions as agreed decisions, or request separate confirmation after each answer.

Finding **facts** is your job. Investigate the codebase and available project context instead of asking the user for information you can discover. Research directly, or delegate a focused lookup to a subagent when useful and available; delegation is optional. Pending research is an unsettled prerequisite: while it runs, you may ask one independent, ready question and wait for the answer. If no decision is ready, wait for the research rather than guessing or treating a blocked tree as complete.

The **decisions** belong to the user. Recommendations and research do not settle a decision on the user's behalf. Identify business assumptions as assumptions rather than known facts. The user may accept or reject the recommendation, select another option, or explain a different preference. Do not introduce recommendation modes, an on/off toggle, or numeric confidence scores or thresholds.

## Shared Completion Process

After each answer or factual investigation, update the tree and evaluate in order:

1. **Are essential decisions or critical uncertainties unresolved?** If yes, continue at every depth, including required factual research. If no question is ready, wait for the required research rather than treating a blocked tree as complete.
2. **Would further investigation materially improve understanding at the selected depth?** If yes, continue with relevant research or one ready question. If no, summarize agreed requirements and decisions and ask the user to confirm explicitly. Irrelevant or already resolved branches must not prolong the interview.

If the user corrects the summary, update the tree and continue as needed, one question at a time. Keep the summary focused on agreed understanding: do not automatically add unexplored optional topics, a warning, backlog, or suggestion to switch modes.

Final confirmation checks the shared understanding; do not frame it as another recommended business decision.

Do not implement the plan before confirmation. When invoked by another workflow, return the confirmed understanding to that workflow; confirmation here does not authorize implementation or its next phase.
