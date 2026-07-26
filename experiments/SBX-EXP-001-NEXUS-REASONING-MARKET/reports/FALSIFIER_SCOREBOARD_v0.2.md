# Falsifier and adversarial-vector scoreboard v0.2

**status_authority:** `NONE`
**Scope:** static derivation from executable test source; not a test run

## Derivation method

Claims `F-01..F-12` are copied from `EXPERIMENT.md`. Vectors `V-001..V-093`
are copied from section 27 of `TECHNICAL_SPEC_v0.1.md`.

Statuses are deliberately conservative:

- `TESTED`: an executable assertion directly exercises the stated attack and
  checks the required rejection, HOLD, root, or conservation result.
- `PARTIAL`: a direct component is exercised, but at least one stated
  dimension, order, boundary, or positive/negative sibling is absent.
- `UNTESTED`: no direct executable assertion was found. Prose, implementation
  code, and a happy path do not count.

Anchors use stable function names or exact test/assertion labels rather than
line numbers. `CE` is `prototype/tests/core-economy.mjs`; `WR` is
`prototype/tests/work-review.mjs`; `PG` is
`prototype/tests/privacy-github.mjs`; `HI` is
`prototype/tests/hybrid-identity.mjs`. `CE.ADV`, `CE.ROUTE`, `CE.HAPPY`,
`CE.HOLD`, `CE.PAYOUT`, `CE.APPEAL`, and `CE.CARRIER` name the corresponding
functions. `WR:"..."` and `PG:"..."` quote exact test or assertion labels.

`CE.CARRIER` includes these exact fail-closed coverage identifiers:

- `assertDuplicateCapabilityOfferContentRejectedByLiveReducer` proves a live
  same-content/different-envelope transition rejects `ERR_ID_PREIMAGE`.
- `assertTamperedCapabilityOfferStateFailsClosed` owns four source-fixture
  immutability cases exercised through both `createRuntime` and
  `recoverRuntime`.
- `assertMissingCapabilityOfferContentIndexRowFailsClosed`,
  `assertExtraStaleCapabilityOfferContentIndexRowFailsClosed`, and
  `assertWrongCapabilityOfferContentIndexRowFailsClosed` reject
  `ERR_CAPABILITY`.
- `assertPerRecordOfferContentRootTamperFailsClosed` rejects
  `ERR_ID_PREIMAGE`.

`WR` contains 71 deterministic named tests. Its exact optional-own-ID carrier
anchors are `WR:"capability offer root distinguishes absent from present derived ID"`
and
`WR:"donated consent record root distinguishes absent from present derived ID"`.

This mapping is auditable by searching the quoted anchor, confirming the
mutated input and asserted result, and checking that every conjunct in the
vector is exercised. A test addition does not change this scoreboard until the
mapping is reviewed.

## Twelve experiment falsifiers

| ID | Status | Exact executable anchors | Remaining gap |
|---|---|---|---|
| F-01 | PARTIAL | `CE.ADV` (`negative-contribution`, `ERR_SUPPLY`), `CE.HAPPY` | not every create/destroy/duplicate path |
| F-02 | UNTESTED | none | no direct post-accept unilateral-unlock vector |
| F-03 | TESTED | `CE.ADV` exact/conflicting replay; `CE.CARRIER` exact offer-event replay before content uniqueness; `HI:"randomized ML-DSA re-sign preserves semantic identity and duplicate replay"` (signature bytes only; exact six-field reference unchanged) | no durable crash store |
| F-04 | PARTIAL | `WR:"accepted slot history blocks a second initial assignment"`, `WR:"stale assignment roots fail packet binding"` | no direct worker-self-review vector |
| F-05 | TESTED | `WR:"nonzero PASS evidence forces HOLD"` | none in prototype scope |
| F-06 | UNTESTED | none | no direct proprietary/secret remote-route attack |
| F-07 | PARTIAL | `CE.ROUTE` forged lease/tool/bytes/funding/expiry cases | not every delegation dimension/order |
| F-08 | PARTIAL | `CE.ADV` (`stale-job`), `WR:"offer eligibility rejects stale job task contract and conflict refs"`, `HI:"hybrid key rotation is atomic and rejects the old pair"` | not every stale object and race |
| F-09 | PARTIAL | `WR:"a shared required dimension produces the HOLD reason"` | same-account/operator and unknown labels incomplete |
| F-10 | TESTED | `CE.CARRIER` (`ERR_VERIFIER_MUTATION`) | external GitHub enforcement is out of scope |
| F-11 | PARTIAL | `PG:"manifest must omit private preimages"`, strict legacy/public wrappers | no exhaustive secret-source scanner corpus |
| F-12 | PARTIAL | `CE.HAPPY`, `CE.HOLD`, `CE.PAYOUT`, terminal invariants | cancel/publication-failure terminal matrix incomplete |

