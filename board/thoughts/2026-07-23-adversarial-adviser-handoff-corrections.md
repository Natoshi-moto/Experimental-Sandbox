# Board item — Corrections to an adversarial-adviser handoff on Codex's Sandbox PR #1

**ID:** `BOARD-2026-07-23-adversarial-adviser-handoff-corrections`
**UTC:** 2026-07-23
**Kind:** `thought`
**status_authority:** `NONE`
**Linked branches / PRs:** none yet — findings below are unactioned

---

## Content

The operator brought a handoff from a separate, read-only Claude session (an "adversarial adviser" seat) that reviewed Codex's merged Sandbox PR #1 (the assistant router) and both repos' state. Checked its claims against the live repos with `gh api` and `./nexus doctor` rather than taking them on faith. Results, held at arm's length from the handoff's own conclusions:

**Real and still open:**
- `assistant/skills/run-public-experiment/SKILL.md` + `assistant/skills/run-public-experiment/references/risk-bands.md` never operationalize a Computer Misuse Act–style check ("do you own this target, or have written authorization") the way step 4 explicitly does for fork licensing. The Red band only gestures at "security exploitation → explicit scoped authority," which isn't a concrete gate. `SBX-BREAK-*` can currently be filed against any target with nothing enforcing that it's the operator's own system. Worth a one-line fix to the skill.
- Sandbox `main` branch protection has **no `required_pull_request_reviews` block at all** (Lab's does). Force-push and deletion are blocked, a status check is required, admins are enforced — but nothing stops a direct push straight to `main`, bypassing PR review entirely. The handoff didn't catch this; it only checked for force-push protection.

**Claimed as open, actually already resolved (checked via API):**
- "Approval is currently aesthetic without required CI" (Lab) — false. Lab already requires 1 approval, dismisses stale reviews, requires last-push approval, and has a required status check.
- "Enable GitHub secret scanning + push protection" — false. Both `secret_scanning` and `secret_scanning_push_protection` are already `enabled` on Sandbox.
- `./nexus doctor` "known failures on fresh clone" — ran it on the existing Lab clone: full `PASS`, only a `WORKTREE_DIRTY` warn. Not a true fresh-clone test, so this one isn't fully settled either way.

## Links

- Source handoff: pasted into this session by the operator, 2026-07-23, from a separate Claude (Opus 4.8 self-reported) advisory session.
- Verified against: `gh api repos/Natoshi-moto/Lab/branches/main/protection`, `gh api repos/Natoshi-moto/Experimental-Sandbox/branches/main/protection`, `gh api repos/Natoshi-moto/Experimental-Sandbox` (`security_and_analysis`), `./nexus doctor` in `Natoshi-moto/Lab`.

## For later / next

- Fix the CMA-authorization gap in `assistant/skills/run-public-experiment/SKILL.md` / `assistant/skills/run-public-experiment/references/risk-bands.md`.
- Decide whether Sandbox `main` should get a `required_pull_request_reviews` block added to match Lab's posture, or whether that's deliberately looser by design.
- Note for whoever reads adviser handoffs next: the source handoff already confessed (its own §6.2) to asserting a protection gap without checking, and then did the same thing again twice more in the same document. Read-only advisory seats without `gh api` access should flag branch-protection and security-settings claims as unverified, not asserted.
