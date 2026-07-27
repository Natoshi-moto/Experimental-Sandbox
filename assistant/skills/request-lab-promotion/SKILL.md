---
name: request-lab-promotion
description: Package a surviving Experimental Sandbox result into a provenance-bound, adversarially reviewed, lay-explained proposal for Nexus Lab while retaining zero authority to merge or change Lab. Use only when the operator explicitly asks to package, promote, propose to main, ask Lab, or prepare a canonical review request.
---

# Request Lab promotion

Current scoped hold: [`SBX-SOH-001`](../../../EMERGENCY_CURRENT_STATUS.md).

1. Read the root emergency status. A direction within an active operator hold
   is ineligible for Lab promotion until a dated written lift or supersession.
2. Require an immutable Sandbox tag and full commit SHA.
3. Complete the seven-field promotion package in `templates/PROMOTION.md`.
4. Verify the tag resolves to the declared SHA.
5. Require reproducible evidence or explicit `DOCUMENTARY_ONLY`.
6. Record non-claims and Lab red impact, including `NONE`.
7. Gather role-distinct adversarial reviews and disclose context/provider relationships.
8. Produce the lay operator card.
9. On explicit `OPEN_LAB_PR`, create a fresh Lab branch from current
   `origin/main`, reapply only the smallest clean change, and preserve Sandbox
   provenance.
10. Open a draft PR. Never approve, auto-merge, bypass protection, alter
    snapshots, clear reds or imply adoption.
11. End with `LAB AUTHORITY: NONE — HUMAN REVIEW REQUIRED`.

Read [references/no-authority.md](references/no-authority.md) before any GitHub write.
