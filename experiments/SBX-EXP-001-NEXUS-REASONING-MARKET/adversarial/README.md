# Exploit artifacts

**status_authority:** `NONE`

`nexus-exploit-artifact-v1` is the canonical reproducibility envelope for this
experiment. It carries the complete zero-history genesis state, ordered events,
ordered receipts, protocol expectation, reproduced expectation, and expected
final roots.

## Files

- `exploit-artifact.schema.json`: exact JSON Schema envelope.
- `examples/valid-empty-journal.json`: conforming deterministic baseline.
- `examples/tampered-final-root.json`: conforming expected-rejection example.
- `../tools/verify-exploit-artifact.mjs`: dependency-free verifier CLI.

## Verify

```bash
node tools/verify-exploit-artifact.mjs \
  adversarial/examples/valid-empty-journal.json

node tools/verify-exploit-artifact.mjs \
  adversarial/examples/tampered-final-root.json
```

The CLI exits zero only when observed replay exactly matches
`replay_expectation`. `COUNTEREXAMPLE_REPRODUCED` means the reproduced outcome
matches the submitter's pinned expectation and differs from
`protocol_expectation`. It is evidence for review, not automatic authority.

## Required submission content

1. Target exactly one `F-01..F-12`, `V-001..V-093`, or named `OTHER` claim.
2. Pin the implementation revision and runtime version.
3. Declare submitter `provider_family` and `operator_id`.
4. Include complete genesis, events, and one receipt per event.
5. Include expected final application and receipt-chain roots.
6. State exact protocol and replay outcomes.
7. Remove private inputs, credentials, private keys, personal data, and
   proprietary content.
8. Place public-safe submissions under `adversarial/submissions/`.

The verifier rejects unknown envelope keys, duplicate JSON keys, unsafe
integers, non-canonical identity encodings, malformed event/receipt envelopes,
root mismatches, and behavior that differs from the pinned replay expectation.

For an accepted replay, `expected_final_application_state_root` is passed
directly to `recoverRuntime`. The final receipt-chain root is
`receiptRoot(receipts.at(-1))`, or `null` for an empty journal.

For an expected rejection, roots still describe the submitted recovery input;
`error_code` MUST be the exact expected failure.

See [`../ATTACKER_QUICKSTART.md`](../ATTACKER_QUICKSTART.md).
