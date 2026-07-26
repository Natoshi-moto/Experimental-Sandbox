# Known issues and out-of-scope boundaries

**status_authority:** `NONE`
**Implementation class:** deterministic research prototype

This page is a limitation register, not a backlog promise. Passing tests means
the checked prototype behavior matched its contract on the tested inputs.

## Identity and custody

The current executable identity scheme is mandatory
`HYBRID_ED25519_ML_DSA_65_V1`: Ed25519 AND ML-DSA-65 over one canonical
domain-separated message. `SIM_AUTH_UNSAFE`, one-key profiles, unknown schemes,
and either/or fallback are rejected.

Historical documents and commits may still mention `SIM_AUTH_UNSAFE`; those
mentions describe the superseded fixture authenticator, not current accepted
runtime authority. The exact current profile is
[`HYBRID_IDENTITY_PROFILE.md`](HYBRID_IDENTITY_PROFILE.md).

The committed private keys are test fixtures. The prototype does not provide
HSMs, protected key generation, operator identity proof, compromise recovery,
certification, or production custody.

## `SIM_CREDIT` has no value

`SIM_CREDIT` is a closed-loop integer used to test conservation and settlement.
It is not money, crypto, a security, a commodity, debt, governance weight,
credit toward future value, or a claim on goods or services. There is no
bridge, redemption, exchange, withdrawal, or external settlement adapter.

## In-memory process boundary

The canonical runtime, journals, receipt indexes, resolver brands, and outbox
are process-local and in memory. Exported snapshots support deterministic
replay; they are not a durable WAL, database, lock protocol, backup, fsync
guarantee, multi-writer consensus, or crash-safe persistence layer.

## Host and worker attestation

Isolation, tool, route, resource, and host-control records are accepted
attestations checked by the state machine. Userland cannot prove that a hostile
host, kernel, hypervisor, remote operator, model provider, or worker actually
enforced those declarations. The prototype has no TEE attestation or remote
deletion proof.

## Private byte length

For private inputs, byte length is verifier-attested and bound to accepted
measurement evidence. The public verifier cannot independently reconstruct
private bytes to recount them without violating the disclosure boundary.
Therefore the prototype proves consistent use of an accepted measurement, not
the truth of the private byte count against unavailable source bytes.

## Disconnected GitHub outbox

The GitHub outbox is deliberately operational and disconnected from canonical
state, receipts, settlement, and application roots. It records no live GitHub
publication in the prototype. A `PUBLISHED` fixture status is not evidence that
GitHub received or retained anything.

## No live external execution

There is no P2P transport, consensus protocol, production database, real model
execution, remote worker, private dataset processor, payment rail, or live
repository merge adapter. External adapter contracts and hostile-network
behavior remain untested.

## Review independence

Three distinct model IDs do not prove independent reasoning. Earlier review
rounds included one provider family and were correlated critique. A round with
unknown or shared `provider_family` or `operator_id` does not satisfy an
independence claim. See
[`INDEPENDENT_REVIEW_INVITATION.md`](INDEPENDENT_REVIEW_INVITATION.md).

## Coverage is incomplete

The executable suites cover many exact transitions and downgrade paths, but
they do not cover all 12 experiment falsifiers or all 93 normative adversarial
vectors. The authoritative coverage claim is the conservative
[`FALSIFIER_SCOREBOARD_v0.2.md`](reports/FALSIFIER_SCOREBOARD_v0.2.md), where
untested and partially tested requirements stay visible.

## UI and operations

The default UI is a read-only demonstration over deterministic fixture data.
It does not authorize or submit state transitions. Load, availability,
multi-process concurrency, browser compatibility breadth, accessibility
certification, and production operations remain out of scope.

## Governing status

This is not a production deployment or Nexus Lab decision. Repository prose,
model approval, test counts, and public visibility confer no authority.

`status_authority: NONE`
