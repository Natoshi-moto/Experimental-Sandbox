# SBX-EXP-001 — Nexus crowdsourced agent-work market

**status_authority:** `NONE`
**State:** `RUNNING`
**Economic class:** `SIMULATION_ONLY`
**Publication class:** `PUBLIC_SAFE_METADATA_ONLY`

This experiment asks whether Nexus Sim can coordinate a whole coding job—from
community funding, donated agent capacity, and bidding through bounded agent
work, three-model review, maintainer acceptance, and settlement—without making
AI an authority, exposing proprietary inputs, sharing provider credentials, or
pretending a simulated credit is money.

## Safety freeze

The first iteration is documentary by design. Product code starts only after
the threat model and non-claims are recorded and pushed.

The frozen architecture is:

```text
human/project account
        │ creates, sponsors, or offers bounded capacity
        ▼
one Job Capsule / one job account
        │
        ├─ immutable contract and privacy class
        ├─ bid commitments and reversible pre-acceptance locks
        ├─ one selected worker seat
        ├─ bounded sub-worker capability leases
        ├─ ordered, hash-linked child receipts
        ├─ deterministic falsifiers
        ├─ three artifact-bound model reviews
        ├─ maintainer/human acceptance
        └─ one atomic terminal settlement record + receipt
                         │
                         ▼
             sanitized GitHub witness record
```

Nexus Sim is the authoritative deterministic state machine. GitHub records,
replays, and witnesses sanitized capsules; it is not the live ledger, privacy
boundary, semantic judge, or global consensus layer.

## Economic boundary

The prototype uses `SIM_CREDIT`:

- exact non-negative integers;
- closed-loop and local to the simulator;
- non-redeemable and non-exchangeable;
- no conversion to future value;
- no external goods, services, cash, crypto, debt relief, or governance;
- agents spend only through bounded human-issued allowances;
- bid and contract locks reserve existing credit and never mint credit.

The words *token*, *wallet*, *bid*, *escrow*, and *market* describe simulated
mechanics in this experiment. They do not assert legal classification,
custody, monetary value, production safety, or authorization by Nexus Lab.

## Documents

- [`EXPERIMENT.md`](EXPERIMENT.md) — falsifiable experiment record.
- [`RAW_ORIGIN.md`](RAW_ORIGIN.md) — the human request, preserved separately
  from agent interpretation.
- [`WHITEPAPER_v0.1.md`](WHITEPAPER_v0.1.md) — product thesis, work commons,
  architecture, safety boundary, and clean Matrix experience.
- [`TECHNICAL_SPEC_v0.1.md`](TECHNICAL_SPEC_v0.1.md) — normative state,
  schemas, transitions, invariants, routing, settlement, witness, and test
  requirements.
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — protected assets, adversaries,
  boundaries, abuse cases, and halt rules.
- [`NON_CLAIMS.md`](NON_CLAIMS.md) — claims the experiment is forbidden to
  imply.
- [`HYBRID_IDENTITY_PROFILE.md`](HYBRID_IDENTITY_PROFILE.md) — mandatory
  Ed25519 AND ML-DSA-65 event identity with no downgrade lane.
- [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) — current limitations and out-of-scope
  boundaries.
- [`ATTACKER_QUICKSTART.md`](ATTACKER_QUICKSTART.md) — fixture and attack
  entry-point index.
- [`INDEPENDENT_REVIEW_INVITATION.md`](INDEPENDENT_REVIEW_INVITATION.md) —
  twelve explicit falsification targets and reviewer independence metadata.
- [`adversarial/`](adversarial/) — canonical exploit schema, verifier, examples,
  and submission instructions.
- [`reports/`](reports/) — corpus, attack, architecture, and safety reports.
- [`reports/CORE_SOURCE_REGISTER_v0.1.md`](reports/CORE_SOURCE_REGISTER_v0.1.md)
  — exact hashes for the load-bearing local source bytes.
- [`corpus/`](corpus/) — privacy-reduced inventory of related local artifacts.

## Current result

`EXECUTABLE_RESEARCH_PROTOTYPE`. Coverage is not complete; the conservative
[`reports/FALSIFIER_SCOREBOARD_v0.2.md`](reports/FALSIFIER_SCOREBOARD_v0.2.md)
keeps partial and untested claims visible. See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)
before interpreting any passing test.
