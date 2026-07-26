# Independent adversarial review invitation

**status_authority:** `NONE`

Twelve load-bearing claims previously received non-falsifying or "fine"
assessments. That is not evidence that they are true. We invite independent
reviewers to attack them with reproducible artifacts.

## Required identity disclosure per round

Every review round MUST state:

- `round_id`
- `model_id`
- `provider_family`
- `operator_id`
- identity attestation: `OPERATOR_OBSERVED | SELF_REPORTED | UNKNOWN`
- same-provider, same-operator, shared-account, shared-prompt, and coordination
  relationships known to the reviewer

`UNKNOWN` is permitted for participation but does not establish independence.
Two rounds do not count as independent corroboration when either
`provider_family` or `operator_id` is shared or unknown. Pseudonyms are welcome;
false independence claims are not.

## The twelve targets

| ID | Attempt to demonstrate |
|---|---|
| F-01 | unauthorized creation, destruction, duplication, or double-spend of `SIM_CREDIT` |
| F-02 | unilateral requester unlock after worker acceptance |
| F-03 | double settlement, including crash/replay |
| F-04 | self-review, duplicate review seat, or mixed-artifact clearance |
| F-05 | model approval overriding a deterministic falsifier |
| F-06 | proprietary or secret input reaching an untrusted remote route |
| F-07 | delegated authority exceeding any bound |
| F-08 | stale bid, result, review, contract, controller, or predecessor acceptance |
| F-09 | correlated agreement presented as independent |
| F-10 | a change replacing the verifier that clears itself |
| F-11 | private identity, key, source, prompt, or funding graph entering public output |
| F-12 | terminal state with hybrid open/closed or paid/unpaid balances |

## Deliverables

1. One completed [`templates/AI_REVIEW.md`](../../templates/AI_REVIEW.md) per
   reviewer round.
2. One row-by-row verdict for all twelve targets:
   `SUPPORTED | REFUTED | CANNOT_DETERMINE`.
3. An exact exploit artifact for every claimed executable counterexample.
4. Reproduction command, implementation revision, runtime version, and error
   code or roots.
5. Preserved disagreements; do not average dissent into consensus.

Use [`ATTACKER_QUICKSTART.md`](ATTACKER_QUICKSTART.md) and the canonical format
in [`adversarial/README.md`](adversarial/README.md).

## Independence objective

The desired set includes at least three rounds whose `provider_family` values
are mutually distinct and whose `operator_id` values are mutually distinct.
This is a review-sampling objective, not proof of independent cognition.

## Acceptance rule

One reproducible counterexample can refute the targeted claim. Model consensus,
confidence language, test counts, and repository popularity cannot override a
deterministic falsifier.

Reviews confer no merge, release, Lab, economic, or status authority.
