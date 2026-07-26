# Safety-freeze reports

**status_authority:** `NONE`

Read in this order:

1. [`RESEARCH_LEDGER_v0.1.md`](RESEARCH_LEDGER_v0.1.md) — timing, scan
   populations, external references, and evidence limits.
2. [`CORPUS_REPORT_v0.1.md`](CORPUS_REPORT_v0.1.md) — one brief assessment per
   materially distinct local design family.
3. [`CORE_SOURCE_REGISTER_v0.1.md`](CORE_SOURCE_REGISTER_v0.1.md) — exact
   hashes for the load-bearing source bytes.
4. [`SECURITY_PRIMITIVES_v0.1.md`](SECURITY_PRIMITIVES_v0.1.md) — what each
   primitive proves, what it does not, and the connectivity/functionality risk
   ladder.
5. [`NOTED_ATTACK_CONTROL_MATRIX_v0.1.md`](NOTED_ATTACK_CONTROL_MATRIX_v0.1.md)
   — category-level mapping of recent Noted attacks to prototype gates.
6. [`SENTINEL_AND_DUAL_KERNEL_REVIEW_v0.1.md`](SENTINEL_AND_DUAL_KERNEL_REVIEW_v0.1.md)
   — detailed load-bearing verdict.
7. [`LIFECYCLE_TRANSACTION_REVIEW_v0.1.md`](LIFECYCLE_TRANSACTION_REVIEW_v0.1.md)
   — one-account/one-job mechanics, agent spending, crowdsourcing, reviews, and
   GitHub witness design.
8. [`FALSIFIER_SCOREBOARD_v0.2.md`](FALSIFIER_SCOREBOARD_v0.2.md) — auditable
   `TESTED|PARTIAL|UNTESTED` mapping for all 12 falsifiers and 93 vectors.

The executable prototype must not use prose in these reports as proof that a
control exists. Every adopted `MUST` needs a deterministic test or a visible
`UNENFORCED` label.
