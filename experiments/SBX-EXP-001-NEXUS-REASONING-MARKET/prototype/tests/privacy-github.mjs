import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import { canonicalize } from "../core/canonical.mjs";
import {
  disclosureCompilationAnchorV2Root,
  nonClaimsRoot,
  publicCapsuleRoot,
  publicationAnchorV2Root,
  publicSafeDisclosureManifestRoot,
} from "../core/carriers.mjs";
import { createAcceptedRecordResolver } from "../core/resolver.mjs";
import { currentRoot, snapshotRuntime } from "../core/reducer.mjs";
import { applicationRoot } from "../core/state.mjs";
import {
  assertAcceptedCoreRecordEnvelope,
  resolveAcceptedCoreRecord,
} from "../privacy/authority.mjs";
import {
  finalizeDisclosure,
  prepareDisclosureContent,
  verifyDisclosureCompilation,
  verifyDisclosurePreparation,
} from "../privacy/disclosure.mjs";
import { createCanonicalNonClaims } from "../privacy/nonclaims.mjs";
import { decideDataRoute } from "../privacy/routing.mjs";
import {
  createPublicCapsule,
  validatePublicCapsuleShape,
} from "../github/capsule.mjs";
import {
  createPublicationIntent,
  publicationIntentRoot,
  verifyPublicationIntent,
} from "../github/intent.mjs";
import {
  assertOperationalOutboxStatus,
  createOperationalOutboxStatus,
} from "../github/outbox.mjs";
import { verifyPublicCapsule } from "../github/verifier.mjs";
import {
  createRouteExecutionFixture,
  runAcceptedCarrierPath,
  runCoreEconomyHappyPath,
} from "./core-economy.mjs";

function clone(value) {
  return JSON.parse(canonicalize(value));
}

function errorCode(error) {
  return error?.code ?? error?.reason ?? null;
}

