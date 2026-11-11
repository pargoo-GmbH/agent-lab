---
name: who-should-do-it
description: Assess whether a defined development task should be implemented by an AI agent or a human developer, using implementation complexity, execution risk, and controllability. Use before recommending or starting implementation, or when material scope or risk evidence changes; return a read-only Agent-led or Developer-led assessment, or identify missing prerequisites.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Who Should Do It?

*Built by the team at [pargoo](https://www.pargoo.com/).*

Evaluate the actual planned change and its consequences, not just technical difficulty. Work independently or return the result to the calling orchestrator without advancing its workflow. An assessment grants no implementation authorization or additional permissions.

## Establish the evidence

1. Identify the exact task and implementable scope. Use the current Issue or selected child when available; without an Issue, use the supplied task. Include relevant parent requirements, shared-system effects, and dependencies so decomposition cannot conceal risks.
2. Read the implementation brief, acceptance criteria, constraints, applicable repository instructions, and necessary architectural, code, and configuration context. Verify the checkout belongs to the task before using it as evidence. Prefer targeted inspection over exhaustive exploration.
3. Determine the affected systems and plausible consequences of an incorrect implementation. Inspect evidence for meaningful automated/manual verification, isolation, test environments and representative data, reversibility, rollback, and detection before significant damage occurs.

Use authorized read-only operations. Do not implement code, change configuration, create or switch branches, mutate Issues, publish comments, assign people, or initiate deployment. Inspect secret references and configuration structure without unnecessarily accessing or exposing secret values. Do not invent architecture, environments, test coverage, recovery mechanisms, or security controls.

If essential evidence is missing, investigate what can reasonably be established through read-only inspection. If requirements or other essential prerequisites remain unresolved, return the specific missing prerequisite and dependent work to the caller without fabricating classifications or a final decision. The caller retains discovery/refinement and authorization. If the scope is defined but material execution risk remains unverifiable, account for that uncertainty in controllability and the decision rather than assuming safety.

## Classify three independent dimensions

### Complexity: Low / Medium / High

- **Low:** Localized, well-understood changes using established patterns with limited coupling.
- **Medium:** Several related components or integrations, with a bounded approach and manageable dependencies.
- **High:** Substantial interconnected or architectural changes, tightly coupled systems, unfamiliar patterns, or significant technical uncertainty.

Consider scope, coupling, architectural implications, and established approaches. Do not use arbitrary file counts, lines of code, time estimates, or numeric scores. High complexity alone does not require developer implementation.

### Risk: Normal / Elevated / Critical

- **Normal:** Limited consequences of incorrect behavior, without significant data, security, availability, or business impact.
- **Elevated:** Material effects on shared behavior, infrastructure, contracts, deployment controls, or business operations that require concrete safeguards.
- **Critical:** Severe consequences such as irreversible production data loss/corruption, critical authorization or security failures, sensitive-data exposure, major outages, or significant financial/business harm.

Judge the actual planned change and environment. A small implementation can carry critical risk; low complexity and good tests cannot compensate for it.

### Controllability: High / Medium / Low

- **High:** Evidence supports meaningful verification before harm, bounded impact, effective isolation, and reliable recovery where needed.
- **Medium:** Useful verification and controls exist, but some coverage, isolation, detection, or recovery limitations remain.
- **Low:** Material behavior cannot be reliably verified, impact cannot be bounded, or detection/recovery is absent or unproven where needed.

Consider automated and manual checks, representative environments/data, reversibility, rollback, and when errors can be detected. Base the level on observed mechanisms and their limitations; tests alone do not establish controllability. Controls do not override security restrictions or required human responsibilities.

## Decide who implements

Return exactly one final decision for a sufficiently defined scope, using evidence-based judgment rather than a numeric formula:

- **Agent-led:** The scope and approach are sufficiently understood, bounded, safe, and verifiable within existing permissions. Normal risk with adequate controllability generally qualifies, even at High complexity. Elevated risk qualifies only when inspected safeguards, verification, reversibility, and impact limits adequately control the actual risks.
- **Developer-led:** Implementation by a human developer is recommended for the current scope. Critical risk always requires this result. Also use it when controllability is insufficient for material consequences, including risks that remain unverifiable after reasonable investigation.

For this prototype, changes involving irreversible production data operations, critical access-control boundaries, production credentials or protected environment access, or material weakening of security/deployment protections are Developer-led. Respect repository protections and human-controlled operations regardless of classification.

Use these examples to distinguish actual changes, not as keyword-based rejection rules:

| Area | Potentially Agent-led, with evidence | Potentially Developer-led |
| --- | --- | --- |
| Database migrations | Additive, compatible changes with established migration, verification, and recovery practices | Destructive production migrations, irreversible operations, unsafe backfills |
| Environment configuration | Documentation or `.env.example` updates without secret exposure | Production secrets, credentials, or protected environment access changes |
| CI/CD | Ordinary lint/test steps preserving privileges and deployment behavior | Critical deployment controls, pipeline privileges, credentials, or protected checks |
| Architecture | Bounded refactoring preserving contracts with meaningful verification | Fundamental cross-system changes with material impact and inadequate verification |
| Service integrations | Isolated stable APIs with verifiable contracts | High-impact interservice contracts, data flows, or critical transactions without adequate controls |
| Authentication / authorization | Isolated changes preserving security boundaries | Critical authorization rules or access-control boundary changes |

Developer-led blocks agent implementation by default. The user may override this recommendation through the orchestrator's explicit risk-confirmation mechanism; the assessment remains Developer-led. This skill only assesses and does not request or accept override confirmation. Reassess only after material scope changes, meaningful new evidence, or changed safeguards; do not repeat unchanged assessments to seek a more favorable result. Do not introduce a developer-approval outcome, wait for technical approval, or automatically launch `get-help` or a publication/assignment workflow.

## Return a concise assessment

Present every completed assessment as a distinct Markdown section using this structure, keeping the task-specific explanation understandable to a nontechnical user:

```markdown
### Implementation Assessment

| Dimension | Result |
| --- | --- |
| Complexity | Low / Medium / High |
| Risk | Normal / Elevated / Critical |
| Controllability | High / Medium / Low |
| **Decision** | **Agent-led / Developer-led** |

**Reason:** <brief task-specific evidence and any material limitations>
```

Select one value per table row and keep Reason outside the table. Keep workflow recommendations and authorization questions separate from the assessment; the caller owns the next workflow action. Distinguish inspected facts from unresolved assumptions; use no numeric confidence scores, artificial risk scores, or lengthy reports. For missing prerequisites, return a short explanation of what is missing and what must be resolved instead of this completed-assessment template.
