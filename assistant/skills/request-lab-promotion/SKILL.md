---
name: request-lab-promotion
description: Package a surviving Experimental Sandbox result into a provenance-bound, adversarially reviewed, lay-explained proposal for Nexus Lab while retaining zero authority to merge or change Lab. Use only when the operator explicitly asks to package, promote, propose to main, ask Lab, or prepare a canonical review request.
---

# Request Lab promotion

1. Require an immutable Sandbox tag and full commit SHA.
2. Complete the seven-field promotion package in `templates/PROMOTION.md`.
3. Verify the tag resolves to the declared SHA.
4. Require reproducible evidence or explicit `DOCUMENTARY_ONLY`.
5. Record non-claims and Lab red impact, including `NONE`.
6. Gather role-distinct adversarial reviews and disclose context/provider relationships.
7. Produce the lay operator card.
8. On explicit `OPEN_LAB_PR`, create a fresh Lab branch from current `origin/main`, reapply only the smallest clean change, and preserve Sandbox provenance.
9. Open a draft PR. Never approve, auto-merge, bypass protection, alter snapshots, clear reds or imply adoption.
10. End with `LAB AUTHORITY: NONE — HUMAN REVIEW REQUIRED`.

Read [references/no-authority.md](references/no-authority.md) before any GitHub write.
