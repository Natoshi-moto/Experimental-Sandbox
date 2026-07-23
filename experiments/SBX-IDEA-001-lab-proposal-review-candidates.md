# SBX-IDEA-001 — candidates for sandbox review, drawn from Lab's unpromoted proposals

**status_authority:** `NONE`
**State:** `IDEA`

## Raw origin

Operator, this session: "Let's take the proposals from the lab and see what we can fuck around with vigorously in the sandbox repo." Followed shortly after by: "I'm gonna give you a package soon to execute on my system after talking a bunch with my annoying Claude unofficial legal advisor." That package has **not** arrived and has **not** been reviewed. Nothing in this record depends on it, and nothing should be executed against it without a separate pass once it lands.

This record itself is the terrain survey, not an experiment result. No code has been run, no claim has been tested, nothing has been forked yet. It exists so a fresh Claude session (or any reviewer) picked up in this sandbox has the map without re-deriving it.

## Claim

Two proposal tracks currently sitting in `Natoshi-moto/Lab` `operations/proposals/`, both `status_authority: NONE` and both parked on "awaiting operator disposition," are viable candidates for independent adversarial review inside this sandbox — separate from Lab's own review loop:

1. **R012→R016 "PCX" chain** (`operations/proposals/R012_BOUNDED_WORK_EXCHANGE` … `R016_PCX_INTEGRATED_CUSTODY_GATE`) — a bounded, synthetic, explicitly non-financial/non-fungible/non-transferable work-exchange and custody protocol, five rounds deep, each round already carrying its own kill-criteria and hostile-mutation testing. Base heads at time of writing:
   - R013 `f28dc07bf1433bb22e4d992a7f523503387ea445`
   - R014 `69bbe07843e0d400d53e696b7516d8f3bcf55e3e`
   - R015 `5d765a3f01e718778a7195415430e7cffae42b57`
   - R016 `8e23e76ea2808131f1683a50abccb48078afff35`
   - All still `UNPROMOTED_PROPOSAL` / `UNPROMOTED_STACKED_PROPOSAL`.
2. **NOTED_SOVEREIGNTY_ASSAULT_001 / NOTED_STOP_THE_LINE_001** — a threat model against the *live* Noted product's Agent iframe (`products/noted-host/`), not a synthetic toy. Highest-severity findings T-01/T-02/T-03 (all severity H): same-origin iframe bypassing the postMessage bridge, unpinned third-party CDN scripts with no SRI, and a silent default CORS-proxy for four of eight model providers. `foundation_status: PROPOSAL_ONLY`, `PROPOSAL_ONLY_OPERATOR_CRITICAL`.

## Falsifier

This idea is wrong / not worth pursuing if any of:
- The PCX chain's claims are already fully covered by Lab's own internal hostile-mutation matrices, such that an outside pass finds nothing new (would show up as: sandbox break attempt reproduces only already-documented failure modes).
- The Noted security track turns out to require live-product access or user data that a public sandbox record cannot responsibly discuss even at the "attack the claim, not the product" level.
- The operator's forthcoming package supersedes or reprioritizes this entirely.

## Smallest test

Not yet run. Proposed first move, pending operator confirmation: fork the R012–R016 chain's stated claims into a `sandbox/break/*` record and attempt to falsify one concrete claim — e.g., R012's "exact replay never manufactures a second accepted receipt" or R016's "quorum recovery" guarantee — using only the public proposal text and code already in `Lab/operations/proposals/`, without touching Lab `main` or any canonical snapshot.

## Method and environment

Local machine, two repos:
- `/home/anon/Lab` — source of the proposals (read-only for this exercise; no writes intended).
- `/home/anon/Projects/Experimental-Sandbox` — this repo, branch `sandbox/thought/pcx-noted-review-proposal`, branched clean from `origin/main` (`e88520e`).

Nothing has been pushed to `origin`. This commit is local pending an explicit push decision from the operator, per this repo's own contract that public visibility is a deliberate act, not a default.

## Results

None. No experiment has been executed against either track yet.

## Limitations and non-claims

- This is not a Lab claim, decision, or task. It cannot and does not speak for `Natoshi-moto/Lab`.
- It does not assert the PCX chain or the Noted threat model contain real defects — only that both are structured (bounded, falsifiable, already self-documented) in a way that makes them good sandbox material.
- It does not authorize any action against the operator's forthcoming package, which is unrelated and unreviewed.
- No promotion package has been prepared. `templates/PROMOTION.md` is not filled out because nothing has been demonstrated yet.

## Evidence

- `Lab/operations/proposals/{R012_BOUNDED_WORK_EXCHANGE,R013_PCX_CONSERVED_CLAIM,R014_PCX_DURABLE_REPLAY,R015_PCX_INDEPENDENT_DURABILITY_VERIFIER_MODEL,R016_PCX_INTEGRATED_CUSTODY_GATE}/{NEXT_ACTION.proposal.md,STATUS.proposal.json}`
- `Lab/operations/proposals/NOTED_SOVEREIGNTY_ASSAULT_001/THREAT_MODEL.md` (T-01 through T-07 read in full for T-01–T-03)
- `Lab/operations/proposals/NOTED_STOP_THE_LINE_001/STATUS.proposal.json`

## Lesson

`NONE` — nothing has been tested yet.