## 93 normative adversarial vectors

| ID | Status | Exact anchor or missing dimension |
|---|---|---|
| V-001 | TESTED | `CE.ADV`: negative, unsafe, overflow; canonical integer rejection |
| V-002 | UNTESTED | no direct insufficient-balance assertion |
| V-003 | PARTIAL | duplicate sub-work commitment/reservation cases only |
| V-004 | PARTIAL | bounded allowance/second commitment cases, not full matrix |
| V-005 | TESTED | `CE.ADV`: state supply drift rejects with `ERR_SUPPLY` |
| V-006 | TESTED | `CE.ADV`: exact replay and conflicting idempotency replay |
| V-007 | TESTED | `CE.ADV`: terminal replay returns original receipt without second commit |
| V-008 | UNTESTED | accept/cancel both-order race absent |
| V-009 | UNTESTED | select/revoke both-order race absent |
| V-010 | UNTESTED | allowance spend/revoke both-order race absent |
| V-011 | UNTESTED | controller transition/spend both-order race absent |
| V-012 | UNTESTED | timeout/result both-order race absent |
| V-013 | TESTED | `CE.ADV`: `wrong-reveal`, `ERR_BID_COMMITMENT` |
| V-014 | PARTIAL | one bid window path; all late commit/reveal edges absent |
| V-015 | PARTIAL | predecessor and exact job refs, not bid-version matrix |
| V-016 | UNTESTED | duplicate-principal-alias vector not invoked by suite |
| V-017 | TESTED | `WR:"winning-bid selection is deterministic"` |
| V-018 | UNTESTED | selective non-reveal absent |
| V-019 | PARTIAL | exact/stale task and lease references; source/attempt matrix absent |
| V-020 | PARTIAL | `CE.ROUTE` input byte ceiling; output boundary absent |
| V-021 | UNTESTED | prompt-injection fixture absent |
| V-022 | PARTIAL | `CE.ROUTE` missing tool authority; destination matrix absent |
| V-023 | TESTED | `CE.ROUTE`: `create-route-from-expired-measurement` |
| V-024 | UNTESTED | attempts-exhausted assertion absent |
| V-025 | UNTESTED | malicious normalized path corpus absent |
| V-026 | UNTESTED | direct worker-self-review assertion absent |
| V-027 | UNTESTED | direct duplicate-model-ID assertion absent |
| V-028 | TESTED | `WR:"a shared required dimension produces the HOLD reason"` |
| V-029 | TESTED | same anchor plus accepted packet diversity binding |
| V-030 | PARTIAL | packet root/evidence changes and stale assignment binding |
| V-031 | TESTED | `WR:"nonzero PASS evidence forces HOLD"` |
| V-032 | TESTED | `CE.HOLD`: `DISSENT,CLEAR,CLEAR` reaches HOLD |
| V-033 | UNTESTED | rework invalidation path absent |
| V-034 | PARTIAL | generic replay tested; review-specific replay absent |
| V-035 | UNTESTED | proprietary remote route absent |
| V-036 | UNTESTED | secret remote route absent |
| V-037 | PARTIAL | entropy/nonce size and one-use binding, not oracle corpus |
| V-038 | PARTIAL | exact public schemas and unclassified reuse rejection |
| V-039 | UNTESTED | malicious secret-pattern artifact absent |
| V-040 | UNTESTED | licence/NOTICE/upstream/provenance omissions absent |
| V-041 | TESTED | `CE.CARRIER`: verifier/policy mutation rejects |
| V-042 | UNTESTED | stale repository base after check absent |
| V-043 | PARTIAL | `PG` legacy/crossed capsule roots; direct current-field tamper incomplete |
| V-044 | TESTED | `CE.ADV`: omitted and reordered receipts/events reject recovery |
| V-045 | PARTIAL | outbox shape exists; outage/retry transition sequence absent |
| V-046 | UNTESTED | no durable persistence crash boundaries |
| V-047 | TESTED | `CE.ADV`: missing, reordered, altered receipt journals reject |
| V-048 | UNTESTED | strict filesystem manifest injection absent |
| V-049 | UNTESTED | post-accept requester revocation absent |
| V-050 | UNTESTED | donor outcome-authority attack absent |
| V-051 | PARTIAL | dissent payout path exists; conditional-clear pay policy not attacked |
| V-052 | UNTESTED | credit-as-review-weight attack absent |
| V-053 | UNTESTED | no executable external-value surface detector |
| V-054 | UNTESTED | false remote-execution with non-local route absent |
| V-055 | UNTESTED | local-trusted `UNKNOWN/UNENFORCED` control absent |
| V-056 | PARTIAL | public preimages omitted and entropy bound; transitive proof incomplete |
| V-057 | TESTED | `CE.PAYOUT`: dissent payout survives deterministic abort |
| V-058 | PARTIAL | `CE.APPEAL`: ineligible/stale resolver cases, not no-resolver matrix |
| V-059 | PARTIAL | settle and abort dispositions; cancel/publication failure incomplete |
| V-060 | UNTESTED | no repository merge adapter or maintainer-negative vector |
| V-061 | PARTIAL | `CE.CARRIER` mutation checks; every pin dimension not isolated |
| V-062 | PARTIAL | operational outbox is separate; status-change/root assertion absent |
| V-063 | UNTESTED | changed irreversible disclosure binding absent |
| V-064 | TESTED | `CE.ADV`: receipt push frozen and state has no `receipts` |
| V-065 | UNTESTED | pre-accept cancel plus terminal settlement absent |
| V-066 | UNTESTED | missing/multi-owned/bucket-mismatch lot vectors absent |
| V-067 | UNTESTED | split/pro-rata/mixed residue insertion permutations absent |
| V-068 | UNTESTED | complete clock skip/decrement/authority/target matrix absent |
| V-069 | UNTESTED | every half-open operation boundary absent |
| V-070 | UNTESTED | wrong round/version/contract reveal bindings absent |
| V-071 | UNTESTED | acceptance mismatch matrix absent |
| V-072 | PARTIAL | exact sub-work evidence bindings, not unauthorized payout attack |
| V-073 | UNTESTED | sub-work result/expiry predecessor permutations absent |
| V-074 | PARTIAL | HOLD and abort exercised; rework/resume/current-stale matrix absent |
| V-075 | PARTIAL | `CE.ROUTE` bytes/lease/tool/funding ceilings; all fields incomplete |
| V-076 | PARTIAL | assignment uniqueness and replacement history; all paid-review cases incomplete |
| V-077 | PARTIAL | `CE.runCanonicalVectors`; full RFC 8785 golden corpus absent |
| V-078 | PARTIAL | `CE.CARRIER`: `assertDuplicateCapabilityOfferContentRejectedByLiveReducer`; `assertTamperedCapabilityOfferStateFailsClosed`; `assertMissingCapabilityOfferContentIndexRowFailsClosed`; `assertExtraStaleCapabilityOfferContentIndexRowFailsClosed`; `assertWrongCapabilityOfferContentIndexRowFailsClosed`; `assertPerRecordOfferContentRootTamperFailsClosed`; these cover live `ERR_ID_PREIMAGE`, bidirectional `createRuntime`/`recoverRuntime` index checks with source-fixture immutability, `ERR_CAPABILITY` for missing/extra-stale/wrong relations, and `ERR_ID_PREIMAGE` for per-record root tamper. `WR:"capability offer root distinguishes absent from present derived ID"` and `WR:"donated consent record root distinguishes absent from present derived ID"` cover absent/exact-present equivalence plus `Object.hasOwn` rejection of present null, explicit undefined, wrong-type, malformed, and canonical-looking mismatched own IDs with `ERR_ID_PREIMAGE`. `WR:"offer verified authentication reference changes carrier root and ID"` and `WR:"consent verified authentication reference changes accepted consent root and ID"` cover exact-reference/V2 carrier binding; every registered type remains absent |
| V-079 | TESTED | `WR:"scheduler readiness ignores insertion order"` |
| V-080 | UNTESTED | PREPARE/COMMIT/snapshot/pointer crash store absent |
| V-081 | PARTIAL | `CE.CARRIER`: `assertDuplicateCapabilityOfferContentRejectedByLiveReducer` covers same-content/different-envelope `ERR_ID_PREIMAGE`; `assertTamperedCapabilityOfferStateFailsClosed` and its four exact state-case identifiers cover index/root rejection through `createRuntime` and `recoverRuntime` without mutating source fixtures. `WR:"offer verified authentication reference changes carrier root and ID"` and `WR:"consent verified authentication reference changes accepted consent root and ID"` cover missing/extra, changed-reference, and crossed-ID/root failures; provider-credential and retroactive-revocation attacks remain incomplete |
| V-082 | UNTESTED | repository-control maintainer-negative vectors absent |
| V-083 | UNTESTED | optional allowance versus reserve attack absent |
| V-084 | UNTESTED | zero/multiple human-decision contract cases absent |
| V-085 | UNTESTED | repository-control claim lifecycle absent |
| V-086 | PARTIAL | appeal ineligibility/stale authority, not every immutable role conflict |
| V-087 | TESTED | `CE.PAYOUT`: deadline abort and undisputed review payout |
| V-088 | PARTIAL | stale predecessor and stable derived IDs; revision transition matrix absent |
| V-089 | UNTESTED | `ENTER_REVIEW` predecessor-order race matrix absent |
| V-090 | PARTIAL | settle/abort terminal paths; every child and later event incomplete |
| V-091 | PARTIAL | filing/resolution/timeout paths; disabled and all tick edges incomplete |
| V-092 | TESTED | `HI:"randomized ML-DSA re-sign preserves semantic identity and duplicate replay"` and `CE.CARRIER` exact offer-event replay prove same-reference stability; `CE.CARRIER`: `assertDuplicateCapabilityOfferContentRejectedByLiveReducer` proves a different envelope/reference for occupied content rejects `ERR_ID_PREIMAGE`; `WR:"offer verified authentication reference changes carrier root and ID"` and `WR:"consent verified authentication reference changes accepted consent root and ID"` prove changed-reference identity divergence/rejection; `HI:"hybrid replay preserves the exact submitted authentication bytes"` and `HI:"hybrid key rotation is atomic and rejects the old pair"` |
| V-093 | PARTIAL | exact count/HOLD/dissent tested; direct worker self-review absent |

## Reviewer action

Prioritize every `UNTESTED` row, then close one missing dimension at a time in
`PARTIAL` rows. Submit reproducible failures using
[`../adversarial/README.md`](../adversarial/README.md). Never promote a row
based only on implementation inspection or model agreement.