export function runPrivacyGithubTests() {
  let assertions = 0;
  const check = (value, message) => {
    assert.ok(value, message);
    assertions += 1;
  };
  const equal = (actual, expected, message) => {
    assert.equal(actual, expected, message);
    assertions += 1;
  };
  const deepEqual = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    assertions += 1;
  };
  const noThrow = (fn, message) => {
    assert.doesNotThrow(fn, message);
    assertions += 1;
  };
  const expectCode = (code, fn, message) => {
    let thrown = null;
    try {
      fn();
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, message ?? `expected ${code}`);
    assert.equal(errorCode(thrown), code, message ?? `expected ${code}`);
    assertions += 1;
  };
  const expectFailClosed = (fn, message) => {
    let thrown = null;
    try {
      fn();
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, message);
    assert.ok(
      ["ERR_SCHEMA", "ERR_VERIFIER_MUTATION"].includes(
        errorCode(thrown),
      ),
      message,
    );
    assertions += 1;
  };

  const bundle = runAcceptedCarrierPath(runCoreEconomyHappyPath());
  const runtime = bundle.context.runtime;
  const resolver = createAcceptedRecordResolver(runtime);
  const snapshot = snapshotRuntime(runtime);
  const acceptedStateRoot = currentRoot(runtime);

  check(Object.isFrozen(runtime), "runtime handle must be frozen");
  equal(Object.getPrototypeOf(runtime), null, "runtime must be propertyless");
  deepEqual(Object.keys(runtime), [], "runtime state must remain opaque");
  equal(
    applicationRoot(snapshot.state),
    acceptedStateRoot,
    "snapshot must match authenticated runtime",
  );
  check(
    Object.isFrozen(snapshot.state),
    "snapshot state must be immutable",
  );
  equal(
    currentRoot(runtime),
    acceptedStateRoot,
    "snapshot mutation must not mutate runtime",
  );

  const preparationRefs = {
    preparation_id: bundle.acceptedPreparation.preparation_id,
    preparation_record_root:
      bundle.acceptedPreparation.preparation_record_root,
  };
  const preparationEnvelopeRequest = {
    record_type: "DISCLOSURE_PREPARATION",
    record_id: preparationRefs.preparation_id,
    record_root: preparationRefs.preparation_record_root,
  };
  const preparationEnvelope = resolveAcceptedCoreRecord(
    resolver,
    preparationEnvelopeRequest,
  );
  equal(
    preparationEnvelope.schema,
    "nexus-accepted-record-envelope-v2",
    "privacy authority must require the V2 accepted-record envelope",
  );
  check(
    Number.isSafeInteger(preparationEnvelope.accepted_logical_tick) &&
      preparationEnvelope.accepted_logical_tick >= 0,
    "privacy authority must bind a safe accepted logical tick",
  );
  const legacyPreparationEnvelope = clone(preparationEnvelope);
  legacyPreparationEnvelope.schema = "nexus-accepted-record-envelope-v1";
  expectCode(
    "ERR_SCHEMA",
    () => assertAcceptedCoreRecordEnvelope(
      legacyPreparationEnvelope,
      preparationEnvelopeRequest,
    ),
    "V1 accepted-record envelopes must be rejected",
  );
  const noTickPreparationEnvelope = clone(preparationEnvelope);
  delete noTickPreparationEnvelope.accepted_logical_tick;
  expectCode(
    "ERR_SCHEMA",
    () => assertAcceptedCoreRecordEnvelope(
      noTickPreparationEnvelope,
      preparationEnvelopeRequest,
    ),
    "accepted-record envelopes without a tick must be rejected",
  );
  const unsafeTickPreparationEnvelope = clone(preparationEnvelope);
  unsafeTickPreparationEnvelope.accepted_logical_tick =
    Number.MAX_SAFE_INTEGER + 1;
  expectCode(
    "ERR_SCHEMA",
    () => assertAcceptedCoreRecordEnvelope(
      unsafeTickPreparationEnvelope,
      preparationEnvelopeRequest,
    ),
    "accepted-record envelopes with an unsafe tick must be rejected",
  );
  const extraKeyPreparationEnvelope = clone(preparationEnvelope);
  extraKeyPreparationEnvelope.compatibility_fallback = true;
  expectCode(
    "ERR_SCHEMA",
    () => assertAcceptedCoreRecordEnvelope(
      extraKeyPreparationEnvelope,
      preparationEnvelopeRequest,
    ),
    "accepted-record envelopes with extra keys must be rejected",
  );
  const preparationVerification = prepareDisclosureContent(
    preparationRefs,
    { resolver },
  );
  equal(
    preparationVerification.schema,
    "nexus-accepted-disclosure-preparation-verification-v1",
    "preparation verification schema",
  );
  equal(
    preparationVerification.preparation.preparation_root,
    bundle.preparationRoot,
    "shared verifier must preserve preparation root",
  );
  check(
    Object.isFrozen(preparationVerification.preparation),
    "verified preparation must be immutable",
  );
  equal(
    verifyDisclosurePreparation(
      preparationVerification.preparation,
      preparationRefs,
      { resolver },
    ),
    bundle.preparationRoot,
    "accepted preparation must reverify",
  );
  const changedPreparation = clone(preparationVerification.preparation);
  changedPreparation.preparation_root = "0".repeat(64);
  expectCode(
    "ERR_VERIFIER_MUTATION",
    () => verifyDisclosurePreparation(
      changedPreparation,
      preparationRefs,
      { resolver },
    ),
    "mutated preparation must fail closed",
  );
  expectCode(
    "ERR_AUTHORITY",
    () => prepareDisclosureContent(preparationRefs, {
      resolver: Object.freeze({}),
    }),
    "unbranded resolver must fail closed",
  );

  const resolveEnvelope = (recordType, recordId, recordRoot) =>
    resolver.resolveAcceptedRecord({
      record_type: recordType,
      record_id: recordId,
      record_root: recordRoot,
    });
  const manifestEnvelope = resolveEnvelope(
    "DISCLOSURE_MANIFEST",
    bundle.disclosureManifest.record_id,
    bundle.disclosureManifest.record_root,
  );
  const manifest = manifestEnvelope.record;
  equal(
    manifestEnvelope.accepted_application_state_root,
    acceptedStateRoot,
    "accepted manifest must bind application state",
  );
  equal(
    publicSafeDisclosureManifestRoot(manifest),
    bundle.disclosureManifest.record_root,
    "public-safe manifest root",
  );
  check(
    !Object.hasOwn(manifest, "policy") &&
      !Object.hasOwn(manifest, "proof_context") &&
      !Object.hasOwn(manifest, "salt"),
    "manifest must omit private preimages",
  );
  const oldManifest = clone(manifest);
  oldManifest.schema = "nexus-disclosure-manifest-v3";
  oldManifest.policy = { legacy: true };
  expectCode(
    "ERR_SCHEMA",
    () => publicSafeDisclosureManifestRoot(oldManifest),
    "legacy manifest must be rejected",
  );

  const compilationRefs = {
    preparation_id: preparationRefs.preparation_id,
    preparation_record_root: preparationRefs.preparation_record_root,
    disclosure_manifest_id: bundle.disclosureManifest.record_id,
    disclosure_manifest_root: bundle.disclosureManifest.record_root,
    accepted_compilation_anchor_id: bundle.compilation.record_id,
    accepted_compilation_anchor_root: bundle.compilation.record_root,
  };
  const disclosure = finalizeDisclosure(compilationRefs, { resolver });
  equal(
    disclosure.schema,
    "nexus-disclosure-compilation-verification-v4",
    "compilation verification schema",
  );
  noThrow(
    () => verifyDisclosureCompilation(disclosure, {}, { resolver }),
    "accepted compilation must reverify",
  );
  const oldReceipt = clone(disclosure);
  oldReceipt.compilation_receipt.schema =
    "nexus-disclosure-compilation-receipt-v3";
  expectFailClosed(
    () => verifyDisclosureCompilation(oldReceipt, {}, { resolver }),
    "legacy compilation receipt must be rejected",
  );
  const oldCompilation = clone(disclosure);
  oldCompilation.schema = "nexus-disclosure-compilation-verification-v3";
  expectCode(
    "ERR_SCHEMA",
    () => verifyDisclosureCompilation(oldCompilation, {}, { resolver }),
    "legacy compilation wrapper must be rejected",
  );

  const compilationAnchor = resolveEnvelope(
    "DISCLOSURE_COMPILATION_ANCHOR",
    bundle.compilation.record_id,
    bundle.compilation.record_root,
  ).record;
  equal(
    disclosureCompilationAnchorV2Root(compilationAnchor),
    bundle.compilation.record_root,
    "accepted compilation anchor root",
  );
  const oldCompilationAnchor = clone(compilationAnchor);
  oldCompilationAnchor.schema =
    "nexus-accepted-disclosure-compilation-anchor-v1";
  delete oldCompilationAnchor.preparation_id;
  delete oldCompilationAnchor.preparation_record_root;
  oldCompilationAnchor.manifest_root =
    oldCompilationAnchor.disclosure_manifest_root;
  expectCode(
    "ERR_SCHEMA",
    () => disclosureCompilationAnchorV2Root(oldCompilationAnchor),
    "legacy compilation anchor must be rejected",
  );

  const capsuleBundle = createPublicCapsule(
    {
      public_capsule_id: bundle.capsule.record_id,
      public_capsule_root: bundle.capsule.record_root,
      non_claims_id: bundle.nonClaims.record_id,
      non_claims_root: bundle.nonClaims.record_root,
    },
    { resolver },
  );
  equal(
    capsuleBundle.schema,
    "nexus-accepted-public-capsule-bundle-v1",
    "accepted capsule bundle schema",
  );
  equal(
    publicCapsuleRoot(capsuleBundle.capsule),
    bundle.capsule.record_root,
    "accepted capsule root",
  );
  noThrow(
    () => validatePublicCapsuleShape(capsuleBundle.capsule),
    "accepted capsule shape",
  );
  const oldCapsule = clone(capsuleBundle.capsule);
  oldCapsule.schema = "nexus-public-capsule-v2";
  delete oldCapsule.accepted_compilation_anchor_id;
  oldCapsule.source_document_root =
    oldCapsule.accepted_compilation_anchor_root;
  expectCode(
    "ERR_SCHEMA",
    () => validatePublicCapsuleShape(oldCapsule),
    "legacy capsule must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => createPublicCapsule(
      {
        public_capsule_id: bundle.capsule.record_id,
        public_capsule_root: bundle.capsule.record_root,
        non_claims_id: bundle.nonClaims.record_id,
        non_claims_root: bundle.nonClaims.record_root,
        schema: "nexus-public-capsule-v2",
      },
      { resolver },
    ),
    "legacy capsule reference input must be rejected",
  );

  equal(
    nonClaimsRoot(capsuleBundle.non_claims),
    bundle.nonClaims.record_root,
    "accepted non-claims root",
  );
  const oldNonClaims = clone(capsuleBundle.non_claims);
  oldNonClaims.schema = "nexus-non-claims-v0";
  oldNonClaims.source_document_root =
    oldNonClaims.accepted_compilation_anchor_root;
  expectCode(
    "ERR_SCHEMA",
    () => nonClaimsRoot(oldNonClaims),
    "legacy non-claims must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => createCanonicalNonClaims("legacy-job-id"),
    "legacy non-claims constructor input must be rejected",
  );

  const intentId = bundle.publication.result.intent_id;
  const intentDigest = intentId.slice("PUBINTENT-".length);
  const publicationIntent = createPublicationIntent(
    {
      publication_intent_id: intentId,
      publication_intent_root: intentDigest,
    },
    { resolver },
  );
  equal(
    publicationIntent.schema,
    "nexus-publication-intent-v3",
    "accepted intent schema",
  );
  equal(
    publicationIntent.destination_policy,
    "GITHUB_SANITIZED_WITNESS",
    "publication destination must be fixed",
  );
  equal(
    publicationIntentRoot(publicationIntent),
    intentDigest,
    "publication intent root",
  );
  noThrow(
    () => verifyPublicationIntent(publicationIntent, {
      accepted_intent_root: intentDigest,
      expected: {},
      resolver,
    }),
    "accepted publication intent must reverify",
  );
  expectCode(
    "ERR_SCHEMA",
    () => createPublicationIntent(
      {
        publication_intent_id: intentId,
        publication_intent_root: intentDigest,
        schema: "nexus-publication-intent-v2",
      },
      { resolver },
    ),
    "legacy intent reference input must be rejected",
  );
  const oldIntent = clone(publicationIntent);
  oldIntent.schema = "nexus-publication-intent-v2";
  oldIntent.capsule_root = oldIntent.public_capsule_root;
  expectCode(
    "ERR_SCHEMA",
    () => publicationIntentRoot(oldIntent),
    "legacy intent must be rejected",
  );

  const publicationAnchor = resolveEnvelope(
    "PUBLICATION_ANCHOR",
    bundle.publicationAnchor.record_id,
    bundle.publicationAnchor.record_root,
  ).record;
  equal(
    publicationAnchorV2Root(publicationAnchor),
    bundle.publicationAnchor.record_root,
    "accepted publication anchor root",
  );
  const oldPublicationAnchor = clone(publicationAnchor);
  oldPublicationAnchor.schema = "nexus-publication-anchor-v1";
  delete oldPublicationAnchor.accepted_compilation_anchor_id;
  delete oldPublicationAnchor.accepted_compilation_anchor_root;
  oldPublicationAnchor.capsule_root =
    oldPublicationAnchor.public_capsule_root;
  expectCode(
    "ERR_SCHEMA",
    () => publicationAnchorV2Root(oldPublicationAnchor),
    "legacy publication anchor must be rejected",
  );

  const verifierInput = {
    capsule: capsuleBundle.capsule,
    disclosure,
    non_claims: capsuleBundle.non_claims,
    publication_anchor_id: bundle.publicationAnchor.record_id,
    publication_anchor_root: bundle.publicationAnchor.record_root,
    publication_intent: publicationIntent,
  };
  const verification = verifyPublicCapsule(verifierInput, { resolver });
  equal(verification.valid, true, "public capsule must verify");
  equal(
    verification.schema,
    "nexus-public-capsule-verification-v3",
    "public capsule verifier schema",
  );
  equal(
    verification.publication_anchor_root,
    bundle.publicationAnchor.record_root,
    "verifier must bind accepted publication anchor",
  );
  expectCode(
    "ERR_SCHEMA",
    () => verifyPublicCapsule(
      {
        ...verifierInput,
        policy: { legacy: true },
        proof_context: { legacy: true },
      },
      { resolver },
    ),
    "legacy verifier input must be rejected",
  );

  const routeFixture = createRouteExecutionFixture();
  const routeReference = {
    route_execution_plan_id:
      routeFixture.result.route_execution_plan_id,
    route_execution_plan_root:
      routeFixture.result.route_execution_plan_root,
  };
  const routeDecision = decideDataRoute(routeReference, {
    resolver: routeFixture.resolver,
  });
  equal(
    routeDecision.schema,
    "nexus-data-route-decision-v5",
    "route adapter must expose only the shared V5 decision",
  );
  equal(
    routeDecision.outcome,
    "ALLOW",
    "authenticated post-lease route plan must be allowed",
  );
  deepEqual(
    routeDecision,
    routeFixture.decision,
    "route adapter must return the exact shared core decision",
  );
  check(
    Object.isFrozen(routeDecision),
    "shared route decision must remain immutable",
  );
  deepEqual(
    Object.keys(routeDecision).sort(),
    [
      "decision_root",
      "derived_spend_amount",
      "derived_total_input_bytes",
      "evaluated_application_state_root",
      "evaluated_logical_tick",
      "outcome",
      "plan_created_application_state_root",
      "reason_codes",
      "route_execution_plan_id",
      "route_execution_plan_root",
      "schema",
    ].sort(),
    "route adapter must not expose accepted raw facts",
  );
  for (const rawField of [
    "checks",
    "contract",
    "lease",
    "offer",
    "payloads",
    "task",
    "tick",
    "tools",
    "worker",
  ]) {
    check(
      !Object.hasOwn(routeDecision, rawField),
      `route decision must omit raw ${rawField}`,
    );
  }

  const allTrueLegacyV4 = {
    schema: "nexus-data-route-decision-v4",
    route_execution_plan_id: routeReference.route_execution_plan_id,
    route_execution_plan_root: routeReference.route_execution_plan_root,
    checks: {
      byte_limit: true,
      capability: true,
      destination: true,
      egress: true,
      expiry: true,
      spend: true,
    },
    contract: {
      privacy: {
        remote_execution: true,
        remote_redacted_execution: true,
        remote_redaction_policy_root:
          routeFixture.result.classified_input_manifest_root,
      },
    },
    lease: { authorized: true },
    offer: { authorized: true },
    payloads: [{ classified: true }],
    task: { authorized: true },
    tick: routeFixture.acceptedContext.accepted_logical_tick,
    tools: [{ authorized: true }],
    worker: { authorized: true },
  };
  expectCode(
    "ERR_SCHEMA",
    () => decideDataRoute(allTrueLegacyV4, {
      resolver: routeFixture.resolver,
    }),
    "all-true raw V4 bypass must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => decideDataRoute(
      {
        ...routeReference,
        accepted_application_state_root:
          routeFixture.acceptedContext.accepted_application_state_root,
        accepted_logical_tick:
          routeFixture.acceptedContext.accepted_logical_tick,
      },
      { resolver: routeFixture.resolver },
    ),
    "caller-supplied application root and tick must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => decideDataRoute(
      { ...routeReference, consumed: false },
      { resolver: routeFixture.resolver },
    ),
    "caller-supplied consumption or replay state must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => decideDataRoute(
      {
        ...routeReference,
        remote_redacted_execution: true,
        remote_redaction_policy_root:
          routeFixture.result.classified_input_manifest_root,
      },
      { resolver: routeFixture.resolver },
    ),
    "caller-supplied remote-redaction booleans must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => decideDataRoute(
      {
        route_execution_plan_id:
          routeReference.route_execution_plan_id,
      },
      { resolver: routeFixture.resolver },
    ),
    "route reference with missing evidence root must be rejected",
  );
  expectCode(
    "ERR_PREDECESSOR",
    () => decideDataRoute(
      {
        ...routeReference,
        route_execution_plan_root: "0".repeat(64),
      },
      { resolver: routeFixture.resolver },
    ),
    "forged route execution plan root must be rejected",
  );
  expectCode(
    "ERR_PREDECESSOR",
    () => decideDataRoute(
      {
        ...routeReference,
        route_execution_plan_root:
          routeFixture.result.classified_input_manifest_root,
      },
      { resolver: routeFixture.resolver },
    ),
    "crossed accepted evidence root must be rejected",
  );
  expectCode(
    "ERR_AUTHORITY",
    () => decideDataRoute(routeReference, {
      resolver: Object.freeze({
        resolveAcceptedRouteContext() {
          return routeFixture.acceptedContext;
        },
      }),
    }),
    "unbranded route resolver must be rejected",
  );
  expectCode(
    "ERR_SCHEMA",
    () => decideDataRoute(routeReference, {
      resolver: routeFixture.resolver,
      checks: { capability: true },
    }),
    "extra resolver options must be rejected",
  );

  const publicationAfterRoute = verifyPublicCapsule(verifierInput, {
    resolver,
  });
  equal(
    publicationAfterRoute.valid,
    true,
    "publication must remain valid after route adapter evaluation",
  );
  equal(
    publicationAfterRoute.publication_anchor_root,
    bundle.publicationAnchor.record_root,
    "route adapter must not alter publication authority",
  );

  const outbox = createOperationalOutboxStatus(intentId);
  noThrow(
    () => assertOperationalOutboxStatus(outbox),
    "operational outbox status must validate",
  );
  const oldOutbox = clone(outbox);
  oldOutbox.schema = "nexus-github-outbox-status-v0";
  expectCode(
    "ERR_SCHEMA",
    () => assertOperationalOutboxStatus(oldOutbox),
    "legacy outbox status must be rejected",
  );

  return {
    assertions,
    accepted_state_root: acceptedStateRoot,
    publication_anchor_root: verification.publication_anchor_root,
    valid: verification.valid,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = runPrivacyGithubTests();
  console.log(
    `privacy/github: PASS (${result.assertions} assertions; root ${result.accepted_state_root}; publication ${result.publication_anchor_root})`,
  );
}
