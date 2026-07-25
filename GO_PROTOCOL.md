# GO Protocol — standing operator law

**status_authority:** `NONE`  
**Zone:** Experimental Sandbox only (public MIT experiment lane)  
**Trigger word:** `GO` (case-insensitive; whole-word intent)

## Activation

Whenever the operator says **GO** (or an unmistakable equivalent that names this protocol), every seated AI must:

1. Enter **full-steam Sandbox mode** immediately.
2. Treat the work as a **public experiment**, not Lab canon, not a product launch, not money.
3. **Use everything relevant** from the local research corpus (Matrix Terminal / NEXUS Room·Drop·LOOM·Forge, Consensus Foundry, Lab experiments as *read-only inspiration*, RoomFinal / Adversarial Finality materials, Paste-Bin checkpoint patterns, Quantum-Nexus archives, handoffs) — but **never** write Nexus Lab `main`, never promote, never ship secrets.
4. Aim for an artifact **as defensible as the original Bitcoin paper in spirit**:
   - problem stated narrowly;
   - mechanism stated completely enough to implement;
   - properties claimed only with **local, mechanical checks**;
   - elegance over feature pile-up;
   - **one-machine provability**: a stranger with this tree and a documented command must reproduce the same result codes / hashes.
5. Prefer **code + tests + short paper + non-claims** over slides and vibes.
6. Finish every GO burst with: what shipped, what is public, hashes/commands to verify, failures, Lab touched? (must be **no**), ≤3 next choices.

## What “Bitcoin-paper standard” means here

| Bitcoin paper quality | Sandbox translation |
|---|---|
| Clear problem | One falsifiable problem statement |
| Complete mechanism | Spec short enough to reimplement from the doc alone |
| Trust minimization | Deterministic kernel; models may propose only |
| Adversarial clarity | Explicit attack surface + automated negative tests |
| One-machine check | `npm test` / `pytest` / `sha256` replay on a single host |
| Honest scope | Non-claims block; no decentralization cosplay |

It does **not** mean: mainnet Bitcoin, token, ICO, PoW mining farm, or claims of independent global consensus.

## Hard boundaries (never expanded by GO)

- No secrets, keys, clipboard dumps, private sessions, machine identity.
- No Lab mutation / merge / protection bypass.
- No real-value currency, custody of other people’s assets, or investment claims.
- No “several AIs agreed ⇒ truth.”
- No silent rewrite of published evidence to look better.
- Public = Experimental-Sandbox branches / Paste-Bin checkpoints only, after secret scan.

## Default GO target (until operator overrides)

**Name:** `SBX-EXP-ONE-MACHINE-LEDGER`  
**One sentence:** A minimal, hash-linked, double-spend-resistant, zero-value ledger and custody transfer object, verifiable by one command on one machine, drawing Room/Drop + Consensus Foundry discipline into a single elegant paper + kernel.

**Deliverables on each GO that does not name another target:**

1. `experiments/SBX-EXP-ONE-MACHINE-LEDGER/` (or successor id)
2. `PAPER.md` — problem, mechanism, properties, attacks, non-claims (Satoshi-length ambition, not novel-length)
3. Executable kernel (Node and/or Python; dependency-light preferred)
4. Adversarial tests (double-spend, reorder, malleation, unknown fields, replay)
5. `VERIFY.md` — exact commands + expected hashes
6. Public branch under `sandbox/experiment/*` when green enough to show

## Operating posture under GO

- Ambition is allowed. Theater is not.
- Scaffold the mechanism first; constrain claims with tests second.
- Keep competing arms only when the operator’s flow requires it; collapse with evidence.
- Use the human copy-paste bus when seats disagree; do not launder majority into FINAL.
- If blocked, ship the largest defensible slice rather than waiting for perfection.

## Relationship to other phrases

| Phrase | Meaning |
|---|---|
| `GO` | This protocol — full steam, public experiment, defensible one-machine artifact |
| Fuck-around / sandbox activation | `HANDOFF_ANY_AI.md` — looser; still Sandbox-only |
| `ASK LAB` | Promotion package only; never merge authority |
| `PARK` | Stop and leave a resume note |

`HANDOFF_ANY_AI.md` already maps casual “go” to Sandbox progress. **This file strengthens that:** explicit **GO** means the Bitcoin-paper-grade campaign above, not a casual dribble.

## First response template when operator says GO

> ⚡ **GO accepted.** Sandbox public experiment. Lab untouched. Target: one-machine defensible ledger/paper (or named override). Building now.

Then build. Do not open with a questionnaire unless a hard boundary (secrets, harm, Lab write) is at risk.

---

*Operator standing order recorded for all future seats.*
