# SBX-SOH-001 — branch or pull-request classification

Use one copy for every existing or proposed branch/PR that may touch the held
scope.

- **Branch or PR:**
- **Head commit:**
- **Reviewer:**
- **Review date:**
- **Touched paths:**
- **Classification:** `OPERATOR_AUTHORIZED_HOLD_ACTIVATION | OUT_OF_SCOPE | ALLOWED_RESEARCH_ONLY | BLOCKED_BY_SBX-SOH-001`
- **Exact reason:**
- **Permitted next action:**
- **Evidence or diff anchors:**

## Classification tests

## `OPERATOR_AUTHORIZED_HOLD_ACTIVATION`

Use only for the single merge that installs `SBX-SOH-001` and its enforcement
surfaces under the exact written operator authorization. It may not carry any
held economic implementation.

### `OUT_OF_SCOPE`

The change does not alter, activate, represent, recruit for, financialise, or
promote internal-credit, agent-economy, community-allocation, or actual
AI-work purchasing mechanisms.

### `ALLOWED_RESEARCH_ONLY`

The change is limited to preservation, verification, reproduction,
falsification, threat modelling, comparative analysis, decision
reconstruction, or press/boundary drafting. It introduces no participant-facing
issuance, live transfer, real model purchase, activation, recruitment,
financialisation, or Lab promotion.

### `BLOCKED_BY_SBX-SOH-001`

The change implements, expands, activates, recruits for, financialises,
presents as approved, or promotes any held mechanism or final operator
position.

Classification is a merge precondition. It does not lift or weaken the hold.

Repository CI can require a complete classification record and evidence anchors.
It cannot establish whether a semantic classification is honest, whether prose
was authored by the Human Operator, or prevent a repository owner from
deliberately changing policy and tests together. Those remain human-governed
review and operator-authority questions.

`status_authority: NONE`
